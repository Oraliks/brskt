import { eq } from 'drizzle-orm';
import { after } from 'next/server';
import { db } from '@/lib/db';
import { bookings, payments } from '@/lib/db/schema';
import { notifyUser } from '@/lib/notify';
import { completePaidVipAccess } from '@/lib/vip-paid-access';
import PaymentReceiptEmail from '@root/emails/payment-receipt';
import { getProviderByName } from './index';
import type { ParsedWebhookEvent } from './types';
import {
  isEventProcessed,
  markEventError,
  markEventProcessed,
  recordEvent,
} from './webhook-utils';

/**
 * Workflow commun aux 3 providers de paiement :
 *   1. Vérifie la signature
 *   2. Parse l'event
 *   3. Idempotence
 *   4. Met à jour payment + booking
 *   5. Si succès, déclenche les tâches post-paiement (emails) via after()
 */
export async function handlePaymentWebhook(
  providerName: 'paddle' | 'paypal' | 'nowpayments',
  request: Request
): Promise<Response> {
  const provider = getProviderByName(providerName);
  if (!provider) {
    return Response.json({ error: 'Unknown provider' }, { status: 400 });
  }

  // Lire le RAW body — indispensable pour la vérification de signature
  const rawBody = await request.text();
  const headersObj: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headersObj[key.toLowerCase()] = value;
  });

  // 1) Signature
  const valid = await provider.verifyWebhookSignature(headersObj, rawBody);
  if (!valid) {
    console.warn(`[${providerName}] invalid signature`);
    return Response.json({ error: 'invalid_signature' }, { status: 401 });
  }

  // 2) Parse
  let event: ParsedWebhookEvent;
  try {
    event = await provider.parseWebhookEvent(rawBody);
  } catch (err) {
    console.error(`[${providerName}] parse error`, err);
    return Response.json({ error: 'parse_failed' }, { status: 400 });
  }

  // 3) Idempotence
  if (await isEventProcessed(providerName, event.providerEventId)) {
    return Response.json({ ok: true, duplicated: true });
  }

  const eventDbId = await recordEvent(
    providerName,
    event.providerEventId,
    JSON.parse(rawBody)
  );

  // 4) Mise à jour DB
  try {
    await processPaymentEvent(providerName, event);
    await markEventProcessed(eventDbId);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`[${providerName}] processing error`, err);
    await markEventError(eventDbId, errMsg);
    return Response.json({ error: 'processing_failed' }, { status: 500 });
  }

  // 5) Tâches asynchrones (emails, notifs)
  after(async () => {
    if (event.status === 'completed') {
      await sendPaymentReceipt(event.providerSessionId);
    }
  });

  return Response.json({ ok: true });
}

async function sendPaymentReceipt(providerSessionId: string) {
  const payment = await db.query.payments.findFirst({
    where: eq(payments.providerSessionId, providerSessionId),
    with: { user: true, booking: { with: { formation: true } } },
  });

  if (!payment?.user || !payment.booking) return;

  const firstName =
    payment.user.telegramFirstName ?? payment.user.name ?? '';
  const amount = Number(payment.amountEur);

  await notifyUser(payment.user, {
    email: {
      subject: `Paiement confirmé — ${payment.booking.formation.title}`,
      react: PaymentReceiptEmail({
        firstName,
        formationTitle: payment.booking.formation.title,
        amount,
        currency: 'EUR',
        paymentMethod: payment.method,
        paymentId: payment.id,
      }),
    },
    telegram:
      `✅ <b>Paiement confirmé</b>\n\n` +
      `<b>${payment.booking.formation.title}</b>\n` +
      `Montant : ${amount}€\n\n` +
      `On valide ta date sous 24h et on te prévient ici.`,
  });
}

async function processPaymentEvent(
  providerName: string,
  event: ParsedWebhookEvent
) {
  // Trouver le payment correspondant
  const payment = await db.query.payments.findFirst({
    where: eq(payments.providerSessionId, event.providerSessionId),
  });

  if (!payment) {
    throw new Error(
      `Payment not found for session ${event.providerSessionId}`
    );
  }

  // Skip si déjà completed et qu'on reçoit un pending tardif
  if (payment.status === 'completed' && event.status === 'pending') {
    return;
  }

  await db
    .update(payments)
    .set({
      status: event.status,
      providerPaymentId: event.providerPaymentId,
      completedAt: event.status === 'completed' ? new Date() : undefined,
    })
    .where(eq(payments.id, payment.id));

  // Détecte le type de paiement via la metadata. Si c'est un accès VIP
  // payant et que le paiement est completed → déclenche le flow auto :
  // génère un invite link Telegram + DM l'user.
  const meta = payment.metadata as
    | { kind?: string; vipPaidAccessId?: string }
    | null;
  if (
    meta?.kind === 'vip_paid_access' &&
    meta.vipPaidAccessId &&
    event.status === 'completed'
  ) {
    try {
      await completePaidVipAccess(meta.vipPaidAccessId);
    } catch (err) {
      console.error('[vip-paid] completePaidVipAccess failed', err);
    }
    return;
  }

  // Mettre à jour le booking lié
  // Flow paiement en 1 fois : completed → pending_admin (admin valide la date)
  // Flow paiement en 3x : completed → incrément installmentsPaid, le booking
  //   ne passe à `pending_admin` que quand TOUTES les échéances sont payées.
  //   La formation ne peut donc avoir lieu qu'après paiement total.
  if (payment.bookingId) {
    if (event.status === 'completed') {
      const booking = await db.query.bookings.findFirst({
        where: eq(bookings.id, payment.bookingId),
      });
      if (!booking) {
        console.warn(
          `[${providerName}] booking ${payment.bookingId} not found for completed payment`
        );
        return;
      }

      const newInstallmentsPaid = booking.installmentsPaid + 1;
      const allPaid = newInstallmentsPaid >= booking.installmentTotal;

      await db
        .update(bookings)
        .set({
          installmentsPaid: newInstallmentsPaid,
          // Passe à pending_admin SEULEMENT si toutes les échéances reçues.
          // Sinon on reste en pending_payment en attendant la suite.
          status: allPaid ? 'pending_admin' : 'pending_payment',
          updatedAt: new Date(),
        })
        .where(eq(bookings.id, booking.id));
    } else if (event.status === 'failed') {
      // En 3x, l'échec d'une échéance NON-1 ne cancel pas le booking
      // (l'user peut retenter). On cancel uniquement si c'est la 1ère
      // (installmentsPaid === 0, car le webhook n'incrémente que sur completed).
      const booking = await db.query.bookings.findFirst({
        where: eq(bookings.id, payment.bookingId),
      });
      if (booking && booking.installmentsPaid === 0) {
        await db
          .update(bookings)
          .set({ status: 'cancelled', updatedAt: new Date() })
          .where(eq(bookings.id, payment.bookingId));
      }
      // Sinon : l'user peut retenter l'échéance via requestNextInstallmentAction
    }
  }
}
