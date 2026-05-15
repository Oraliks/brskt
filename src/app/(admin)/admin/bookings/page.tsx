import { and, count, desc, eq, gte, isNull, lt, sql } from 'drizzle-orm';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { db } from '@/lib/db';
import { bookings, formationWaitlist } from '@/lib/db/schema';
import {
  AdminContainer,
  AdminPageHeader,
} from '@/components/admin/page-header';
import { Button } from '@/components/ui/button';
import { BookingsStats } from '@/components/admin/bookings-stats';
import { BookingsOverviewSplit } from '@/components/admin/bookings-overview-split';

export const dynamic = 'force-dynamic';

/**
 * Vue d'ensemble réservations + waitlist :
 *  - 5 KPIs (total / waitlist / pending_payment / asap / confirmées ce mois)
 *  - Split compact des 5 derniers de chaque source avec liens "Voir tout"
 *
 * Les pages détaillées :
 *  - /admin/bookings/list      → toutes les réservations (actions complètes)
 *  - /admin/bookings/waitlist  → toute la file d'attente
 */
export default async function AdminBookingsPage() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const [
    recentBookings,
    recentWaitlist,
    bookingsTotalRow,
    bookingsThisMonthRow,
    bookingsLastMonthRow,
    waitlistTotalRow,
    waitlistThisMonthRow,
    pendingPaymentAgg,
    asapRow,
    confirmedThisMonthRow,
  ] = await Promise.all([
    db.query.bookings.findMany({
      orderBy: [desc(bookings.createdAt)],
      with: { formation: true, user: true },
      limit: 10,
    }),
    db.query.formationWaitlist.findMany({
      where: isNull(formationWaitlist.notifiedAt),
      orderBy: [desc(formationWaitlist.createdAt)],
      limit: 10,
    }),
    db.select({ c: count() }).from(bookings),
    db
      .select({ c: count() })
      .from(bookings)
      .where(gte(bookings.createdAt, startOfMonth)),
    db
      .select({ c: count() })
      .from(bookings)
      .where(
        and(
          gte(bookings.createdAt, startOfPrevMonth),
          lt(bookings.createdAt, startOfMonth)
        )
      ),
    db
      .select({ c: count() })
      .from(formationWaitlist)
      .where(isNull(formationWaitlist.notifiedAt)),
    db
      .select({ c: count() })
      .from(formationWaitlist)
      .where(
        and(
          isNull(formationWaitlist.notifiedAt),
          gte(formationWaitlist.createdAt, startOfMonth)
        )
      ),
    // Somme estimative du montant pending_payment : on JOIN avec formations
    // pour récupérer le prix. Plus précis que de juste compter.
    db.execute(sql`
      SELECT
        COUNT(b.id)::int AS c,
        COALESCE(SUM(f.price_eur::numeric), 0)::float AS total
      FROM bookings b
      INNER JOIN formations f ON f.id = b.formation_id
      WHERE b.status = 'pending_payment'
    `),
    db
      .select({ c: count() })
      .from(bookings)
      .where(eq(bookings.preferredAsap, true)),
    db
      .select({ c: count() })
      .from(bookings)
      .where(
        and(
          eq(bookings.status, 'confirmed'),
          gte(bookings.updatedAt, startOfMonth)
        )
      ),
  ]);

  // postgres-js renvoie un array-like, pas un object {rows}
  const pendingRow = (pendingPaymentAgg as unknown as Array<{
    c: number;
    total: number;
  }>)[0];

  return (
    <AdminContainer>
      <AdminPageHeader
        title="Réservations & waitlist"
        description="Valider les créneaux, gérer la file d'attente."
        actions={
          <Button asChild size="sm">
            <Link
              href="/admin/coachings"
              title="Ajouter un client hors-site (coaching offline)"
            >
              <Plus className="h-4 w-4" />
              Nouvelle réservation
            </Link>
          </Button>
        }
      />

      <BookingsStats
        data={{
          bookingsTotal: bookingsTotalRow[0]?.c ?? 0,
          bookingsThisMonth: bookingsThisMonthRow[0]?.c ?? 0,
          bookingsLastMonth: bookingsLastMonthRow[0]?.c ?? 0,
          waitlistTotal: waitlistTotalRow[0]?.c ?? 0,
          waitlistThisMonth: waitlistThisMonthRow[0]?.c ?? 0,
          pendingPaymentCount: pendingRow?.c ?? 0,
          pendingPaymentEur: Number(pendingRow?.total ?? 0),
          asapCount: asapRow[0]?.c ?? 0,
          confirmedThisMonth: confirmedThisMonthRow[0]?.c ?? 0,
        }}
      />

      <div className="mt-5">
        <BookingsOverviewSplit
          bookings={recentBookings}
          waitlist={recentWaitlist}
          bookingsTotal={bookingsTotalRow[0]?.c ?? 0}
          waitlistTotal={waitlistTotalRow[0]?.c ?? 0}
        />
      </div>
    </AdminContainer>
  );
}
