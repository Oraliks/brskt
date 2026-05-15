/**
 * Validation et application des codes promo au checkout.
 *
 * Best-effort fail-closed : si quoi que ce soit échoue, on refuse le code
 * (pas de réduction à l'aveugle).
 */

import { eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { bookingPromoCodes, promoCodes } from '@/lib/db/schema';

export type PromoValidationError =
  | 'not_found'
  | 'inactive'
  | 'not_yet_valid'
  | 'expired'
  | 'max_uses_reached'
  | 'wrong_mode';

export interface PromoValidationOk {
  valid: true;
  promoId: string;
  code: string;
  /** Type de discount. */
  type: 'percent' | 'fixed';
  /** Valeur brute du discount (% ou €). */
  value: number;
  /** Montant en € à déduire sur le total. Toujours <= total. */
  discountEur: number;
  /** Total après réduction. Garanti >= 0. */
  totalAfterEur: number;
}

export interface PromoValidationKo {
  valid: false;
  reason: PromoValidationError;
}

/**
 * Valide un code promo pour une formation donnée et calcule le discount.
 * Ne modifie rien en DB — appelle `applyPromoToBooking` après création du
 * booking pour persister le lien.
 */
export async function validatePromoCode(
  rawCode: string,
  formationMode: 'remote' | 'onsite',
  priceEur: number
): Promise<PromoValidationOk | PromoValidationKo> {
  const code = rawCode.trim().toUpperCase();
  if (!code) return { valid: false, reason: 'not_found' };

  const promo = await db.query.promoCodes.findFirst({
    where: eq(promoCodes.code, code),
  });
  if (!promo) return { valid: false, reason: 'not_found' };
  if (!promo.active) return { valid: false, reason: 'inactive' };

  const now = new Date();
  if (promo.validFrom && now < promo.validFrom) {
    return { valid: false, reason: 'not_yet_valid' };
  }
  if (promo.validUntil && now > promo.validUntil) {
    return { valid: false, reason: 'expired' };
  }
  if (
    promo.maxUses !== null &&
    promo.maxUses !== undefined &&
    promo.usedCount >= promo.maxUses
  ) {
    return { valid: false, reason: 'max_uses_reached' };
  }
  if (
    promo.applicableMode &&
    promo.applicableMode !== formationMode
  ) {
    return { valid: false, reason: 'wrong_mode' };
  }

  const value = Number(promo.discountValue);
  const discountRaw =
    promo.discountType === 'percent' ? (priceEur * value) / 100 : value;
  const discountEur = Math.min(Math.max(0, Math.round(discountRaw * 100) / 100), priceEur);
  const totalAfterEur = Math.max(0, priceEur - discountEur);

  return {
    valid: true,
    promoId: promo.id,
    code: promo.code,
    type: promo.discountType,
    value,
    discountEur,
    totalAfterEur,
  };
}

/**
 * Persiste l'usage d'un code sur un booking (atomique) :
 *  - INSERT booking_promo_codes
 *  - increment promo_codes.usedCount
 */
export async function applyPromoToBooking(opts: {
  bookingId: string;
  promoId: string;
  discountEur: number;
}): Promise<void> {
  await db.insert(bookingPromoCodes).values({
    bookingId: opts.bookingId,
    promoCodeId: opts.promoId,
    appliedDiscountEur: String(opts.discountEur),
  });
  await db
    .update(promoCodes)
    .set({
      usedCount: sql`${promoCodes.usedCount} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(promoCodes.id, opts.promoId));
}
