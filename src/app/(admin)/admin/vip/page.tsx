import { desc } from 'drizzle-orm';
import { db } from '@/lib/db';
import { vipApplications } from '@/lib/db/schema';
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

  return (
    <AdminContainer>
      <AdminPageHeader
        title="VIP Telegram"
        description="Valide les inscriptions, dépôts, et éjecte si nécessaire."
        actions={
          <Badge variant={mode === 'api' ? 'success' : 'warning'}>
            Mode IronFX : {mode}
          </Badge>
        }
      />
      <VipTable applications={list} />
    </AdminContainer>
  );
}
