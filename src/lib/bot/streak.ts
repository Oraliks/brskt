import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';

/**
 * Met à jour le streak bot d'un user (à appeler sur chaque interaction).
 *
 * Règle :
 *  - Si dernière interaction dans les 24h précédentes → pas de change
 *  - Si dernière interaction entre 24h et 48h → +1 au streak
 *  - Si dernière interaction > 48h → reset à 1
 *  - Si jamais d'interaction → set à 1
 *
 * Best-effort : log mais ne throw pas (le tracking ne doit pas casser
 * une commande bot).
 *
 * @returns le nouveau streak count (0 si erreur ou user non trouvé)
 */
export async function bumpBotStreak(telegramId: number): Promise<number> {
  try {
    const user = await db.query.users.findFirst({
      where: eq(users.telegramId, telegramId),
    });
    if (!user) return 0;

    const now = new Date();
    const last = user.botLastInteractionAt;
    const hoursSince = last
      ? (now.getTime() - last.getTime()) / (1000 * 60 * 60)
      : Infinity;

    let newStreak: number;
    if (!last) {
      newStreak = 1;
    } else if (hoursSince < 24) {
      // Déjà compté aujourd'hui — on ne touche pas au compteur
      // mais on met à jour lastInteractionAt
      newStreak = user.botStreakCount;
    } else if (hoursSince < 48) {
      // Bonne fenêtre : +1
      newStreak = user.botStreakCount + 1;
    } else {
      // Trop tard, reset
      newStreak = 1;
    }

    await db
      .update(users)
      .set({
        botStreakCount: newStreak,
        botLastInteractionAt: now,
        updatedAt: now,
      })
      .where(eq(users.id, user.id));

    return newStreak;
  } catch (err) {
    console.warn('[bot] bumpBotStreak failed', err);
    return 0;
  }
}
