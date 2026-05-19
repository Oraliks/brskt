import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { manualIronfxStatus, vipApplications } from '@/lib/db/schema';
import { getSession } from '@/lib/auth/server';
import { Section, SectionHeader } from '@/components/shared/section';
import { VipLanding } from '@/components/vip/vip-landing';
import { VipWizard } from '@/components/vip/vip-wizard';
import { WelcomeBonusBanner } from '@/components/vip/welcome-bonus-banner';
import { VipPathChoice } from '@/components/vip/vip-path-choice';
import { VipPaidAccessSummary } from '@/components/vip/vip-paid-access-summary';
import { VipSwitchToDirectBanner } from '@/components/vip/vip-switch-to-direct-banner';
import { getWelcomeBonus } from '@/lib/settings/welcome-bonus';
import { getVipPaidAccessConfig } from '@/lib/settings/vip-paid-access';
import { getActivePaidAccess } from '@/lib/vip-paid-access';
import { getIronFXMode } from '@/lib/ironfx';

export const dynamic = 'force-dynamic';

export default async function VipPage({
  searchParams,
}: {
  searchParams: Promise<{ path?: string; paid?: string }>;
}) {
  const params = await searchParams;
  const session = await getSession().catch(() => null);

  if (!session?.user) {
    // On lit la config pour exposer l'option d'accès direct sur la landing
    // publique (sinon les visiteurs non loggés ne savent pas qu'elle existe).
    const cfg = await getVipPaidAccessConfig().catch(() => ({
      enabled: true,
      priceEur: 250,
    }));
    return (
      <VipLanding paidPriceEur={cfg.priceEur} paidEnabled={cfg.enabled} />
    );
  }

  if (!session.user.email || !session.user.onboardingCompletedAt) {
    return (
      <Section className="pt-32 pb-32">
        <SectionHeader
          eyebrow="VIP Telegram"
          title="Finalise ton onboarding"
          description="On a besoin de ton email avant de démarrer le funnel VIP."
        />
        <div className="mt-8 text-center">
          <a
            href="/onboarding?redirectTo=/vip"
            className="inline-flex items-center justify-center rounded-md bg-[var(--color-accent)] px-6 py-3 text-sm font-medium text-white"
          >
            Compléter mon profil
          </a>
        </div>
      </Section>
    );
  }

  const [application, paidAccess, welcomeBonus, ironfxMode, paidConfig] =
    await Promise.all([
      db.query.vipApplications.findFirst({
        where: eq(vipApplications.userId, session.user.id),
      }),
      getActivePaidAccess(session.user.id),
      getWelcomeBonus(),
      getIronFXMode(),
      getVipPaidAccessConfig(),
    ]);

  // 1) Si user a un accès payant actif (ou en cours) → on lui montre cet état,
  // pas le wizard affilié (les 2 chemins ne se mélangent pas).
  if (paidAccess) {
    return (
      <Section className="pt-24 pb-16">
        <div className="max-w-3xl mx-auto">
          <SectionHeader
            eyebrow="Accès VIP Telegram"
            title={
              <>
                Accès <span className="font-serif italic">direct.</span>
              </>
            }
            description="Tu as choisi l'accès direct payant — pas de funnel affilié, pas de qualification CPA."
            align="left"
          />
          <div className="mt-8">
            <VipPaidAccessSummary access={paidAccess} />
          </div>
        </div>
      </Section>
    );
  }

  // 2) Si user n'a pas encore d'application ET pas d'accès payant, et
  //    que l'option payante est activée → on lui propose les 2 chemins.
  //    Skip si ?path=affiliate (l'user a explicitement choisi le funnel).
  if (!application && paidConfig.enabled && params.path !== 'affiliate') {
    return (
      <Section className="pt-24 pb-16">
        <div className="max-w-4xl mx-auto">
          <SectionHeader
            eyebrow="Funnel VIP Telegram"
            title={
              <>
                Choisis ton{' '}
                <span className="font-serif italic">accès.</span>
              </>
            }
            description="Deux chemins vers le groupe Telegram privé. Tu peux changer d'avis tant que tu n'as pas démarré."
            align="left"
          />
          <div className="mt-8 space-y-4">
            {welcomeBonus.enabled && (
              <WelcomeBonusBanner bonus={welcomeBonus} />
            )}
            <VipPathChoice priceEur={paidConfig.priceEur} />
          </div>
        </div>
      </Section>
    );
  }

  // 3) Sinon (application existante ou paidConfig désactivé) → wizard normal.
  let tradingProgressPct = 0;
  if (application?.brokerAccountId && application.step === 'in_group') {
    const status = await db.query.manualIronfxStatus.findFirst({
      where: eq(manualIronfxStatus.accountId, application.brokerAccountId),
    });
    if (status) {
      tradingProgressPct = status.tradingProgressPct;
    }
  }

  return (
    <Section className="pt-24 pb-16">
      <div className="max-w-3xl mx-auto">
        <SectionHeader
          eyebrow="Funnel VIP Telegram"
          title={
            <>
              Accès <span className="font-serif italic">VIP.</span>
            </>
          }
          description="Suis les étapes — on te guide jusqu'au groupe Telegram privé."
          align="left"
        />

        <div className="mt-8 space-y-4">
          {welcomeBonus.enabled && <WelcomeBonusBanner bonus={welcomeBonus} />}
          {/* Switch path : si l'option payante est activée et l'user
              n'est pas encore in_group, on lui offre la sortie de secours
              vers l'accès direct 250€. */}
          {paidConfig.enabled && application?.step !== 'in_group' && (
            <VipSwitchToDirectBanner
              priceEur={paidConfig.priceEur}
              currentStep={application?.step ?? 'link_generated'}
            />
          )}
          <VipWizard
            application={application ?? null}
            tradingProgressPct={tradingProgressPct}
            ironfxMode={ironfxMode}
          />
        </div>
      </div>
    </Section>
  );
}
