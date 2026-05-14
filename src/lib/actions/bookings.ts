'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { db } from '@/lib/db';
import {
  adminNotifications,
  bookings,
  formations,
  payments,
} from '@/lib/db/schema';
import { requireOnboarded } from '@/lib/auth/server';
import { ADMIN_EMAIL, sendEmail } from '@/lib/email';
import { notifyUser } from '@/lib/notify';
import BookingReceivedEmail from '@root/emails/booking-received';
import AdminNotificationEmail from '@root/emails/admin-notification';
import { getPaymentProvider } from '@/lib/payments';
import { checkRateLimit } from '@/lib/rate-limit';
import {
  bookingFormSchema,
  respondProposedDateSchema,
  type BookingFormInput,
} from '@/lib/validations';

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

/**
 * Crée une réservation ET lance immédiatement le paiement.
 * Le user paie AVANT que l'admin valide la date — évite les changements d'avis.
 *
 * Flow :
 *   1. Booking inséré avec status `pending_payment`
 *   2. Session de paiement créée chez le provider
 *   3. On retourne l'URL de redirection → user paie chez le provider
 *   4. Webhook paiement → status passe à `pending_admin` (date à valider par admin)
 *   5. Admin confirme ou propose une autre date
 *   6. Si admin propose : user accepte ou refuse via accept/reject actions
 */
export async function createBookingAction(
  input: BookingFormInput
): Promise<ActionResult<{ bookingId: string; redirectUrl: string }>> {
  const session = await requireOnboarded();

  // Rate limit : 5 créations / 10 min par user. Évite le spam de bookings
  // jamais payés (qui polluent la DB et créent des sessions payment chez
  // les providers).
  const rl = await checkRateLimit({
    key: `booking:user:${session.user.id}`,
    limit: 5,
    windowSec: 600,
  });
  if (!rl.allowed) {
    return {
      success: false,
      error: `Trop de tentatives. Réessaye dans ${Math.ceil(rl.resetIn / 60)} min.`,
    };
  }

  const parsed = bookingFormSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: 'Données invalides',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const formation = await db.query.formations.findFirst({
    where: eq(formations.id, parsed.data.formationId),
  });

  if (!formation || !formation.active) {
    return { success: false, error: 'Formation introuvable' };
  }

  // 1. Booking — payment plan détermine installmentTotal
  const installmentTotal = parsed.data.paymentPlan === 'installments_3x' ? 3 : 1;
  const [booking] = await db
    .insert(bookings)
    .values({
      userId: session.user.id,
      formationId: formation.id,
      preferredDates: parsed.data.preferredDates,
      preferredAsap: parsed.data.preferredAsap,
      status: 'pending_payment',
      paymentPlan: parsed.data.paymentPlan,
      installmentTotal,
      installmentsPaid: 0,
    })
    .returning();

  if (!booking) {
    return { success: false, error: 'Erreur lors de la création' };
  }

  // 2. Session de paiement
  let provider;
  try {
    provider = getPaymentProvider(parsed.data.paymentMethod);
  } catch (err) {
    console.error('[booking] payment provider error', err);
    return {
      success: false,
      error: `Le moyen de paiement "${parsed.data.paymentMethod}" n'est pas encore configuré. Contacte l'équipe.`,
    };
  }

  const fullPrice = Number(formation.priceEur);
  // Montant de la PREMIÈRE échéance — en 3x, c'est 1/3, sinon le total
  // (arrondi au centime près pour éviter les écarts d'arrondi : la dernière
  // échéance absorbe le résidu côté requestNextInstallmentAction).
  const amount =
    installmentTotal === 1
      ? fullPrice
      : Math.round((fullPrice / installmentTotal) * 100) / 100;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  let paymentSession;
  try {
    paymentSession = await provider.createSession({
      userId: session.user.id,
      bookingId: booking.id,
      amount,
      currency: 'EUR',
      metadata: {
        formationMode: formation.mode,
        formationTitle: formation.title,
        installmentIndex: '1',
        installmentTotal: String(installmentTotal),
      },
      returnUrl: `${appUrl}/dashboard?booked=${booking.id}`,
      cancelUrl: `${appUrl}/checkout/${booking.id}?cancelled=1`,
    });
  } catch (err) {
    console.error('[booking] payment session error', err);
    return {
      success: false,
      error: "Impossible d'initialiser le paiement. Réessaie ou contacte l'équipe.",
    };
  }

  // 3. Persister le payment
  const [payment] = await db
    .insert(payments)
    .values({
      userId: session.user.id,
      bookingId: booking.id,
      amountEur: String(amount),
      method: parsed.data.paymentMethod,
      provider: provider.name,
      providerSessionId: paymentSession.sessionId,
      status: 'pending',
    })
    .returning();

  if (payment) {
    await db
      .update(bookings)
      .set({ paymentId: payment.id, updatedAt: new Date() })
      .where(eq(bookings.id, booking.id));
  }

  if (!paymentSession.redirectUrl) {
    return {
      success: false,
      error: 'Le provider de paiement n\'a pas retourné de redirection',
    };
  }

  // 4. Notif admin + email user (async)
  after(async () => {
    await db.insert(adminNotifications).values({
      type: 'new_booking',
      payload: {
        bookingId: booking.id,
        userId: session.user.id,
        formationId: formation.id,
        amount,
      },
    });

    await notifyUser(session.user, {
      email: {
        subject: `On a reçu ta demande — ${formation.title}`,
        react: BookingReceivedEmail({
          firstName:
            session.user.telegramFirstName ?? session.user.name ?? '',
          formationTitle: formation.title,
          bookingId: booking.id,
        }),
      },
      telegram:
        `📝 <b>Réservation reçue</b>\n\n` +
        `<b>${formation.title}</b>\n` +
        `Montant : ${amount}€\n\n` +
        `Une fois ton paiement reçu, on validera ta date sous 24h.`,
    });

    await sendEmail({
      to: ADMIN_EMAIL,
      subject: `[Boursikotons] Nouvelle réservation — ${formation.title}`,
      react: AdminNotificationEmail({
        type: 'new_booking',
        summary: `${session.user.name} a réservé "${formation.title}" (${amount}€). En attente du paiement.`,
        link: `${appUrl}/admin/bookings#${booking.id}`,
      }),
    });
  });

  revalidatePath('/dashboard');

  return {
    success: true,
    data: { bookingId: booking.id, redirectUrl: paymentSession.redirectUrl },
  };
}

