import Link from 'next/link';
import { redirect } from 'next/navigation';
import { count, desc, eq, sql } from 'drizzle-orm';
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock,
  CreditCard,
  GraduationCap,
  MessageCircle,
  Send,
  Sparkles,
  Trophy,
  Users,
  XCircle,
} from 'lucide-react';
import { db } from '@/lib/db';
import {
  bookings,
  formations,
  manualIronfxStatus,
  users,
  vipApplications,
} from '@/lib/db/schema';
import { requireAuth } from '@/lib/auth/server';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Section } from '@/components/shared/section';
import { DeleteCancelledBooking } from '@/components/formation/delete-cancelled-booking';
import { TradingHero } from '@/components/shared/trading-hero';
import { ReferralLinkCopy } from '@/components/dashboard/referral-link-copy';
import { ProposedDateActions } from '@/components/formation/proposed-date-actions';
import { buildReferralLink, ensureReferralCode } from '@/lib/referrals';
import { getChannelMemberCount } from '@/lib/telegram/community-stats';
import { cn, formatDate, formatPrice } from '@/lib/utils';

export const dynamic = 'force-dynamic';

/**
 * Dashboard user — vue 2 colonnes compacte.
 *
 * Layout :
 *  - Hero "Mon espace" avec sparkline en background + 3 KPI à droite
 *  - Split 2/3 + 1/3 :
 *    - Gauche : Mes réservations + Parrainage
 *    - Droite : 4 cards latérales (VIP / Formation / Canal / Bot)
 */
export default async function DashboardPage() {
  const session = await requireAuth();

  if (!session.user.email || !session.user.onboardingCompletedAt) {
    redirect('/onboarding');
  }

  const referralCode = await ensureReferralCode(session.user.id);

  const [userBookings, vipApp, myReferrals, topReferrer, channelCount] =
    await Promise.all([
      db.query.bookings.findMany({
        where: eq(bookings.userId, session.user.id),
        orderBy: [desc(bookings.createdAt)],
        with: { formation: true },
      }),
      db.query.vipApplications.findFirst({
        where: eq(vipApplications.userId, session.user.id),
      }),
      db
        .select({ c: count() })
        .from(users)
        .where(eq(users.referredBy, session.user.id))
        .then((r) => r[0]?.c ?? 0),
      db
        .select({
          userId: users.referredBy,
          firstName: sql<string>`max(referrer.telegram_first_name)`,
          username: sql<string>`max(referrer.telegram_username)`,
          c: count(),
        })
        .from(users)
        .leftJoin(sql`users as referrer`, sql`referrer.id = ${users.referredBy}`)
        .where(sql`${users.referredBy} IS NOT NULL`)
        .groupBy(users.referredBy)
        .orderBy(desc(count()))
        .limit(3),
      getChannelMemberCount(),
    ]);

  let tradingProgressPct = 0;
  let cpaQualified = false;
  if (vipApp?.brokerAccountId && vipApp.step === 'in_group') {
    const st = await db.query.manualIronfxStatus.findFirst({
      where: eq(manualIronfxStatus.accountId, vipApp.brokerAccountId),
    });
    if (st) {
      tradingProgressPct = st.tradingProgressPct;
      cpaQualified = st.cpaQualified;
    }
  }

  const firstName = session.user.telegramFirstName ?? session.user.name ?? '';
  const botUsername = process.env.TELEGRAM_BOT_USERNAME;
  const channelUrl = process.env.NEXT_PUBLIC_TELEGRAM_CHANNEL_URL;

  // Stats hero
  const pendingBookings = userBookings.filter(
    (b) => b.status === 'pending_admin' || b.status === 'pending_payment'
  );
  const inscritsCount = userBookings.filter(
    (b) =>
      b.status === 'confirmed' ||
      b.status === 'paid' ||
      b.status === 'date_proposed'
  ).length;

  // Réservations affichées dans le panneau gauche : on cache cancelled
  // sauf si l'user a SEULEMENT des cancelled (pour qu'il puisse les voir/supprimer).
  const visibleBookings = userBookings.filter((b) => b.status !== 'completed');
  const reservationsToShow = visibleBookings.slice(0, 3);

  return (
    <Section
      className="pt-6 md:pt-8 pb-10"
      containerClassName="space-y-5 md:space-y-7"
    >
      {/* HERO "Mon espace" */}
      <HeroBlock
        firstName={firstName}
        pendingCount={pendingBookings.length}
        formationsCount={inscritsCount}
        channelCount={channelCount}
      />

      {/* SPLIT 2 colonnes */}
      <div className="grid lg:grid-cols-[2fr_1fr] gap-4">
        {/* COL GAUCHE */}
        <div className="space-y-4 min-w-0">
          <BookingsCard
            bookings={reservationsToShow}
            totalCount={visibleBookings.length}
          />
          <ReferralCard
            myReferrals={myReferrals}
            referralLink={buildReferralLink(
              botUsername,
              process.env.NEXT_PUBLIC_APP_URL,
              referralCode
            )}
            botUsername={botUsername}
            topReferrer={topReferrer.map((r) => ({
              firstName: r.firstName,
              username: r.username,
              count: r.c,
            }))}
          />
        </div>

        {/* COL DROITE — 4 cards compactes */}
        <div className="space-y-3">
          <VipSideCard
            application={vipApp ?? null}
            tradingProgressPct={tradingProgressPct}
            cpaQualified={cpaQualified}
          />
          <FormationSideCard hasBooking={inscritsCount > 0} />
          <ChannelSideCard channelUrl={channelUrl} count={channelCount} />
          <BotCtaCard botUsername={botUsername} />
        </div>
      </div>
    </Section>
  );
}

