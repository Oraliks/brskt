import Link from 'next/link';
import { and, count, desc, gte, sql } from 'drizzle-orm';
import {
  AlertTriangle,
  ArrowRight,
  Clock,
  TrendingDown,
  Users,
} from 'lucide-react';
import { db } from '@/lib/db';
import { funnelEvents, vipApplications } from '@/lib/db/schema';
import {
  AdminContainer,
  AdminPageHeader,
} from '@/components/admin/page-header';
import { Badge } from '@/components/ui/badge';
import { cn, formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

/**
 * Drop-off funnel admin page.
 *
 * Calcule le nombre d'apps qui ont ATTEINT ou DÉPASSÉ chaque étape, sur la
 * cohorte sélectionnée (basée sur vipApplications.createdAt). Permet de voir
 * où on perd les gens dans le funnel.
 *
 * Les pourcentages sont :
 *  - taux : N de l'étape ÷ N de l'étape précédente
 *  - drop : 100 - taux
 *  - global : N de l'étape ÷ N total entré dans le funnel
 *
 * Note : la table `funnel_events` existe mais n'est pas encore alimentée.
 * Quand elle le sera (tracking clics affiliés, événements granulaires),
 * on pourra enrichir cette page.
 */

type Cohort = '7d' | '30d' | '90d' | 'all';

const COHORT_LABEL: Record<Cohort, string> = {
  '7d': '7 derniers jours',
  '30d': '30 derniers jours',
  '90d': '90 derniers jours',
  all: 'Depuis le début',
};

// Étapes "actives" du funnel dans leur ordre — exclut les étapes réservées
// (clicked, signup_pending) et ejected (état terminal, pas dans le funnel).
const FUNNEL_STEPS = [
  { key: 'link_generated', label: 'Lien affilié généré' },
  { key: 'signup_validated', label: 'Inscription validée' },
  { key: 'deposit_pending', label: 'Dépôt soumis' },
  { key: 'deposit_validated', label: 'Dépôt validé' },
  { key: 'telegram_invited', label: 'Lien Telegram envoyé' },
  { key: 'in_group', label: 'Dans le groupe VIP' },
] as const;

// Ordre logique : on considère qu'avoir atteint l'étape N implique avoir
// passé les étapes 1..N-1. Donc "compteur étape N" = nb d'apps dont l'étape
// actuelle est dans (N, N+1, ..., dernière). Pour ça on a besoin d'un rang
// par étape.
const STEP_RANK: Record<string, number> = {
  link_generated: 1,
  clicked: 2,
  signup_pending: 3,
  signup_validated: 4,
  deposit_pending: 5,
  deposit_validated: 6,
  telegram_invited: 7,
  in_group: 8,
  ejected: 99, // hors funnel
};

function parseCohort(raw: string | undefined): Cohort {
  if (raw === '7d' || raw === '30d' || raw === '90d' || raw === 'all')
    return raw;
  return '30d';
}

function cohortStart(cohort: Cohort): Date | null {
  if (cohort === 'all') return null;
  const days = cohort === '7d' ? 7 : cohort === '30d' ? 30 : 90;
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

export default async function AdminFunnelPage({
  searchParams,
}: {
  searchParams: Promise<{ cohort?: string }>;
}) {
  const params = await searchParams;
  const cohort = parseCohort(params.cohort);
  const start = cohortStart(cohort);

  // Récupère TOUTES les apps de la cohorte avec leur step
  const cohortWhere = start
    ? gte(vipApplications.createdAt, start)
    : undefined;

  const apps = await db
    .select({
      id: vipApplications.id,
      step: vipApplications.step,
      createdAt: vipApplications.createdAt,
      currentStepEnteredAt: vipApplications.currentStepEnteredAt,
    })
    .from(vipApplications)
    .where(cohortWhere);

  const total = apps.length;
  const ejectedCount = apps.filter((a) => a.step === 'ejected').length;

  // Agrégation des events funnel sur la même cohorte (par event_name)
  const eventStats = await db
    .select({
      eventName: funnelEvents.eventName,
      c: count(),
    })
    .from(funnelEvents)
    .where(start ? gte(funnelEvents.createdAt, start) : undefined)
    .groupBy(funnelEvents.eventName);
  const eventCounts = new Map(eventStats.map((e) => [e.eventName, e.c]));

  // Time-in-step moyen pour les apps actuellement bloquées (en jours)
  const stuckByStepData = new Map<
    string,
    { count: number; avgDaysStuck: number }
  >();
  for (const a of apps) {
    if (a.step === 'in_group' || a.step === 'ejected') continue;
    const enteredAt = a.currentStepEnteredAt ?? a.createdAt;
    const daysStuck =
      (Date.now() - enteredAt.getTime()) / (1000 * 60 * 60 * 24);
    const prev = stuckByStepData.get(a.step) ?? { count: 0, avgDaysStuck: 0 };
    const newCount = prev.count + 1;
    stuckByStepData.set(a.step, {
      count: newCount,
      avgDaysStuck: (prev.avgDaysStuck * prev.count + daysStuck) / newCount,
    });
  }

  // Pour chaque étape du funnel, compte les apps dont le RANG d'étape >= rang de cette étape.
  // On exclut 'ejected' (rang 99) du compteur "in_group" car ils ont quitté.
  // Note : un user éjecté A ATTEINT in_group avant d'être éjecté, mais pour
  // le funnel actuel on veut le ratio des "encore là" — donc on compte
  // séparément.
  const stepStats = FUNNEL_STEPS.map((step) => {
    const rank = STEP_RANK[step.key] ?? 0;
    const reached = apps.filter((a) => {
      const r = STEP_RANK[a.step] ?? 0;
      // ejected (rank 99) compte pour toutes les étapes (a atteint in_group
      // dans le passé). On l'inclut pour avoir le compteur "people who went
      // through this step" — l'éjection est trackée séparément via
      // ejectedCount.
      return r >= rank;
    }).length;
    return { ...step, reached };
  });

  // % conversion d'une étape à la suivante
  const withConversion = stepStats.map((step, i) => {
    const prev = i === 0 ? total : stepStats[i - 1]!.reached;
    const conversionFromPrev = prev > 0 ? (step.reached / prev) * 100 : 0;
    const globalRate = total > 0 ? (step.reached / total) * 100 : 0;
    const dropFromPrev = i === 0 ? 0 : 100 - conversionFromPrev;
    return {
      ...step,
      conversionFromPrev,
      globalRate,
      dropFromPrev,
      drop_abs: i === 0 ? 0 : (prev - step.reached),
    };
  });

  // Plus gros point de chute
  const biggestDrop = withConversion
    .slice(1)
    .reduce<{ label: string; drop: number; abs: number } | null>((acc, s) => {
      if (!acc || s.dropFromPrev > acc.drop) {
        return { label: s.label, drop: s.dropFromPrev, abs: s.drop_abs };
      }
      return acc;
    }, null);

  // KPIs
  const completedCount =
    stepStats.find((s) => s.key === 'in_group')?.reached ?? 0;
  const endToEnd = total > 0 ? (completedCount / total) * 100 : 0;

  // Apps bloquées par étape (current step, pas reached) — pour drill-down
  const stuckByStep = new Map<string, number>();
  for (const a of apps) {
    stuckByStep.set(a.step, (stuckByStep.get(a.step) ?? 0) + 1);
  }

  return (
    <AdminContainer>
      <AdminPageHeader
        title="Funnel VIP"
        description="Drop-off par étape sur la cohorte sélectionnée."
        actions={<CohortSwitcher current={cohort} />}
      />

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KpiCard
          label="Apps entrées"
          value={total}
          icon={Users}
          sub={COHORT_LABEL[cohort]}
        />
        <KpiCard
          label="Conversion E2E"
          value={`${endToEnd.toFixed(1)}%`}
          icon={ArrowRight}
          sub={`${completedCount} dans le groupe`}
        />
        <KpiCard
          label="Plus gros drop"
          value={biggestDrop ? `${biggestDrop.drop.toFixed(0)}%` : '—'}
          icon={TrendingDown}
          sub={
            biggestDrop
              ? `${biggestDrop.label} (${biggestDrop.abs} users)`
              : 'Pas assez de data'
          }
        />
        <KpiCard
          label="Éjectés"
          value={ejectedCount}
          icon={AlertTriangle}
          sub={`${total > 0 ? ((ejectedCount / total) * 100).toFixed(1) : 0}% des apps`}
        />
      </div>

      {/* Tunnel visuel */}
      <div className="glass rounded-[var(--radius-lg)] p-6 mb-8">
        <h2 className="text-base font-semibold mb-1">Tunnel de conversion</h2>
        <p className="text-xs text-[var(--color-text-dim)] mb-6">
          Chaque barre montre le nombre d'apps qui ont <em>atteint au moins</em>{' '}
          cette étape (incluant les éjectés qui sont passés par in_group).
        </p>
        <div className="space-y-3">
          {withConversion.map((step, i) => {
            const width = total > 0 ? (step.reached / total) * 100 : 0;
            const isFirst = i === 0;
            const stuckHere = stuckByStep.get(step.key) ?? 0;
            const stuckStats = stuckByStepData.get(step.key);
            return (
              <div key={step.key}>
                <div className="flex items-baseline justify-between text-sm mb-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs text-[var(--color-text-dim)] w-4">
                      {i + 1}
                    </span>
                    <span className="font-medium">{step.label}</span>
                    {stuckHere > 0 && (
                      <Link
                        href={`/admin/vip?step=${step.key}`}
                        className="text-[10px] uppercase tracking-wider text-[var(--color-text-dim)] hover:text-[var(--color-text)] bg-[var(--color-surface-tint)] hover:bg-[var(--color-surface-tint-strong)] px-1.5 py-0.5 rounded-sm"
                      >
                        {stuckHere} bloqués ici
                      </Link>
                    )}
                    {stuckStats && stuckStats.avgDaysStuck > 0.5 && (
                      <span className="text-[10px] text-amber-300 light:text-amber-700 inline-flex items-center gap-1">
                        <Clock className="h-2.5 w-2.5" />~
                        {stuckStats.avgDaysStuck.toFixed(1)}j en moyenne
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 font-mono tabular-nums text-xs">
                    <span className="text-[var(--color-text-dim)]">
                      {step.globalRate.toFixed(0)}% global
                    </span>
                    <span className="font-semibold w-12 text-right">
                      {step.reached}
                    </span>
                    {!isFirst && (
                      <Badge
                        variant={
                          step.dropFromPrev > 40
                            ? 'danger'
                            : step.dropFromPrev > 15
                            ? 'warning'
                            : 'success'
                        }
                      >
                        {step.conversionFromPrev.toFixed(0)}%
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="h-2 w-full rounded-full bg-[var(--color-surface-tint)] overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-500',
                      'bg-gradient-to-r from-indigo-500 to-pink-500'
                    )}
                    style={{ width: `${Math.max(width, 1)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Events détaillés (depuis funnel_events) */}
      {eventStats.length > 0 && (
        <div className="glass rounded-[var(--radius-lg)] p-6 mb-8">
          <h2 className="text-base font-semibold mb-1">
            Événements détaillés
          </h2>
          <p className="text-xs text-[var(--color-text-dim)] mb-5">
            Compteur par <code>event_name</code> dans la cohorte. Donne une
            vue plus fine que les step (notamment{' '}
            <code>vip_link_clicked</code> = clics sur le lien d&apos;affilié,
            non capturé dans le step).
          </p>
          <div className="grid sm:grid-cols-2 gap-2">
            {eventStats
              .sort((a, b) => b.c - a.c)
              .map((e) => (
                <div
                  key={e.eventName}
                  className="flex items-baseline justify-between px-3 py-2 rounded-md bg-[var(--color-surface-tint)]"
                >
                  <span className="font-mono text-xs">{e.eventName}</span>
                  <span className="font-mono tabular-nums font-semibold">
                    {e.c}
                  </span>
                </div>
              ))}
          </div>
          {/* Conversion link_generated → link_clicked en highlight */}
          {(() => {
            const generated = eventCounts.get('vip_link_generated') ?? 0;
            const clicked = eventCounts.get('vip_link_clicked') ?? 0;
            if (generated === 0) return null;
            const rate = (clicked / generated) * 100;
            return (
              <div className="mt-5 p-3 rounded-md bg-indigo-500/8 border border-indigo-500/25 text-sm">
                <strong>
                  Taux de clic sur le lien d&apos;affiliation :{' '}
                  <span className="font-mono">{rate.toFixed(1)}%</span>
                </strong>{' '}
                ({clicked}/{generated})
                {rate < 50 && (
                  <p className="mt-1 text-xs text-[var(--color-text-dim)]">
                    Moins de la moitié des users génèrent puis cliquent. Peut
                    indiquer un manque de confiance / clarté au step{' '}
                    <code>link_generated</code>.
                  </p>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* Apps récentes en bottleneck */}
      <RecentBottleneck total={total} cohortStartDate={start} />
    </AdminContainer>
  );
}

function CohortSwitcher({ current }: { current: Cohort }) {
  const options: { value: Cohort; label: string }[] = [
    { value: '7d', label: '7j' },
    { value: '30d', label: '30j' },
    { value: '90d', label: '90j' },
    { value: 'all', label: 'Tout' },
  ];
  return (
    <div className="inline-flex items-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface-tint)] p-1">
      {options.map((opt) => (
        <Link
          key={opt.value}
          href={`/admin/funnel?cohort=${opt.value}`}
          className={cn(
            'px-3 py-1 text-xs rounded-full transition-colors',
            current === opt.value
              ? 'bg-[var(--color-inverse)] text-[var(--color-on-inverse)] font-medium'
              : 'text-[var(--color-text-dim)] hover:text-[var(--color-text)]'
          )}
        >
          {opt.label}
        </Link>
      ))}
    </div>
  );
}

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="glass rounded-[var(--radius-lg)] p-5">
      <div className="flex items-center justify-between">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-[var(--color-surface-tint)] border border-[var(--color-border)]">
          <Icon className="h-4 w-4 text-[var(--color-text-dim)]" />
        </span>
        <span className="text-xs text-[var(--color-text-dim)] uppercase tracking-wider">
          {label}
        </span>
      </div>
      <div className="mt-4 font-serif text-4xl text-gradient">{value}</div>
      {sub && (
        <div className="mt-1 text-xs text-[var(--color-text-dim)]">{sub}</div>
      )}
    </div>
  );
}

async function RecentBottleneck({
  total,
  cohortStartDate,
}: {
  total: number;
  cohortStartDate: Date | null;
}) {
  if (total === 0) return null;

  // Apps les plus anciennes encore bloquées dans le funnel (pas in_group, pas ejected)
  const stuck = await db.query.vipApplications.findMany({
    where: and(
      // pas terminales
      sql`${vipApplications.step} NOT IN ('in_group', 'ejected')`,
      cohortStartDate ? gte(vipApplications.createdAt, cohortStartDate) : undefined
    ),
    with: { user: true },
    orderBy: [desc(vipApplications.updatedAt)],
    limit: 10,
  });

  if (stuck.length === 0) return null;

  return (
    <div className="glass rounded-[var(--radius-lg)] p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold">Apps bloquées récemment</h2>
          <p className="text-xs text-[var(--color-text-dim)]">
            Les 10 dernières apps qui n'ont pas atteint le groupe ni été éjectées.
          </p>
        </div>
        <Link
          href="/admin/vip"
          className="text-xs text-[var(--color-text-dim)] hover:text-[var(--color-text)] inline-flex items-center gap-1"
        >
          Voir toutes
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      <div className="divide-y divide-[var(--color-border)]">
        {stuck.map((a) => (
          <Link
            key={a.id}
            href={`/admin/vip#${a.id}`}
            className="flex items-center gap-4 py-3 hover:bg-white/[0.02] -mx-2 px-2 rounded-md"
          >
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{a.user.name}</div>
              <div className="text-xs text-[var(--color-text-dim)] truncate">
                Maj {formatDate(a.updatedAt)} · créée {formatDate(a.createdAt)}
              </div>
            </div>
            <Badge variant="warning">{a.step}</Badge>
          </Link>
        ))}
      </div>
    </div>
  );
}

