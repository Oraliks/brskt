import { desc, isNull } from 'drizzle-orm';
import Link from 'next/link';
import { ArrowLeft, Clock, Download } from 'lucide-react';
import { db } from '@/lib/db';
import { formationWaitlist } from '@/lib/db/schema';
import {
  AdminContainer,
  AdminPageHeader,
} from '@/components/admin/page-header';
import { WaitlistTable } from '@/components/admin/waitlist-table';
import { Button } from '@/components/ui/button';

export const dynamic = 'force-dynamic';

export default async function AdminWaitlistPage() {
  const waitlist = await db.query.formationWaitlist.findMany({
    where: isNull(formationWaitlist.notifiedAt),
    orderBy: [desc(formationWaitlist.createdAt)],
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
        title="Liste d'attente"
        description="Personnes en attente d'une nouvelle session. À notifier quand un créneau s'ouvre."
        actions={
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 text-xs text-[var(--color-text-dim)]">
              <Clock className="h-3.5 w-3.5" />
              {waitlist.length} en attente
            </span>
            <Button asChild size="sm" variant="secondary" className="gap-1.5">
              <a href="/api/admin/export/waitlist.csv" download>
                <Download className="h-3.5 w-3.5" />
                Exporter CSV
              </a>
            </Button>
          </div>
        }
      />
      <WaitlistTable entries={waitlist} />
    </AdminContainer>
  );
}
