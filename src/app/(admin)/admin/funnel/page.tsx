import Link from 'next/link';
import { and, count, gte, lt } from 'drizzle-orm';
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Calendar,
  CheckCircle2,
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
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

/**
 * Drop-off funnel admin page — vue split.
 *
 *  - 4 KPIs (entrées, conversion E2E, plus gros drop, éjectés)
 *  - Section "Tunnel de conversion" (2/3) : barres bicolores convertis/drop par étape
 *  - Section "Vue d'ensemble" (1/3) : donut + stats + analyse drop
 *  - Section "Événements détaillés" : top events avec delta vs période précédente
 *
 * Tout calculé server-side à partir de `vipApplications` (steps) et
 * `funnel_events` (events fins). Pas de state client : refresh = refetch.
 */

type Cohort = '7d' | '30d' | '90d' | 'all';

const COHORT_LABEL: Record<Cohort, string> = {
  '7d': '7 derniers jours',
  '30d': '30 derniers jours',
  '90d': '90 derniers jours',
  all: 'Depuis le début',
};

const FUNNEL_STEPS = [
  { key: 'link_generated', label: 'Lien affilié généré' },
  { key: 'signup_validated', label: 'Inscription validée' },
  { key: 'deposit_pending', label: 'Dépôt soumis' },
  { key: 'deposit_validated', label: 'Dépôt validé' },
  { key: 'telegram_invited', label: 'Lien Telegram envoyé' },
  { key: 'in_group', label: 'Dans le groupe VIP' },
] as const;

const STEP_RANK: Record<string, number> = {
  link_generated: 1,
  clicked: 2,
  signup_pending: 3,
  signup_validated: 4,
  deposit_pending: 5,
  deposit_validated: 6,
  telegram_invited: 7,
  in_group: 8,
  ejected: 99,
};

const COHORT_DAYS: Record<Cohort, number | null> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  all: null,
};

function parseCohort(raw: string | undefined): Cohort {
  if (raw === '7d' || raw === '30d' || raw === '90d' || raw === 'all')
    return raw;
  return '30d';
}