// ============================================================
// HERO
// ============================================================

function HeroBlock({
  firstName,
  pendingCount,
  formationsCount,
  channelCount,
}: {
  firstName: string;
  pendingCount: number;
  formationsCount: number;
  channelCount: number | null;
}) {
  return (
    <div className="relative isolate overflow-hidden rounded-[var(--radius-xl)] glass border border-[var(--color-border)]">
      {/* Sparkline en background */}
      <div className="absolute inset-0 -z-10 opacity-25 light:opacity-50 pointer-events-none">
        <TradingHero />
      </div>

      <div className="p-5 md:p-7 grid md:grid-cols-[1fr_auto] gap-5 items-end">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-dim)]">
            Mon espace
          </p>
          <h1 className="mt-1 font-serif text-3xl md:text-5xl">
            Salut {firstName}
            <span className="text-[var(--color-accent-2)]">.</span>
          </h1>
        </div>

        {/* 3 stat cards alignées à droite */}
        <div className="flex flex-wrap md:flex-nowrap gap-2.5">
          <HeroStat
            icon={<CalendarDays className="h-4 w-4" />}
            label="Réservation"
            value={pendingCount}
            sub={pendingCount > 0 ? 'En attente' : 'Aucune en cours'}
            tone="warning"
          />
          <HeroStat
            icon={<GraduationCap className="h-4 w-4" />}
            label="Formations"
            value={formationsCount}
            sub={formationsCount > 1 ? 'Inscrites' : 'Inscrite'}
            tone="default"
          />
          <HeroStat
            icon={<Users className="h-4 w-4" />}
            label="Membres"
            value={
              channelCount !== null ? channelCount.toLocaleString('fr-FR') : '—'
            }
            sub="Canal Telegram"
            tone="success"
          />
        </div>
      </div>
    </div>
  );
}

function HeroStat({
  icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub: string;
  tone: 'default' | 'warning' | 'success';
}) {
  const TONE_BG = {
    default:
      'bg-[var(--color-surface-tint-strong)] border-[var(--color-border)] text-[var(--color-text-dim)]',
    warning:
      'bg-amber-500/15 border-amber-500/30 text-amber-300 light:text-amber-700',
    success:
      'bg-emerald-500/15 border-emerald-500/30 text-emerald-300 light:text-emerald-700',
  };
  return (
    <div className="rounded-[var(--radius-md)] bg-[var(--color-bg-elevated)]/60 backdrop-blur-sm border border-[var(--color-border)] px-3.5 py-2.5 min-w-[140px]">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'inline-flex h-7 w-7 items-center justify-center rounded-md border',
            TONE_BG[tone]
          )}
        >
          {icon}
        </span>
        <span className="text-[9px] uppercase tracking-wider text-[var(--color-text-dim)]">
          {label}
        </span>
      </div>
      <div className="mt-1.5 text-xl md:text-2xl font-semibold tabular-nums leading-none">
        {value}
      </div>
      <div className="mt-1 text-[10px] text-[var(--color-text-dim)]">{sub}</div>
    </div>
  );
}

