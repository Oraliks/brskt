import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { vipApplications } from '@/lib/db/schema';
import { getIronFXAdapter } from '@/lib/ironfx';
import { ejectFromTelegram } from '@/lib/telegram/helpers';
import { cleanupRateLimits } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // 60s sur Vercel Pro

/**
 * Vérifie quotidiennement l'état des comptes IronFX des membres VIP.
 *
 * Règles d'éjection :
 *   - hasWithdrawn && !cpaQualified → éjection (le client a retiré avant qu'on touche notre CPA)
 *   - accountClosed → éjection
 *
 * À configurer dans vercel.json :
 * {
 *   "crons": [{ "path": "/api/cron/check-vip-status", "schedule": "0 6 * * *" }]
 * }
 */
export async function GET(request: Request) {
  // Sécurité : seul Vercel Cron ou un appelant authentifié peut hit
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  const adapter = await getIronFXAdapter();

  // Récupère tous les users actuellement in_group
  const inGroupApps = await db.query.vipApplications.findMany({
    where: eq(vipApplications.step, 'in_group'),
    with: { user: true },
  });

  const results = {
    checked: 0,
    ejected: 0,
    errors: 0,
    skipped: 0,
  };

  for (const app of inGroupApps) {
    if (!app.brokerAccountId) {
      results.skipped++;
      continue;
    }

    results.checked++;

    try {
      const status = await adapter.getClientStatus(app.brokerAccountId);
      if (!status) {
        results.skipped++;
        continue;
      }

      let ejectionReason: string | null = null;

      if (status.hasWithdrawn && !status.cpaQualified) {
        ejectionReason =
          'Tu as effectué un retrait avant que ton activité de trading ne déclenche notre commission de partenariat. Pour réintégrer le groupe : redépose des fonds et attends ta qualification.';
      } else if (status.accountClosed) {
        ejectionReason =
          'Ton compte broker a été clôturé. Le statut VIP requiert un compte actif. Pour réintégrer : rouvre un compte via notre lien et effectue un nouveau dépôt.';
      }

      if (ejectionReason) {
        const ejection = await ejectFromTelegram(app.userId, ejectionReason);
        if (ejection.success) {
          results.ejected++;
        } else {
          results.errors++;
        }
      }

      // Sync les flags CPA
      if (status.cpaQualified && !app.cpaQualified) {
        await db
          .update(vipApplications)
          .set({
            cpaQualified: true,
            cpaQualifiedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(vipApplications.id, app.id));
      }
    } catch (err) {
      console.error(`[CRON] Error for app ${app.id}`, err);
      results.errors++;
    }
  }

  // Cleanup des vieilles entrées rate_limits (best-effort)
  let rateLimitsDeleted = 0;
  try {
    rateLimitsDeleted = await cleanupRateLimits();
  } catch (err) {
    console.error('[CRON] cleanupRateLimits failed', err);
  }

  return Response.json({
    success: true,
    timestamp: new Date().toISOString(),
    mode: adapter.mode,
    results,
    rateLimitsDeleted,
  });
}
