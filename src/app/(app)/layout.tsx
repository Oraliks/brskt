import { BackgroundFX } from '@/components/shared/background-fx';
import { Footer } from '@/components/shared/footer';
import { AppNavbar } from '@/components/shared/app-navbar';
import { requireAuth } from '@/lib/auth/server';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAuth();
  return (
    <>
      <BackgroundFX />
      <AppNavbar
        userName={session.user.telegramFirstName ?? session.user.name ?? 'Toi'}
        userImage={session.user.telegramPhotoUrl ?? null}
        isAdmin={session.user.role === 'admin'}
      />
      <main className="relative">{children}</main>
      <Footer />
    </>
  );
}