// ============================================================
// Réponse user à la contre-proposition admin
// ============================================================

export async function respondToProposedDateAction(
  input: unknown
): Promise<ActionResult> {
  const session = await requireOnboarded();
  const parsed = respondProposedDateSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: 'Données invalides' };
  }

  const booking = await db.query.bookings.findFirst({
    where: eq(bookings.id, parsed.data.bookingId),
    with: { formation: true },
  });

  if (!booking || booking.userId !== session.user.id) {
    return { success: false, error: 'Réservation introuvable' };
  }

  if (booking.status !== 'date_proposed') {
    return {
      success: false,
      error: 'Aucune contre-proposition à traiter sur cette réservation',
    };
  }

  if (parsed.data.action === 'accept') {
    if (!booking.adminProposedDate) {
      return { success: false, error: 'Aucune date proposée par l\'admin' };
    }
    await db
      .update(bookings)
      .set({
        confirmedDate: booking.adminProposedDate,
        status: 'confirmed',
        updatedAt: new Date(),
      })
      .where(eq(bookings.id, booking.id));

    after(async () => {
      await db.insert(adminNotifications).values({
        type: 'booking_counter_accepted',
        payload: {
          bookingId: booking.id,
          userId: session.user.id,
          confirmedDate: booking.adminProposedDate,
        },
      });
    });
  } else {
    // Refus : on annule la réservation. Remboursement à faire manuellement.
    await db
      .update(bookings)
      .set({
        status: 'cancelled',
        adminNotes: parsed.data.reason
          ? `User a refusé la contre-proposition : ${parsed.data.reason}`
          : `User a refusé la contre-proposition`,
        updatedAt: new Date(),
      })
      .where(eq(bookings.id, booking.id));

    after(async () => {
      await db.insert(adminNotifications).values({
        type: 'booking_counter_rejected_refund_needed',
        payload: {
          bookingId: booking.id,
          userId: session.user.id,
          paymentId: booking.paymentId,
          reason: parsed.data.reason ?? null,
        },
      });
    });
  }

  revalidatePath('/dashboard');
  revalidatePath('/admin/bookings');
  return { success: true, data: undefined };
}

