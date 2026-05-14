import { BackgroundFX } from '@/components/shared/background-fx';
import { Footer } from '@/components/shared/footer';
import { Navbar } from '@/components/shared/navbar';
import { getSession, isAdminUser } from '@/lib/auth/server';

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession().catch(() => null);
  const user = session?.user
    ? {
        name:
          session.user.telegramFirstName ?? session.user.name ?? 'Toi',
        image: session.user.telegramPhotoUrl ?? null,
      }
    : null;
  return (
    <>
      <BackgroundFX />
      <Navbar user={user} isAdmin={isAdminUser(session?.user)} />
      <main className="relative">{children}</main>
      <Footer />
    </>
  );
}
