import crypto from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@/lib/db';
import { vipApplications } from '@/lib/db/schema';
import { getIronFXAdapter } from '@/lib/ironfx';
import { ejectFromTelegram } from '@/lib/telegram/helpers';
import { cleanupRateLimits } from '@/lib/rate-limit';
import { notifyUser } from '@/lib/notify';
import VipEjectionWarningEmail from '@root/emails/vip-ejection-warning';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // 60s sur Vercel Pro

/**
 * Vérifie quotidiennement l'état des comptes IronFX des membres VIP.
 *
 * Pattern warning J-1 → éjection :
 *  - Si situation à risque détectée pour la 1ère fois → on envoie un email
 *    + telegram warning, on set `ejectionWarnedAt`, et on ne touche pas
 *    le statut. Le user a ~24h pour régulariser.
 *  - Au check suivant (J+1, le CRON passe 1x/jour), si la situation est
 *    toujours à risque ET ejectionWarnedAt set depuis > 12h → on éjecte.
 *  - Si la situation est résolue entre temps → on reset ejectionWarnedAt.
 *
 * Situations à risque :
 *   - hasWithdrawn && !cpaQualified (retrait avant qu'on touche notre CPA)
 *   - accountClosed
 *
 * À configurer dans vercel.json :
 * {
 *   "crons": [{ "path": "/api/cron/check-vip-status", "schedule": "0 6 * * *" }]
 * }
 */

const WARNING_GRACE_HOURS = 12; // Délai mini entre warning et éjection
export async function GET(request: Request) {
  // Sécurité : seul Vercel Cron ou un appelant authentifié peut hit.
  // timingSafeEqual évite les timing-attacks sur le secret.
  if (!verifyCronAuth(request.headers.get('authorization'))) {
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
    warned: 0,
    ejected: 0,
    cleared: 0,
    errors: 0,
    skipped: 0,
  };

  const warningGraceMs = WARNING_GRACE_HOURS * 60 * 60 * 1000;

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

      let riskReason: string | null = null;

      if (status.hasWithdrawn && !status.cpaQualified) {
        riskReason =
          'Tu as effectué un retrait avant que ton activité de trading ne déclenche notre commission de partenariat. Pour réintégrer le groupe : redépose des fonds et attends ta qualification.';
      } else if (status.accountClosed) {
        riskReason =
          'Ton compte broker a été clôturé. Le statut VIP requiert un compte actif. Pour réintégrer : rouvre un compte via notre lien et effectue un nouveau dépôt.';
      }

      if (riskReason) {
        const warnedAt = app.ejectionWarnedAt
          ? app.ejectionWarnedAt.getTime()
          : null;
        const enoughTimeElapsed =
          warnedAt !== null && Date.now() - warnedAt >= warningGraceMs;

        if (enoughTimeElapsed) {
          // 2e passage avec situation toujours à risque → on éjecte
          const ejection = await ejectFromTelegram(app.userId, riskReason);
          if (ejection.success) {
            results.ejected++;
          } else {
            results.errors++;
          }
        } else if (!warnedAt) {
          // 1er passage → set ejectionWarnedAt + notif. CAS pattern (WHERE
          // ejection_warned_at IS NULL) : si un autre process / webhook a
          // déjà set le warning entre la lecture et l'update, l'UPDATE ne
          // touche rien et on skip la notif (évite les doublons d'email).
          const claimed = await db
            .update(vipApplications)
            .set({ ejectionWarnedAt: new Date(), updatedAt: new Date() })
            .where(
              and(
                eq(vipApplications.id, app.id),
                isNull(vipApplications.ejectionWarnedAt)
              )
            )
            .returning({ id: vipApplications.id });

          if (claimed.length === 0) {
            results.skipped++;
            continue;
          }

          const firstName =
            app.user.telegramFirstName ?? app.user.name ?? '';
          await notifyUser(app.user, {
            email: {
              subject:
                '⚠️ Action requise — risque d\'éjection du groupe VIP',
              react: VipEjectionWarningEmail({
                firstName,
                reason: riskReason,
              }),
            },
            telegram:
              `🚨 <b>ALERTE — Risque d'éjection</b>\n\n` +
              `On a détecté une situation à risque sur ton compte :\n` +
              `<i>${escapeHtml(riskReason)}</i>\n\n` +
              `<b>Tu as ~24h pour régulariser</b> avant éjection automatique.\n` +
              `Contacte-nous vite : https://t.me/boursi_support`,
          });

          results.warned++;
        } else {
          // Warning déjà set mais grace pas écoulée → on attend le prochain CRON
          results.skipped++;
        }
      } else {
        // Situation OK : si on avait un warning actif, on le clear
        if (app.ejectionWarnedAt) {
          await db
            .update(vipApplications)
            .set({ ejectionWarnedAt: null, updatedAt: new Date() })
            .where(eq(vipApplications.id, app.id));
          results.cleared++;
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

        // Bonus XP "VIP sécurisé" (CPA qualifié) — idempotent
        const { awardMilestoneOnce } = await import('@/lib/games/xp');
        await awardMilestoneOnce(app.userId, 'vip_secured', {
          source: 'cron_check_vip_status',
          applicationId: app.id,
        });
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

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Compare le header Authorization avec `Bearer ${CRON_SECRET}` en temps
 * constant. Évite les timing-attacks où un attaquant pourrait deviner le
 * secret octet par octet en mesurant la latence des comparaisons `!==`.
 */
function verifyCronAuth(authHeader: string | null): boolean {
  if (!authHeader) return false;
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(authHeader);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
