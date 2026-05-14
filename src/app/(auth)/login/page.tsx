import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { getSession } from '@/lib/auth/server';
import { TelegramLoginButton } from '@/components/auth/telegram-login-button';
import { MessageCircle, ShieldCheck, Zap } from 'lucide-react';

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

      {/* Fallback : connexion via bot DM si le widget bug */}
      {botUsername && (
        <div className="glass rounded-[var(--radius-lg)] p-5 space-y-3">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-blue-500/15 border border-blue-500/30 flex-shrink-0">
              <MessageCircle className="h-4 w-4 text-blue-300 light:text-blue-700" />
            </span>
            <div className="flex-1">
              <div className="text-sm font-medium">
                Le bouton bleu ne marche pas ?
              </div>
              <p className="mt-1 text-xs text-[var(--color-text-dim)]">
                Ouvre le bot Telegram et envoie{' '}
                <code className="font-mono bg-[var(--color-surface-tint)] px-1.5 py-0.5 rounded">
                  /login
                </code>{' '}
                — il te renverra un lien de connexion instantané (valable 10
                min).
              </p>
              <a
                href={`https://t.me/${botUsername}?start=hello`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-blue-300 light:text-blue-700 hover:underline"
              >
                Ouvrir @{botUsername} →
              </a>
            </div>
          </div>
        </div>
      )}

      <details className="text-xs text-[var(--color-text-faint)]">
        <summary className="cursor-pointer hover:text-[var(--color-text-dim)]">
          Le widget ne fait rien quand je clique ?
        </summary>
        <div className="mt-2 space-y-2 leading-relaxed text-[var(--color-text-dim)]">
          <p>Les causes les plus fréquentes :</p>
          <ul className="list-disc list-inside space-y-1">
            <li>
              <strong>Sur desktop</strong> : le navigateur a bloqué la popup
              Telegram. Autorise les popups pour ce site.
            </li>
            <li>
              <strong>Sur mobile</strong> : tu n&apos;as pas encore ouvert
              notre bot une fois. Tape{' '}
              <code className="font-mono">/start</code> au bot, puis
              reviens cliquer sur le bouton.
            </li>
            <li>
              <strong>Toujours bloqué</strong> : utilise le fallback{' '}
              <code className="font-mono">/login</code> via le bot ci-dessus.
            </li>
          </ul>
        </div>
      </details>

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
