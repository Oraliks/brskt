import Link from 'next/link';
import {
  and,
  count,
  desc,
  eq,
  gte,
  isNotNull,
  lt,
  ne,
  sql,
} from 'drizzle-orm';
import {
  AlertCircle,
  ArrowRight,
  ArrowUpRight,
  Bot,
  Briefcase,
  CalendarCheck,
  CalendarClock,
  CheckCircle2,
  CreditCard,
  Hash,
  MessageSquare,
  Percent,
  Sparkles,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import { db } from '@/lib/db';
import {
  bookings,
  offlineCoachings,
  payments,
  testimonials,
  users,
  vipApplications,
} from '@/lib/db/schema';
import {
  AdminContainer,
  AdminPageHeader,
} from '@/components/admin/page-header';
import { Badge } from '@/components/ui/badge';
import { getChannelMemberCount } from '@/lib/telegram/community-stats';
import { getBotFeatures } from '@/lib/settings/bot-features';
import { formatDate, formatPrice } from '@/lib/utils';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

/**
 * Page d'accueil admin (Overview).
 *
 * Layout :
 *  1. Bandeau "Actions requises" (caché si rien à faire)
 *  2. 8 KPIs (2 lignes) — acquisition + financier + opérationnel
 *  3. Split :
 *     - Gauche : Activité récente (timeline mixte bookings/paiements/VIP)
 *     - Droite : Sessions à venir + Funnel VIP snapshot
 */
export default async function AdminOverview() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const threeDaysAgo = new Date(now);
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
  const twoDaysAgo = new Date(now);
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

  // Helper : wrap chaque query pour qu'une erreur OU un hang ne fasse pas
  // crasher toute la page. Timeout à 8s par query — si une query Drizzle
  // ou un appel externe (Telegram) dépasse, on récupère le fallback.
  //
  // Pourquoi Promise.race avec timeout : `Promise.all` n'a pas de timeout
  // implicite, si UNE query hang, le runtime Vercel attend jusqu'à son
  // propre timeout (300s ici) → 504 et page jamais rendue. Le timeout
  // par-query garantit que la page render en max ~8s peu importe l'état
  // de la DB / API externes.
  async function safe<T>(
    p: Promise<T>,
    fallback: T,
    name: string,
    timeoutMs = 8000
  ): Promise<T> {
    try {
      return await Promise.race<T>([
        p,
        new Promise<T>((_, reject) =>
          setTimeout(
            () => reject(new Error(`timeout after ${timeoutMs}ms`)),
            timeoutMs
          )
        ),
      ]);
    } catch (err) {
      console.error(`[admin/overview] "${name}" failed:`, err);
      return fallback;
    }
  }

  const [
    usersTotalRow,
    usersThisMonthRow,
    usersPrevMonthRow,
    bookingsTotalRow,
    bookingsThisMonthRow,
    paidPaymentsRow,
    revenueThisMonthAgg,
    revenueTotalAgg,
    avgTicketAgg,
    vipInGroupRow,
    vipQualifiedRow,
    vipStepCounts,
    coachingsActiveRow,
    coachingsRemainingAgg,
    testimonialsPendingRow,
    pendingAdminRow,
    pendingPaymentStaleRow,
    vipDepositPendingRow,
    recentBookings,
    recentPayments,
    recentVipTransitions,
    upcomingBookings,
    channelCount,
    features,
  ] = await Promise.all([
    safe(db.select({ c: count() }).from(users), [{ c: 0 }], 'usersTotal'),
    safe(
      db
        .select({ c: count() })
        .from(users)
        .where(gte(users.createdAt, startOfMonth)),
      [{ c: 0 }],
      'usersThisMonth'
    ),
    safe(
      db
        .select({ c: count() })
        .from(users)
        .where(
          and(
            gte(users.createdAt, startOfPrevMonth),
            lt(users.createdAt, startOfMonth)
          )
        ),
      [{ c: 0 }],
      'usersPrevMonth'
    ),
    safe(db.select({ c: count() }).from(bookings), [{ c: 0 }], 'bookingsTotal'),
    safe(
      db
        .select({ c: count() })
        .from(bookings)
        .where(gte(bookings.createdAt, startOfMonth)),
      [{ c: 0 }],
      'bookingsThisMonth'
    ),
    safe(
      db
        .select({ c: count() })
        .from(payments)
        .where(eq(payments.status, 'completed')),
      [{ c: 0 }],
      'paidPayments'
    ),
    safe(
      db.execute(sql`
        SELECT COALESCE(SUM(amount_eur::numeric), 0)::float AS total
        FROM payments
        WHERE status = 'completed' AND created_at >= ${startOfMonth.toISOString()}
      `),
      [{ total: 0 }] as unknown as Awaited<ReturnType<typeof db.execute>>,
      'revenueThisMonth'
    ),
    safe(
      db.execute(sql`
        SELECT COALESCE(SUM(amount_eur::numeric), 0)::float AS total
        FROM payments
        WHERE status = 'completed'
      `),
      [{ total: 0 }] as unknown as Awaited<ReturnType<typeof db.execute>>,
      'revenueTotal'
    ),
    safe(
      db.execute(sql`
        SELECT
          COALESCE(SUM(amount_eur::numeric), 0)::float AS total,
          COUNT(*)::int AS c
        FROM payments
        WHERE status = 'completed'
      `),
      [{ total: 0, c: 0 }] as unknown as Awaited<ReturnType<typeof db.execute>>,
      'avgTicket'
    ),
    safe(
      db
        .select({ c: count() })
        .from(vipApplications)
        .where(eq(vipApplications.step, 'in_group')),
      [{ c: 0 }],
      'vipInGroup'
    ),
    safe(
      db
        .select({ c: count() })
        .from(vipApplications)
        .where(
          and(
            eq(vipApplications.step, 'in_group'),
            eq(vipApplications.cpaQualified, true)
          )
        ),
      [{ c: 0 }],
      'vipQualified'
    ),
    safe(
      db
        .select({ step: vipApplications.step, c: count() })
        .from(vipApplications)
        .groupBy(vipApplications.step),
      [] as Array<{ step: string; c: number }>,
      'vipStepCounts'
    ),
    safe(
      db
        .select({ c: count() })
        .from(offlineCoachings)
        .where(eq(offlineCoachings.status, 'active')),
      [{ c: 0 }],
      'coachingsActive'
    ),
    safe(
      db.execute(sql`
        SELECT COALESCE(SUM((total_amount_eur::numeric - paid_amount_eur::numeric)), 0)::float AS total
        FROM offline_coachings
        WHERE status != 'cancelled'
          AND total_amount_eur::numeric > paid_amount_eur::numeric
      `),
      [{ total: 0 }] as unknown as Awaited<ReturnType<typeof db.execute>>,
      'coachingsRemaining'
    ),
    safe(
      db
        .select({ c: count() })
        .from(testimonials)
        .where(eq(testimonials.status, 'pending')),
      [{ c: 0 }],
      'testimonialsPending'
    ),
    safe(
      db
        .select({ c: count() })
        .from(bookings)
        .where(eq(bookings.status, 'pending_admin')),
      [{ c: 0 }],
      'pendingAdmin'
    ),
    safe(
      db
        .select({ c: count() })
        .from(bookings)
        .where(
          and(
            eq(bookings.status, 'pending_payment'),
            lt(bookings.createdAt, threeDaysAgo)
          )
        ),
      [{ c: 0 }],
      'pendingPaymentStale'
    ),
    safe(
      db
        .select({ c: count() })
        .from(vipApplications)
        .where(
          and(
            eq(vipApplications.step, 'deposit_pending'),
            lt(vipApplications.currentStepEnteredAt, twoDaysAgo)
          )
        ),
      [{ c: 0 }],
      'vipDepositPending'
    ),
    safe(
      db.query.bookings.findMany({
        orderBy: [desc(bookings.createdAt)],
        limit: 6,
        with: { formation: true, user: true },
      }),
      [],
      'recentBookings'
    ),
    safe(
      db.query.payments.findMany({
        where: eq(payments.status, 'completed'),
        orderBy: [desc(payments.createdAt)],
        limit: 6,
        with: { user: { columns: { name: true } } },
      }),
      [],
      'recentPayments'
    ),
    safe(
      db.query.vipApplications.findMany({
        where: ne(vipApplications.step, 'link_generated'),
        orderBy: [desc(vipApplications.currentStepEnteredAt)],
        limit: 6,
        with: { user: { columns: { name: true } } },
      }),
      [],
      'recentVipTransitions'
    ),
    safe(
      db.query.bookings.findMany({
        where: and(
          isNotNull(bookings.confirmedDate),
          gte(
            bookings.confirmedDate,
            now.toISOString().slice(0, 10) as unknown as string
          )
        ),
        orderBy: [bookings.confirmedDate],
        limit: 5,
        with: { formation: true, user: true },
      }),
      [],
      'upcomingBookings'
    ),
    safe(getChannelMemberCount(), null, 'channelCount'),
    safe(
      getBotFeatures(),
      {
        quiz: true,
        economicAlerts: true,
        priceAlerts: true,
        referral: true,
        inline: true,
        calculators: true,
        streak: true,
        qualify: true,
      },
      'features'
    ),
  ]);

  // ============ DERIVED STATS ============
  const usersTotal = usersTotalRow[0]?.c ?? 0;
  const usersThisMonth = usersThisMonthRow[0]?.c ?? 0;
  const usersPrevMonth = usersPrevMonthRow[0]?.c ?? 0;
  const usersDelta = usersThisMonth - usersPrevMonth;

  const bookingsTotal = bookingsTotalRow[0]?.c ?? 0;
  const bookingsThisMonth = bookingsThisMonthRow[0]?.c ?? 0;

  const revenueThisMonth = Number(
    (revenueThisMonthAgg as unknown as Array<{ total: number }>)[0]?.total ?? 0
  );
  const revenueTotal = Number(
    (revenueTotalAgg as unknown as Array<{ total: number }>)[0]?.total ?? 0
  );
  const avgTicketRow = (avgTicketAgg as unknown as Array<{
    total: number;
    c: number;
  }>)[0];
  const avgTicket =
    avgTicketRow && avgTicketRow.c > 0
      ? avgTicketRow.total / avgTicketRow.c
      : 0;

  const vipInGroup = vipInGroupRow[0]?.c ?? 0;
  const vipQualified = vipQualifiedRow[0]?.c ?? 0;
  const cpaConversionPct =
    vipInGroup > 0 ? Math.round((vipQualified / vipInGroup) * 100) : 0;

  const coachingsActive = coachingsActiveRow[0]?.c ?? 0;
  const coachingsRemaining = Number(
    (coachingsRemainingAgg as unknown as Array<{ total: number }>)[0]?.total ??
      0
  );

  const enabledFeatures = Object.values(features).filter(Boolean).length;
  const totalFeatures = Object.keys(features).length;

  // ============ ACTIONS REQUISES ============
  const actions = [
    {
      key: 'pending_admin',
      label: 'réservation(s) à valider',
      count: pendingAdminRow[0]?.c ?? 0,
      href: '/admin/bookings/list',
      icon: CalendarCheck,
    },
    {
      key: 'pending_payment',
      label: 'paiement(s) en attente > 3j',
      count: pendingPaymentStaleRow[0]?.c ?? 0,
      href: '/admin/bookings/list',
      icon: CreditCard,
    },
    {
      key: 'vip_deposit',
      label: 'dépôt(s) VIP à valider > 2j',
      count: vipDepositPendingRow[0]?.c ?? 0,
      href: '/admin/vip',
      icon: Sparkles,
    },
    {
      key: 'testimonials',
      label: 'témoignage(s) à modérer',
      count: testimonialsPendingRow[0]?.c ?? 0,
      href: '/admin/testimonials',
      icon: MessageSquare,
    },
  ].filter((a) => a.count > 0);

  // ============ TIMELINE ACTIVITÉ ============
  type ActivityItem = {
    id: string;
    when: Date;
    type: 'booking' | 'payment' | 'vip';
    userName: string;
    text: string;
    badge?: { label: string; tone: 'success' | 'warning' | 'default' | 'danger' };
    href?: string;
  };

  const activity: ActivityItem[] = [
    ...recentBookings.map<ActivityItem>((b) => ({
      id: `b-${b.id}`,
      when: b.createdAt,
      type: 'booking' as const,
      userName: b.user.name,
      text: `${b.formation.title} · ${formatPrice(Number(b.formation.priceEur))}`,
      badge: {
        label: b.status,
        tone:
          b.status === 'confirmed' || b.status === 'paid'
            ? 'success'
            : b.status === 'pending_admin' || b.status === 'pending_payment'
            ? 'warning'
            : b.status === 'cancelled'
            ? 'danger'
            : 'default',
      },
      href: `/admin/bookings/list#${b.id}`,
    })),
    ...recentPayments.map<ActivityItem>((p) => ({
      id: `p-${p.id}`,
      when: p.createdAt,
      type: 'payment' as const,
      userName: p.user.name,
      text: `Paiement ${formatPrice(Number(p.amountEur))} via ${p.provider}`,
      badge: { label: 'payé', tone: 'success' },
    })),
    ...recentVipTransitions.map<ActivityItem>((v) => ({
      id: `v-${v.id}`,
      when: v.currentStepEnteredAt ?? v.createdAt,
      type: 'vip' as const,
      userName: v.user.name,
      text: `VIP step → ${v.step.replace('_', ' ')}`,
      badge: {
        label:
          v.step === 'in_group'
            ? 'membre'
            : v.step === 'ejected'
            ? 'éjecté'
            : 'en cours',
        tone:
          v.step === 'in_group'
            ? 'success'
            : v.step === 'ejected'
            ? 'danger'
            : 'default',
      },
      href: '/admin/vip',
    })),
  ]
    .sort((a, b) => b.when.getTime() - a.when.getTime())
    .slice(0, 12);

  // ============ FUNNEL VIP SNAPSHOT ============
  const vipStepMap = new Map(vipStepCounts.map((r) => [r.step, r.c]));
  const vipTotalApps = vipStepCounts.reduce((acc, r) => acc + r.c, 0);
  const funnelSteps = [
    {
      label: 'Lien généré',
      count:
        (vipStepMap.get('link_generated') ?? 0) +
        (vipStepMap.get('clicked') ?? 0) +
        (vipStepMap.get('signup_pending') ?? 0) +
        (vipStepMap.get('signup_validated') ?? 0) +
        (vipStepMap.get('deposit_pending') ?? 0) +
        (vipStepMap.get('deposit_validated') ?? 0) +
        (vipStepMap.get('telegram_invited') ?? 0) +
        (vipStepMap.get('in_group') ?? 0) +
        (vipStepMap.get('ejected') ?? 0),
    },
    {
      label: 'Inscription validée',
      count:
        (vipStepMap.get('signup_validated') ?? 0) +
        (vipStepMap.get('deposit_pending') ?? 0) +
        (vipStepMap.get('deposit_validated') ?? 0) +
        (vipStepMap.get('telegram_invited') ?? 0) +
        (vipStepMap.get('in_group') ?? 0) +
        (vipStepMap.get('ejected') ?? 0),
    },
    {
      label: 'Dépôt validé',
      count:
        (vipStepMap.get('deposit_validated') ?? 0) +
        (vipStepMap.get('telegram_invited') ?? 0) +
        (vipStepMap.get('in_group') ?? 0) +
        (vipStepMap.get('ejected') ?? 0),
    },
    {
      label: 'Dans le groupe VIP',
      count: vipInGroup,
    },
    {
      label: 'CPA qualifiés',
      count: vipQualified,
    },
  ];

  return (
    <AdminContainer>
      <AdminPageHeader
        title="Overview"
        description="Vue globale de la plateforme."
        actions={
          <span className="text-xs text-[var(--color-text-dim)]">
            Mis à jour {formatDate(now)}
          </span>
        }
      />

      {/* Actions requises (banner conditionnel) */}
      {actions.length > 0 && <ActionsBanner actions={actions} />}

      {/* 8 KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <KpiCard
          icon={<Users className="h-4 w-4" />}
          label="Utilisateurs"
          value={usersTotal}
          hint={
            usersDelta === 0
              ? `${usersThisMonth} ce mois`
              : `${usersDelta > 0 ? '+' : ''}${usersDelta} vs mois dernier`
          }
          tone="info"
        />
        <KpiCard
          icon={<CalendarCheck className="h-4 w-4" />}
          label="Réservations"
          value={bookingsTotal}
          hint={`+${bookingsThisMonth} ce mois`}
          tone="default"
        />
        <KpiCard
          icon={<Wallet className="h-4 w-4" />}
          label="CA ce mois"
          value={`${revenueThisMonth.toLocaleString('fr-FR')}€`}
          hint={`Total : ${revenueTotal.toLocaleString('fr-FR')}€`}
          tone="success"
        />
        <KpiCard
          icon={<Hash className="h-4 w-4" />}
          label="Panier moyen"
          value={
            avgTicket > 0
              ? `${Math.round(avgTicket).toLocaleString('fr-FR')}€`
              : '—'
          }
          hint={`${paidPaymentsRow[0]?.c ?? 0} paiement(s) OK`}
          tone="default"
        />
        <KpiCard
          icon={<Sparkles className="h-4 w-4" />}
          label="VIP in_group"
          value={vipInGroup}
          hint={`${vipQualified} CPA qualifiés`}
          tone="default"
        />
        <KpiCard
          icon={<Percent className="h-4 w-4" />}
          label="Conversion CPA"
          value={`${cpaConversionPct}%`}
          hint="qualifiés / in_group"
          tone={cpaConversionPct >= 50 ? 'success' : 'warning'}
        />
        <KpiCard
          icon={<Briefcase className="h-4 w-4" />}
          label="Coachings offline"
          value={coachingsActive}
          hint={
            coachingsRemaining > 0
              ? `${coachingsRemaining.toLocaleString('fr-FR')}€ reste dû`
              : '✓ tous soldés'
          }
          tone={coachingsRemaining > 0 ? 'warning' : 'default'}
        />
        <KpiCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Canal Telegram"
          value={
            channelCount !== null ? channelCount.toLocaleString('fr-FR') : '—'
          }
          hint={channelCount !== null ? 'membres' : 'config manquante'}
          tone={channelCount !== null ? 'info' : 'default'}
        />
      </div>

      {/* Mini-status row */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-5">
        <StatusChip
          icon={<Bot className="h-3.5 w-3.5" />}
          label="Bot Telegram"
          value={`${enabledFeatures}/${totalFeatures} features`}
          tone={enabledFeatures === totalFeatures ? 'success' : 'warning'}
          href="/admin/bot"
        />
        <StatusChip
          icon={<CalendarClock className="h-3.5 w-3.5" />}
          label="Calendrier"
          value={`${upcomingBookings.length} session(s) à venir`}
          tone="default"
          href="/admin/calendar"
        />
        <StatusChip
          icon={<CheckCircle2 className="h-3.5 w-3.5" />}
          label="Funnel VIP"
          value={`${vipTotalApps} apps · ${cpaConversionPct}% CPA`}
          tone="default"
          href="/admin/funnel"
        />
      </div>

      {/* Split 2/3 + 1/3 */}
      <div className="grid lg:grid-cols-[2fr_1fr] gap-4">
        <ActivityTimeline items={activity} />
        <div className="space-y-4">
          <UpcomingSessions items={upcomingBookings} />
          <FunnelSnapshot
            steps={funnelSteps}
            total={vipTotalApps}
          />
        </div>
      </div>
    </AdminContainer>
  );
}

// ============================================================
// COMPOSANTS
// ============================================================

function ActionsBanner({
  actions,
}: {
  actions: Array<{
    key: string;
    label: string;
    count: number;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
  }>;
}) {
  return (
    <div className="mb-5 rounded-[var(--radius-lg)] border border-amber-500/30 bg-amber-500/5 p-3 md:p-4">
      <div className="flex items-start gap-3 mb-3">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-300 light:text-amber-700 flex-shrink-0 mt-0.5">
          <AlertCircle className="h-4 w-4" />
        </span>
        <div>
          <div className="text-sm font-semibold">Actions requises</div>
          <p className="text-xs text-[var(--color-text-dim)]">
            Choses qui demandent ton attention immédiate.
          </p>
        </div>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
        {actions.map((a) => (
          <Link
            key={a.key}
            href={a.href}
            className="flex items-center gap-2.5 rounded-[var(--radius-md)] bg-[var(--color-surface-tint)] hover:bg-[var(--color-surface-tint-strong)] border border-[var(--color-border)] p-2.5 transition-colors group"
          >
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-amber-500/10 border border-amber-500/25 text-amber-300 light:text-amber-700 flex-shrink-0">
              <a.icon className="h-3.5 w-3.5" />
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium tabular-nums">
                {a.count}
              </div>
              <div className="text-[10px] text-[var(--color-text-dim)] leading-tight truncate">
                {a.label}
              </div>
            </div>
            <ArrowUpRight className="h-3.5 w-3.5 text-[var(--color-text-faint)] group-hover:text-[var(--color-text)] transition-colors flex-shrink-0" />
          </Link>
        ))}
      </div>
    </div>
  );
}

const TONE_BG: Record<'default' | 'info' | 'success' | 'warning' | 'danger', string> = {
  default:
    'bg-[var(--color-surface-tint-strong)] border-[var(--color-border)] text-[var(--color-text-dim)]',
  info: 'bg-indigo-500/15 border-indigo-500/30 text-indigo-300 light:text-indigo-700',
  success:
    'bg-emerald-500/15 border-emerald-500/30 text-emerald-300 light:text-emerald-700',
  warning: 'bg-amber-400/15 border-amber-400/30 text-amber-300 light:text-amber-700',
  danger: 'bg-rose-500/15 border-rose-500/30 text-rose-300 light:text-rose-700',
};

function KpiCard({
  icon,
  label,
  value,
  hint,
  tone = 'default',
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: 'default' | 'info' | 'success' | 'warning' | 'danger';
}) {
  return (
    <div className="glass rounded-[var(--radius-lg)] p-4">
      <div className="flex items-center gap-2.5">
        <span
          className={cn(
            'inline-flex h-8 w-8 items-center justify-center rounded-md border flex-shrink-0',
            TONE_BG[tone]
          )}
        >
          {icon}
        </span>
        <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-dim)]">
          {label}
        </span>
      </div>
      <div className="mt-2.5 text-xl md:text-2xl font-semibold tabular-nums">
        {value}
      </div>
      {hint && (
        <div className="mt-0.5 text-[11px] text-[var(--color-text-dim)] truncate">
          {hint}
        </div>
      )}
    </div>
  );
}

