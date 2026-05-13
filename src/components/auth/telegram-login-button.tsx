'use client';

import Script from 'next/script';
import { useEffect, useState } from 'react';
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
  const [loading, setLoading] = useState(false);

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

  return (
    <div className="space-y-4">
      <div className="relative flex min-h-[60px] items-center justify-center rounded-[var(--radius-md)] bg-white/[0.02] border border-[var(--color-border)] p-3">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-[var(--color-bg)]/80 rounded-[var(--radius-md)]">
            <Loader2 className="h-5 w-5 animate-spin text-[var(--color-accent)]" />
            <span className="ml-2 text-sm">Connexion…</span>
          </div>
        )}

        {/* Le widget Telegram s'injecte ici */}
        <div id="telegram-login-container" className="flex items-center justify-center w-full">
          <Script
            src="https://telegram.org/js/telegram-widget.js?22"
            strategy="afterInteractive"
            data-telegram-login={botUsername}
            data-size="large"
            data-radius="10"
            data-onauth="onTelegramAuth(user)"
            data-request-access="write"
          />
        </div>
      </div>

      <p className="text-center text-xs text-[var(--color-text-faint)]">
        Le bouton bleu est fourni par Telegram. Cliquer ouvre une fenêtre
        Telegram qui te renvoie ici une fois validé.
      </p>
    </div>
  );
}
