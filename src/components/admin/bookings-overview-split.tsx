import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatDate, formatPrice } from '@/lib/utils';
import { cn } from '@/lib/utils';
import type { Booking, Formation, User } from '@/lib/db/schema';

export type BookingRow = Booking & { formation: Formation; user: User };
export type WaitlistEntry = {
  id: string;
  mode: 'remote' | 'onsite';
  email: string;
  firstName: string | null;
  telegramId: number | null;
  notes: string | null;
  createdAt: Date;
};

interface Props {
  bookings: BookingRow[];
  waitlist: WaitlistEntry[];
  bookingsTotal: number;
  waitlistTotal: number;
}

const STATUS_LABEL: Record<Booking['status'], string> = {
  pending_admin: 'pending admin',
  date_proposed: 'date proposée',
  confirmed: 'à confirmer',
  pending_payment: 'pending payment',
  paid: 'confirmée',
  completed: 'terminée',
  cancelled: 'annulée',
};

const STATUS_VARIANT: Record<
  Booking['status'],
  'default' | 'success' | 'warning' | 'danger' | 'secondary'
> = {
  pending_admin: 'warning',
  date_proposed: 'warning',
  confirmed: 'default',
  pending_payment: 'warning',
  paid: 'success',
  completed: 'secondary',
  cancelled: 'danger',
};

/**
 * Vue split : 2 tables compactes côte à côte (Réservations + Liste d'attente).
 * Affiche les 5 dernières lignes de chaque source avec un lien "Voir tout"
 * vers la sous-page dédiée. Optimisé pour scan rapide, pas pour action
 * détaillée (qui passe par le clic vers la liste complète).
 */
export function BookingsOverviewSplit({
  bookings,
  waitlist,
  bookingsTotal,
  waitlistTotal,
}: Props) {
  const topBookings = bookings.slice(0, 5);
  const topWaitlist = waitlist.slice(0, 5);

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <Panel
        title="Réservations"
        seeAllHref="/admin/bookings/list"
        seeAllLabel={`Voir tout (${bookingsTotal})`}
      >
        {topBookings.length === 0 ? (
          <EmptyState>Aucune réservation pour le moment.</EmptyState>
        ) : (
          <div className="divide-y divide-[var(--color-border)]">
            <BookingsHeader />
            {topBookings.map((b) => (
              <BookingRowItem key={b.id} booking={b} />
            ))}
          </div>
        )}
      </Panel>

      <Panel
        title="Liste d'attente"
        seeAllHref="/admin/bookings/waitlist"
        seeAllLabel={`Voir toute la liste d'attente (${waitlistTotal})`}
      >
        {topWaitlist.length === 0 ? (
          <EmptyState>Personne en attente.</EmptyState>
        ) : (
          <div className="divide-y divide-[var(--color-border)]">
            <WaitlistHeader />
            {topWaitlist.map((w) => (
              <WaitlistRowItem key={w.id} entry={w} />
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

function Panel({
  title,
  seeAllHref,
  seeAllLabel,
  children,
}: {
  title: string;
  seeAllHref: string;
  seeAllLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div className="glass rounded-[var(--radius-lg)] overflow-hidden flex flex-col">
      <div className="px-4 py-3 border-b border-[var(--color-border)] flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        <Link
          href={seeAllHref}
          className="inline-flex items-center gap-1 text-xs text-[var(--color-accent-hover)] hover:underline"
        >
          {seeAllLabel}
          <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="py-10 px-4 text-center text-xs text-[var(--color-text-dim)]">
      {children}
    </div>
  );
}

function BookingsHeader() {
  return (
    <div className="grid grid-cols-[1.4fr_1.4fr_1fr_1fr_0.8fr] gap-2 px-4 py-2 text-[10px] uppercase tracking-wider text-[var(--color-text-faint)] bg-[var(--color-surface-tint)]">
      <div>Utilisateurs</div>
      <div>Formation</div>
      <div>Créneau</div>
      <div>Statut</div>
      <div className="text-right">Date</div>
    </div>
  );
}

function BookingRowItem({ booking: b }: { booking: BookingRow }) {
  const dateLabel = b.confirmedDate
    ? formatDate(b.confirmedDate)
    : b.adminProposedDate
    ? formatDate(b.adminProposedDate)
    : '—';
  const slotLabel = b.confirmedDate
    ? b.confirmedDate
    : b.adminProposedDate
    ? `Proposé ${b.adminProposedDate}`
    : b.preferredAsap
    ? 'ASAP'
    : b.preferredDates?.[0]?.start ?? '—';

  return (
    <Link
      href={`/admin/bookings/list#${b.id}`}
      className="grid grid-cols-[1.4fr_1.4fr_1fr_1fr_0.8fr] gap-2 px-4 py-2.5 hover:bg-[var(--color-surface-tint)] transition-colors items-center"
    >
      <div className="min-w-0">
        <div className="text-xs font-medium truncate">{b.user.name}</div>
        <div className="text-[10px] text-[var(--color-text-faint)] truncate">
          {b.user.email ?? <em>pas d&apos;email</em>}
        </div>
      </div>
      <div className="min-w-0">
        <div className="text-xs truncate">{b.formation.title}</div>
        <div className="text-[10px] text-[var(--color-text-faint)] font-mono tabular-nums">
          {formatPrice(Number(b.formation.priceEur))}
        </div>
      </div>
      <div className="text-[11px] font-mono text-[var(--color-text-dim)] truncate">
        {slotLabel}
      </div>
      <div>
        <Badge
          variant={STATUS_VARIANT[b.status]}
          className="text-[10px] whitespace-nowrap"
        >
          {STATUS_LABEL[b.status]}
        </Badge>
      </div>
      <div
        className={cn(
          'text-right text-[11px] text-[var(--color-text-dim)] tabular-nums truncate',
          b.confirmedDate && 'text-[var(--color-text)]'
        )}
      >
        {dateLabel}
      </div>
    </Link>
  );
}

function WaitlistHeader() {
  return (
    <div className="grid grid-cols-[1.6fr_0.8fr_1.4fr_0.9fr] gap-2 px-4 py-2 text-[10px] uppercase tracking-wider text-[var(--color-text-faint)] bg-[var(--color-surface-tint)]">
      <div>Contact</div>
      <div>Format</div>
      <div>Notes</div>
      <div className="text-right">Inscrit le</div>
    </div>
  );
}

function WaitlistRowItem({ entry: w }: { entry: WaitlistEntry }) {
  return (
    <div className="grid grid-cols-[1.6fr_0.8fr_1.4fr_0.9fr] gap-2 px-4 py-2.5 items-center">
      <div className="min-w-0">
        <div className="text-xs font-medium truncate">
          {w.firstName ?? '—'}
        </div>
        <a
          href={`mailto:${w.email}`}
          className="text-[10px] text-[var(--color-accent-hover)] hover:underline truncate block"
        >
          {w.email}
        </a>
      </div>
      <div>
        <Badge
          variant={w.mode === 'onsite' ? 'gold' : 'default'}
          className="text-[10px]"
        >
          {w.mode === 'onsite' ? 'Présentiel' : 'À distance'}
        </Badge>
      </div>
      <div className="text-[11px] text-[var(--color-text-dim)] italic truncate">
        {w.notes ? `«${w.notes}»` : '—'}
      </div>
      <div className="text-right text-[11px] text-[var(--color-text-faint)] tabular-nums">
        {formatDate(w.createdAt)}
      </div>
    </div>
  );
}
