/**
 * Gestion des codes de parrainage utilisateur.
 *
 * Le code est généré paresseusement : à la première fois qu'on a besoin
 * de l'afficher (dashboard, commande /invite). On stocke en DB pour rester
 * stable entre sessions et permettre le tracking via `/start ref_<code>`.
 */

import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';

/**
 * Renvoie le code parrain du user, en le générant si absent.
 * Idempotent : appels concurrents pourraient créer 2 codes mais on a un index
 * unique sur `referral_code` qui rejettera le second.
 */
export async function ensureReferralCode(userId: string): Promise<string> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { referralCode: true },
  });

  if (user?.referralCode) return user.referralCode;

  const code = nanoid(8);
  try {
    await db
      .update(users)
      .set({ referralCode: code, updatedAt: new Date() })
      .where(eq(users.id, userId));
    return code;
  } catch {
    // Si conflit (race condition rarissime), relire la valeur
    const refresh = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { referralCode: true },
    });
    return refresh?.referralCode ?? code;
  }
}

export function buildReferralLink(
  botUsername: string | undefined,
  appUrl: string | undefined,
  code: string
): string {
  // Préférence : deeplink Telegram bot (track natif côté bot)
  if (botUsername) {
    return `https://t.me/${botUsername}?start=ref_${code}`;
  }
  // Fallback : redirect side via /?ref=<code> qui set un cookie puis /login
  const base = appUrl ?? 'https://boursikotons.com';
  return `${base}/?ref=${code}`;
}
