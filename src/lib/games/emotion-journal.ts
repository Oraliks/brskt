import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { emotionJournalEntries } from '@/lib/db/schema';
import { getParisDate } from './markets';
import { addXp } from './xp';

/** XP gagné par entrée quotidienne. */
export const EMOTION_XP_PER_ENTRY = 20;

/** Bonus aux milestones de streak. */
export const EMOTION_STREAK_BONUSES: Record<number, number> = {
  7: 75,
  30: 250,
  90: 750,
  180: 2000,
};

export interface EmotionEntry {
  id: string;
  entryDate: string;
  mood: number;
  note: string | null;
  createdAt: Date;
}

export type SubmitEmotionResult =
  | {
      ok: true;
      created: boolean;
      xpAwarded: number;
      bonusAwarded: number;
      newStreak: number;
      newTotal: number;
    }
  | { ok: false; error: 'invalid_mood' | 'unknown' };

/**
 * Crée ou met à jour l'entrée du jour. Idempotent : si l'user a déjà
 * une entrée aujourd'hui, on update juste mood/note (pas de double XP).
 *
 * Calcul streak : nombre de jours consécutifs avec une entrée. Reset si
 * un jour est sauté. Bonus XP aux milestones 7/30/90/180.
 */
export async function submitEmotionEntry(
  userId: string,
  mood: number,
  note: string | null
): Promise<SubmitEmotionResult> {
  if (!Number.isFinite(mood) || mood < 1 || mood > 10) {
    return { ok: false, error: 'invalid_mood' };
  }
  const today = getParisDate();
  const trimmedNote = note?.trim() ? note.trim().slice(0, 500) : null;

  try {
    // Check si entrée existe déjà aujourd'hui
    const [existing] = await db
      .select()
      .from(emotionJournalEntries)
      .where(
        and(
          eq(emotionJournalEntries.userId, userId),
          eq(emotionJournalEntries.entryDate, today)
        )
      )
      .limit(1);

    if (existing) {
      // Update — pas de XP/streak (déjà attribué le 1er submit du jour)
      await db
        .update(emotionJournalEntries)
        .set({ mood, note: trimmedNote, updatedAt: new Date() })
        .where(eq(emotionJournalEntries.id, existing.id));

      const currentStreak = await computeStreak(userId);
      return {
        ok: true,
        created: false,
        xpAwarded: 0,
        bonusAwarded: 0,
        newStreak: currentStreak,
        newTotal: 0,
      };
    }

    // Crée la nouvelle entrée
    await db.insert(emotionJournalEntries).values({
      userId,
      entryDate: today,
      mood,
      note: trimmedNote,
    });

    // XP de base
    let total = await addXp({
      userId,
      amount: EMOTION_XP_PER_ENTRY,
      reason: 'wheel_spin', // pas d'enum dédié pour le journal — on tag via metadata
      metadata: { source: 'emotion_journal', mood, date: today },
    });

    // Recalcule le streak après ajout
    const newStreak = await computeStreak(userId);

    // Milestone bonus
    let bonus = 0;
    const milestone = EMOTION_STREAK_BONUSES[newStreak];
    if (milestone) {
      bonus = milestone;
      total = await addXp({
        userId,
        amount: milestone,
        reason: 'wheel_spin',
        metadata: {
          source: 'emotion_journal_streak',
          milestone: newStreak,
        },
      });
    }

    return {
      ok: true,
      created: true,
      xpAwarded: EMOTION_XP_PER_ENTRY,
      bonusAwarded: bonus,
      newStreak,
      newTotal: total,
    };
  } catch (err) {
    console.warn('[emotion] submit failed', err);
    return { ok: false, error: 'unknown' };
  }
}

/**
 * Compte les jours consécutifs avec une entrée jusqu'à aujourd'hui.
 *
 * Algo simple : on récupère les dates d'entrée triées desc, on itère
 * en partant d'aujourd'hui et on compte tant que dateN === dateN-1 + 1.
 */
async function computeStreak(userId: string): Promise<number> {
  const today = getParisDate();
  const rows = await db
    .select({ d: emotionJournalEntries.entryDate })
    .from(emotionJournalEntries)
    .where(eq(emotionJournalEntries.userId, userId))
    .orderBy(desc(emotionJournalEntries.entryDate))
    .limit(400); // ~14 mois

  const dates = new Set(rows.map((r) => r.d));
  let streak = 0;
  const cursor = new Date(today + 'T12:00:00Z');
  // Itère jour par jour en arrière
  // Tolère le cas où aujourd'hui pas encore d'entrée mais hier oui (streak compté avec dernière entrée)
  while (true) {
    const dateStr = cursor.toISOString().slice(0, 10);
    if (!dates.has(dateStr)) {
      // Si c'est aujourd'hui et pas d'entrée, on peut tolérer (l'user va l'ajouter)
      // Sinon, streak interrompu.
      if (streak === 0 && dateStr === today) {
        cursor.setUTCDate(cursor.getUTCDate() - 1);
        continue;
      }
      break;
    }
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
    if (streak > 365) break; // safety
  }
  return streak;
}

/**
 * Historique des N dernières entrées (récent en premier).
 */
export async function getEmotionHistory(
  userId: string,
  limit = 30
): Promise<EmotionEntry[]> {
  try {
    return await db
      .select({
        id: emotionJournalEntries.id,
        entryDate: emotionJournalEntries.entryDate,
        mood: emotionJournalEntries.mood,
        note: emotionJournalEntries.note,
        createdAt: emotionJournalEntries.createdAt,
      })
      .from(emotionJournalEntries)
      .where(eq(emotionJournalEntries.userId, userId))
      .orderBy(desc(emotionJournalEntries.entryDate))
      .limit(limit);
  } catch {
    return [];
  }
}

/**
 * Stats agrégées : moyenne mood, total entries, streak actuel.
 */
export async function getEmotionStats(userId: string): Promise<{
  totalEntries: number;
  averageMood: number;
  currentStreak: number;
  todayMood: number | null;
}> {
  try {
    const today = getParisDate();
    const [stats] = await db
      .select({
        total: sql<number>`count(*)::int`,
        avg: sql<number>`coalesce(avg(mood), 0)::numeric`,
      })
      .from(emotionJournalEntries)
      .where(eq(emotionJournalEntries.userId, userId));

    const [todayRow] = await db
      .select({ mood: emotionJournalEntries.mood })
      .from(emotionJournalEntries)
      .where(
        and(
          eq(emotionJournalEntries.userId, userId),
          eq(emotionJournalEntries.entryDate, today)
        )
      )
      .limit(1);

    const currentStreak = await computeStreak(userId);

    return {
      totalEntries: stats?.total ?? 0,
      averageMood: Number(stats?.avg ?? 0),
      currentStreak,
      todayMood: todayRow?.mood ?? null,
    };
  } catch {
    return {
      totalEntries: 0,
      averageMood: 0,
      currentStreak: 0,
      todayMood: null,
    };
  }
}
