import Link from 'next/link';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { AlertTriangle, ArrowLeft, RefreshCw } from 'lucide-react';
import { db } from '@/lib/db';
import { vipApplications } from '@/lib/db/schema';
import { requireAuth } from '@/lib/auth/server';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Section } from '@/components/shared/section';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function EjectedPage() {
  const session = await requireAuth();

  const application = await db.query.vipApplications.findFirst({
    where: eq(vipApplications.userId, session.user.id),
  });

  if (!application || application.step !== 'ejected') {
    redirect('/dashboard');
  }

  return (
    <Section className="pt-24 pb-32">
      <div className="max-w-2xl mx-auto">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-sm text-[var(--color-text-dim)] hover:text-[var(--color-text)] mb-8"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour au dashboard
        </Link>

        <div className="glass-strong rounded-[var(--radius-2xl)] p-8 md:p-12 border-rose-500/20">
          <Badge variant="danger">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Éjecté du groupe VIP
          </Badge>

          <h1 className="mt-6 font-serif text-3xl md:text-5xl text-gradient leading-tight">
            Tu n'es plus dans
            <br />
            le groupe.
          </h1>

          {application.ejectedAt && (
            <p className="mt-3 text-sm text-[var(--color-text-faint)]">
              Éjecté le {formatDate(application.ejectedAt)}
            </p>
          )}

          {application.ejectionReason && (
            <div className="mt-8 rounded-[var(--radius-lg)] bg-rose-500/10 border border-rose-500/20 p-6">
              <div className="text-xs font-medium text-rose-200 uppercase tracking-wider mb-3">
                Raison
              </div>
              <p className="text-base text-[var(--color-text)]">
                {application.ejectionReason}
              </p>
            </div>
          )}

          <div className="mt-8 space-y-4">
            <h2 className="font-semibold">Comment réintégrer le groupe ?</h2>
            <ol className="space-y-3 text-sm text-[var(--color-text-dim)]">
              <li className="flex gap-3">
                <span className="font-mono text-[var(--color-accent-hover)]">01.</span>
                Redépose des fonds sur ton compte broker (minimum 250€).
              </li>
              <li className="flex gap-3">
                <span className="font-mono text-[var(--color-accent-hover)]">02.</span>
                Trade activement — il faut générer au moins $1 de commission CPA
                pour qu'on récupère notre part du partenariat.
              </li>
              <li className="flex gap-3">
                <span className="font-mono text-[var(--color-accent-hover)]">03.</span>
                Contacte notre équipe via Telegram pour qu'on relance ta validation.
              </li>
            </ol>
          </div>

          <div className="mt-10 flex flex-col sm:flex-row gap-3">
            <Button asChild size="lg" variant="glow">
              <a
                href={`https://t.me/${process.env.TELEGRAM_BOT_USERNAME ?? ''}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <RefreshCw className="h-4 w-4" />
                Contacter l'équipe
              </a>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link href="/dashboard">Retour au dashboard</Link>
            </Button>
          </div>
        </div>
      </div>
    </Section>
  );
}
