'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
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

export function TelegramLoginButton({ botUsername, redirectTo }: Props) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);

  // Handler global pour le callback Telegram
  useEffect(() => {
    window.onTelegramAuth = async (data: TelegramAuthData) => {
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

  return (
    <div className="space-y-4">
      <div className="relative flex min-h-[60px] items-center justify-center rounded-[var(--radius-md)] bg-white/[0.02] border border-[var(--color-border)] p-3">
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
    </div>
  );
}
