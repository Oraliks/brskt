import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth/server';
import { OnboardingForm } from '@/components/auth/onboarding-form';

interface PageProps {
  searchParams: Promise<{ redirectTo?: string }>;
}

export default async function OnboardingPage({ searchParams }: PageProps) {
  const session = await requireAuth();
  const { redirectTo } = await searchParams;

  if (session.user.email && session.user.onboardingCompletedAt) {
    redirect(redirectTo ?? '/dashboard');
  }

  return (
    <div className="space-y-8">
      <div className="text-center space-y-3">
        <h1 className="font-serif text-4xl md:text-5xl text-gradient">
          Une dernière étape
        </h1>
        <p className="text-sm text-[var(--color-text-dim)]">
          On a besoin de ton email pour t'envoyer factures, confirmations
          et liens importants.
        </p>
      </div>

      <div className="glass-strong rounded-[var(--radius-lg)] p-8">
        <OnboardingForm
          defaultName={session.user.telegramFirstName ?? session.user.name ?? ''}
          redirectTo={redirectTo}
        />
      </div>
    </div>
  );
}
