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
      {/* Structure : flex-row à la racine avec min-h-screen.
          - Sidebar : h-[100dvh] + sticky top-0 → reste visible à 100vh du
            viewport quel que soit le scroll. Pour que le sticky fonctionne,
            son parent direct doit être au moins aussi haut que le viewport.
            Ici le parent direct EST le wrapper min-h-screen donc OK.
          - Main : flex-col avec content (flex-1) + Footer → footer toujours
            en bas du contenu, jamais en plein milieu. */}
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
