import { desc, notInArray } from 'drizzle-orm';
import { CalendarCheck } from 'lucide-react';
import { db } from '@/lib/db';
import { bookings } from '@/lib/db/schema';
import {
  AdminContainer,
  AdminPageHeader,
} from '@/components/admin/page-header';
import { Badge } from '@/components/ui/badge';
import {
  BookingCalendar,
  type CalendarBooking,
} from '@/components/admin/booking-calendar';

export const dynamic = 'force-dynamic';

export default async function AdminCalendarPage() {
  // On charge tous les bookings non-cancelled — on ne veut pas polluer
  // le calendrier avec des annulations. Limite haute (500) car la vue
  // mois peut s'étendre sur 6 semaines = ~50 events visibles max.
  const rows = await db.query.bookings.findMany({
    where: notInArray(bookings.status, ['cancelled']),
    orderBy: [desc(bookings.createdAt)],
    with: {
      user: { columns: { name: true, email: true, telegramUsername: true } },
      formation: { columns: { title: true, mode: true, priceEur: true } },
    },
    limit: 500,
  });

  const items: CalendarBooking[] = rows.map((b) => ({
    id: b.id,
    userName: b.user.name,
    userEmail: b.user.email,
    userTelegramUsername: b.user.telegramUsername,
    formationTitle: b.formation.title,
    formationMode: b.formation.mode,
    formationPriceEur: Number(b.formation.priceEur),
    status: b.status,
    preferredDates: b.preferredDates,
    preferredAsap: b.preferredAsap,
    confirmedDate: b.confirmedDate,
    adminProposedDate: b.adminProposedDate,
    adminNotes: b.adminNotes,
    installmentsPaid: b.installmentsPaid,
    installmentTotal: b.installmentTotal,
  }));

  return (
    <AdminContainer>
      <AdminPageHeader
        title="Calendrier"
        description="Vue mois des réservations. Clic sur un event pour les détails, drag pour proposer une autre date."
        actions={
          <Badge variant="secondary">
            <CalendarCheck className="h-3 w-3 mr-1" />
            {items.length} actives
          </Badge>
        }
      />
      <BookingCalendar bookings={items} />
    </AdminContainer>
  );
}
