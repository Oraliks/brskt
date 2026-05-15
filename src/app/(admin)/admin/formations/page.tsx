import { asc } from 'drizzle-orm';
import { GraduationCap } from 'lucide-react';
import { db } from '@/lib/db';
import { formations } from '@/lib/db/schema';
import {
  AdminContainer,
  AdminPageHeader,
} from '@/components/admin/page-header';
import { FormationsAdminList } from '@/components/admin/formations-admin-list';

export const dynamic = 'force-dynamic';

export default async function AdminFormationsPage() {
  const list = await db.query.formations.findMany({
    orderBy: [asc(formations.priceEur)],
  });

  return (
    <AdminContainer>
      <AdminPageHeader
        title="Formations"
        description="Modifier les prix, titres, descriptions. Désactiver = la formation n'apparaît plus dans les pages publiques mais les bookings existants ne sont pas affectés."
        actions={
          <span className="inline-flex items-center gap-1.5 text-xs text-[var(--color-text-dim)]">
            <GraduationCap className="h-3.5 w-3.5" />
            {list.length} formation{list.length > 1 ? 's' : ''}
          </span>
        }
      />

      <FormationsAdminList
        items={list.map((f) => ({
          id: f.id,
          title: f.title,
          slug: f.slug,
          mode: f.mode,
          description: f.description ?? '',
          priceEur: Number(f.priceEur),
          durationDays: f.durationDays,
          active: f.active,
        }))}
      />
    </AdminContainer>
  );
}
