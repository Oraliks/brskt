import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { vipApplications } from '@/lib/db/schema';
import { emitFunnelEvent } from '@/lib/analytics/funnel';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Endpoint de redirect pour le lien d'affiliation IronFX.
 *
 * Au lieu de pointer le user directement vers `ironfx.com?sub_id=xxx`,
 * on passe par `/api/affiliate-redirect?ref=xxx` qui :
 *  1. Émet un event `vip_link_clicked` (lifecycle funnel)
 *  2. Met à jour `vip_applications.step` à 'clicked' (si encore 'link_generated')
 *  3. 302 redirect vers IronFX avec le sub_id
 *
 * Permet de mesurer le "clic vers le broker" — étape critique du funnel
 * qu'on perdait sans tracking.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const ref = url.searchParams.get('ref');

  // Construit l'URL IronFX finale (même logique que startVipFunnelAction)
  const baseLink =
    process.env.IRONFX_AFFILIATE_BASE_LINK ?? 'https://ironfx.com/?ref=';
  const subIdParam = process.env.IRONFX_AFFILIATE_SUBID_PARAM ?? 'sub_id';

  if (!ref) {
    // Pas de ref — redirige juste vers IronFX (cas anormal)
    return Response.redirect(baseLink, 302);
  }

  // Track l'event (best-effort, ne bloque pas le redirect)
  try {
    const app = await db.query.vipApplications.findFirst({
      where: eq(vipApplications.affiliateRef, ref),
    });
    if (app) {
      await emitFunnelEvent({
        userId: app.userId,
        sessionId: app.userId,
        eventName: 'vip_link_clicked',
        metadata: { affiliateRef: ref, applicationId: app.id },
      });

      // Met à jour step si encore au stade initial (clicked existait dans
      // l'enum mais n'était jamais émis — on le code maintenant).
      if (app.step === 'link_generated') {
        await db
          .update(vipApplications)
          .set({
            step: 'clicked',
            currentStepEnteredAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(vipApplications.id, app.id));
      }
    }
  } catch (err) {
    console.error('[affiliate-redirect] tracking failed', err);
  }

  // Redirige vers IronFX avec le sub_id
  const separator = baseLink.includes('?') ? '&' : '?';
  const target = `${baseLink}${separator}${subIdParam}=${encodeURIComponent(ref)}`;
  return Response.redirect(target, 302);
}
