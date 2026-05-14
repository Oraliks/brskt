import { desc, isNull } from 'drizzle-orm';
import { CalendarCheck, Clock } from 'lucide-react';
import { db } from '@/lib/db';
import { bookings, formationWaitlist } from '@/lib/db/schema';
import {
  AdminContainer,
  AdminPageHeader,
} from '@/components/admin/page-header';
import { BookingsTable } from '@/components/admin/bookings-table';
import { WaitlistTable } from '@/components/admin/waitlist-table';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';

export const dynamic = 'force-dynamic';

export default async function AdminBookingsPage() {
  const [list, waitlist] = await Promise.all([
    db.query.bookings.findMany({
      orderBy: [desc(bookings.createdAt)],
      with: { formation: true, user: true },
      limit: 200,
    }),
    db.query.formationWaitlist.findMany({
      where: isNull(formationWaitlist.notifiedAt),
      orderBy: [desc(formationWaitlist.createdAt)],
      limit: 200,
    }),
  ]);

  return (
    <AdminContainer>
      <AdminPageHeader
        title="Réservations & waitlist"
        description="Valider les créneaux, gérer la file d'attente."
      />

      <Tabs defaultValue="bookings">
        <TabsList>
          <TabsTrigger value="bookings" className="gap-1.5">
            <CalendarCheck className="h-3.5 w-3.5" />
            Réservations
            <Badge variant="secondary" className="ml-1 px-1.5 py-0">
              {list.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="waitlist" className="gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            Liste d&apos;attente
            <Badge variant="secondary" className="ml-1 px-1.5 py-0">
              {waitlist.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="bookings">
          <BookingsTable bookings={list} />
        </TabsContent>

        <TabsContent value="waitlist">
          <WaitlistTable entries={waitlist} />
        </TabsContent>
      </Tabs>
    </AdminContainer>
  );
}
