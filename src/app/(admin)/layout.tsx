import { BackgroundFX } from '@/components/shared/background-fx';
import { Footer } from '@/components/shared/footer';
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
      {/* min-h-screen + flex-row sur desktop : sidebar à gauche, main à droite.
          Le main est flex-col avec content (flex-1) + Footer : ça pousse le
          footer tout en bas du viewport même quand le contenu est court. */}
      <div className="min-h-screen flex flex-col md:flex-row">
        <AdminSidebar />
        <main className="flex-1 min-w-0 flex flex-col">
          <div className="flex-1">{children}</div>
          <Footer />
        </main>
      </div>
    </>
  );
}
