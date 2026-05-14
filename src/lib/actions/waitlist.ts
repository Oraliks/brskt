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

/**
 * Variante pour les utilisateurs déjà authentifiés (formulaire /formation/reserver).
 * Pas besoin de demander email/prénom — on prend ceux de la session. Le telegramId
 * est aussi capturé pour permettre la notification via le bot quand un créneau s'ouvre.
 */
export async function joinWaitlistAuthAction(input: {
  mode: 'remote' | 'onsite';
  notes?: string;
}): Promise<ActionResult> {
  const session = await getSession().catch(() => null);
  if (!session?.user?.email) {
    return { success: false, error: 'Connecte-toi pour rejoindre la waitlist.' };
  }

  if (input.mode !== 'remote' && input.mode !== 'onsite') {
    return { success: false, error: 'Mode invalide' };
  }

  const notes = (input.notes ?? '').trim().slice(0, 500) || null;

  try {
    await db
      .insert(formationWaitlist)
      .values({
        mode: input.mode,
        email: session.user.email.toLowerCase(),
        firstName:
          session.user.telegramFirstName ?? session.user.name ?? null,
        telegramId: session.user.telegramId ?? null,
        notes,
      })
      .onConflictDoUpdate({
        target: [formationWaitlist.mode, formationWaitlist.email],
        set: {
          firstName: sql`coalesce(${formationWaitlist.firstName}, excluded.first_name)`,
          notes: sql`coalesce(excluded.notes, ${formationWaitlist.notes})`,
          telegramId: sql`coalesce(${formationWaitlist.telegramId}, excluded.telegram_id)`,
        },
      });

    await emitFunnelEvent({
      userId: session.user.id,
      sessionId: session.user.id,
      eventName: 'formation_booking_created',
      metadata: { source: 'waitlist_auth', mode: input.mode },
    });

    return { success: true, data: undefined };
  } catch (err) {
    logger.error('[waitlist] auth insert failed', err, { mode: input.mode });
    return {
      success: false,
      error: 'Erreur serveur, réessaye dans un instant.',
    };
  }
}
