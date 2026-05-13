'use server';

import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { bookings, payments } from '@/lib/db/schema';
import { requireOnboarded } from '@/lib/auth/server';
import { getPaymentProvider } from '@/lib/payments';
import { createPaymentSchema } from '@/lib/validations';
import type { ActionResult } from './bookings';

export async function createPaymentAction(
  input: unknown
): Promise<ActionResult<{ redirectUrl: string }>> {
  const session = await requireOnboarded();
  const parsed = createPaymentSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: 'Données invalides',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const booking = await db.query.bookings.findFirst({
    where: eq(bookings.id, parsed.data.bookingId),
    with: { formation: true },
  });

  if (!booking || booking.userId !== session.user.id) {
    return { success: false, error: 'Réservation introuvable' };
  }

  // Le checkout sert à reprendre un paiement abandonné.
  if (booking.status !== 'pending_payment') {
    return {
      success: false,
      error: "Cette réservation n'est pas en attente de paiement",
    };
  }

  const amount = Number(booking.formation.priceEur);
  const provider = getPaymentProvider(parsed.data.method);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  try {
    const sessionInfo = await provider.createSession({
      userId: session.user.id,
      bookingId: booking.id,
      amount,
      currency: 'EUR',
      metadata: {
        formationMode: booking.formation.mode,
        formationTitle: booking.formation.title,
      },
      returnUrl: `${appUrl}/dashboard?paid=${booking.id}`,
      cancelUrl: `${appUrl}/checkout/${booking.id}?cancelled=1`,
    });

    // Persister la tentative
    await db.insert(payments).values({
      userId: session.user.id,
      bookingId: booking.id,
      amountEur: String(amount),
      method: parsed.data.method,
      provider: provider.name,
      providerSessionId: sessionInfo.sessionId,
      status: 'pending',
    });

    await db
      .update(bookings)
      .set({ status: 'pending_payment', updatedAt: new Date() })
      .where(eq(bookings.id, booking.id));

    if (!sessionInfo.redirectUrl) {
      return {
        success: false,
        error: 'Le provider de paiement n’a pas retourné de redirection',
      };
    }

    return {
      success: true,
      data: { redirectUrl: sessionInfo.redirectUrl },
    };
  } catch (err) {
    console.error('[payments] createSession error', err);
    return {
      success: false,
      error: 'Le paiement n’a pas pu être initialisé. Réessaie ou choisis un autre mode.',
    };
  }
}
