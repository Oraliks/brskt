import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { getSession } from '@/lib/auth/server';
import { TelegramLoginButton } from '@/components/auth/telegram-login-button';
import { ShieldCheck, Zap } from 'lucide-react';

interface PageProps {
  searchParams: Promise<{ redirectTo?: string }>;
}

export default async function LoginPage({ searchParams }: PageProps) {
  const { redirectTo } = await searchParams;
  const session = await getSession().catch(() => null);

  if (session?.user) {
    redirect(redirectTo ?? '/dashboard');
  }

  const botUsername = process.env.TELEGRAM_BOT_USERNAME ?? '';

  return (
    <div className="space-y-8">
      <div className="text-center space-y-3">
        <h1 className="font-serif text-4xl md:text-5xl text-gradient">
          Connexion
        </h1>
        <p className="text-sm text-[var(--color-text-dim)]">
          Identification via Telegram — un clic, aucun mot de passe.
        </p>
      </div>

      <div className="glass-strong rounded-[var(--radius-lg)] p-8 space-y-6">
        <Suspense fallback={<div className="h-12 animate-pulse bg-[var(--color-surface-tint)] rounded-md" />}>
          {botUsername ? (
            <TelegramLoginButton
              botUsername={botUsername}
              redirectTo={redirectTo}
            />
          ) : (
            <div className="text-sm text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-md p-4">
              ⚠ <code>TELEGRAM_BOT_USERNAME</code> manquant dans la configuration.
              Définis-le dans <code>.env.local</code>.
            </div>
          )}
        </Suspense>

        <div className="grid gap-3">
          <Perk
            icon={ShieldCheck}
            title="Signé cryptographiquement"
            text="On vérifie ton login côté serveur avec ta signature Telegram."
          />
          <Perk
            icon={Zap}
            title="Pas de mot de passe"
            text="Tu utilises déjà ton compte Telegram, on l'utilise directement."
          />
        </div>
      </div>

      <p className="text-center text-xs text-[var(--color-text-faint)]">
        En te connectant, tu acceptes nos conditions.
        <br />
        Aucun email ni numéro n'est transmis par Telegram.
      </p>
    </div>
  );
}

function Perk({
  icon: Icon,
  title,
  text,
}: {
  icon: React.ElementType;
  title: string;
  text: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-[var(--color-surface-tint)] border border-[var(--color-border)] flex-shrink-0">
        <Icon className="h-4 w-4 text-[var(--color-accent-hover)]" />
      </span>
      <div>
        <div className="text-sm font-medium">{title}</div>
        <div className="text-xs text-[var(--color-text-dim)] mt-0.5">{text}</div>
      </div>
    </div>
  );
}
