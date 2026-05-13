import { BackgroundFX } from '@/components/shared/background-fx';
import { Footer } from '@/components/shared/footer';
import { Navbar } from '@/components/shared/navbar';
import { getSession } from '@/lib/auth/server';

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession().catch(() => null);
  return (
    <>
      <BackgroundFX />
      <Navbar authenticated={Boolean(session?.user)} />
      <main className="relative">{children}</main>
      <Footer />
    </>
  );
}
