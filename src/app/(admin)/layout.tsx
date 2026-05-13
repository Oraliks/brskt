import { BackgroundFX } from '@/components/shared/background-fx';
import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { requireAdmin } from '@/lib/auth/server';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();
  return (
    <>
      <BackgroundFX />
      <div className="min-h-screen flex">
        <AdminSidebar />
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </>
  );
}
