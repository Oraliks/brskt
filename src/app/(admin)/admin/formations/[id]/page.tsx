import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { formations } from '@/lib/db/schema';
import { AdminContainer } from '@/components/admin/page-header';
import { FormationForm } from '@/components/admin/formation-form';

export const dynamic = 'force-dynamic';

export default async function EditFormationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // UUID sanity check — évite un trip DB pour un path obvieusement invalide
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    notFound();
  }

  const formation = await db.query.formations.findFirst({
    where: eq(formations.id, id),
  });

  if (!formation) {
    notFound();
  }

  return (
    <AdminContainer>
      <FormationForm
        initial={{
          id: formation.id,
          title: formation.title,
          slug: formation.slug,
          mode: formation.mode,
          description: formation.description ?? '',
          priceEur: Number(formation.priceEur),
          durationDays: formation.durationDays,
          dailyCapacity: formation.dailyCapacity,
          active: formation.active,
        }}
      />
    </AdminContainer>
  );
}