function cohortStart(cohort: Cohort): Date | null {
  const days = COHORT_DAYS[cohort];
  if (days === null) return null;
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

/**
 * Période précédente de même longueur, ex: 30d → les 30 jours qui précèdent
 * les 30 derniers. Sert au calcul de delta sur les KPIs et events.
 */
function prevCohortRange(cohort: Cohort): { start: Date; end: Date } | null {
  const days = COHORT_DAYS[cohort];
  if (days === null) return null;
  const end = new Date();
  end.setDate(end.getDate() - days);
  const start = new Date(end);
  start.setDate(start.getDate() - days);
  return { start, end };
}

function formatDateShort(d: Date): string {
  return d.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default async function AdminFunnelPage({
  searchParams,
}: {
  searchParams: Promise<{ cohort?: string }>;
}) {
  const params = await searchParams;
  const cohort = parseCohort(params.cohort);
  const start = cohortStart(cohort);
  const prev = prevCohortRange(cohort);
  const now = new Date();

  // Cohort actuelle : apps de la table vipApplications
  const apps = await db
    .select({
      id: vipApplications.id,
      step: vipApplications.step,
      createdAt: vipApplications.createdAt,
    })
    .from(vipApplications)
    .where(start ? gte(vipApplications.createdAt, start) : undefined);

  const total = apps.length;
  const ejectedCount = apps.filter((a) => a.step === 'ejected').length;

  // Apps de la période précédente pour comparer la conversion E2E
  const prevApps = prev
    ? await db
        .select({ step: vipApplications.step })
        .from(vipApplications)
        .where(
          and(
            gte(vipApplications.createdAt, prev.start),
            lt(vipApplications.createdAt, prev.end)
          )
        )
    : [];

  // Step stats : nombre d'apps ayant atteint au moins ce step (rank-based,
  // les éjectés sont inclus dans toutes les étapes <= in_group car ils sont
  // passés par là).
  const stepStats = FUNNEL_STEPS.map((step) => {
    const rank = STEP_RANK[step.key] ?? 0;
    const reached = apps.filter((a) => (STEP_RANK[a.step] ?? 0) >= rank).length;
    return { ...step, reached };
  });

  const withConversion = stepStats.map((step, i) => {
    const prevCount = i === 0 ? total : stepStats[i - 1]!.reached;
    const conversionFromPrev =
      prevCount > 0 ? (step.reached / prevCount) * 100 : 0;
    const globalRate = total > 0 ? (step.reached / total) * 100 : 0;
    const dropAbs = i === 0 ? 0 : prevCount - step.reached;
    return {
      ...step,
      conversionFromPrev,
      globalRate,
      dropFromPrev: i === 0 ? 0 : 100 - conversionFromPrev,
      dropAbs,
    };
  });

  const biggestDrop = withConversion
    .slice(1)
    .reduce<{ label: string; drop: number; abs: number } | null>((acc, s) => {
      if (!acc || s.dropFromPrev > acc.drop) {
        return { label: s.label, drop: s.dropFromPrev, abs: s.dropAbs };
      }
      return acc;
    }, null);

  const completedCount =
    stepStats.find((s) => s.key === 'in_group')?.reached ?? 0;
  const endToEnd = total > 0 ? (completedCount / total) * 100 : 0;
  const prevCompleted = prevApps.filter(
    (a) => (STEP_RANK[a.step] ?? 0) >= STEP_RANK['in_group']!
  ).length;
  const prevE2E =
    prevApps.length > 0 ? (prevCompleted / prevApps.length) * 100 : 0;
  const e2eDelta = endToEnd - prevE2E;

  // Apps actuellement bloquées par étape (pour badge "X bloqué(s) ici")
  const stuckByStep = new Map<string, number>();
  for (const a of apps) stuckByStep.set(a.step, (stuckByStep.get(a.step) ?? 0) + 1);
  const dropOffTotal = total - completedCount - ejectedCount;

  // Événements détaillés sur cohort + période précédente (pour delta)
  const [eventStats, prevEventStats] = await Promise.all([
    db
      .select({ eventName: funnelEvents.eventName, c: count() })
      .from(funnelEvents)
      .where(start ? gte(funnelEvents.createdAt, start) : undefined)
      .groupBy(funnelEvents.eventName),
    prev
      ? db
          .select({ eventName: funnelEvents.eventName, c: count() })
          .from(funnelEvents)
          .where(
            and(
              gte(funnelEvents.createdAt, prev.start),
              lt(funnelEvents.createdAt, prev.end)
            )
          )
          .groupBy(funnelEvents.eventName)
      : Promise.resolve([]),
  ]);

  const prevEventCounts = new Map(prevEventStats.map((e) => [e.eventName, e.c]));
  const topEvents = eventStats
    .map((e) => {
      const prevCount = prevEventCounts.get(e.eventName) ?? 0;
      const deltaPct =
        prevCount > 0
          ? ((e.c - prevCount) / prevCount) * 100
          : e.c > 0 && cohort !== 'all'
          ? null // "nouveau" — pas de baseline
          : 0;
      return { name: e.eventName, count: e.c, deltaPct };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 4);

  // Date range affichable dans le header (style "14 avr. – 14 mai 2026")
  const rangeLabel = start
    ? `${formatDateShort(start)} – ${formatDateShort(now)}`
    : 'Depuis le début';

  return (
    <AdminContainer>
      <AdminPageHeader
        title="Funnel VIP"
        description="Drop-off par étape sur la cohorte sélectionnée."
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <CohortSwitcher current={cohort} />
            <span className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-[var(--color-border)] bg-[var(--color-surface-tint)] text-[var(--color-text-dim)]">
              <Calendar className="h-3.5 w-3.5" />
              {rangeLabel}
            </span>
          </div>
        }
      />

      {/* 4 KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <KpiCard
          icon={Users}
          label="Apps entrées"
          value={total}
          hint={COHORT_LABEL[cohort]}
          tone="info"
        />
        <KpiCard
          icon={ArrowRight}
          label="Conversion E2E"
          value={`${endToEnd.toFixed(1)}%`}
          hint={`${completedCount} dans le groupe`}
          tone="info"
          delta={
            cohort === 'all' || prev === null
              ? null
              : {
                  pct: e2eDelta,
                  label:
                    prev &&
                    `vs ${formatDateShort(prev.start)} – ${formatDateShort(
                      prev.end
                    )}`,
                }
          }
        />
        <KpiCard
          icon={TrendingDown}
          label="Plus gros drop"
          value={biggestDrop ? `${biggestDrop.drop.toFixed(0)}%` : '0%'}
          hint={
            biggestDrop && biggestDrop.drop > 0
              ? `${biggestDrop.label} (${biggestDrop.abs} users)`
              : 'Aucune perte significative'
          }
          tone={biggestDrop && biggestDrop.drop > 0 ? 'warning' : 'success'}
        />
        <KpiCard
          icon={AlertTriangle}
          label="Éjectés"
          value={ejectedCount}
          hint={`${
            total > 0 ? ((ejectedCount / total) * 100).toFixed(1) : 0
          }% des apps`}
          tone={ejectedCount > 0 ? 'danger' : 'default'}
        />
      </div>

      {/* Split : tunnel (2/3) + vue d'ensemble (1/3) */}
      <div className="grid lg:grid-cols-[2fr_1fr] gap-4 mb-5">
        <FunnelTunnel
          steps={withConversion}
          total={total}
          stuckByStep={stuckByStep}
        />
        <ConversionOverview
          endToEnd={endToEnd}
          entries={total}
          converted={completedCount}
          dropOffTotal={dropOffTotal}
          biggestDrop={biggestDrop}
        />
      </div>

      {/* Événements détaillés */}
      {topEvents.length > 0 && (
        <EventsBlock events={topEvents} cohort={cohort} />
      )}
    </AdminContainer>
  );
}

// ============================================================
// COMPOSANTS
// ============================================================

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

const TONE_BG: Record<'default' | 'info' | 'success' | 'warning' | 'danger', string> = {
  default: 'bg-[var(--color-surface-tint)] border-[var(--color-border)] text-[var(--color-text-dim)]',
  info: 'bg-indigo-500/15 border-indigo-500/30 text-indigo-300 light:text-indigo-700',
  success: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300 light:text-emerald-700',
  warning: 'bg-amber-400/15 border-amber-400/30 text-amber-300 light:text-amber-700',
  danger: 'bg-rose-500/15 border-rose-500/30 text-rose-300 light:text-rose-700',
};

function KpiCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = 'default',
  delta = null,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  hint?: string;
  tone?: 'default' | 'info' | 'success' | 'warning' | 'danger';
  delta?: { pct: number; label?: string | false | null } | null;
}) {
  return (
    <div className="glass rounded-[var(--radius-lg)] p-4 md:p-5">
      <div className="flex items-center gap-3">
        <span
          className={cn(
            'inline-flex h-9 w-9 items-center justify-center rounded-md border',
            TONE_BG[tone]
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
        <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-dim)]">
          {label}
        </span>
      </div>
      <div className="mt-3 flex items-baseline gap-2 flex-wrap">
        <div
          className={cn(
            'font-serif text-3xl md:text-4xl',
            tone === 'success'
              ? 'text-emerald-300 light:text-emerald-700'
              : tone === 'warning'
              ? 'text-amber-300 light:text-amber-700'
              : tone === 'danger'
              ? 'text-rose-300 light:text-rose-700'
              : 'text-gradient'
          )}
        >
          {value}
        </div>
        {delta && (
          <Badge
            variant={
              delta.pct > 0 ? 'success' : delta.pct < 0 ? 'danger' : 'secondary'
            }
            className="text-[10px] gap-0.5"
          >
            {delta.pct > 0 ? '↑' : delta.pct < 0 ? '↓' : '='}
            {Math.abs(delta.pct).toFixed(0)}%
          </Badge>
        )}
      </div>
      {hint && (
        <div className="mt-1 text-xs text-[var(--color-text-dim)]">{hint}</div>
      )}
      {delta?.label && (
        <div className="mt-0.5 text-[10px] text-[var(--color-text-faint)]">
          {delta.label}
        </div>
      )}
    </div>
  );
}

