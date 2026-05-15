import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { Clock } from 'lucide-react';
import { db } from '@/lib/db';
import { formations } from '@/lib/db/schema';
import { Section, SectionHeader } from '@/components/shared/section';
import { BookingForm } from '@/components/formation/booking-form';
import { WaitlistFormAuth } from '@/components/formation/waitlist-form-auth';
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

  // Slot waitlist rendu juste après les créneaux (étape 2 du BookingForm).
  // Bordure subtile (pas glass-strong) pour ne pas concurrencer visuellement
  // les blocs principaux du form.
  const waitlistSlot = (
    <details className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-tint)] p-3 group">
      <summary className="cursor-pointer flex items-center justify-between gap-3 list-none">
        <div className="flex items-center gap-2.5 min-w-0">
          <Clock className="h-4 w-4 text-amber-300 light:text-amber-700 flex-shrink-0" />
          <div className="min-w-0">
            <div className="text-sm font-semibold">
              Aucun de tes créneaux ne convient finalement ?
            </div>
            <div className="text-xs text-[var(--color-text-dim)] leading-snug">
              Mets-toi sur la liste d&apos;attente — on te DM dès qu&apos;une
              place s&apos;ouvre.
            </div>
          </div>
        </div>
        <span className="text-xs text-[var(--color-text-dim)] group-open:rotate-180 transition-transform flex-shrink-0">
          ▼
        </span>
      </summary>
      <div className="mt-3 pt-3 border-t border-[var(--color-border)]">
        <WaitlistFormAuth />
      </div>
    </details>
  );

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

        <BookingForm
          formations={list}
          defaultMode={mode}
          slotAfterDates={waitlistSlot}
        />
      </div>
    </Section>
  );
}