// ============================================================
// BOOKINGS CARD
// ============================================================

type BookingWithFormation = typeof bookings.$inferSelect & {
  formation: typeof formations.$inferSelect;
};

function BookingsCard({
  bookings: rows,
  totalCount,
}: {
  bookings: BookingWithFormation[];
  totalCount: number;
}) {
  return (
    <div className="glass rounded-[var(--radius-lg)] p-5 md:p-6">
      <div className="flex items-baseline justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 light:text-indigo-700">
            <CalendarDays className="h-3.5 w-3.5" />
          </span>
          <h2 className="text-sm font-semibold">Mes réservations</h2>
        </div>
        {totalCount > 3 ? (
          <Link
            href="/formation"
            className="text-xs text-[var(--color-text-dim)] hover:text-[var(--color-text)] inline-flex items-center gap-1"
          >
            Voir toutes
            <ArrowRight className="h-3 w-3" />
          </Link>
        ) : (
          <Button asChild size="sm" variant="ghost" className="h-7">
            <Link href="/formation/reserver">
              <ArrowRight className="h-3.5 w-3.5" />
              Nouvelle
            </Link>
          </Button>
        )}
      </div>

      {rows.length === 0 ? (
        <EmptyBookings />
      ) : (
        <div className="space-y-3">
          {rows.map((b) => (
            <BookingRow key={b.id} booking={b} />
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyBookings() {
  return (
    <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] p-8 text-center">
      <CalendarDays className="h-7 w-7 text-[var(--color-text-faint)] mx-auto" />
      <p className="mt-3 text-sm text-[var(--color-text-dim)]">
        Aucune réservation pour le moment.
      </p>
      <Button asChild size="sm" className="mt-4">
        <Link href="/formation/reserver">
          Réserver ma première formation
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </Button>
    </div>
  );
}

const STATUS_CONFIG: Record<
  BookingWithFormation['status'],
  { label: string; variant: 'success' | 'warning' | 'danger' | 'secondary' }
> = {
  pending_payment: { label: 'Paiement en attente', variant: 'warning' },
  pending_admin: { label: 'En attente de validation', variant: 'warning' },
  date_proposed: { label: 'Date alternative proposée', variant: 'warning' },
  confirmed: { label: 'Confirmé', variant: 'success' },
  paid: { label: 'Payé', variant: 'success' },
  completed: { label: 'Terminée', variant: 'secondary' },
  cancelled: { label: 'Annulée', variant: 'danger' },
};

function BookingRow({ booking }: { booking: BookingWithFormation }) {
  const conf = STATUS_CONFIG[booking.status];
  const formation = booking.formation;

  return (
    <div className="rounded-[var(--radius-md)] bg-[var(--color-surface-tint)] border border-[var(--color-border)] p-4 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <Badge variant={conf.variant} className="text-[10px]">
              {conf.label}
            </Badge>
            <span className="text-[10px] text-[var(--color-text-faint)] font-mono">
              #{booking.id.slice(0, 8)}
            </span>
          </div>
          <h3 className="font-medium text-sm">{formation.title}</h3>
          <p className="text-xs text-[var(--color-text-dim)] mt-0.5">
            {booking.confirmedDate
              ? `Confirmé · ${formatDate(booking.confirmedDate)}`
              : booking.preferredAsap
              ? 'Dès que possible'
              : 'Dates proposées en attente'}
          </p>
        </div>
        <div className="sm:text-right flex sm:flex-col items-center sm:items-end gap-2 sm:gap-1.5">
          <div className="font-mono text-sm font-semibold tabular-nums">
            {formatPrice(Number(formation.priceEur))}
          </div>
          {booking.status === 'pending_payment' && (
            <Button asChild size="sm">
              <Link href={`/checkout/${booking.id}`}>
                <CreditCard className="h-3 w-3" />
                Finaliser le paiement
              </Link>
            </Button>
          )}
          {booking.status === 'completed' && (
            <Button asChild size="sm" variant="secondary">
              <Link href={`/formation/${booking.id}`}>
                Ressources
                <ArrowRight className="h-3 w-3" />
              </Link>
            </Button>
          )}
        </div>
      </div>

      {booking.status === 'date_proposed' && booking.adminProposedDate && (
        <ProposedDateBlock
          bookingId={booking.id}
          proposedDate={booking.adminProposedDate}
          adminNotes={booking.adminNotes}
        />
      )}

      {booking.paymentPlan === 'installments_3x' &&
        booking.installmentsPaid < booking.installmentTotal &&
        booking.status !== 'cancelled' && (
          <InstallmentsBlock
            bookingId={booking.id}
            installmentsPaid={booking.installmentsPaid}
            installmentTotal={booking.installmentTotal}
            priceEur={Number(formation.priceEur)}
          />
        )}

      {booking.status === 'cancelled' && (
        <div className="rounded-[var(--radius-md)] bg-rose-500/10 border border-rose-500/20 p-3 space-y-2">
          {booking.adminNotes && (
            <p className="text-xs text-[var(--color-text)] italic">
              «{booking.adminNotes}»
            </p>
          )}
          <div className="flex items-center justify-end">
            <DeleteCancelledBooking bookingId={booking.id} />
          </div>
        </div>
      )}
    </div>
  );
}

function ProposedDateBlock({
  bookingId,
  proposedDate,
  adminNotes,
}: {
  bookingId: string;
  proposedDate: string;
  adminNotes: string | null;
}) {
  return (
    <div className="rounded-[var(--radius-md)] bg-amber-500/10 border border-amber-500/25 p-3 space-y-2">
      <div>
        <div className="text-[10px] font-medium text-amber-200 light:text-amber-800 uppercase tracking-wider">
          L&apos;équipe te propose une autre date
        </div>
        <div className="mt-0.5 text-sm font-medium">
          {formatDate(proposedDate)}
        </div>
        {adminNotes && (
          <p className="text-xs text-[var(--color-text-dim)] mt-1 italic">
            « {adminNotes} »
          </p>
        )}
      </div>
      <ProposedDateActions bookingId={bookingId} />
    </div>
  );
}

function InstallmentsBlock({
  bookingId,
  installmentsPaid,
  installmentTotal,
  priceEur,
}: {
  bookingId: string;
  installmentsPaid: number;
  installmentTotal: number;
  priceEur: number;
}) {
  const perInstallment =
    Math.round((priceEur / installmentTotal) * 100) / 100;
  return (
    <div className="rounded-[var(--radius-md)] bg-indigo-500/8 border border-indigo-500/25 p-3 space-y-2">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <div className="text-xs">
          <strong className="font-mono tabular-nums">
            {installmentsPaid}/{installmentTotal}
          </strong>{' '}
          échéances · {perInstallment}€ chacune
        </div>
        <Button asChild size="sm">
          <Link href={`/checkout/${bookingId}?next=1`}>
            <CreditCard className="h-3 w-3" />
            Payer l&apos;échéance {installmentsPaid + 1}
          </Link>
        </Button>
      </div>
      <div className="flex gap-1">
        {Array.from({ length: installmentTotal }).map((_, i) => (
          <div
            key={i}
            className={cn(
              'h-1 flex-1 rounded-full',
              i < installmentsPaid
                ? 'bg-emerald-400'
                : i === installmentsPaid
                ? 'bg-indigo-400'
                : 'bg-[var(--color-surface-tint-strong)]'
            )}
          />
        ))}
      </div>
    </div>
  );
}

// ============================================================
// REFERRAL CARD
// ============================================================

function ReferralCard({
  myReferrals,
  referralLink,
  botUsername,
  topReferrer,
}: {
  myReferrals: number;
  referralLink: string;
  botUsername: string | undefined;
  topReferrer: Array<{
    firstName: string | null;
    username: string | null;
    count: number;
  }>;
}) {
  return (
    <div className="glass rounded-[var(--radius-lg)] p-5 md:p-6">
      <div className="flex items-center gap-2.5 mb-3">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-pink-500/15 border border-pink-500/30 text-pink-300 light:text-pink-700">
          <Sparkles className="h-3.5 w-3.5" />
        </span>
        <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-dim)]">
          Parrainage
        </span>
      </div>

      <h3 className="text-xl md:text-2xl font-semibold leading-tight">
        Tu as parrainé{' '}
        <span className="text-gradient">
          {myReferrals} personne{myReferrals > 1 ? 's' : ''}
        </span>
      </h3>
      <p className="mt-1.5 text-xs text-[var(--color-text-dim)]">
        Partage ton lien : tes filleuls te sont attribués automatiquement.
      </p>

      <div className="mt-4">
        <ReferralLinkCopy
          link={referralLink}
          shareText="Rejoins-moi sur Boursikotons — formation trading + groupe VIP gratuit."
        />
      </div>

      {botUsername && (
        <Link
          href={`https://t.me/${botUsername}?start=hello`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-2 text-[11px] text-[var(--color-text-dim)] hover:text-[var(--color-text)]"
        >
          <MessageCircle className="h-3 w-3" />
          Ou via la commande /invite du bot
        </Link>
      )}

      {/* Podium top parrains — affiché seulement si data */}
      {topReferrer.length > 0 && (
        <div className="mt-5 pt-5 border-t border-[var(--color-border)]">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-[var(--color-text-dim)] mb-3">
            <Trophy className="h-3 w-3" />
            Top parrains all-time
          </div>
          <ol className="space-y-1.5">
            {topReferrer.map((r, i) => {
              const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉';
              const name = r.username
                ? `@${r.username}`
                : r.firstName ?? 'Anonyme';
              return (
                <li
                  key={i}
                  className="flex items-center justify-between rounded-md bg-[var(--color-surface-tint)] px-2.5 py-1.5"
                >
                  <span className="text-xs font-medium">
                    {medal} {name}
                  </span>
                  <span className="font-mono tabular-nums text-xs text-[var(--color-text-dim)]">
                    {r.count}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </div>
  );
}

// ============================================================
// SIDE CARDS (colonne droite)
// ============================================================

const VIP_STEPS_ORDER = [
  'link_generated',
  'signup_pending',
  'signup_validated',
  'deposit_pending',
  'deposit_validated',
  'telegram_invited',
  'in_group',
] as const;

function SideCard({
  href,
  icon,
  label,
  title,
  sub,
  tone = 'default',
  external,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  title: string;
  sub?: string;
  tone?: 'default' | 'success' | 'info' | 'warning';
  external?: boolean;
  children?: React.ReactNode;
}) {
  const TONE_BORDER = {
    default: 'border-[var(--color-border)] hover:bg-[var(--color-surface-tint)]',
    success:
      'border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10',
    info: 'border-indigo-500/30 bg-indigo-500/5 hover:bg-indigo-500/10',
    warning:
      'border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10',
  };
  const ICON_TONE = {
    default: 'text-[var(--color-text-dim)]',
    success: 'text-emerald-300 light:text-emerald-700',
    info: 'text-indigo-300 light:text-indigo-700',
    warning: 'text-amber-300 light:text-amber-700',
  };

  return (
    <Link
      href={href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
      className={cn(
        'glass rounded-[var(--radius-lg)] border p-4 block transition-colors group',
        TONE_BORDER[tone]
      )}
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5">
          <span className={cn('inline-flex items-center', ICON_TONE[tone])}>
            {icon}
          </span>
          <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-dim)] font-medium">
            {label}
          </span>
        </div>
        <ArrowRight className="h-3 w-3 text-[var(--color-text-faint)] group-hover:text-[var(--color-text)] group-hover:translate-x-0.5 transition-all" />
      </div>
      <div className="text-sm font-semibold leading-tight">{title}</div>
      {sub && (
        <div className="mt-0.5 text-[11px] text-[var(--color-text-dim)]">
          {sub}
        </div>
      )}
      {children}
    </Link>
  );
}

function VipSideCard({
  application,
  tradingProgressPct,
  cpaQualified,
}: {
  application: typeof vipApplications.$inferSelect | null;
  tradingProgressPct: number;
  cpaQualified: boolean;
}) {
  const step = application?.step;
  const isInGroup = step === 'in_group';
  const isEjected = step === 'ejected';
  const inProgress = step && !isInGroup && !isEjected;
  const stepNum = step
    ? VIP_STEPS_ORDER.indexOf(step as (typeof VIP_STEPS_ORDER)[number]) + 1
    : 0;
  const href = isEjected ? '/dashboard/ejected' : '/vip';

  const title = isInGroup
    ? cpaQualified
      ? 'Qualifié ✓'
      : 'Dans le groupe'
    : isEjected
    ? 'Tu as quitté'
    : inProgress
    ? `Étape ${stepNum}/7`
    : 'Pas démarré';

  const Icon = isInGroup
    ? CheckCircle2
    : isEjected
    ? XCircle
    : inProgress
    ? Clock
    : Sparkles;

  const tone: 'success' | 'warning' | 'info' = isInGroup
    ? 'success'
    : isEjected
    ? 'warning'
    : 'info';

  const progressPct = isInGroup
    ? Math.max(2, tradingProgressPct)
    : inProgress
    ? (stepNum / 7) * 100
    : 0;

  return (
    <SideCard
      href={href}
      icon={<Icon className="h-3.5 w-3.5" />}
      label="VIP Telegram"
      title={title}
      tone={tone}
    >
      {(isInGroup || inProgress) && (
        <div className="mt-2 h-1 w-full rounded-full bg-[var(--color-surface-tint)] overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all',
              cpaQualified
                ? 'bg-emerald-400'
                : 'bg-gradient-to-r from-indigo-400 to-pink-400'
            )}
            style={{ width: `${progressPct}%` }}
          />
        </div>
      )}
    </SideCard>
  );
}

function FormationSideCard({ hasBooking }: { hasBooking: boolean }) {
  return (
    <SideCard
      href={hasBooking ? '/formation' : '/formation/reserver'}
      icon={<GraduationCap className="h-3.5 w-3.5" />}
      label="Formation"
      title={hasBooking ? 'Mes formations' : 'Réserver une formation'}
      sub={hasBooking ? 'Voir ma session' : '1500€ distance · 3500€ Dubaï'}
    />
  );
}

function ChannelSideCard({
  channelUrl,
  count,
}: {
  channelUrl: string | undefined;
  count: number | null;
}) {
  if (!channelUrl) {
    return (
      <SideCard
        href="#"
        icon={<MessageCircle className="h-3.5 w-3.5" />}
        label="Canal Telegram"
        title="Bientôt disponible"
        sub="Annonces & alertes"
      />
    );
  }
  return (
    <SideCard
      href={channelUrl}
      external
      icon={<MessageCircle className="h-3.5 w-3.5" />}
      label="Canal Telegram"
      title={
        count !== null
          ? `${count.toLocaleString('fr-FR')} membres`
          : 'Notre canal public'
      }
      sub="Contenu gratuit, ouvert à tous"
    />
  );
}

function BotCtaCard({ botUsername }: { botUsername: string | undefined }) {
  if (!botUsername) return null;
  return (
    <Link
      href={`https://t.me/${botUsername}?start=hello`}
      target="_blank"
      rel="noopener noreferrer"
      className="glass rounded-[var(--radius-lg)] border border-indigo-500/30 bg-indigo-500/5 hover:bg-indigo-500/10 p-4 block transition-colors group"
    >
      <div className="flex items-start gap-3">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 light:text-indigo-700 flex-shrink-0">
          <Send className="h-4 w-4" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-[var(--color-text)] leading-relaxed">
            Envoie{' '}
            <code className="font-mono text-[var(--color-accent-hover)]">
              /start
            </code>{' '}
            à{' '}
            <span className="font-medium underline underline-offset-2">
              @{botUsername}
            </span>
          </p>
          <p className="mt-1 text-[11px] text-[var(--color-text-dim)]">
            pour recevoir tes notifications sur Telegram.
          </p>
        </div>
      </div>
    </Link>
  );
}
