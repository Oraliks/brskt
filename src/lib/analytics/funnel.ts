/**
 * Émission d'événements funnel pour tracking fin du parcours VIP.
 *
 * Double-écriture :
 *  - Table `funnel_events` (Postgres) — source de vérité, exploitable en SQL
 *  - PostHog server-side — visualisation funnels + cohortes + A/B
 *
 * Best-effort : si l'un des deux échoue, on log mais ne throw pas (le tracking
 * ne doit jamais casser un flow business).
 */

import { db } from '@/lib/db';
import { funnelEvents } from '@/lib/db/schema';
import { captureServerEvent } from './posthog-server';

export type FunnelEventName =
  // Affiliate link
  | 'vip_link_generated'
  | 'vip_link_clicked'
  // Wizard
  | 'vip_funnel_started'
  | 'vip_broker_submitted'
  | 'vip_signup_validated'
  | 'vip_deposit_submitted'
  | 'vip_deposit_validated'
  | 'vip_invite_requested'
  | 'vip_joined_group'
  // Terminal
  | 'vip_ejected'
  | 'vip_qualified'
  // Bot
  | 'bot_started'
  | 'bot_deeplink'
  // Formation
  | 'formation_booking_created'
  | 'formation_payment_completed'
  // Automations
  | 'testimonial_asked';

export async function emitFunnelEvent(opts: {
  /** UUID de l'utilisateur (null si anonyme). */
  userId?: string | null;
  /** Identifiant de session — peut être userId pour les events authentifiés. */
  sessionId: string;
  eventName: FunnelEventName;
  metadata?: Record<string, unknown> | null;
}): Promise<void> {
  // 1) DB (source de vérité)
  try {
    await db.insert(funnelEvents).values({
      userId: opts.userId ?? null,
      sessionId: opts.sessionId,
      eventName: opts.eventName,
      metadata: opts.metadata ?? null,
    });
  } catch (err) {
    console.error('[funnel] DB emit failed', {
      eventName: opts.eventName,
      userId: opts.userId,
      err,
    });
  }

  // 2) PostHog (no-throw, no-await — fire & forget)
  captureServerEvent({
    distinctId: opts.userId ?? opts.sessionId,
    event: opts.eventName,
    properties: {
      ...(opts.metadata ?? {}),
      $set_once: opts.userId
        ? { first_seen_user_id: opts.userId }
        : undefined,
    },
  });
}
