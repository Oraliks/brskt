import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { formations } from '@/lib/db/schema';
import { Section, SectionHeader } from '@/components/shared/section';
import { ReservationFlow } from '@/components/formation/reservation-flow';
import { getSession } from '@/lib/auth/server';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ mode?: string }>;
}

export default async function ReserverPage({ searchParams }: PageProps) {
  const { mode } = await searchParams;
  const session = await getSession().catch(() => null);

  if (!session?.user) {
    redirect(`/login?redirectTo=/formation/reserver${mode ? `?mode=${mode}` : ''}`);
  }

  if (!session.user.email || !session.user.onboardingCompletedAt) {
    redirect('/onboarding?redirectTo=/formation/reserver');
  }

  const list = await db.query.formations.findMany({
    where: eq(formations.active, true),
  });

  return (
    <Section className="pt-16 pb-12">
      <div className="max-w-3xl mx-auto space-y-6">
        <SectionHeader
          eyebrow="Réservation"
          title={
            <>
              Réserve ta <span className="font-serif italic">session.</span>
            </>
          }
          description="Choisis ton format, propose tes créneaux. On confirme sous 24h, puis tu paies."
          align="left"
        />

        <ReservationFlow formations={list} defaultMode={mode} />
      </div>
    </Section>
  );
}
