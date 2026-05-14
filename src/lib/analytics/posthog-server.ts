/**
 * PostHog côté serveur. On charge le client lazy pour éviter une dépendance
 * au cold start si POSTHOG_KEY n'est pas configuré.
 *
 * Best-effort : toutes les méthodes loggent en cas d'échec mais ne throwent
 * jamais (l'analytics ne doit pas casser un flow business).
 */

import { PostHog } from 'posthog-node';

let client: PostHog | null = null;
let initialized = false;

function getClient(): PostHog | null {
  if (initialized) return client;
  initialized = true;

  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://eu.i.posthog.com';

  if (!key) {
    return null;
  }

  client = new PostHog(key, {
    host,
    // Flush rapide côté serveur — on n'a pas de session client persistante
    flushAt: 1,
    flushInterval: 0,
  });

  return client;
}

export interface CaptureOpts {
  distinctId: string;
  event: string;
  properties?: Record<string, unknown>;
}

export function captureServerEvent(opts: CaptureOpts): void {
  const c = getClient();
  if (!c) return;
  try {
    c.capture({
      distinctId: opts.distinctId,
      event: opts.event,
      properties: opts.properties,
    });
  } catch (err) {
    console.error('[posthog-server] capture failed', { event: opts.event, err });
  }
}

export function identifyUser(opts: {
  distinctId: string;
  properties?: Record<string, unknown>;
}): void {
  const c = getClient();
  if (!c) return;
  try {
    c.identify({
      distinctId: opts.distinctId,
      properties: opts.properties,
    });
  } catch (err) {
    console.error('[posthog-server] identify failed', err);
  }
}

/**
 * À appeler depuis un context Next.js avec `after()` pour ne pas bloquer
 * la réponse. Flush forcé qui attend la confirmation des events envoyés.
 */
export async function flushPostHog(): Promise<void> {
  const c = getClient();
  if (!c) return;
  try {
    await c.shutdown();
    // Reset pour le prochain coldstart Vercel — sinon le client est dead
    client = null;
    initialized = false;
  } catch (err) {
    console.error('[posthog-server] flush failed', err);
  }
}
