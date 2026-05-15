import { and, desc, isNotNull, notInArray } from 'drizzle-orm';
import { CalendarCheck } from 'lucide-react';
import { db } from '@/lib/db';
import { bookings, offlineCoachings } from '@/lib/db/schema';
import {
  AdminContainer,
  AdminPageHeader,
} from '@/components/admin/page-header';
import { Badge } from '@/components/ui/badge';
import {
  BookingCalendar,
  type CalendarBooking,
  type CalendarOfflineCoaching,
} from '@/components/admin/booking-calendar';

export const dynamic = 'force-dynamic';

export default async function AdminCalendarPage() {
  // Bookings online (site) non-cancelled + coachings offline non-cancelled
  // ayant une date planifiée (les autres restent invisibles du calendrier).
  const [rows, offRows] = await Promise.all([
    db.query.bookings.findMany({
      where: notInArray(bookings.status, ['cancelled']),
      orderBy: [desc(bookings.createdAt)],
      with: {
        user: {
          columns: { name: true, email: true, telegramUsername: true },
        },
        formation: {
          columns: { title: true, mode: true, priceEur: true },
        },
      },
      limit: 500,
    }),
    db.query.offlineCoachings.findMany({
      where: and(
        notInArray(offlineCoachings.status, ['cancelled']),
        isNotNull(offlineCoachings.scheduledDate)
      ),
      orderBy: [desc(offlineCoachings.scheduledDate)],
      limit: 500,
    }),
  ]);

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

  const offlineItems: CalendarOfflineCoaching[] = offRows
    .filter((c) => c.scheduledDate)
    .map((c) => ({
      id: c.id,
      fullName: c.fullName,
      mode: c.mode,
      scheduledDate: c.scheduledDate!,
      totalAmountEur: Number(c.totalAmountEur),
      paidAmountEur: Number(c.paidAmountEur),
      status: c.status,
      email: c.email,
      phone: c.phone,
      notes: c.notes,
    }));

  return (
    <AdminContainer>
      <AdminPageHeader
        title="Calendrier"
        description="Vue mois ou semaine — sessions site + coachings offline. Drag un event site pour proposer une autre date. Offline éditable depuis /admin/coachings."
        actions={
          <Badge variant="secondary">
            <CalendarCheck className="h-3 w-3 mr-1" />
            {items.length + offlineItems.length} sessions
          </Badge>
        }
      />
      <BookingCalendar bookings={items} offlineCoachings={offlineItems} />
    </AdminContainer>
  );
}
