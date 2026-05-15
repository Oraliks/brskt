import { asc } from 'drizzle-orm';
import Link from 'next/link';
import { GraduationCap, Plus } from 'lucide-react';
import { db } from '@/lib/db';
import { formations } from '@/lib/db/schema';
import {
  AdminContainer,
  AdminPageHeader,
} from '@/components/admin/page-header';
import { Button } from '@/components/ui/button';
import { FormationsTable } from '@/components/admin/formations-table';

export const dynamic = 'force-dynamic';

export default async function AdminFormationsPage() {
  const list = await db.query.formations.findMany({
    orderBy: [asc(formations.priceEur)],
  });

  return (
    <AdminContainer>
      <AdminPageHeader
        title="Formations"
        description="Liste et gestion des formations proposées. Cliquer sur Modifier pour éditer les détails."
        actions={
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 text-xs text-[var(--color-text-dim)]">
              <GraduationCap className="h-3.5 w-3.5" />
              {list.length} formation{list.length > 1 ? 's' : ''}
            </span>
            <Button asChild size="sm">
              <Link href="/admin/formations/new">
                <Plus className="h-4 w-4" />
                Nouvelle formation
              </Link>
            </Button>
          </div>
        }
      />

      <FormationsTable
        items={list.map((f) => ({
          id: f.id,
          title: f.title,
          slug: f.slug,
          mode: f.mode,
          priceEur: Number(f.priceEur),
          durationDays: f.durationDays,
          dailyCapacity: f.dailyCapacity,
          active: f.active,
        }))}
      />
    </AdminContainer>
  );
}
