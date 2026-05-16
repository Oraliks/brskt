'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AlertCircle, Loader2 } from 'lucide-react';

/**
 * Types minimaux pour `window.Telegram.WebApp` — la lib officielle Telegram
 * expose bien plus mais on n'a besoin que de quelques champs pour l'auth.
 */
interface TelegramWebAppLike {
  initData?: string;
  ready?: () => void;
  expand?: () => void;
  colorScheme?: 'light' | 'dark';
  themeParams?: { bg_color?: string };
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebAppLike };
  }
}

type State =
  | { status: 'loading' }
  | { status: 'no_telegram' }
  | { status: 'no_init_data' }
  | { status: 'error'; error: string };

export function MiniAppAuth() {
  const router = useRouter();
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    // Petit délai pour laisser le script Telegram WebApp s'initialiser
    // (beforeInteractive devrait l'avoir déjà chargé mais on est défensif).
    const timer = setTimeout(() => {
      const tg = window.Telegram?.WebApp;
      if (!tg) {
        setState({ status: 'no_telegram' });
        return;
      }

      tg.ready?.();
      tg.expand?.();

      const initData = tg.initData;
      if (!initData) {
        setState({ status: 'no_init_data' });
        return;
      }

      // Synchronise data-theme avec le thème Telegram pour cohérence visuelle
      if (tg.colorScheme === 'light') {
        document.documentElement.setAttribute('data-theme', 'light');
      }

      // Échange initData contre un cookie de session
      fetch('/api/auth/telegram-webapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData }),
      })
        .then(async (res) => {
          const data = (await res.json()) as
            | { ok: true; needsOnboarding: boolean }
            | { error: string };
          if (!res.ok || 'error' in data) {
            setState({
              status: 'error',
              error:
                'error' in data ? data.error : `HTTP ${res.status}`,
            });
            return;
          }
          // Auth réussie → redirige vers onboarding si email manque, sinon dashboard
          router.replace(data.needsOnboarding ? '/onboarding' : '/dashboard');
        })
        .catch((err: unknown) => {
          setState({
            status: 'error',
            error: err instanceof Error ? err.message : String(err),
          });
        });
    }, 100);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      {state.status === 'loading' && (
        <>
          <Loader2 className="h-8 w-8 animate-spin text-[var(--color-accent)] mb-4" />
          <p className="text-sm text-[var(--color-text-dim)]">
            Connexion en cours…
          </p>
        </>
      )}

      {state.status === 'no_telegram' && (
        <>
          <AlertCircle className="h-8 w-8 text-amber-400 mb-4" />
          <h1 className="font-serif text-2xl mb-2">
            Ouvre cette page depuis Telegram
          </h1>
          <p className="text-sm text-[var(--color-text-dim)] max-w-sm mb-6">
            Cette page ne fonctionne que dans le Mini App Telegram. Clique
            sur le bouton « Ouvrir l&apos;app » en bas de la conversation
            avec notre bot.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-full bg-[var(--color-inverse)] text-[var(--color-on-inverse)] px-5 py-2.5 text-sm font-medium"
          >
            Aller à la connexion classique
          </Link>
        </>
      )}

      {state.status === 'no_init_data' && (
        <>
          <AlertCircle className="h-8 w-8 text-amber-400 mb-4" />
          <h1 className="font-serif text-2xl mb-2">
            Données Telegram manquantes
          </h1>
          <p className="text-sm text-[var(--color-text-dim)] max-w-sm mb-6">
            Telegram n&apos;a pas transmis tes infos. Réouvre depuis le bot
            ou utilise la connexion classique.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-full bg-[var(--color-inverse)] text-[var(--color-on-inverse)] px-5 py-2.5 text-sm font-medium"
          >
            Connexion classique
          </Link>
        </>
      )}

      {state.status === 'error' && (
        <>
          <AlertCircle className="h-8 w-8 text-rose-400 mb-4" />
          <h1 className="font-serif text-2xl mb-2">Connexion échouée</h1>
          <p className="text-sm text-[var(--color-text-dim)] max-w-sm mb-6">
            Erreur : <code className="font-mono">{state.error}</code>
          </p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-full bg-[var(--color-inverse)] text-[var(--color-on-inverse)] px-5 py-2.5 text-sm font-medium"
          >
            Connexion classique
          </Link>
        </>
      )}
    </div>
  );
}
