'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Loader2, MessageCircle } from 'lucide-react';
import Link from 'next/link';
import { toast } from '@/components/ui/use-toast';

interface TelegramAuthData {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

interface Props {
  botUsername: string;
  redirectTo?: string;
}

declare global {
  interface Window {
    onTelegramAuth?: (data: TelegramAuthData) => void;
  }
}

// Délai après le 1er clic sur la zone du widget avant qu'on suspecte un
// problème. 45s = laisse le temps au user de saisir le code reçu par DM.
const STUCK_DETECTION_MS = 45_000;

export function TelegramLoginButton({ botUsername, redirectTo }: Props) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [stuck, setStuck] = useState(false);

  const interactedRef = useRef(false);
  const stuckTimerRef = useRef<number | null>(null);

  // Handler global pour le callback Telegram
  useEffect(() => {
    window.onTelegramAuth = async (data: TelegramAuthData) => {
      // Auth a réussi → on annule la détection de blocage
      if (stuckTimerRef.current !== null) {
        window.clearTimeout(stuckTimerRef.current);
        stuckTimerRef.current = null;
      }
      setStuck(false);
      setLoading(true);
      try {
        const res = await fetch('/api/auth/telegram', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.error ?? 'login_failed');
        }
        const dest =
          redirectTo && redirectTo.startsWith('/')
            ? redirectTo
            : json.redirectTo ?? '/dashboard';
        router.push(dest);
        router.refresh();
      } catch (err) {
        toast({
          title: 'Connexion impossible',
          description: err instanceof Error ? err.message : String(err),
          variant: 'destructive',
        });
        setLoading(false);
      }
    };
    return () => {
      delete window.onTelegramAuth;
    };
  }, [redirectTo, router]);

  // Injection manuelle du script Telegram DANS le container
  // (sinon le widget génère son iframe à la fin du body)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.async = true;
    script.setAttribute('data-telegram-login', botUsername);
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-radius', '10');
    script.setAttribute('data-onauth', 'onTelegramAuth(user)');
    script.setAttribute('data-request-access', 'write');
    container.appendChild(script);

    return () => {
      // Cleanup : retire le script ET l'iframe générée à côté
      container.innerHTML = '';
    };
  }, [botUsername]);

  // Détection de widget bloqué : si user clique sur la zone du widget mais
  // que onTelegramAuth n'est jamais appelé dans les 45s → on affiche un
  // hint pour utiliser le fallback /login du bot. Cas typique : domain pas
  // configuré chez BotFather → le popup s'ouvre, le code est reçu, l'user
  // l'entre, mais le postMessage de retour échoue silencieusement.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    function onFirstInteract() {
      if (interactedRef.current) return;
      interactedRef.current = true;
      stuckTimerRef.current = window.setTimeout(() => {
        setStuck(true);
      }, STUCK_DETECTION_MS);
    }

    // Le widget est dans une iframe — on capte le pointerdown au-dessus
    // de l'iframe sur le container parent (le clic réel n'est pas
    // accessible directement à cause du cross-origin iframe).
    container.addEventListener('pointerdown', onFirstInteract);
    return () => {
      container.removeEventListener('pointerdown', onFirstInteract);
      if (stuckTimerRef.current !== null) {
        window.clearTimeout(stuckTimerRef.current);
      }
    };
  }, []);

  return (
    <div className="space-y-4">
      <div className="relative flex min-h-[60px] items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-surface-tint)] border border-[var(--color-border)] p-3">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-[var(--color-bg)]/80 rounded-[var(--radius-md)] z-10">
            <Loader2 className="h-5 w-5 animate-spin text-[var(--color-accent)]" />
            <span className="ml-2 text-sm">Connexion…</span>
          </div>
        )}

        <div
          ref={containerRef}
          className="flex items-center justify-center w-full min-h-[44px]"
        />
      </div>

      <p className="text-center text-xs text-[var(--color-text-faint)]">
        Le bouton bleu est fourni par Telegram. Cliquer ouvre une fenêtre
        Telegram qui te renvoie ici une fois validé.
      </p>

      {/* Hint affiché si le widget semble bloqué après 45s */}
      {stuck && (
        <div className="rounded-[var(--radius-md)] border border-amber-500/40 bg-amber-500/10 p-4 space-y-3 animate-[radix-fade-in_0.3s_ease-out]">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-400 light:text-amber-700 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <strong className="text-amber-200 light:text-amber-800 text-sm font-semibold">
                Le widget Telegram ne répond pas ?
              </strong>
              <p className="mt-1 text-xs text-[var(--color-text-dim)] leading-relaxed">
                Tu as reçu un code par Telegram mais après l&apos;avoir
                entré rien ne se passe ? C&apos;est souvent un problème de
                configuration du bot.{' '}
                <strong className="text-[var(--color-text)]">
                  Utilise le fallback ci-dessous :
                </strong>
              </p>
              <ol className="mt-2 space-y-1 text-xs text-[var(--color-text-dim)] list-decimal list-inside">
                <li>
                  Ouvre{' '}
                  <Link
                    href={`https://t.me/${botUsername}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline font-medium text-[var(--color-text)]"
                  >
                    @{botUsername}
                  </Link>{' '}
                  sur Telegram
                </li>
                <li>
                  Envoie la commande{' '}
                  <code className="font-mono bg-[var(--color-surface-tint)] px-1 py-0.5 rounded">
                    /login
                  </code>
                </li>
                <li>Clique sur le lien que le bot t&apos;envoie</li>
              </ol>
              <Link
                href={`https://t.me/${botUsername}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-blue-300 light:text-blue-700 hover:underline"
              >
                <MessageCircle className="h-3 w-3" />
                Ouvrir le bot Telegram
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
