import { AdminShell } from '@/components/admin/admin-shell';
import { requireAdmin } from '@/lib/auth/server';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();
  return <AdminShell>{children}</AdminShell>;
}