// ============================================================
// Échéances suivantes pour paiement en 3x
// ============================================================

/**
 * Crée une session de paiement pour la PROCHAINE échéance d'un booking en 3x.
 * Le user appelle cette action depuis son dashboard quand il veut régler
 * l'échéance 2 ou 3 d'un booking où `installments_paid < installment_total`.
 *
 * Règles :
 *  - Booking doit appartenir à l'user
 *  - paymentPlan doit être 'installments_3x'
 *  - installments_paid doit être < installment_total
 *  - Aucune session pending sur l'échéance courante (sinon on retourne
 *    l'URL existante via getPaymentSession)
 *
 * La dernière échéance absorbe le résidu d'arrondi pour que le user ait
 * payé exactement le prix total à la fin.
 */
export async function requestNextInstallmentAction(input: {
  bookingId: string;
  paymentMethod: 'card' | 'paypal' | 'crypto';
}): Promise<ActionResult<{ redirectUrl: string; installmentIndex: number }>> {
  const session = await requireOnboarded();

  // Rate limit doux : 5 / 10 min par user
  const rl = await checkRateLimit({
    key: `next_installment:user:${session.user.id}`,
    limit: 5,
    windowSec: 600,
  });
  if (!rl.allowed) {
    return {
      success: false,
      error: `Trop de tentatives. Réessaye dans ${Math.ceil(rl.resetIn / 60)} min.`,
    };
  }

  const booking = await db.query.bookings.findFirst({
    where: eq(bookings.id, input.bookingId),
    with: { formation: true },
  });

  if (!booking || booking.userId !== session.user.id) {
    return { success: false, error: 'Réservation introuvable' };
  }

  if (booking.paymentPlan !== 'installments_3x') {
    return {
      success: false,
      error: "Cette réservation n'est pas en paiement échelonné",
    };
  }

  if (booking.installmentsPaid >= booking.installmentTotal) {
    return {
      success: false,
      error: 'Toutes les échéances ont déjà été réglées',
    };
  }

  const fullPrice = Number(booking.formation.priceEur);
  const perInstallment =
    Math.round((fullPrice / booking.installmentTotal) * 100) / 100;
  const nextIndex = booking.installmentsPaid + 1; // 2 ou 3
  // Dernière échéance : on absorbe le résidu pour que total payé = fullPrice
  const isLast = nextIndex === booking.installmentTotal;
  const amount = isLast
    ? Math.round(
        (fullPrice - perInstallment * (booking.installmentTotal - 1)) * 100
      ) / 100
    : perInstallment;

  let provider;
  try {
    provider = getPaymentProvider(input.paymentMethod);
  } catch (err) {
    console.error('[next-installment] payment provider error', err);
    return {
      success: false,
      error: `Le moyen de paiement "${input.paymentMethod}" n'est pas encore configuré.`,
    };
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  let paymentSession;
  try {
    paymentSession = await provider.createSession({
      userId: session.user.id,
      bookingId: booking.id,
      amount,
      currency: 'EUR',
      metadata: {
        formationMode: booking.formation.mode,
        formationTitle: booking.formation.title,
        installmentIndex: String(nextIndex),
        installmentTotal: String(booking.installmentTotal),
      },
      returnUrl: `${appUrl}/dashboard?paid=${booking.id}`,
      cancelUrl: `${appUrl}/checkout/${booking.id}?cancelled=1`,
    });
  } catch (err) {
    console.error('[next-installment] payment session error', err);
    return {
      success: false,
      error: "Impossible d'initialiser le paiement. Contacte l'équipe.",
    };
  }

  await db.insert(payments).values({
    userId: session.user.id,
    bookingId: booking.id,
    amountEur: String(amount),
    method: input.paymentMethod,
    provider: provider.name,
    providerSessionId: paymentSession.sessionId,
    status: 'pending',
  });

  if (!paymentSession.redirectUrl) {
    return {
      success: false,
      error: "Le provider de paiement n'a pas retourné de redirection",
    };
  }

  return {
    success: true,
    data: {
      redirectUrl: paymentSession.redirectUrl,
      installmentIndex: nextIndex,
    },
  };
}