function StatusChip({
  icon,
  label,
  value,
  tone,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: 'default' | 'success' | 'warning' | 'danger';
  href: string;
}) {
  return (
    <Link
      href={href}
      className="glass rounded-[var(--radius-md)] px-3 py-2 flex items-center gap-2.5 hover:bg-[var(--color-surface-tint)] transition-colors group"
    >
      <span
        className={cn(
          'inline-flex h-7 w-7 items-center justify-center rounded-md border flex-shrink-0',
          TONE_BG[tone]
        )}
      >
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-dim)]">
          {label}
        </div>
        <div className="text-xs font-medium truncate">{value}</div>
      </div>
      <ArrowUpRight className="h-3 w-3 text-[var(--color-text-faint)] group-hover:text-[var(--color-text)] flex-shrink-0" />
    </Link>
  );
}

interface ActivityItem {
  id: string;
  when: Date;
  type: 'booking' | 'payment' | 'vip';
  userName: string;
  text: string;
  badge?: { label: string; tone: 'success' | 'warning' | 'default' | 'danger' };
  href?: string;
}

function ActivityTimeline({ items }: { items: ActivityItem[] }) {
  return (
    <div className="glass rounded-[var(--radius-lg)] p-5">
      <div className="flex items-baseline justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold">Activité récente</h2>
          <p className="text-xs text-[var(--color-text-dim)] mt-0.5">
            Réservations, paiements et transitions VIP — toutes sources mélangées.
          </p>
        </div>
        <Link
          href="/admin/audit"
          className="text-xs text-[var(--color-text-dim)] hover:text-[var(--color-text)] inline-flex items-center gap-1"
        >
          Audit log
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      {items.length === 0 ? (
        <div className="py-10 text-center text-sm text-[var(--color-text-dim)]">
          Aucune activité pour le moment.
        </div>
      ) : (
        <div className="space-y-0">
          {items.map((item, i) => (
            <ActivityRow key={item.id} item={item} isLast={i === items.length - 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function ActivityRow({
  item,
  isLast,
}: {
  item: ActivityItem;
  isLast: boolean;
}) {
  const TYPE_ICON: Record<ActivityItem['type'], React.ReactNode> = {
    booking: <CalendarCheck className="h-3.5 w-3.5" />,
    payment: <CreditCard className="h-3.5 w-3.5" />,
    vip: <Sparkles className="h-3.5 w-3.5" />,
  };
  const TYPE_TONE: Record<ActivityItem['type'], string> = {
    booking: 'bg-indigo-500/15 border-indigo-500/30 text-indigo-300 light:text-indigo-700',
    payment: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300 light:text-emerald-700',
    vip: 'bg-pink-500/15 border-pink-500/30 text-pink-300 light:text-pink-700',
  };

  const content = (
    <div className="flex items-start gap-3 py-2.5 relative">
      {/* Dot + ligne verticale connectrice */}
      <div className="flex-shrink-0 flex flex-col items-center pt-0.5">
        <span
          className={cn(
            'inline-flex h-6 w-6 items-center justify-center rounded-full border',
            TYPE_TONE[item.type]
          )}
        >
          {TYPE_ICON[item.type]}
        </span>
        {!isLast && (
          <span className="w-px flex-1 bg-[var(--color-border)] mt-1" />
        )}
      </div>
      <div className="flex-1 min-w-0 pb-2">
        <div className="flex items-baseline justify-between gap-2 flex-wrap">
          <div className="text-sm font-medium truncate">{item.userName}</div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {item.badge && (
              <Badge variant={item.badge.tone} className="text-[10px]">
                {item.badge.label}
              </Badge>
            )}
            <span className="text-[10px] text-[var(--color-text-faint)] tabular-nums">
              {timeAgo(item.when)}
            </span>
          </div>
        </div>
        <div className="text-xs text-[var(--color-text-dim)] truncate">
          {item.text}
        </div>
      </div>
    </div>
  );

  return item.href ? (
    <Link
      href={item.href}
      className="block hover:bg-[var(--color-surface-tint)] -mx-2 px-2 rounded-md transition-colors"
    >
      {content}
    </Link>
  ) : (
    <div className="-mx-2 px-2">{content}</div>
  );
}

function UpcomingSessions({
  items,
}: {
  items: Array<{
    id: string;
    confirmedDate: string | null;
    formation: { title: string; mode: 'remote' | 'onsite' };
    user: { name: string };
  }>;
}) {
  return (
    <div className="glass rounded-[var(--radius-lg)] p-5">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-sm font-semibold">Sessions à venir</h3>
        <Link
          href="/admin/calendar"
          className="text-xs text-[var(--color-accent-hover)] hover:underline inline-flex items-center gap-1"
        >
          Calendrier
          <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>
      {items.length === 0 ? (
        <div className="py-6 text-center text-xs text-[var(--color-text-dim)]">
          Aucune session confirmée à venir.
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((b) => (
            <div
              key={b.id}
              className="flex items-center gap-3 rounded-[var(--radius-md)] bg-[var(--color-surface-tint)] border border-[var(--color-border)] px-3 py-2"
            >
              <div className="text-center flex-shrink-0">
                <div className="text-[10px] uppercase text-[var(--color-text-faint)]">
                  {b.confirmedDate &&
                    new Date(b.confirmedDate).toLocaleDateString('fr-FR', {
                      month: 'short',
                    })}
                </div>
                <div className="text-base font-mono font-semibold tabular-nums">
                  {b.confirmedDate &&
                    new Date(b.confirmedDate).getDate().toString().padStart(2, '0')}
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium truncate">{b.user.name}</div>
                <div className="text-[10px] text-[var(--color-text-dim)] truncate">
                  {b.formation.title}
                </div>
              </div>
              <Badge
                variant={b.formation.mode === 'onsite' ? 'gold' : 'default'}
                className="text-[10px] flex-shrink-0"
              >
                {b.formation.mode === 'onsite' ? 'Dubaï' : 'Distance'}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FunnelSnapshot({
  steps,
  total,
}: {
  steps: Array<{ label: string; count: number }>;
  total: number;
}) {
  return (
    <div className="glass rounded-[var(--radius-lg)] p-5">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-sm font-semibold">Funnel VIP</h3>
        <Link
          href="/admin/funnel"
          className="text-xs text-[var(--color-accent-hover)] hover:underline inline-flex items-center gap-1"
        >
          Détail
          <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>
      {total === 0 ? (
        <div className="py-6 text-center text-xs text-[var(--color-text-dim)]">
          Aucune app VIP pour le moment.
        </div>
      ) : (
        <div className="space-y-2">
          {steps.map((s, i) => {
            const pct = total > 0 ? (s.count / total) * 100 : 0;
            return (
              <div key={s.label}>
                <div className="flex items-baseline justify-between gap-2 mb-1">
                  <span className="text-[11px] text-[var(--color-text-dim)] truncate">
                    {i + 1}. {s.label}
                  </span>
                  <span className="text-xs font-mono tabular-nums font-semibold flex-shrink-0">
                    {s.count}
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-[var(--color-surface-tint)] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-pink-500"
                    style={{ width: `${Math.max(pct, 2)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function timeAgo(d: Date): string {
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}j`;
  return formatDate(d);
}
