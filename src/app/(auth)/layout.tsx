import { BackgroundFX } from '@/components/shared/background-fx';
import { Logo } from '@/components/shared/logo';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <BackgroundFX />
      <div className="min-h-screen flex flex-col">
        <header className="px-4 sm:px-6 lg:px-8 py-6">
          <Logo />
        </header>
        <main className="flex-1 flex items-center justify-center px-4 py-12">
          <div className="w-full max-w-md">{children}</div>
        </main>
      </div>
    </>
  );
}
