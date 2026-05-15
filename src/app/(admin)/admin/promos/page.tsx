import { desc } from 'drizzle-orm';
import { Tag } from 'lucide-react';
import { db } from '@/lib/db';
import { promoCodes } from '@/lib/db/schema';
import {
  AdminContainer,
  AdminPageHeader,
} from '@/components/admin/page-header';
import { PromoList } from '@/components/admin/promo-list';

export const dynamic = 'force-dynamic';

export default async function AdminPromosPage() {
  const list = await db.query.promoCodes.findMany({
    orderBy: [desc(promoCodes.createdAt)],
    limit: 200,
  });

  return (
    <AdminContainer>
      <AdminPageHeader
        title="Codes promo"
        description="Créer, désactiver, suivre l'utilisation des codes promo. Appliqués au checkout par les users."
        actions={
          <span className="inline-flex items-center gap-1.5 text-xs text-[var(--color-text-dim)]">
            <Tag className="h-3.5 w-3.5" />
            {list.length} code{list.length > 1 ? 's' : ''}
          </span>
        }
      />

      <PromoList
        items={list.map((p) => ({
          id: p.id,
          code: p.code,
          discountType: p.discountType,
          discountValue: Number(p.discountValue),
          validFrom: p.validFrom?.toISOString() ?? null,
          validUntil: p.validUntil?.toISOString() ?? null,
          maxUses: p.maxUses,
          usedCount: p.usedCount,
          applicableMode: p.applicableMode,
          active: p.active,
          notes: p.notes,
          createdAt: p.createdAt.toISOString(),
        }))}
      />
    </AdminContainer>
  );
}
