import { desc } from 'drizzle-orm';
import Link from 'next/link';
import { ArrowLeft, CalendarCheck } from 'lucide-react';
import { db } from '@/lib/db';
import { bookings } from '@/lib/db/schema';
import {
  AdminContainer,
  AdminPageHeader,
} from '@/components/admin/page-header';
import { BookingsTable } from '@/components/admin/bookings-table';
import { Button } from '@/components/ui/button';

export const dynamic = 'force-dynamic';

export default async function AdminBookingsListPage() {
  const list = await db.query.bookings.findMany({
    orderBy: [desc(bookings.createdAt)],
    with: { formation: true, user: true },
    limit: 500,
  });

  return (
    <AdminContainer>
      <div className="mb-3">
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link href="/admin/bookings">
            <ArrowLeft className="h-4 w-4" />
            Vue d&apos;ensemble
          </Link>
        </Button>
      </div>
      <AdminPageHeader
        title="Toutes les réservations"
        description="Liste complète des réservations site. Valider, proposer une autre date, refuser ou annuler."
        actions={
          <span className="inline-flex items-center gap-1.5 text-xs text-[var(--color-text-dim)]">
            <CalendarCheck className="h-3.5 w-3.5" />
            {list.length} réservation{list.length > 1 ? 's' : ''}
          </span>
        }
      />
      <BookingsTable bookings={list} />
    </AdminContainer>
  );
}
