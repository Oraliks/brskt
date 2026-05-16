'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AlertCircle, Loader2 } from 'lucide-react';
import { useTelegram } from './telegram-webapp';

type State =
  | { status: 'loading' }
  | { status: 'no_telegram' }
  | { status: 'no_init_data' }
  | { status: 'error'; error: string };

/**
 * Composant d'auth Mini App.
 *
 * 1. Lit `tg.initData` via le TelegramProvider monté au root layout
 * 2. POST sur `/api/auth/telegram-webapp` pour échanger contre un cookie
 * 3. Redirect selon :
 *    - start_param fourni (deep-link bot) → route correspondante
 *    - sinon : /onboarding si email manquant, sinon /dashboard
 */
export function MiniAppAuth() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { tg, startParam } = useTelegram();
  const [state, setState] = useState<State>({ status: 'loading' });

  // Param lu depuis 2 sources :
  //  - Telegram start_param (lien t.me/<bot>/<webapp>?startapp=…)
  //  - Query string ?goto=… (URL de la WebApp button d'un InlineKeyboard
  //    envoyé par le bot — c'est ce qu'on utilise dans bot.ts)
  // Le ?goto= prend priorité car c'est notre mécanisme principal.
  const gotoParam = searchParams.get('goto') ?? null;
  const effectiveParam = gotoParam ?? startParam;

  useEffect(() => {
    // Attente courte que le provider ait détecté Telegram
    const timer = setTimeout(() => {
      if (!tg) {
        setState({ status: 'no_telegram' });
        return;
      }

      const initData = tg.initData;
      if (!initData) {
        setState({ status: 'no_init_data' });
        return;
      }

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
          // Détermine la cible :
          //  - Si onboarding requis → /onboarding (passe outre le startParam)
          //  - Sinon, mappe startParam vers la bonne route
          const target = data.needsOnboarding
            ? '/onboarding'
            : routeForStartParam(effectiveParam) ?? '/dashboard';
          router.replace(target);
        })
        .catch((err: unknown) => {
          setState({
            status: 'error',
            error: err instanceof Error ? err.message : String(err),
          });
        });
    }, 100);

    return () => clearTimeout(timer);
  }, [router, tg, effectiveParam]);

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

/**
 * Mappe un `start_param` Telegram vers une route interne. Le bot dispatche
 * ces paramètres via `t.me/<bot>/<webapp_short>?startapp=<value>` ou
 * `?start=<value>` (parsé côté bot).
 *
 * Valeurs supportées (alignées avec les commandes bot) :
 *  - `formation_remote` / `formation_onsite` → page de réservation
 *  - `vip` → funnel VIP
 *  - `jeux` / `predict` / `roue` / `classement` → pages jeux
 *  - `reservation` / `dashboard` → dashboard user
 *
 * Retourne null si pas de match — on laisse le fallback /dashboard prendre.
 */
export function routeForStartParam(param: string | null): string | null {
  if (!param) return null;
  switch (param) {
    case 'formation_remote':
      return '/formation/reserver?mode=remote';
    case 'formation_onsite':
      return '/formation/reserver?mode=onsite';
    case 'formation':
      return '/formation';
    case 'vip':
      return '/vip';
    case 'reservation':
    case 'dashboard':
      return '/dashboard';
    case 'temoignages':
      return '/temoignages';
    case 'jeux':
    case 'jouer':
      return '/jeux';
    case 'predict':
    case 'pronostic':
      return '/jeux/predict';
    case 'roue':
    case 'wheel':
      return '/jeux/roue';
    case 'classement':
    case 'leaderboard':
      return '/jeux/classement';
    default:
      // Paramètres dynamiques type "waitlist_remote" : prefix-match
      if (param.startsWith('waitlist_')) return '/formation';
      return null;
  }
}
