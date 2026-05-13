import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { vipApplications } from '@/lib/db/schema';
import { getSession } from '@/lib/auth/server';
import { Section, SectionHeader } from '@/components/shared/section';
import { VipLanding } from '@/components/vip/vip-landing';
import { VipWizard } from '@/components/vip/vip-wizard';

export const dynamic = 'force-dynamic';

export default async function VipPage() {
  const session = await getSession().catch(() => null);

  if (!session?.user) {
    return <VipLanding />;
  }

  // Onboarding pas fini → renvoyer vers onboarding
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

  const application = await db.query.vipApplications.findFirst({
    where: eq(vipApplications.userId, session.user.id),
  });

  return (
    <>
      <Section className="pt-32 pb-12">
        <SectionHeader
          eyebrow="Funnel VIP Telegram"
          title={
            <>
              Accès <span className="font-serif italic">VIP.</span>
            </>
          }
          description="Suis les étapes — on te guide jusqu'au groupe Telegram privé."
        />
      </Section>

      <Section className="pt-0 pb-32">
        <div className="max-w-3xl mx-auto">
          <VipWizard application={application ?? null} />
        </div>
      </Section>
    </>
  );
}
