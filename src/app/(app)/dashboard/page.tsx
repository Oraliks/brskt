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
import { bookings, formations, vipApplications } from '@/lib/db/schema';
import { requireAuth } from '@/lib/auth/server';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Section } from '@/components/shared/section';
import { ProposedDateActions } from '@/components/formation/proposed-date-actions';
import { formatDate, formatPrice } from '@/lib/utils';

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

  if (vipApp?.step === 'ejected') {
    redirect('/dashboard/ejected');
  }

  const firstName = session.user.telegramFirstName ?? session.user.name ?? '';

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
      </Section>

      <Section className="py-0">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* VIP Card */}
          <VipCard application={vipApp ?? null} />

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
                ? '5 jours intensifs, à distance ou à Dubaï.'
                : "Tu as déjà une réservation, vois-la ci-dessous."}
            </p>
          </Link>

          {/* Telegram link */}
          <a
            href="https://t.me/"
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

function VipCard({
  application,
}: {
  application: typeof vipApplications.$inferSelect | null;
}) {
  const step = application?.step;
  const isInGroup = step === 'in_group';
  const inProgress =
    step &&
    step !== 'in_group' &&
    step !== 'ejected';

  return (
    <Link
      href="/vip"
      className="glass-strong rounded-[var(--radius-lg)] p-6 hover:border-white/20 transition-colors group relative overflow-hidden"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-transparent pointer-events-none" />
      <div className="relative">
        <div className="flex items-start justify-between">
          <Badge variant="gold">
            <MessageCircle className="h-3 w-3 mr-1" />
            VIP Telegram
          </Badge>
          <ArrowRight className="h-4 w-4 text-[var(--color-text-dim)] group-hover:translate-x-1 transition-transform" />
        </div>
        <div className="mt-6 flex items-center gap-2">
          {isInGroup ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
          ) : inProgress ? (
            <Clock className="h-5 w-5 text-amber-400" />
          ) : (
            <XCircle className="h-5 w-5 text-[var(--color-text-faint)]" />
          )}
          <h3 className="text-lg font-semibold">
            {isInGroup
              ? 'Membre VIP actif'
              : inProgress
              ? 'Funnel en cours'
              : 'Pas encore démarré'}
          </h3>
        </div>
        <p className="mt-2 text-sm text-[var(--color-text-dim)]">
          {isInGroup
            ? 'Tu as accès au groupe Telegram privé.'
            : inProgress
            ? `Étape actuelle : ${step?.replace('_', ' ')}`
            : 'Démarre le funnel pour accéder au groupe.'}
        </p>
      </div>
    </Link>
  );
}
