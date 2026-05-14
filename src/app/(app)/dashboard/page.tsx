import Link from 'next/link';
import { redirect } from 'next/navigation';
import { count, desc, eq, sql } from 'drizzle-orm';
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock,
  CreditCard,
  Gift,
  MessageCircle,
  Sparkles,
  Trophy,
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
import { ProposedDateActions } from '@/components/formation/proposed-date-actions';
import { DeleteCancelledBooking } from '@/components/formation/delete-cancelled-booking';
import { TradingHero } from '@/components/shared/trading-hero';
import { ReferralLinkCopy } from '@/components/dashboard/referral-link-copy';
import { buildReferralLink, ensureReferralCode } from '@/lib/referrals';
import { getChannelMemberCount } from '@/lib/telegram/community-stats';
import { cn, formatDate, formatPrice } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const session = await requireAuth();

  if (!session.user.email || !session.user.onboardingCompletedAt) {
    redirect('/onboarding');
  }

  const referralCode = await ensureReferralCode(session.user.id);

  const [userBookings, vipApp, myReferrals, topReferrer, channelCount] = await Promise.all([
    db.query.bookings.findMany({
      where: eq(bookings.userId, session.user.id),
      orderBy: [desc(bookings.createdAt)],
      with: { formation: true },
    }),
    db.query.vipApplications.findFirst({
      where: eq(vipApplications.userId, session.user.id),
    }),
    // Combien j'ai parrainé
    db
      .select({ c: count() })
      .from(users)
      .where(eq(users.referredBy, session.user.id))
      .then((r) => r[0]?.c ?? 0),
    // Top parrain global (utilisé pour la mini-section "podium")
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
    // Count membres du canal Telegram (best-effort, cache 10min)
    getChannelMemberCount(),
  ]);

  // Note : pas de redirect pour les éjectés — la VipCard affiche "Tu as quitté
  // le groupe" et propose un clic vers /dashboard/ejected pour les détails.

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

  return (
    <>
      {/* HEADER compact : Salut au-dessus du chart en fond, puis 3 cards en row */}
      <Section className="pt-10 pb-4">
        {/* Zone titre + bot CTA avec chart en arriere-plan */}
        <div className="relative isolate mb-3">
          <div className="absolute inset-0 -z-10 opacity-30 pointer-events-none overflow-hidden rounded-[var(--radius-lg)]">
            <TradingHero />
          </div>

          <div className="p-4 md:p-6 space-y-3 max-w-3xl">
            <p className="text-xs text-[var(--color-text-dim)] uppercase tracking-wider">
              Mon espace
            </p>
            <h1 className="font-serif text-4xl md:text-5xl text-gradient">
              Salut {firstName}.
            </h1>
            {botUsername && (
              <div className="inline-flex items-start gap-2.5 rounded-[var(--radius-md)] bg-blue-500/10 light:bg-blue-500/15 border border-blue-500/25 light:border-blue-500/50 backdrop-blur-sm px-3 py-2 max-w-lg">
                <MessageCircle className="h-4 w-4 text-blue-300 light:text-blue-700 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-[var(--color-text)]">
                  <Link
                    href={`https://t.me/${botUsername}?start=hello`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium underline underline-offset-2 hover:text-blue-200"
                  >
                    Envoie /start à @{botUsername}
                  </Link>{' '}
                  pour recevoir tes notifs sur Telegram.
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 3 cards en row full-width sous le titre */}
        <div className="grid gap-3 sm:grid-cols-3">
          <MiniVipCard
            application={vipApp ?? null}
            tradingProgressPct={tradingProgressPct}
            cpaQualified={cpaQualified}
          />
          <MiniFormationCard hasBooking={userBookings.length > 0} />
          <MiniChannelCard channelUrl={channelUrl} count={channelCount} />
        </div>
      </Section>

      {/* RÉSERVATIONS */}
      <Section className="py-6">
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="text-xl font-semibold tracking-tight">
            Mes réservations
          </h2>
          {userBookings.length > 0 && (
            <Button asChild size="sm" variant="ghost">
              <Link href="/formation/reserver">
                Nouvelle réservation
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          )}
        </div>

        {userBookings.length === 0 ? (
          <EmptyBookings />
        ) : (
          <div className="space-y-3">
            {userBookings.map((b) => (
              <BookingRow key={b.id} booking={b} />
            ))}
          </div>
        )}
      </Section>

      {/* PARRAINAGE */}
      <Section className="py-6">
        <ReferralSection
          myReferrals={myReferrals}
          topReferrer={topReferrer.map((r) => ({
            firstName: r.firstName,
            username: r.username,
            count: r.c,
          }))}
          botUsername={botUsername}
          referralLink={buildReferralLink(
            botUsername,
            process.env.NEXT_PUBLIC_APP_URL,
            referralCode
          )}
        />
      </Section>
    </>
  );
}

function EmptyBookings() {
  return (
    <div className="glass rounded-[var(--radius-lg)] p-10 text-center">
      <CalendarDays className="h-8 w-8 text-[var(--color-text-faint)] mx-auto" />
      <p className="mt-4 text-sm text-[var(--color-text-dim)]">
        Aucune réservation pour le moment.
      </p>
      <Button asChild size="lg" className="mt-6">
        <Link href="/formation/reserver">
          Réserver ma première formation
          <ArrowRight className="h-4 w-4" />
        </Link>
      </Button>
    </div>
  );
}

interface BookingRowProps {
  booking: typeof bookings.$inferSelect & {
    formation: typeof formations.$inferSelect;
  };
}

/**
 * Renvoie true si la formation est terminée (status completed) OU si la
 * date confirmée est dépassée — auquel cas la page /formation/[id] affiche
 * les ressources post-formation.
 */
function isPostFormation(b: BookingRowProps['booking']): boolean {
  if (b.status === 'completed') return true;
  if (!b.confirmedDate) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(b.confirmedDate) < today;
}

function BookingRow({ booking }: BookingRowProps) {
  const status = booking.status;
  const formation = booking.formation;

  const statusConfig = {
    pending_payment: { label: 'Paiement en attente', variant: 'warning' as const },
    pending_admin: { label: 'En attente de validation', variant: 'warning' as const },
    date_proposed: { label: 'Date alternative proposée', variant: 'warning' as const },
    confirmed: { label: 'Confirmé', variant: 'success' as const },
    paid: { label: 'Payé', variant: 'success' as const },
    completed: { label: 'Terminée', variant: 'secondary' as const },
    cancelled: { label: 'Annulée', variant: 'danger' as const },
  };

  const conf = statusConfig[status];

  return (
    <div className="glass rounded-[var(--radius-lg)] p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <Badge variant={conf.variant}>{conf.label}</Badge>
            <span className="text-xs text-[var(--color-text-faint)] font-mono">
              #{booking.id.slice(0, 8)}
            </span>
          </div>
          <h3 className="font-medium">{formation.title}</h3>
          <p className="text-sm text-[var(--color-text-dim)] mt-1">
            {booking.confirmedDate
              ? `Confirmé · ${formatDate(booking.confirmedDate)}`
              : booking.preferredAsap
              ? 'Dès que possible'
              : 'Dates proposées en attente'}
          </p>
        </div>
        <div className="text-right">
          <div className="font-mono text-sm text-[var(--color-text-dim)]">
            {formatPrice(Number(formation.priceEur))}
          </div>
          {status === 'pending_payment' && (
            <Button asChild size="sm" className="mt-2">
              <Link href={`/checkout/${booking.id}`}>
                <CreditCard className="h-3 w-3" />
                Finaliser le paiement
              </Link>
            </Button>
          )}
          {isPostFormation(booking) && (
            <Button asChild size="sm" variant="secondary" className="mt-2">
              <Link href={`/formation/${booking.id}`}>
                Ressources
                <ArrowRight className="h-3 w-3" />
              </Link>
            </Button>
          )}
        </div>
      </div>

      {status === 'date_proposed' && booking.adminProposedDate && (
        <ProposedDateBlock
          bookingId={booking.id}
          proposedDate={booking.adminProposedDate}
          adminNotes={booking.adminNotes}
        />
      )}

      {booking.paymentPlan === 'installments_3x' &&
        booking.installmentsPaid < booking.installmentTotal && (
          <InstallmentsBlock
            bookingId={booking.id}
            installmentsPaid={booking.installmentsPaid}
            installmentTotal={booking.installmentTotal}
            priceEur={Number(formation.priceEur)}
            blockedUntilFullyPaid
          />
        )}

      {status === 'cancelled' && (
        <div className="rounded-[var(--radius-md)] bg-rose-500/10 border border-rose-500/20 p-4 space-y-3">
          {booking.adminNotes && (
            <div>
              <div className="text-xs font-medium text-rose-200 uppercase tracking-wider mb-1">
                Message de l&apos;équipe
              </div>
              <p className="text-sm text-[var(--color-text)]">
                {booking.adminNotes}
              </p>
            </div>
          )}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-xs text-[var(--color-text-dim)]">
              Tu peux supprimer cette réservation et en créer une nouvelle.
            </p>
            <DeleteCancelledBooking bookingId={booking.id} />
          </div>
        </div>
      )}
    </div>
  );
}

function InstallmentsBlock({
  bookingId,
  installmentsPaid,
  installmentTotal,
  priceEur,
  blockedUntilFullyPaid,
}: {
  bookingId: string;
  installmentsPaid: number;
  installmentTotal: number;
  priceEur: number;
  blockedUntilFullyPaid?: boolean;
}) {
  const perInstallment =
    Math.round((priceEur / installmentTotal) * 100) / 100;
  return (
    <div className="rounded-[var(--radius-md)] bg-indigo-500/8 border border-indigo-500/25 p-4 space-y-3">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <div>
          <div className="text-xs font-medium text-indigo-200 uppercase tracking-wider mb-1">
            Paiement en {installmentTotal} fois
          </div>
          <div className="text-sm">
            <strong className="text-[var(--color-text)] font-mono tabular-nums">
              {installmentsPaid}/{installmentTotal}
            </strong>{' '}
            échéances réglées · {perInstallment}€ par échéance
          </div>
        </div>
        <Button asChild size="sm">
          <Link href={`/checkout/${bookingId}?next=1`}>
            <CreditCard className="h-3 w-3" />
            Payer l'échéance {installmentsPaid + 1}
          </Link>
        </Button>
      </div>
      <div className="flex gap-1.5">
        {Array.from({ length: installmentTotal }).map((_, i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full ${
              i < installmentsPaid
                ? 'bg-emerald-400'
                : i === installmentsPaid
                ? 'bg-indigo-400'
                : 'bg-[var(--color-surface-tint-strong)]'
            }`}
          />
        ))}
      </div>
      {blockedUntilFullyPaid && (
        <p className="text-xs text-[var(--color-text-dim)] leading-relaxed">
          ⓘ La formation ne pourra avoir lieu qu'une fois la totalité du
          paiement reçue ({installmentTotal} échéances). Aucun remboursement
          des échéances déjà versées.
        </p>
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
    <div className="rounded-[var(--radius-md)] bg-amber-500/10 border border-amber-500/25 p-4 space-y-3">
      <div>
        <div className="text-xs font-medium text-amber-200 uppercase tracking-wider mb-1">
          L'équipe te propose une autre date
        </div>
        <div className="text-base font-medium">{formatDate(proposedDate)}</div>
        {adminNotes && (
          <p className="text-sm text-[var(--color-text-dim)] mt-2 italic">
            « {adminNotes} »
          </p>
        )}
      </div>
      <ProposedDateActions bookingId={bookingId} />
    </div>
  );
}

const VIP_STEPS_ORDER = [
  'link_generated',
  'signup_pending',
  'signup_validated',
  'deposit_pending',
  'deposit_validated',
  'telegram_invited',
  'in_group',
] as const;

interface ReferralEntry {
  firstName: string | null;
  username: string | null;
  count: number;
}

function ReferralSection({
  myReferrals,
  topReferrer,
  botUsername,
  referralLink,
}: {
  myReferrals: number;
  topReferrer: ReferralEntry[];
  botUsername: string | undefined;
  referralLink: string;
}) {
  return (
    <div className="glass rounded-[var(--radius-lg)] p-6 md:p-8 grid md:grid-cols-2 gap-6">
      {/* Bloc 1 : mon lien parrain */}
      <div>
        <div className="inline-flex items-center gap-2 text-xs uppercase tracking-wider text-[var(--color-text-dim)]">
          <Gift className="h-3 w-3" />
          Parrainage
        </div>
        <h3 className="mt-2 text-2xl font-semibold">
          Tu as parrainé{' '}
          <span className="text-gradient">
            {myReferrals} personne{myReferrals > 1 ? 's' : ''}
          </span>
        </h3>
        <p className="mt-2 text-sm text-[var(--color-text-dim)]">
          {myReferrals === 0
            ? `Partage ton lien : tes filleuls te sont attribués automatiquement.`
            : `Continue — pas de récompense matérielle pour l'instant, juste la fierté du top.`}
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
            className="mt-3 inline-flex items-center gap-2 text-xs text-[var(--color-text-dim)] hover:text-[var(--color-text)]"
          >
            <MessageCircle className="h-3 w-3" />
            Ou via la commande /invite du bot
          </Link>
        )}
      </div>

      {/* Bloc 2 : podium top parrains */}
      <div className="border-t md:border-t-0 md:border-l border-[var(--color-border)] pt-6 md:pt-0 md:pl-6">
        <div className="inline-flex items-center gap-2 text-xs uppercase tracking-wider text-[var(--color-text-dim)]">
          <Trophy className="h-3 w-3" />
          Top parrains (all-time)
        </div>
        {topReferrer.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--color-text-dim)]">
            Personne n&apos;a encore parrainé. Sois le premier !
          </p>
        ) : (
          <ol className="mt-3 space-y-2">
            {topReferrer.map((r, i) => {
              const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉';
              const name = r.username
                ? `@${r.username}`
                : r.firstName ?? 'Anonyme';
              return (
                <li
                  key={i}
                  className="flex items-center justify-between rounded-md bg-[var(--color-surface-tint)] px-3 py-2"
                >
                  <span className="text-sm font-medium">
                    {medal} {name}
                  </span>
                  <span className="font-mono tabular-nums text-sm">
                    {r.count} filleul{r.count > 1 ? 's' : ''}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}

/**
 * Mini-card VIP : statut compact + barre de progression si in_group.
 */
function MiniVipCard({
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

  const tone = isEjected
    ? 'bg-rose-500/8 border-rose-500/25'
    : isInGroup
    ? 'bg-emerald-500/8 border-emerald-500/25'
    : 'bg-amber-500/8 border-amber-500/25';
  const Icon = isInGroup
    ? CheckCircle2
    : isEjected
    ? XCircle
    : inProgress
    ? Clock
    : Sparkles;
  const iconColor = isInGroup
    ? 'text-emerald-300'
    : isEjected
    ? 'text-rose-300'
    : inProgress
    ? 'text-amber-300'
    : 'text-indigo-300';

  return (
    <Link
      href={href}
      className={cn(
        'group relative overflow-hidden rounded-[var(--radius-lg)] border p-3 transition-all hover:-translate-y-0.5 hover:shadow-lg',
        tone
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className={cn('h-4 w-4', iconColor)} />
          <span className="text-[10px] uppercase tracking-wider font-medium">
            VIP Telegram
          </span>
        </div>
        <ArrowRight className="h-3 w-3 text-[var(--color-text-dim)] group-hover:translate-x-1 transition-transform" />
      </div>
      <div className="mt-1.5 text-sm font-semibold leading-tight">
        {isInGroup
          ? cpaQualified
            ? 'Qualifié ✓'
            : 'Dans le groupe'
          : isEjected
          ? 'Tu as quitté'
          : inProgress
          ? `Étape ${stepNum}/7`
          : 'Pas démarré'}
      </div>
      {inProgress && (
        <div className="mt-2 h-1 w-full rounded-full bg-[var(--color-surface-tint)] overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-pink-500 transition-all"
            style={{ width: `${(stepNum / 7) * 100}%` }}
          />
        </div>
      )}
      {isInGroup && (
        <div className="mt-2 h-1 w-full rounded-full bg-[var(--color-surface-tint)] overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all',
              cpaQualified
                ? 'bg-emerald-400'
                : 'bg-gradient-to-r from-indigo-400 to-pink-400'
            )}
            style={{ width: `${Math.max(2, tradingProgressPct)}%` }}
          />
        </div>
      )}
    </Link>
  );
}

function MiniFormationCard({ hasBooking }: { hasBooking: boolean }) {
  return (
    <Link
      href={hasBooking ? '/formation' : '/formation/reserver'}
      className="group rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-accent)]/5 hover:bg-[var(--color-accent)]/10 hover:border-[var(--color-accent)]/30 transition-all p-3"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-[var(--color-accent-hover)]" />
          <span className="text-[10px] uppercase tracking-wider font-medium">
            Formation
          </span>
        </div>
        <ArrowRight className="h-3 w-3 text-[var(--color-text-dim)] group-hover:translate-x-1 transition-transform" />
      </div>
      <div className="mt-1.5 text-sm font-semibold leading-tight">
        {hasBooking ? 'Mes formations' : 'Réserver une formation'}
      </div>
      <div className="mt-0.5 text-[10px] text-[var(--color-text-dim)]">
        {hasBooking ? 'Voir ma session' : '1500€ distance · 3500€ Dubaï'}
      </div>
    </Link>
  );
}

function MiniChannelCard({
  channelUrl,
  count,
}: {
  channelUrl: string | undefined;
  count: number | null;
}) {
  const target = channelUrl ?? '#';
  return (
    <a
      href={target}
      target={channelUrl ? '_blank' : undefined}
      rel={channelUrl ? 'noopener noreferrer' : undefined}
      className={cn(
        'group rounded-[var(--radius-lg)] border border-blue-500/25 bg-blue-500/8 transition-all p-3',
        channelUrl
          ? 'hover:bg-blue-500/15 hover:border-blue-500/40'
          : 'pointer-events-none opacity-70'
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-blue-300" />
          <span className="text-[10px] uppercase tracking-wider font-medium text-blue-200">
            Canal Telegram
          </span>
        </div>
        {channelUrl && (
          <ArrowRight className="h-3 w-3 text-[var(--color-text-dim)] group-hover:translate-x-1 transition-transform" />
        )}
      </div>
      <div className="mt-1.5 text-sm font-semibold leading-tight tabular-nums">
        {count !== null
          ? `${count.toLocaleString('fr-FR')} membres`
          : 'Annonces & alertes'}
      </div>
      <div className="mt-0.5 text-[10px] text-[var(--color-text-dim)]">
        {count !== null ? 'Contenu gratuit, ouvert à tous' : 'Notre canal public'}
      </div>
    </a>
  );
}
