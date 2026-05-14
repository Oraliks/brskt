import Link from 'next/link';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { AlertTriangle, ArrowLeft, RefreshCw, TrendingUp } from 'lucide-react';
import { db } from '@/lib/db';
import { manualIronfxStatus, vipApplications } from '@/lib/db/schema';
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

  // Progression au moment de l'éjection (si on a un brokerAccountId)
  const lastStatus = application.brokerAccountId
    ? await db.query.manualIronfxStatus.findFirst({
        where: eq(manualIronfxStatus.accountId, application.brokerAccountId),
      })
    : null;
  const lastProgressPct = lastStatus?.tradingProgressPct ?? 0;
  const hadDeposit = application.depositAmount
    ? Number(application.depositAmount)
    : 0;

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
              <div className="text-xs font-medium text-rose-200 light:text-rose-700 uppercase tracking-wider mb-3">
                Raison
              </div>
              <p className="text-base text-[var(--color-text)]">
                {application.ejectionReason}
              </p>
            </div>
          )}

          {/* Snapshot de progression au moment de l'éjection */}
          {(lastProgressPct > 0 || hadDeposit > 0) && (
            <div className="mt-6 rounded-[var(--radius-lg)] bg-[var(--color-surface-tint)] border border-[var(--color-border)] p-6 space-y-4">
              <div className="flex items-center gap-2 text-xs font-medium text-[var(--color-text-dim)] uppercase tracking-wider">
                <TrendingUp className="h-3 w-3" />
                Ta progression au moment de l&apos;éjection
              </div>

              {lastProgressPct > 0 && (
                <div className="space-y-2">
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm text-[var(--color-text-dim)]">
                      Volume de trading généré
                    </span>
                    <span className="font-mono tabular-nums text-lg font-medium">
                      {lastProgressPct}%
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-[var(--color-surface-tint-strong)] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[var(--color-accent)] to-pink-500"
                      style={{ width: `${Math.max(2, lastProgressPct)}%` }}
                    />
                  </div>
                  <p className="text-xs text-[var(--color-text-faint)]">
                    Il manquait {Math.max(0, 100 - lastProgressPct)}% pour
                    atteindre la qualification CPA et sécuriser ta place.
                  </p>
                </div>
              )}

              {hadDeposit > 0 && (
                <div className="flex items-baseline justify-between text-sm">
                  <span className="text-[var(--color-text-dim)]">
                    Dépôt initial déclaré
                  </span>
                  <span className="font-mono tabular-nums font-medium">
                    {hadDeposit}€
                  </span>
                </div>
              )}
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
