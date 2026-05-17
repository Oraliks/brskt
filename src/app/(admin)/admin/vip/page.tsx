import { desc, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { manualIronfxStatus, vipApplications } from '@/lib/db/schema';
import { AdminContainer, AdminPageHeader } from '@/components/admin/page-header';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { VipTable } from '@/components/admin/vip-table';
import { VipPaidAccessTable } from '@/components/admin/vip-paid-access-table';
import { getIronFXMode } from '@/lib/ironfx';
import {
  getPaidAccessStats,
  listPaidAccessesForAdmin,
} from '@/lib/vip-paid-access';
import { Badge } from '@/components/ui/badge';
import { formatPrice } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function AdminVipPage() {
  const [list, mode, paidAccesses, paidStats] = await Promise.all([
    db.query.vipApplications.findMany({
      orderBy: [desc(vipApplications.updatedAt)],
      with: { user: true },
      limit: 200,
    }),
    getIronFXMode(),
    listPaidAccessesForAdmin(100),
    getPaidAccessStats(),
  ]);

  // Fetch manual ironfx status for accounts that have a brokerAccountId
  const accountIds = list
    .map((a) => a.brokerAccountId)
    .filter((id): id is string => !!id);

  const statuses =
    accountIds.length > 0
      ? await db.query.manualIronfxStatus.findMany({
          where: inArray(manualIronfxStatus.accountId, accountIds),
        })
      : [];

  const statusMap = new Map(statuses.map((s) => [s.accountId, s]));

  const enriched = list.map((a) => ({
    ...a,
    ironfxStatus: a.brokerAccountId
      ? statusMap.get(a.brokerAccountId) ?? null
      : null,
  }));

  return (
    <AdminContainer>
      <AdminPageHeader
        title="VIP Telegram"
        description="2 chemins d'accès : funnel affilié broker, ou paiement direct."
        actions={
          <Badge variant={mode === 'api' ? 'success' : 'warning'}>
            Mode IronFX : {mode}
          </Badge>
        }
      />

      {/* Stats récap accès payants (rapide visualisation) */}
      <div className="grid gap-3 md:grid-cols-3 mb-6">
        <StatCard
          label="Membres payants actifs"
          value={paidStats.active}
        />
        <StatCard
          label="Nouveaux ce mois"
          value={paidStats.newThisMonth}
        />
        <StatCard
          label="Revenu total accès payants"
          value={formatPrice(paidStats.totalRevenue)}
        />
      </div>

      <Tabs defaultValue="funnel" className="w-full">
        <TabsList>
          <TabsTrigger value="funnel">
            Funnel affilié{' '}
            <span className="ml-1 text-[10px] text-[var(--color-text-faint)]">
              ({enriched.length})
            </span>
          </TabsTrigger>
          <TabsTrigger value="paid">
            Accès payants{' '}
            <span className="ml-1 text-[10px] text-[var(--color-text-faint)]">
              ({paidAccesses.length})
            </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="funnel" className="mt-4">
          <VipTable applications={enriched} ironfxMode={mode} />
        </TabsContent>

        <TabsContent value="paid" className="mt-4">
          <VipPaidAccessTable rows={paidAccesses} />
        </TabsContent>
      </Tabs>
    </AdminContainer>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="glass rounded-[var(--radius-md)] p-4">
      <div className="text-xs uppercase tracking-wider text-[var(--color-text-faint)] mb-1">
        {label}
      </div>
      <div className="font-mono text-2xl font-semibold">{value}</div>
    </div>
  );
}