interface StepWithStats {
  key: string;
  label: string;
  reached: number;
  conversionFromPrev: number;
  globalRate: number;
  dropFromPrev: number;
  dropAbs: number;
}

function FunnelTunnel({
  steps,
  total,
  stuckByStep,
}: {
  steps: StepWithStats[];
  total: number;
  stuckByStep: Map<string, number>;
}) {
  return (
    <div className="glass rounded-[var(--radius-lg)] p-5 md:p-6">
      <div className="flex items-baseline justify-between mb-1 gap-3 flex-wrap">
        <h2 className="text-base font-semibold">Tunnel de conversion</h2>
      </div>
      <p className="text-xs text-[var(--color-text-dim)] mb-5">
        Chaque étape représente le nombre d&apos;apps ayant atteint cette étape.
      </p>

      <div className="space-y-4">
        {steps.map((step, i) => {
          const widthPct = total > 0 ? Math.max((step.reached / total) * 100, 2) : 2;
          const dropAbs = step.dropAbs;
          const stuckHere = stuckByStep.get(step.key) ?? 0;
          return (
            <div key={step.key}>
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-surface-tint)] border border-[var(--color-border)] text-xs font-mono text-[var(--color-text-dim)] flex-shrink-0">
                    {i + 1}
                  </span>
                  <span className="text-sm font-medium truncate">
                    {step.label}
                  </span>
                  {stuckHere > 0 && (
                    <Link
                      href={`/admin/vip?step=${step.key}`}
                      className="text-[9px] uppercase tracking-wider text-amber-200 light:text-amber-800 bg-amber-500/15 border border-amber-500/30 hover:bg-amber-500/25 px-1.5 py-0.5 rounded-sm whitespace-nowrap"
                    >
                      {stuckHere} bloqué{stuckHere > 1 ? 's' : ''} ici
                    </Link>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 font-mono tabular-nums text-xs">
                  <span className="font-semibold w-8 text-right">
                    {step.reached}
                  </span>
                  <Badge
                    variant={
                      i === 0
                        ? 'secondary'
                        : step.dropFromPrev > 40
                        ? 'danger'
                        : step.dropFromPrev > 15
                        ? 'warning'
                        : 'success'
                    }
                    className="text-[10px]"
                  >
                    {step.conversionFromPrev.toFixed(0)}%
                  </Badge>
                </div>
              </div>
              {/* Barre bicolore : convertis (gauche) + drop (droite) */}
              <div className="h-2.5 w-full rounded-full bg-rose-500/10 overflow-hidden flex">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-pink-500 transition-all"
                  style={{ width: `${widthPct}%` }}
                />
              </div>
              {dropAbs > 0 && (
                <div className="mt-1 text-[10px] text-rose-300 light:text-rose-700">
                  −{dropAbs} drop-off depuis l&apos;étape précédente
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Légende */}
      <div className="mt-5 pt-4 border-t border-[var(--color-border)] flex items-center gap-4 text-[10px] text-[var(--color-text-dim)]">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2 w-3 rounded-sm bg-gradient-to-r from-indigo-500 to-pink-500" />
          Convertis
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2 w-3 rounded-sm bg-rose-500/30" />
          Drop-off
        </span>
      </div>
    </div>
  );
}

function ConversionOverview({
  endToEnd,
  entries,
  converted,
  dropOffTotal,
  biggestDrop,
}: {
  endToEnd: number;
  entries: number;
  converted: number;
  dropOffTotal: number;
  biggestDrop: { label: string; drop: number; abs: number } | null;
}) {
  return (
    <div className="glass rounded-[var(--radius-lg)] p-5 md:p-6 space-y-5">
      <h2 className="text-base font-semibold">Vue d&apos;ensemble de conversion</h2>

      <div className="flex items-center gap-5">
        <DonutChart percent={endToEnd} />
        <div className="space-y-1.5 text-sm flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[var(--color-text-dim)]">Entrées</span>
            <span className="font-mono tabular-nums font-semibold">
              {entries}
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[var(--color-text-dim)]">Convertis</span>
            <span className="font-mono tabular-nums font-semibold text-emerald-300 light:text-emerald-700">
              {converted}
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[var(--color-text-dim)]">Drop-off total</span>
            <span className="font-mono tabular-nums font-semibold text-rose-300 light:text-rose-700">
              {dropOffTotal}
            </span>
          </div>
        </div>
      </div>

      <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] p-3 space-y-1.5">
        <div className="text-xs font-medium">Étape avec le plus gros drop</div>
        {biggestDrop && biggestDrop.drop > 0 ? (
          <div className="text-xs flex items-center gap-1.5 text-amber-300 light:text-amber-700">
            <TrendingDown className="h-3.5 w-3.5" />
            <span className="font-medium">{biggestDrop.label}</span>
            <span className="text-[var(--color-text-dim)]">
              · -{biggestDrop.drop.toFixed(0)}%
            </span>
          </div>
        ) : (
          <div className="text-xs flex items-center gap-1.5 text-emerald-300 light:text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Aucun drop significatif
            <span className="text-[var(--color-text-faint)]">
              · toutes les étapes au-dessus de 60%
            </span>
          </div>
        )}
      </div>

      <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] p-3 space-y-2">
        <div className="text-xs font-medium">Définition de la conversion E2E</div>
        <p className="text-[11px] text-[var(--color-text-dim)] leading-snug">
          Un app est considéré comme converti s&apos;il atteint la dernière
          étape :
        </p>
        <Badge variant="default" className="text-[10px]">
          Dans le groupe VIP
        </Badge>
      </div>
    </div>
  );
}

/**
 * Donut chart SVG simple. Pas de lib externe — un cercle stroke avec
 * stroke-dasharray pour la portion remplie. Rotation -90deg pour démarrer
 * en haut. Le label central est composé en absolu au-dessus du SVG.
 */
function DonutChart({ percent }: { percent: number }) {
  const radius = 32;
  const stroke = 8;
  const circumference = 2 * Math.PI * radius;
  const filled = (Math.max(0, Math.min(100, percent)) / 100) * circumference;

  return (
    <div className="relative flex-shrink-0">
      <svg width={84} height={84} className="-rotate-90">
        <circle
          cx={42}
          cy={42}
          r={radius}
          stroke="var(--color-surface-tint-strong)"
          strokeWidth={stroke}
          fill="none"
        />
        <circle
          cx={42}
          cy={42}
          r={radius}
          stroke="url(#donut-gradient)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference - filled}`}
          fill="none"
        />
        <defs>
          <linearGradient id="donut-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgb(99, 102, 241)" />
            <stop offset="100%" stopColor="rgb(236, 72, 153)" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-[11px] font-semibold tabular-nums leading-none">
          {percent.toFixed(1)}%
        </div>
        <div className="mt-0.5 text-[7px] uppercase tracking-wider text-[var(--color-text-dim)]">
          E2E
        </div>
      </div>
    </div>
  );
}

function EventsBlock({
  events,
  cohort,
}: {
  events: Array<{ name: string; count: number; deltaPct: number | null }>;
  cohort: Cohort;
}) {
  return (
    <div className="glass rounded-[var(--radius-lg)] p-5 md:p-6">
      <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
        <div>
          <h2 className="text-base font-semibold">Événements détaillés</h2>
          <p className="text-xs text-[var(--color-text-dim)] mt-0.5">
            Compteur par <code className="text-[10px]">event_name</code> dans
            la cohorte. Donne une vue plus fine que les étapes.
          </p>
        </div>
        <Link
          href="/admin/audit"
          className="inline-flex items-center gap-1 text-xs text-[var(--color-accent-hover)] hover:underline"
        >
          Voir tous les événements
          <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {events.map((e) => (
          <EventCard
            key={e.name}
            name={e.name}
            count={e.count}
            deltaPct={e.deltaPct}
            cohort={cohort}
          />
        ))}
      </div>
    </div>
  );
}

const EVENT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  bot_started: Users,
  bot_deeplink: ArrowRight,
  formation_booking_created: CheckCircle2,
  formation_payment_completed: CheckCircle2,
  vip_link_generated: Users,
  vip_link_clicked: ArrowRight,
  vip_funnel_started: Users,
  vip_joined_group: CheckCircle2,
  vip_ejected: AlertTriangle,
  vip_qualified: CheckCircle2,
  testimonial_asked: Users,
};

function EventCard({
  name,
  count,
  deltaPct,
  cohort,
}: {
  name: string;
  count: number;
  deltaPct: number | null;
  cohort: Cohort;
}) {
  const Icon = EVENT_ICONS[name] ?? Users;
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-tint)] p-3">
      <div className="flex items-center gap-2">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 light:text-indigo-700 flex-shrink-0">
          <Icon className="h-3.5 w-3.5" />
        </span>
        <span className="text-[11px] font-mono truncate">{name}</span>
      </div>
      <div className="mt-2.5 text-2xl font-semibold tabular-nums">{count}</div>
      <div className="mt-0.5 text-[10px] text-[var(--color-text-dim)] flex items-center gap-1">
        {cohort === 'all' || deltaPct === null ? (
          <span className="text-[var(--color-text-faint)]">
            {deltaPct === null ? 'nouveau' : 'depuis le début'}
          </span>
        ) : (
          <>
            <span
              className={cn(
                'font-medium',
                deltaPct > 0
                  ? 'text-emerald-300 light:text-emerald-700'
                  : deltaPct < 0
                  ? 'text-rose-300 light:text-rose-700'
                  : 'text-[var(--color-text-dim)]'
              )}
            >
              {deltaPct > 0 ? '↑' : deltaPct < 0 ? '↓' : '='}
              {Math.abs(deltaPct).toFixed(0)}%
            </span>
            <span>vs période précédente</span>
          </>
        )}
      </div>
    </div>
  );
}
