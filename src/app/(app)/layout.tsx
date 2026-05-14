import { BackgroundFX } from '@/components/shared/background-fx';
import { Footer } from '@/components/shared/footer';
import { Navbar } from '@/components/shared/navbar';
import { LiveTickerBar } from '@/components/shared/live-ticker-bar';
import { isAdminUser, requireAuth } from '@/lib/auth/server';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAuth();
  return (
    <div className="min-h-screen flex flex-col">
      <BackgroundFX />
      <Navbar
        user={{
          name:
            session.user.telegramFirstName ?? session.user.name ?? 'Toi',
          image: session.user.telegramPhotoUrl ?? null,
        }}
        isAdmin={isAdminUser(session.user)}
      />
      <LiveTickerBar />
      <main className="relative flex-1">{children}</main>
      <Footer />
    </div>
  );
}
