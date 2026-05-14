import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { manualIronfxStatus, vipApplications } from '@/lib/db/schema';
import { getSession } from '@/lib/auth/server';
import { Section, SectionHeader } from '@/components/shared/section';
import { VipLanding } from '@/components/vip/vip-landing';
import { VipWizard } from '@/components/vip/vip-wizard';
import { WelcomeBonusBanner } from '@/components/vip/welcome-bonus-banner';
import { getWelcomeBonus } from '@/lib/settings/welcome-bonus';
import { getIronFXMode } from '@/lib/ironfx';

export const dynamic = 'force-dynamic';

export default async function VipPage() {
  const session = await getSession().catch(() => null);

  if (!session?.user) {
    return <VipLanding />;
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

  const [application, welcomeBonus, ironfxMode] = await Promise.all([
    db.query.vipApplications.findFirst({
      where: eq(vipApplications.userId, session.user.id),
    }),
    getWelcomeBonus(),
    getIronFXMode(),
  ]);

  // Fetch progression de trading si l'user est in_group avec un compte broker
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
