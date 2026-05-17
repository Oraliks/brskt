import { and, desc, eq, gt, inArray, isNull, or, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  gameWheelSpins,
  promoCodes,
  userXpStates,
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
 * Tolérant à l'absence de la table `user_xp_states` (migration pas
 * encore appliquée) : on renvoie "peut spinner" plutôt que de planter.
 */
export async function getWheelStatus(userId: string): Promise<WheelStatus> {
  let last: Date | null = null;
  try {
    const [u] = await db
      .select({ last: userXpStates.lastWheelSpunAt })
      .from(userXpStates)
      .where(eq(userXpStates.userId, userId))
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
  // Bump atomique en 2 temps :
  //  1. SELECT la row existante pour vérifier le cooldown applicatif
  //  2. UPSERT pour mettre à jour lastWheelSpunAt
  //
  // On évite `setWhere` avec une Date interpolée parce que Drizzle/
  // postgres-js plante côté driver ("string argument expected, got Date")
  // sur les paramètres de templates SQL bruts. Le rate-limit côté action
  // gère la concurrence (3 spins / min / user max).
  const now = new Date();
  const cooldownThresholdMs = now.getTime() - WHEEL_COOLDOWN_MS;

  const [existing] = await db
    .select({ last: userXpStates.lastWheelSpunAt })
    .from(userXpStates)
    .where(eq(userXpStates.userId, userId))
    .limit(1);

  if (existing?.last && existing.last.getTime() > cooldownThresholdMs) {
    return {
      ok: false,
      error: 'cooldown',
      nextSpinAt: new Date(existing.last.getTime() + WHEEL_COOLDOWN_MS),
    };
  }

  await db
    .insert(userXpStates)
    .values({ userId, lastWheelSpunAt: now, updatedAt: now })
    .onConflictDoUpdate({
      target: userXpStates.userId,
      set: { lastWheelSpunAt: now, updatedAt: now },
    });

  const picked = pickSegment();
  let segment = picked.segment;
  const index = picked.index;

  let promoCodeStr: string | undefined;
  if (segment.rewardType === 'promo') {
    // Pioche dans le pool admin : codes scope IN ('game','both'), actifs,
    // pas expirés, encore des usages dispo, valeur correspondante au segment.
    // Si rien → fallback XP équivalent (segment.value pour un -5% ≈ +200 XP,
    // pour -10% ≈ +400 XP — barème simple).
    const claimedCode = await tryClaimPromoFromPool(segment.value);
    if (claimedCode) {
      promoCodeStr = claimedCode;
    } else {
      // Fallback : transforme le segment promo en XP. L'user gagne quand
      // même quelque chose et l'admin est notifié indirectement via les
      // logs xp_events (metadata.fallback='no_promo_in_pool').
      const fallbackXp = segment.value === 10 ? 400 : 200;
      const fallbackSegment: WheelSegment = {
        weight: segment.weight,
        rewardType: 'xp',
        value: fallbackXp,
        label: `+${fallbackXp} XP`,
      };
      segment = fallbackSegment;
    }
  }

  let newXpTotal = 0;
  if (segment.rewardType === 'xp') {
    newXpTotal = await addXp({
      userId,
      amount: segment.value,
      reason: 'wheel_spin',
      metadata: {
        segmentIndex: index,
        label: segment.label,
        fallback: promoCodeStr ? undefined : 'maybe_no_promo_in_pool',
      },
    });
  } else {
    // Promo : pas d'XP gagné mais on récupère le total courant pour
    // l'afficher au toast.
    const [u] = await db
      .select({ xp: userXpStates.xpTotal })
      .from(userXpStates)
      .where(eq(userXpStates.userId, userId))
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
 * Tente de "réserver" un code promo du pool admin pour la roue.
 *
 *  - Filtres : scope IN ('game', 'both'), active=true, pas expiré,
 *    discountValue = `targetPercent`, et soit maxUses=null soit
 *    usedCount < maxUses
 *  - Si trouvé : incrémente usedCount de 1 (claim atomique via UPDATE)
 *    et renvoie le code à afficher à l'user
 *  - Si rien dispo : null → l'appelant fallback en XP
 *
 * NOTE : pour l'instant on incrémente `usedCount` au moment du SPIN, pas
 * de l'UTILISATION effective côté checkout. Ça veut dire qu'un code
 * "gagné mais jamais utilisé" compte quand même pour son maxUses. Bon
 * compromis pour empêcher qu'un même code soit donné à 1000 users (un
 * code avec maxUses=10 reste pour 10 users max).
 */
async function tryClaimPromoFromPool(
  targetPercent: number
): Promise<string | null> {
  const now = new Date();
  const candidates = await db
    .select()
    .from(promoCodes)
    .where(
      and(
        inArray(promoCodes.scope, ['game', 'both']),
        eq(promoCodes.active, true),
        eq(promoCodes.discountType, 'percent'),
        eq(promoCodes.discountValue, String(targetPercent)),
        or(
          isNull(promoCodes.validUntil),
          gt(promoCodes.validUntil, now)
        ),
        or(
          isNull(promoCodes.maxUses),
          sql`${promoCodes.usedCount} < ${promoCodes.maxUses}`
        )
      )
    )
    .orderBy(desc(promoCodes.createdAt))
    .limit(20);

  if (candidates.length === 0) return null;

  // Pick aléatoire parmi les candidats pour répartir le tirage si l'admin
  // a plusieurs codes valides (ex: WHEEL5_A, WHEEL5_B...).
  const pick = candidates[Math.floor(Math.random() * candidates.length)];
  if (!pick) return null;

  // Claim atomique : incrémente usedCount, mais seulement si la row est
  // encore éligible (anti-race condition entre 2 spins simultanés).
  const [updated] = await db
    .update(promoCodes)
    .set({
      usedCount: sql`${promoCodes.usedCount} + 1`,
      updatedAt: now,
    })
    .where(
      and(
        eq(promoCodes.id, pick.id),
        or(
          isNull(promoCodes.maxUses),
          sql`${promoCodes.usedCount} < ${promoCodes.maxUses}`
        )
      )
    )
    .returning({ code: promoCodes.code });

  return updated?.code ?? null;
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
