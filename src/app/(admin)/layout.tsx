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
      {/* Structure : conteneur vertical (sidebar+main en haut, Footer pleine
          largeur en bas). Le flex-1 sur le row du milieu pousse le Footer
          tout en bas du viewport quand le contenu est court, et le footer
          suit naturellement après le scroll quand le contenu est long.
          Pattern cohérent avec le layout (app) côté user. */}
      <div className="min-h-screen flex flex-col">
        <div className="flex-1 flex flex-col md:flex-row">
          <AdminSidebar />
          <main className="flex-1 min-w-0">{children}</main>
        </div>
        <Footer />
      </div>
    </>
  );
}
