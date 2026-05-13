'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { requireAuth } from '@/lib/auth/server';
import { onboardingSchema } from '@/lib/validations';
import { notifyUser } from '@/lib/notify';
import WelcomeEmail from '@root/emails/welcome';
import type { ActionResult } from './bookings';

export async function completeOnboardingAction(
  input: unknown
): Promise<ActionResult> {
  const session = await requireAuth();
  const parsed = onboardingSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: 'Données invalides',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  // Vérifier que l'email n'est pas déjà pris par un autre compte
  const existing = await db.query.users.findFirst({
    where: eq(users.email, parsed.data.email),
  });

  if (existing && existing.id !== session.user.id) {
    return {
      success: false,
      error: 'Cet email est déjà associé à un autre compte',
    };
  }

  await db
    .update(users)
    .set({
      email: parsed.data.email,
      name: parsed.data.firstName,
      telegramFirstName: parsed.data.firstName,
      onboardingCompletedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(users.id, session.user.id));

  revalidatePath('/dashboard');
  revalidatePath('/vip');

  // Welcome notif (best-effort, non bloquant)
  after(() => {
    const botUsername = process.env.TELEGRAM_BOT_USERNAME;
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ?? 'https://boursikotons.com';

    return notifyUser(
      {
        email: parsed.data.email,
        telegramId: session.user.telegramId ?? null,
      },
      {
        email: {
          subject: 'Bienvenue chez Boursikotons',
          react: WelcomeEmail({
            firstName: parsed.data.firstName,
            botUsername: botUsername ?? undefined,
          }),
        },
        telegram:
          `👋 <b>Bienvenue ${escapeHtml(parsed.data.firstName)} !</b>\n\n` +
          `Ton compte Boursikotons est prêt. Tu peux :\n\n` +
          `• 📚 Réserver une formation trading\n` +
          `• 💎 Démarrer le funnel VIP (gratuit — payé en commission par le broker, pas par toi)\n\n` +
          `Mon espace : ${appUrl}/dashboard`,
      }
    );
  });

  return { success: true, data: undefined };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
