'use server';

import { sql } from 'drizzle-orm';
import { headers } from 'next/headers';
import { db } from '@/lib/db';
import { formationWaitlist } from '@/lib/db/schema';
import { getSession } from '@/lib/auth/server';
import { checkRateLimit } from '@/lib/rate-limit';
import { formationWaitlistSchema } from '@/lib/validations';
import { emitFunnelEvent } from '@/lib/analytics/funnel';
import { logger } from '@/lib/logger';
import type { ActionResult } from './bookings';

/**
 * Inscription à la liste d'attente d'une formation présentielle/distance.
 *
 * Idempotent : si l'email est déjà sur la waitlist pour ce mode, on ne crée
 * pas de doublon (index unique mode+email) — on renvoie quand même success
 * pour ne pas leak l'info "cet email existe".
 *
 * Rate-limit : 3 tentatives / 10min par IP, pour éviter les bots.
 */
export async function joinWaitlistAction(
  input: unknown
): Promise<ActionResult> {
  const parsed = formationWaitlistSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: 'Données invalides',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const hdrs = await headers();
  const ip =
    hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const rl = await checkRateLimit({
    key: `waitlist:${ip}`,
    limit: 3,
    windowSec: 600,
  });
  if (!rl.allowed) {
    return {
      success: false,
      error: 'Trop de tentatives. Réessaye dans quelques minutes.',
    };
  }

  // Si user connecté, on enrichit avec son telegram_id (utile pour notif bot
  // quand un créneau s'ouvre)
  const session = await getSession().catch(() => null);
  const telegramId = session?.user?.telegramId ?? null;

  try {
    await db
      .insert(formationWaitlist)
      .values({
        mode: parsed.data.mode,
        email: parsed.data.email.toLowerCase(),
        firstName: parsed.data.firstName ?? null,
        telegramId,
        notes: parsed.data.notes ?? null,
      })
      .onConflictDoUpdate({
        target: [formationWaitlist.mode, formationWaitlist.email],
        // Refresh notes/firstName si re-inscription (mais conserve created_at)
        set: {
          firstName: sql`coalesce(${formationWaitlist.firstName}, excluded.first_name)`,
          notes: sql`coalesce(excluded.notes, ${formationWaitlist.notes})`,
          telegramId: sql`coalesce(${formationWaitlist.telegramId}, excluded.telegram_id)`,
        },
      });

    await emitFunnelEvent({
      userId: session?.user?.id ?? null,
      sessionId: session?.user?.id ?? ip,
      eventName: 'formation_booking_created',
      metadata: {
        source: 'waitlist',
        mode: parsed.data.mode,
      },
    });

    return { success: true, data: undefined };
  } catch (err) {
    logger.error('[waitlist] insert failed', err, {
      mode: parsed.data.mode,
    });
    return {
      success: false,
      error: 'Erreur serveur, réessaye dans un instant.',
    };
  }
}
