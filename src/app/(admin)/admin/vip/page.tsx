import { desc, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { manualIronfxStatus, vipApplications } from '@/lib/db/schema';
import { AdminContainer, AdminPageHeader } from '@/components/admin/page-header';
import { VipTable } from '@/components/admin/vip-table';
import { getIronFXMode } from '@/lib/ironfx';
import { Badge } from '@/components/ui/badge';

export const dynamic = 'force-dynamic';

export default async function AdminVipPage() {
  const [list, mode] = await Promise.all([
    db.query.vipApplications.findMany({
      orderBy: [desc(vipApplications.updatedAt)],
      with: { user: true },
      limit: 200,
    }),
    getIronFXMode(),
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
        description="Valide les inscriptions, dépôts, ajuste la progression."
        actions={
          <Badge variant={mode === 'api' ? 'success' : 'warning'}>
            Mode IronFX : {mode}
          </Badge>
        }
      />
      <VipTable applications={enriched} ironfxMode={mode} />
    </AdminContainer>
  );
}
