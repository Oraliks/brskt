import crypto from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  gameWheelSpins,
  promoCodes,
  users,
} from '@/lib/db/schema';
import { addXp } from './xp';

/**
 * Cooldown entre 2 spins de la roue = 7 jours pleins. Mesuré côté serveur,
 * pas côté client (sinon trivial à bypass).
 */
export const WHEEL_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Segments de la roue. Probabilités cumulatives doivent atteindre 100.
 *
 * Les XP sont prioritaires (haute fréquence, faible valeur) et les promos
 * sont rares (créent un effet "wow"). On n'inclut PAS de segment "rien" :
 * la roue garantit toujours quelque chose, sinon ça frustre.
 *
 * Pour ajouter/modifier : conserver la somme = 100 et trier par probabilité
 * décroissante (cosmetic, le tirage est uniforme sur [0, 100)).
 */
export interface WheelSegment {
  /** Probabilité en %. Total = 100. */
  weight: number;
  rewardType: 'xp' | 'promo';
  /** XP amount ou % de réduction. */
  value: number;
  /** Label humain affiché à la victoire. */
  label: string;
}

export const WHEEL_SEGMENTS: WheelSegment[] = [
  { weight: 30, rewardType: 'xp', value: 50, label: '+50 XP' },
  { weight: 25, rewardType: 'xp', value: 100, label: '+100 XP' },
  { weight: 20, rewardType: 'xp', value: 200, label: '+200 XP' },
  { weight: 12, rewardType: 'xp', value: 500, label: '+500 XP' },
  { weight: 8, rewardType: 'promo', value: 5, label: 'Code -5% formation' },
  { weight: 4, rewardType: 'promo', value: 10, label: 'Code -10% formation' },
  { weight: 1, rewardType: 'xp', value: 1000, label: '🎉 JACKPOT +1000 XP' },
];

export interface WheelStatus {
  canSpin: boolean;
  nextSpinAt: Date | null;
  lastSpunAt: Date | null;
}

/**
 * Renvoie si l'user peut spinner aujourd'hui et si non, quand il pourra.
 *
 * Tolérant à l'absence de la colonne `last_wheel_spun_at` (migration 0019
 * pas encore appliquée) : on renvoie "peut spinner" plutôt que de planter
 * la page.
 */
export async function getWheelStatus(userId: string): Promise<WheelStatus> {
  let last: Date | null = null;
  try {
    const [u] = await db
      .select({ last: users.lastWheelSpunAt })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    last = u?.last ?? null;
  } catch (err) {
    console.warn('[wheel] getWheelStatus fallback (migration?)', err);
    return { canSpin: true, nextSpinAt: null, lastSpunAt: null };
  }

  if (!last) {
    return { canSpin: true, nextSpinAt: null, lastSpunAt: null };
  }

  const now = Date.now();
  const elapsed = now - last.getTime();
  if (elapsed >= WHEEL_COOLDOWN_MS) {
    return { canSpin: true, nextSpinAt: null, lastSpunAt: last };
  }
  return {
    canSpin: false,
    nextSpinAt: new Date(last.getTime() + WHEEL_COOLDOWN_MS),
    lastSpunAt: last,
  };
}

export type SpinResult =
  | {
      ok: true;
      segment: WheelSegment;
      segmentIndex: number;
      promoCode?: string;
      newXpTotal: number;
    }
  | { ok: false; error: 'cooldown'; nextSpinAt: Date }
  | { ok: false; error: 'unknown' };

/**
 * Fait spinner la roue pour un user. Atomique côté logique : on update
 * `lastWheelSpunAt` AVANT de calculer la récompense pour éviter qu'un
 * double-click rapide en parallèle déclenche 2 spins.
 *
 *  - XP : ajouté immédiatement à users.xpTotal + log xp_events
 *  - Promo : génère un code unique single-use lié au user (notes = userId)
 *    inséré dans promo_codes. Le code est de la forme `ROUE-<XXXXX>`.
 */
export async function spinWheel(userId: string): Promise<SpinResult> {
  // Recheck eligibility + bump atomique. Si lastWheelSpunAt est < cooldown,
  // l'UPDATE n'updatera rien (where clause) et on saura via affected rows.
  const cooldownAgo = new Date(Date.now() - WHEEL_COOLDOWN_MS);
  const [bumped] = await db
    .update(users)
    .set({ lastWheelSpunAt: new Date(), updatedAt: new Date() })
    .where(
      sql`${users.id} = ${userId} AND (${users.lastWheelSpunAt} IS NULL OR ${users.lastWheelSpunAt} <= ${cooldownAgo})`
    )
    .returning({ id: users.id, last: users.lastWheelSpunAt });

  if (!bumped) {
    const status = await getWheelStatus(userId);
    return {
      ok: false,
      error: 'cooldown',
      nextSpinAt: status.nextSpinAt ?? new Date(Date.now() + WHEEL_COOLDOWN_MS),
    };
  }

  const { segment, index } = pickSegment();

  let promoCodeStr: string | undefined;
  if (segment.rewardType === 'promo') {
    promoCodeStr = `ROUE-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    await db.insert(promoCodes).values({
      code: promoCodeStr,
      discountType: 'percent',
      discountValue: String(segment.value),
      maxUses: 1,
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      notes: `Roue de la fortune · user ${userId}`,
      active: true,
    });
  }

  let newXpTotal = 0;
  if (segment.rewardType === 'xp') {
    newXpTotal = await addXp({
      userId,
      amount: segment.value,
      reason: 'wheel_spin',
      metadata: { segmentIndex: index, label: segment.label },
    });
  } else {
    // Pour les promos on log juste un xp_event "0" pour traçabilité.
    // (Pas d'XP attribué.)
    const [u] = await db
      .select({ xp: users.xpTotal })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    newXpTotal = u?.xp ?? 0;
  }

  await db.insert(gameWheelSpins).values({
    userId,
    rewardType: segment.rewardType,
    rewardValue:
      segment.rewardType === 'promo' ? promoCodeStr ?? null : String(segment.value),
    rewardLabel: segment.label,
  });

  return {
    ok: true,
    segment,
    segmentIndex: index,
    promoCode: promoCodeStr,
    newXpTotal,
  };
}

/**
 * Tirage pondéré uniformément sur les segments. Renvoie l'index pour que
 * l'UI puisse animer la rotation jusqu'au bon emplacement.
 */
function pickSegment(): { segment: WheelSegment; index: number } {
  const total = WHEEL_SEGMENTS.reduce((s, seg) => s + seg.weight, 0);
  const r = Math.random() * total;
  let acc = 0;
  for (let i = 0; i < WHEEL_SEGMENTS.length; i++) {
    const seg = WHEEL_SEGMENTS[i];
    if (!seg) continue;
    acc += seg.weight;
    if (r < acc) return { segment: seg, index: i };
  }
  // Fallback (ne devrait jamais arriver — WHEEL_SEGMENTS est non vide)
  const fallback = WHEEL_SEGMENTS[0] ?? {
    weight: 100,
    rewardType: 'xp' as const,
    value: 50,
    label: '+50 XP',
  };
  return { segment: fallback, index: 0 };
}
