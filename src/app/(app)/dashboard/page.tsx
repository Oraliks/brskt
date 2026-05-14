import Link from 'next/link';
import { redirect } from 'next/navigation';
import { desc, eq } from 'drizzle-orm';
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock,
  CreditCard,
  MessageCircle,
  XCircle,
} from 'lucide-react';
import { db } from '@/lib/db';
import {
  bookings,
  formations,
  manualIronfxStatus,
  vipApplications,
} from '@/lib/db/schema';
import { requireAuth } from '@/lib/auth/server';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Section } from '@/components/shared/section';
import { ProposedDateActions } from '@/components/formation/proposed-date-actions';
import { cn, formatDate, formatPrice } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const session = await requireAuth();

  if (!session.user.email || !session.user.onboardingCompletedAt) {
    redirect('/onboarding');
  }

  const [userBookings, vipApp] = await Promise.all([
    db.query.bookings.findMany({
      where: eq(bookings.userId, session.user.id),
      orderBy: [desc(bookings.createdAt)],
      with: { formation: true },
    }),
    db.query.vipApplications.findFirst({
      where: eq(vipApplications.userId, session.user.id),
    }),
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
          <div className="mt-8 inline-flex items-start gap-3 rounded-[var(--radius-md)] bg-blue-500/10 border border-blue-500/25 px-4 py-3 max-w-xl">
            <MessageCircle className="h-4 w-4 text-blue-300 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <strong className="text-blue-200">Notifications temps réel :</strong>{' '}
              <Link
                href={`https://t.me/${botUsername}?start=hello`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-white"
              >
                envoie <code className="font-mono bg-white/5 px-1.5 py-0.5 rounded">/start</code> à @{botUsername}
              </Link>{' '}
              une fois pour recevoir confirmations & alertes directement sur Telegram.
            </div>
          </div>
        )}
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
            className="glass rounded-[var(--radius-lg)] p-6 hover:border-white/14 transition-colors group"
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
              className="glass rounded-[var(--radius-lg)] p-6 hover:border-white/14 transition-colors group"
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
        </div>
      </div>

      {status === 'date_proposed' && booking.adminProposedDate && (
        <ProposedDateBlock
          bookingId={booking.id}
          proposedDate={booking.adminProposedDate}
          adminNotes={booking.adminNotes}
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
      className="glass-strong rounded-[var(--radius-lg)] p-6 hover:border-white/20 transition-colors group relative overflow-hidden block"
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
            <div className="h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
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
            <div className="h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
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
