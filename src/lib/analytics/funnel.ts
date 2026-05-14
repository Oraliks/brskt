/**
 * Émission d'événements funnel pour tracking fin du parcours VIP.
 *
 * La table funnel_events existait mais était vide jusqu'ici. On l'alimente
 * maintenant à chaque action clé pour pouvoir mesurer :
 *  - Drop-off entre étapes
 *  - Time-to-conversion par cohorte
 *  - A/B tester des variations (via metadata)
 *
 * Best-effort : si l'insert échoue, on log mais ne throw pas (le tracking
 * ne doit jamais casser un flow business).
 */

import { db } from '@/lib/db';
import { funnelEvents } from '@/lib/db/schema';

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
  | 'formation_payment_completed';

export async function emitFunnelEvent(opts: {
  /** UUID de l'utilisateur (null si anonyme). */
  userId?: string | null;
  /** Identifiant de session — peut être userId pour les events authentifiés. */
  sessionId: string;
  eventName: FunnelEventName;
  metadata?: Record<string, unknown> | null;
}): Promise<void> {
  try {
    await db.insert(funnelEvents).values({
      userId: opts.userId ?? null,
      sessionId: opts.sessionId,
      eventName: opts.eventName,
      metadata: opts.metadata ?? null,
    });
  } catch (err) {
    console.error('[funnel] emit failed', {
      eventName: opts.eventName,
      userId: opts.userId,
      err,
    });
  }
}
