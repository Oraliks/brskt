import Link from 'next/link';
import { ArrowLeft, Home } from 'lucide-react';
import { BackgroundFX } from '@/components/shared/background-fx';
import { Logo } from '@/components/shared/logo';

export default function NotFound() {
  return (
    <>
      <BackgroundFX />
      <div className="min-h-screen flex flex-col">
        <header className="px-4 sm:px-6 lg:px-8 py-6">
          <Logo />
        </header>

        <main className="flex-1 flex items-center justify-center px-4 py-12">
          <div className="max-w-lg w-full text-center space-y-8">
            <div className="font-mono text-xs text-[var(--color-text-faint)] uppercase tracking-[0.2em]">
              Erreur · NOT_FOUND_404
            </div>

            <h1 className="font-serif text-7xl md:text-9xl text-gradient-accent leading-none">
              404
            </h1>

            <div className="space-y-3">
              <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">
                Cette page n&apos;existe pas.
              </h2>
              <p className="text-[var(--color-text-dim)] text-sm md:text-base">
                Le lien que tu as suivi est cassé, ou la ressource a été
                supprimée. Code <code className="font-mono text-[var(--color-text)] bg-white/5 px-1.5 py-0.5 rounded">404</code> renvoyé par notre serveur.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
              <Link
                href="/"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-white text-[var(--color-bg)] px-6 py-3 text-sm font-medium hover:-translate-y-0.5 transition-all"
              >
                <Home className="h-4 w-4" />
                Retour à l&apos;accueil
              </Link>
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-white/5 border border-[var(--color-border)] px-6 py-3 text-sm hover:bg-white/10 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Mon espace
              </Link>
            </div>
          </div>
        </main>

        <footer className="px-4 py-6 text-center">
          <p className="text-xs text-[var(--color-text-faint)]">
            Si tu pensais arriver quelque part de précis, signale-nous le lien
            sur Telegram.
          </p>
        </footer>
      </div>
    </>
  );
}
