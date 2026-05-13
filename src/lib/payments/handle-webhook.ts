import { eq } from 'drizzle-orm';
import { after } from 'next/server';
import { db } from '@/lib/db';
import { bookings, payments } from '@/lib/db/schema';
import { sendEmail } from '@/lib/email';
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

  if (!payment?.user?.email || !payment.booking) return;

  await sendEmail({
    to: payment.user.email,
    subject: `Paiement confirmé — ${payment.booking.formation.title}`,
    react: PaymentReceiptEmail({
      firstName: payment.user.telegramFirstName ?? payment.user.name ?? '',
      formationTitle: payment.booking.formation.title,
      amount: Number(payment.amountEur),
      currency: 'EUR',
      paymentMethod: payment.method,
      paymentId: payment.id,
    }),
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

  // Mettre à jour le booking lié
  if (payment.bookingId) {
    if (event.status === 'completed') {
      await db
        .update(bookings)
        .set({ status: 'paid', updatedAt: new Date() })
        .where(eq(bookings.id, payment.bookingId));
    } else if (event.status === 'failed') {
      await db
        .update(bookings)
        .set({ status: 'confirmed', updatedAt: new Date() })
        .where(eq(bookings.id, payment.bookingId));
    }
  }
}
