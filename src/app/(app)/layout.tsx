import { BackgroundFX } from '@/components/shared/background-fx';
import { Footer } from '@/components/shared/footer';
import { AppNavbar } from '@/components/shared/app-navbar';
import { LiveTickerBar } from '@/components/shared/live-ticker-bar';
import { isAdminUser, requireAuth } from '@/lib/auth/server';

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
        isAdmin={isAdminUser(session.user)}
      />
      <LiveTickerBar />
      <main className="relative">{children}</main>
      <Footer />
    </>
  );
}
