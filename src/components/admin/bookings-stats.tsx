import {
  CalendarCheck,
  CheckCircle2,
  Clock,
  CreditCard,
  Zap,
} from 'lucide-react';
import { StatCard, StatCardGrid } from '@/components/admin/stat-card';

export interface BookingsStatsData {
  bookingsTotal: number;
  bookingsThisMonth: number;
  bookingsLastMonth: number;
  waitlistTotal: number;
  waitlistThisMonth: number;
  pendingPaymentCount: number;
  pendingPaymentEur: number;
  asapCount: number;
  confirmedThisMonth: number;
}

/**
 * 5 KPIs de la page Réservations & waitlist.
 * Tous calculés côté serveur dans la page (cf. /admin/bookings/page.tsx).
 *
 * "+X ce mois" : delta vs mois précédent. Affiché en vert/rouge selon
 * la direction. Sur waitlist le "+" est juste informatif (pas de baseline).
 */
export function BookingsStats({ data }: { data: BookingsStatsData }) {
  const bookingsDelta = data.bookingsThisMonth - data.bookingsLastMonth;
  const bookingsDeltaLabel =
    bookingsDelta === 0
      ? 'stable vs mois dernier'
      : `${bookingsDelta > 0 ? '+' : ''}${bookingsDelta} ce mois`;

  return (
    <StatCardGrid cols={5}>
      <StatCard
        label="Réservations"
        value={data.bookingsTotal}
        icon={<CalendarCheck className="h-4 w-4" />}
        tone="info"
        hint={bookingsDeltaLabel}
      />
      <StatCard
        label="Waitlist"
        value={data.waitlistTotal}
        icon={<Clock className="h-4 w-4" />}
        tone="default"
        hint={`+${data.waitlistThisMonth} ce mois`}
      />
      <StatCard
        label="Pending payment"
        value={data.pendingPaymentCount}
        icon={<CreditCard className="h-4 w-4" />}
        tone="warning"
        hint={`${data.pendingPaymentEur.toLocaleString('fr-FR')}€`}
      />
      <StatCard
        label="ASAP"
        value={data.asapCount}
        icon={<Zap className="h-4 w-4" />}
        tone="default"
        hint="proposés"
      />
      <StatCard
        label="Confirmées"
        value={data.confirmedThisMonth}
        icon={<CheckCircle2 className="h-4 w-4" />}
        tone="success"
        hint="ce mois"
      />
    </StatCardGrid>
  );
}
