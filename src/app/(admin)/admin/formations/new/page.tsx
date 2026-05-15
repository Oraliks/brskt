import { AdminContainer } from '@/components/admin/page-header';
import { FormationForm } from '@/components/admin/formation-form';

export const dynamic = 'force-dynamic';

export default function NewFormationPage() {
  return (
    <AdminContainer>
      <FormationForm />
    </AdminContainer>
  );
}
