import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { getSession } from '@/lib/auth/server';
import { TelegramLoginButton } from '@/components/auth/telegram-login-button';
import { MessageCircle, ShieldCheck, Zap } from 'lucide-react';

interface PageProps {
  searchParams: Promise<{ redirectTo?: string; error?: string }>;
}

const ERROR_MESSAGES: Record<string, string> = {
  missing_token: 'Lien invalide : token manquant.',
  malformed: 'Lien malformé. Demande-en un nouveau via /login dans le bot.',
  invalid_signature:
    'Lien invalide ou modifié. Demande-en un nouveau via /login dans le bot.',
  expired:
    'Lien expiré (10 min max). Renvoie /login dans le bot pour en obtenir un nouveau.',
  rate_limited:
    'Trop de tentatives. Réessaye dans 10 minutes.',
  user_create_failed:
    'Erreur création du compte. Contacte l\'équipe sur Telegram.',
};

export default async function LoginPage({ searchParams }: PageProps) {
  const { redirectTo, error } = await searchParams;
  const session = await getSession().catch(() => null);

  if (session?.user) {
    redirect(redirectTo ?? '/dashboard');
  }

  const botUsername = process.env.TELEGRAM_BOT_USERNAME ?? '';
  const errorMessage = error ? ERROR_MESSAGES[error] ?? error : null;

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h1 className="font-serif text-4xl md:text-5xl text-gradient">
          Connexion
        </h1>
        <p className="text-sm text-[var(--color-text-dim)]">
          Identification via Telegram — un clic, aucun mot de passe.
        </p>
      </div>

      {/* Banner d'erreur si redirection depuis /login/magic avec ?error=... */}
      {errorMessage && (
        <div className="rounded-[var(--radius-md)] bg-rose-500/10 border border-rose-500/30 px-4 py-3 text-sm text-rose-200 light:text-rose-700">
          <strong>Connexion magic-link échouée :</strong> {errorMessage}
        </div>
      )}

      {/* Astuce mobile bien visible (le widget Telegram bug souvent sur mobile) */}
      {botUsername && (
        <div className="rounded-[var(--radius-md)] bg-blue-500/10 border border-blue-500/30 px-4 py-3 text-xs text-[var(--color-text-dim)] flex items-start gap-2.5">
          <MessageCircle className="h-4 w-4 text-blue-300 light:text-blue-700 flex-shrink-0 mt-0.5" />
          <div>
            <strong className="text-[var(--color-text)]">
              Sur téléphone ?
            </strong>{' '}
            Le widget ci-dessous peut buguer (notification jamais reçue). Si
            ça t&apos;arrive, utilise le{' '}
            <a
              href={`https://t.me/${botUsername}?start=login`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-blue-300 light:text-blue-700 underline underline-offset-2 hover:text-blue-200"
            >
              lien direct via le bot →
            </a>{' '}
            (instantané).
          </div>
        </div>
      )}

      <div className="glass-strong rounded-[var(--radius-lg)] p-6 md:p-8 space-y-5">
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

      {/* Fallback : magic link via bot DM */}
      {botUsername && (
        <div className="glass rounded-[var(--radius-lg)] p-5">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-blue-500/15 border border-blue-500/30 flex-shrink-0">
              <MessageCircle className="h-4 w-4 text-blue-300 light:text-blue-700" />
            </span>
            <div className="flex-1">
              <div className="text-sm font-medium">
                Méthode garantie : magic link via bot
              </div>
              <p className="mt-1 text-xs text-[var(--color-text-dim)]">
                Ouvre le bot Telegram → tu reçois immédiatement un lien de
                connexion en DM (valable 10 min). Marche dans tous les cas, y
                compris quand le widget ci-dessus échoue.
              </p>
              <a
                href={`https://t.me/${botUsername}?start=login`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-md bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium transition-colors"
              >
                <MessageCircle className="h-4 w-4" />
                Recevoir mon lien via @{botUsername}
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
