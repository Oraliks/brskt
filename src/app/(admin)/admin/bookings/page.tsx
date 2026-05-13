import { desc } from 'drizzle-orm';
import { db } from '@/lib/db';
import { bookings } from '@/lib/db/schema';
import { AdminContainer, AdminPageHeader } from '@/components/admin/page-header';
import { BookingsTable } from '@/components/admin/bookings-table';

export const dynamic = 'force-dynamic';

export default async function AdminBookingsPage() {
  const list = await db.query.bookings.findMany({
    orderBy: [desc(bookings.createdAt)],
    with: { formation: true, user: true },
    limit: 200,
  });

  return (
    <AdminContainer>
      <AdminPageHeader
        title="Réservations"
        description="Valide les créneaux, propose des alternatives, ou refuse."
      />
      <BookingsTable bookings={list} />
    </AdminContainer>
  );
}
