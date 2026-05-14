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
import { TradingHero } from '@/components/shared/trading-hero';
import { ReferralLinkCopy } from '@/components/dashboard/referral-link-copy';
import { buildReferralLink, ensureReferralCode } from '@/lib/referrals';
import { cn, formatDate, formatPrice } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const session = await requireAuth();

  if (!session.user.email || !session.user.onboardingCompletedAt) {
    redirect('/onboarding');
  }

  const referralCode = await ensureReferralCode(session.user.id);

  const [userBookings, vipApp, myReferrals, topReferrer, vipStats] = await Promise.all([
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
    // Stats VIP communauté (public, anonymisé)
    db
      .select({
        inGroup: sql<number>`count(*) filter (where ${vipApplications.step} = 'in_group')`,
        qualified: sql<number>`count(*) filter (where ${vipApplications.step} = 'in_group' and ${vipApplications.cpaQualified} = true)`,
        recent30d: sql<number>`count(*) filter (where ${vipApplications.step} = 'in_group' and ${vipApplications.createdAt} > now() - interval '30 days')`,
      })
      .from(vipApplications)
      .then((r) => r[0] ?? { inGroup: 0, qualified: 0, recent30d: 0 }),
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
      <Section className="pt-24 pb-12">
        <div className="space-y-2">
          <p className="text-sm text-[var(--color-text-dim)] uppercase tracking-wider">
            Mon espace
          </p>
          <h1 className="font-serif text-4xl md:text-5xl text-gradient">
            Salut {firstName}.
          </h1>
        </div>

        {botUsername && (
          <div className="mt-8 inline-flex items-start gap-3 rounded-[var(--radius-md)] bg-blue-500/10 light:bg-blue-500/15 border border-blue-500/25 light:border-blue-500/50 px-4 py-3 max-w-xl">
            <MessageCircle className="h-4 w-4 text-blue-300 light:text-blue-700 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-[var(--color-text)]">
              <strong className="text-blue-200 light:text-blue-800 font-semibold">Notifications temps réel :</strong>{' '}
              <Link
                href={`https://t.me/${botUsername}?start=hello`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-[var(--color-text)] light:text-blue-700"
              >
                envoie <code className="font-mono bg-[var(--color-surface-tint)] px-1.5 py-0.5 rounded">/start</code> à @{botUsername}
              </Link>{' '}
              une fois pour recevoir confirmations & alertes directement sur Telegram.
            </div>
          </div>
        )}

        {/* Décor : chart animé, comble l'espace entre header et cards */}
        <div className="mt-8">
          <TradingHero />
        </div>
      </Section>

      <Section className="py-0">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* VIP Card */}
          <VipCard
            application={vipApp ?? null}
            tradingProgressPct={tradingProgressPct}
            cpaQualified={cpaQualified}
          />

          {/* Formation CTA */}
          <Link
            href={userBookings.length === 0 ? '/formation/reserver' : '/formation'}
            className="glass rounded-[var(--radius-lg)] p-6 hover:border-[var(--color-border-strong)] transition-colors group"
          >
            <div className="flex items-start justify-between">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-[var(--color-accent)]/15 border border-[var(--color-accent)]/30">
                <CalendarDays className="h-4 w-4 text-[var(--color-accent-hover)]" />
              </span>
              <ArrowRight className="h-4 w-4 text-[var(--color-text-dim)] group-hover:translate-x-1 transition-transform" />
            </div>
            <h3 className="mt-6 text-lg font-semibold">
              {userBookings.length === 0 ? 'Réserver une formation' : 'Voir les formations'}
            </h3>
            <p className="mt-2 text-sm text-[var(--color-text-dim)]">
              {userBookings.length === 0
                ? '7 jours intensifs, à distance ou à Dubaï.'
                : "Tu as déjà une réservation, vois-la ci-dessous."}
            </p>
          </Link>

          {/* Telegram channel link */}
          {channelUrl ? (
            <a
              href={channelUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="glass rounded-[var(--radius-lg)] p-6 hover:border-[var(--color-border-strong)] transition-colors group"
            >
              <div className="flex items-start justify-between">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-blue-500/15 border border-blue-500/30">
                  <MessageCircle className="h-4 w-4 text-blue-300" />
                </span>
                <ArrowRight className="h-4 w-4 text-[var(--color-text-dim)] group-hover:translate-x-1 transition-transform" />
              </div>
              <h3 className="mt-6 text-lg font-semibold">Notre canal Telegram</h3>
              <p className="mt-2 text-sm text-[var(--color-text-dim)]">
                Annonces, contenu gratuit et nouvelles cohortes.
              </p>
            </a>
          ) : null}
        </div>
      </Section>

      {/* Stats VIP communauté */}
      <Section className="py-8">
        <CommunityStats stats={vipStats} />
      </Section>

      {/* Parrainage */}
      <Section className="py-8">
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

      {/* Bookings */}
      <Section className="py-12">
        <div className="flex items-baseline justify-between mb-6">
          <h2 className="text-2xl font-semibold tracking-tight">
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

      {status === 'cancelled' && booking.adminNotes && (
        <div className="rounded-[var(--radius-md)] bg-rose-500/10 border border-rose-500/20 p-4">
          <div className="text-xs font-medium text-rose-200 uppercase tracking-wider mb-1">
            Message de l'équipe
          </div>
          <p className="text-sm text-[var(--color-text)]">
            {booking.adminNotes}
          </p>
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

function VipCard({
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
  // Qualification = CPA généré côté broker (colonne DB, peut être set
  // manuellement par l'admin). C'est le seul état qui protège de l'éjection.
  const isQualified = cpaQualified;

  const href = isEjected ? '/dashboard/ejected' : '/vip';

  return (
    <Link
      href={href}
      className="glass-strong rounded-[var(--radius-lg)] p-6 hover:border-[var(--color-border-strong)] transition-colors group relative overflow-hidden block"
    >
      <div
        className={cn(
          'absolute inset-0 pointer-events-none',
          isEjected
            ? 'bg-gradient-to-br from-rose-500/10 to-transparent'
            : isInGroup
            ? 'bg-gradient-to-br from-emerald-500/10 to-transparent'
            : 'bg-gradient-to-br from-amber-500/10 to-transparent'
        )}
      />
      <div className="relative">
        <div className="flex items-start justify-between">
          <Badge
            variant={isEjected ? 'danger' : isInGroup ? 'success' : 'gold'}
          >
            <MessageCircle className="h-3 w-3 mr-1" />
            VIP Telegram
          </Badge>
          <ArrowRight className="h-4 w-4 text-[var(--color-text-dim)] group-hover:translate-x-1 transition-transform" />
        </div>

        <div className="mt-6 flex items-center gap-2">
          {isInGroup ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
          ) : isEjected ? (
            <XCircle className="h-5 w-5 text-rose-400" />
          ) : inProgress ? (
            <Clock className="h-5 w-5 text-amber-400" />
          ) : (
            <XCircle className="h-5 w-5 text-[var(--color-text-faint)]" />
          )}
          <h3 className="text-lg font-semibold">
            {isInGroup
              ? isQualified
                ? 'Membre VIP ✓ qualifié'
                : 'Tu es dans le groupe'
              : isEjected
              ? 'Tu as quitté le groupe'
              : inProgress
              ? `Funnel : ${stepNum}/7`
              : 'Pas encore démarré'}
          </h3>
        </div>

        <p className="mt-2 text-sm text-[var(--color-text-dim)]">
          {isInGroup
            ? isQualified
              ? 'Ta place est sécurisée — pas de risque de kick.'
              : `${tradingProgressPct}% de trading depuis ton arrivée`
            : isEjected
            ? 'Voir la raison et les conditions de réintégration'
            : inProgress
            ? 'On te tient au courant à chaque étape'
            : 'Démarre le funnel — 100% gratuit'}
        </p>

        {/* Progress bar : funnel avant in_group, trading après */}
        {inProgress && (
          <div className="mt-4 space-y-2">
            <div className="h-1.5 w-full rounded-full bg-[var(--color-surface-tint)] overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-pink-500 transition-all duration-500"
                style={{ width: `${(stepNum / 7) * 100}%` }}
              />
            </div>
          </div>
        )}

        {isInGroup && (
          <div className="mt-4 space-y-2">
            <div className="flex items-baseline justify-between text-xs">
              <span className="text-[var(--color-text-dim)]">
                Volume de trading
              </span>
              <span className="font-mono tabular-nums font-medium">
                {tradingProgressPct}%
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-[var(--color-surface-tint)] overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-500',
                  isQualified
                    ? 'bg-emerald-400'
                    : 'bg-gradient-to-r from-[var(--color-accent)] to-pink-500'
                )}
                style={{ width: `${Math.max(2, tradingProgressPct)}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </Link>
  );
}

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

function CommunityStats({
  stats,
}: {
  stats: { inGroup: number; qualified: number; recent30d: number };
}) {
  const inGroup = Number(stats.inGroup) || 0;
  const qualified = Number(stats.qualified) || 0;
  const recent30d = Number(stats.recent30d) || 0;
  const qualifiedPct =
    inGroup > 0 ? Math.round((qualified / inGroup) * 100) : 0;

  // Anonymisé : pas de noms, juste des chiffres communauté
  return (
    <div className="glass rounded-[var(--radius-lg)] p-6 md:p-8">
      <div className="inline-flex items-center gap-2 text-xs uppercase tracking-wider text-[var(--color-text-dim)]">
        <Trophy className="h-3 w-3" />
        La communauté VIP en chiffres
      </div>
      <div className="mt-5 grid grid-cols-3 gap-4">
        <StatItem
          label="Membres actifs"
          value={inGroup}
          hint={`${recent30d} sur 30 derniers jours`}
        />
        <StatItem
          label="Qualifiés CPA"
          value={qualified}
          hint={`${qualifiedPct}% du groupe`}
          tone="success"
        />
        <StatItem
          label="Conversion"
          value={`${qualifiedPct}%`}
          hint="ratio qualified / membres"
          tone="info"
        />
      </div>
      <p className="mt-4 text-xs text-[var(--color-text-faint)]">
        Données mises à jour en temps réel · 100% anonymes.
      </p>
    </div>
  );
}

function StatItem({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: 'default' | 'success' | 'info';
}) {
  const toneClass =
    tone === 'success'
      ? 'text-emerald-300 light:text-emerald-700'
      : tone === 'info'
      ? 'text-sky-300 light:text-sky-700'
      : 'text-[var(--color-text)]';
  return (
    <div className="rounded-[var(--radius-md)] bg-[var(--color-surface-tint)] border border-[var(--color-border)] p-4">
      <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-dim)]">
        {label}
      </div>
      <div className={cn('mt-1 text-2xl font-semibold tabular-nums', toneClass)}>
        {value}
      </div>
      {hint && (
        <div className="mt-0.5 text-[10px] text-[var(--color-text-faint)]">
          {hint}
        </div>
      )}
    </div>
  );
}
