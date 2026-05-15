import { desc } from 'drizzle-orm';
import { Users } from 'lucide-react';
import { db } from '@/lib/db';
import { offlineCoachings } from '@/lib/db/schema';
import {
  AdminContainer,
  AdminPageHeader,
} from '@/components/admin/page-header';
import { StatCard, StatCardGrid } from '@/components/admin/stat-card';
import { CoachingsList } from '@/components/admin/coachings-list';

export const dynamic = 'force-dynamic';

export default async function AdminCoachingsPage() {
  const rows = await db.query.offlineCoachings.findMany({
    orderBy: [desc(offlineCoachings.createdAt)],
    limit: 500,
  });

  const items = rows.map((r) => ({
    id: r.id,
    fullName: r.fullName,
    email: r.email,
    phone: r.phone,
    mode: r.mode,
    totalAmountEur: Number(r.totalAmountEur),
    paidAmountEur: Number(r.paidAmountEur),
    scheduledDate: r.scheduledDate,
    notes: r.notes,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
  }));

  const totalDue = items.reduce(
    (acc, c) => acc + Math.max(0, c.totalAmountEur - c.paidAmountEur),
    0
  );
  const totalPaid = items.reduce((acc, c) => acc + c.paidAmountEur, 0);
  const activeCount = items.filter((c) => c.status === 'active').length;

  return (
    <AdminContainer>
      <AdminPageHeader
        title="Coachings clients (offline)"
        description="Clients hors-site (importés depuis Excel ou créés à la main). Paiements suivis manuellement, pas via les payment providers."
      />

      <StatCardGrid cols={3} className="mb-5">
        <StatCard
          label="Clients actifs"
          value={activeCount}
          icon={<Users className="h-4 w-4" />}
          tone="info"
        />
        <StatCard
          label="Total encaissé"
          value={`${totalPaid.toLocaleString('fr-FR')}€`}
          tone="success"
        />
        <StatCard
          label="Reste à encaisser"
          value={`${totalDue.toLocaleString('fr-FR')}€`}
          tone={totalDue > 0 ? 'warning' : 'default'}
        />
      </StatCardGrid>

      <CoachingsList items={items} />
    </AdminContainer>
  );
}
