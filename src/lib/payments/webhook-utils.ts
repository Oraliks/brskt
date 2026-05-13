import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { webhookEvents } from '@/lib/db/schema';

/**
 * Vérifie si un événement a déjà été traité (idempotence).
 * Retourne true si on doit ignorer l'event (déjà traité).
 */
export async function isEventProcessed(
  provider: string,
  providerEventId: string
): Promise<boolean> {
  const existing = await db.query.webhookEvents.findFirst({
    where: and(
      eq(webhookEvents.provider, provider),
      eq(webhookEvents.providerEventId, providerEventId)
    ),
  });

  return !!existing?.processedAt;
}

/**
 * Enregistre l'event et retourne l'ID. Si déjà existant, retourne l'existant.
 */
export async function recordEvent(
  provider: string,
  providerEventId: string,
  payload: unknown
): Promise<string> {
  const existing = await db.query.webhookEvents.findFirst({
    where: and(
      eq(webhookEvents.provider, provider),
      eq(webhookEvents.providerEventId, providerEventId)
    ),
  });

  if (existing) return existing.id;

  const [inserted] = await db
    .insert(webhookEvents)
    .values({
      provider,
      providerEventId,
      payload: payload as Record<string, unknown>,
    })
    .returning();

  if (!inserted) throw new Error('Failed to insert webhook event');
  return inserted.id;
}

export async function markEventProcessed(eventDbId: string): Promise<void> {
  await db
    .update(webhookEvents)
    .set({ processedAt: new Date() })
    .where(eq(webhookEvents.id, eventDbId));
}

export async function markEventError(
  eventDbId: string,
  error: string
): Promise<void> {
  await db
    .update(webhookEvents)
    .set({ error })
    .where(eq(webhookEvents.id, eventDbId));
}
