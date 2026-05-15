'use server';

import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { bookings } from '@/lib/db/schema';
import { requireOnboarded } from '@/lib/auth/server';
import { checkRateLimit } from '@/lib/rate-limit';
import { validatePromoCode } from '@/lib/promos';
import type { ActionResult } from './bookings';

/**
 * Valide un code promo pour un booking donné (au moment du checkout).
 *
 * Le user doit être authentifié et propriétaire du booking. Rate-limit
 * 10 tentatives / 10 min par user pour éviter le bruteforce de codes.
 *
 * Renvoie : { discountEur, totalAfterEur } ou erreur lisible.
 * Ne persiste rien : le binding effectif booking ↔ promo se fait au
 * webhook payment confirmé.
 */
export async function validatePromoForBookingAction(input: {
  bookingId: string;
  code: string;
}): Promise<
  ActionResult<{
    code: string;
    type: 'percent' | 'fixed';
    discountEur: number;
    totalAfterEur: number;
  }>
> {
  const session = await requireOnboarded();

  const rl = await checkRateLimit({
    key: `promo_validate:user:${session.user.id}`,
    limit: 10,
    windowSec: 600,
  });
  if (!rl.allowed) {
    return {
      success: false,
      error: 'Trop de tentatives, réessaye dans quelques minutes.',
    };
  }

  const booking = await db.query.bookings.findFirst({
    where: eq(bookings.id, input.bookingId),
    with: { formation: true },
  });
  if (!booking || booking.userId !== session.user.id) {
    return { success: false, error: 'Réservation introuvable' };
  }

  const priceEur = Number(booking.formation.priceEur);
  const result = await validatePromoCode(
    input.code,
    booking.formation.mode,
    priceEur
  );

  if (!result.valid) {
    const messages = {
      not_found: 'Code inconnu.',
      inactive: 'Code désactivé.',
      not_yet_valid: "Ce code n'est pas encore actif.",
      expired: 'Code expiré.',
      max_uses_reached: 'Ce code a atteint sa limite d\'utilisations.',
      wrong_mode: "Code non valable pour ce format de formation.",
    };
    return { success: false, error: messages[result.reason] };
  }

  return {
    success: true,
    data: {
      code: result.code,
      type: result.type,
      discountEur: result.discountEur,
      totalAfterEur: result.totalAfterEur,
    },
  };
}
