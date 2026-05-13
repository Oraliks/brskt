'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { AlertTriangle, Home, RotateCw } from 'lucide-react';
import { BackgroundFX } from '@/components/shared/background-fx';
import { Logo } from '@/components/shared/logo';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Log côté client pour le debug navigateur (Sentry/PostHog auto-capture si configurés)
    console.error('[boursikotons error]', error);
  }, [error]);

  return (
    <>
      <BackgroundFX />
      <div className="min-h-screen flex flex-col">
        <header className="px-4 sm:px-6 lg:px-8 py-6">
          <Logo />
        </header>

        <main className="flex-1 flex items-center justify-center px-4 py-12">
          <div className="max-w-lg w-full text-center space-y-8">
            <div className="font-mono text-xs text-rose-300/80 uppercase tracking-[0.2em] inline-flex items-center gap-2">
              <AlertTriangle className="h-3 w-3" />
              Erreur · APP_RUNTIME_500
            </div>

            <h1 className="font-serif text-7xl md:text-9xl text-gradient leading-none">
              500
            </h1>

            <div className="space-y-3">
              <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">
                Une erreur est survenue.
              </h2>
              <p className="text-[var(--color-text-dim)] text-sm md:text-base">
                Quelque chose s&apos;est mal passé côté serveur. Notre équipe
                est notifiée automatiquement.
              </p>
            </div>

            {error.digest && (
              <div className="inline-flex items-center gap-2 rounded-md bg-rose-500/10 border border-rose-500/20 px-3 py-2 text-xs">
                <span className="text-[var(--color-text-dim)] uppercase tracking-wider">
                  Référence
                </span>
                <code className="font-mono text-rose-200">
                  {error.digest}
                </code>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
              <button
                onClick={() => reset()}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-white text-[var(--color-bg)] px-6 py-3 text-sm font-medium hover:-translate-y-0.5 transition-all"
              >
                <RotateCw className="h-4 w-4" />
                Réessayer
              </button>
              <Link
                href="/"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-white/5 border border-[var(--color-border)] px-6 py-3 text-sm hover:bg-white/10 transition-colors"
              >
                <Home className="h-4 w-4" />
                Retour à l&apos;accueil
              </Link>
            </div>
          </div>
        </main>

        <footer className="px-4 py-6 text-center">
          <p className="text-xs text-[var(--color-text-faint)]">
            Si le problème persiste, partage la référence ci-dessus à
            l&apos;équipe via Telegram.
          </p>
        </footer>
      </div>
    </>
  );
}
