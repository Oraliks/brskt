import { Activity, AlertCircle, AlertTriangle, CheckCircle2 } from 'lucide-react';
import {
  AdminContainer,
  AdminPageHeader,
} from '@/components/admin/page-header';
import { Badge } from '@/components/ui/badge';

export const dynamic = 'force-dynamic';

/**
 * Page diagnostic admin : vérifie la config Telegram bot + autres env vars
 * essentiels. Utile quand un user signale un problème de login pour
 * identifier rapidement la cause.
 *
 * Tests :
 *  1. TELEGRAM_BOT_TOKEN set + valide (appelle getMe)
 *  2. TELEGRAM_BOT_USERNAME set + match le username remonté par getMe
 *  3. NEXT_PUBLIC_APP_URL set + en HTTPS
 *  4. BotFather setdomain rappel (on ne peut pas vérifier via API)
 *  5. MAGIC_LINK_SECRET ou BETTER_AUTH_SECRET set
 *  6. ADMIN_TELEGRAM_IDS set
 *  7. Webhook bot set (getWebhookInfo)
 */
export default async function AdminDiagnosticsPage() {
  const botInfo = await fetchBotInfo();
  const webhookInfo = await fetchWebhookInfo();

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const botUsername = process.env.TELEGRAM_BOT_USERNAME;
  const expectedUsername =
    botInfo.ok && 'username' in botInfo.data ? botInfo.data.username : null;

  // Test live de la config /setdomain : appelle oauth.telegram.org/embed
  // avec notre origin. Si BotFather n'a pas le domaine, Telegram répond
  // avec une page d'erreur (origin mismatch).
  const widgetOrigin = await checkWidgetOrigin(botUsername, appUrl);

  const checks: Check[] = [
    {
      label: 'TELEGRAM_BOT_TOKEN configuré et valide',
      status: botInfo.ok ? 'ok' : 'error',
      detail: botInfo.ok
        ? `Bot : ${botInfo.data.first_name} (@${botInfo.data.username}) · ID ${botInfo.data.id}`
        : `Erreur Telegram API : ${botInfo.error}`,
      action: !botInfo.ok
        ? "Vérifier TELEGRAM_BOT_TOKEN dans Vercel. Régénérer via @BotFather (/token) si compromis."
        : undefined,
    },
    {
      label: 'TELEGRAM_BOT_USERNAME correspond au bot',
      status:
        !botUsername
          ? 'error'
          : expectedUsername && botUsername === expectedUsername
          ? 'ok'
          : 'warn',
      detail: !botUsername
        ? 'Variable manquante.'
        : expectedUsername
        ? `Configuré : @${botUsername} · Telegram dit : @${expectedUsername}`
        : 'Telegram API inaccessible, impossible de comparer.',
      action:
        botUsername && expectedUsername && botUsername !== expectedUsername
          ? `Mismatch ! Le widget pointera vers @${botUsername} mais le bot est @${expectedUsername}. Aligner les deux dans Vercel.`
          : undefined,
    },
    {
      label: 'NEXT_PUBLIC_APP_URL en HTTPS',
      status: !appUrl
        ? 'error'
        : appUrl.startsWith('https://')
        ? 'ok'
        : 'warn',
      detail: appUrl ?? 'manquant',
      action: appUrl?.startsWith('http://')
        ? "Telegram widget refuse HTTP en production. Forcer HTTPS."
        : undefined,
    },
    {
      label: 'BotFather /setdomain (origin du Telegram Login Widget)',
      status: widgetOrigin.status,
      detail: widgetOrigin.detail,
      action: widgetOrigin.action,
    },
    {
      label: 'Webhook Telegram configuré',
      status: webhookInfo.ok && webhookInfo.data.url ? 'ok' : 'warn',
      detail: webhookInfo.ok
        ? webhookInfo.data.url
          ? `URL : ${webhookInfo.data.url}${
              webhookInfo.data.pending_update_count
                ? ` · ${webhookInfo.data.pending_update_count} updates en attente`
                : ''
            }${
              webhookInfo.data.last_error_message
                ? ` · ⚠ Dernière erreur : ${webhookInfo.data.last_error_message}`
                : ''
            }`
          : 'Aucun webhook set — utiliser `pnpm telegram:setup` ou setWebhook manuellement.'
        : `Erreur : ${webhookInfo.error}`,
      action:
        webhookInfo.ok && !webhookInfo.data.url
          ? 'Lancer `pnpm telegram:setup` pour configurer le webhook'
          : undefined,
    },
    {
      label: 'MAGIC_LINK_SECRET ou BETTER_AUTH_SECRET configuré',
      status:
        process.env.MAGIC_LINK_SECRET || process.env.BETTER_AUTH_SECRET
          ? 'ok'
          : 'error',
      detail: process.env.MAGIC_LINK_SECRET
        ? 'MAGIC_LINK_SECRET set'
        : process.env.BETTER_AUTH_SECRET
        ? 'BETTER_AUTH_SECRET set (utilisé en fallback)'
        : 'Aucun secret — le magic-link /login ne marchera pas.',
    },
    {
      label: 'ADMIN_TELEGRAM_IDS configuré',
      status: process.env.ADMIN_TELEGRAM_IDS?.trim() ? 'ok' : 'error',
      detail: process.env.ADMIN_TELEGRAM_IDS
        ? `IDs déclarés : ${process.env.ADMIN_TELEGRAM_IDS.split(',').length}`
        : 'Variable manquante — aucun admin ne pourra accéder à /admin (404 partout).',
    },
  ];

  return (
    <AdminContainer>
      <AdminPageHeader
        title="Diagnostics"
        description="Vérification de la configuration Telegram et auth."
        actions={
          <Badge variant="secondary">
            <Activity className="h-3 w-3 mr-1" />
            Live check
          </Badge>
        }
      />

      <div className="space-y-3">
        {checks.map((c) => (
          <CheckRow key={c.label} check={c} />
        ))}
      </div>

      <div className="mt-8 glass rounded-[var(--radius-lg)] p-5 text-sm space-y-3">
        <h2 className="font-semibold">Si un user n&apos;arrive pas à se connecter</h2>
        <ol className="list-decimal list-inside space-y-2 text-[var(--color-text-dim)]">
          <li>
            Vérifier que tous les checks ci-dessus sont au vert (notamment{' '}
            <code>/setdomain</code> chez @BotFather).
          </li>
          <li>
            Lui dire d&apos;envoyer <code>/start</code> au bot Telegram une
            première fois, puis de revenir sur la page de login.
          </li>
          <li>
            En dernier recours : envoyer <code>/login</code> dans le bot DM —
            il recevra un lien de connexion direct (valide 10 min).
          </li>
          <li>
            Sur desktop : vérifier que la popup Telegram n&apos;est pas
            bloquée par le navigateur.
          </li>
        </ol>
      </div>
    </AdminContainer>
  );
}

interface Check {
  label: string;
  status: 'ok' | 'warn' | 'error' | 'manual';
  detail: string;
  action?: string;
}

function CheckRow({ check }: { check: Check }) {
  const variants = {
    ok: {
      icon: CheckCircle2,
      iconClass: 'text-emerald-400 light:text-emerald-700',
      bgClass: 'bg-emerald-500/8 border-emerald-500/25',
    },
    warn: {
      icon: AlertTriangle,
      iconClass: 'text-amber-400 light:text-amber-700',
      bgClass: 'bg-amber-500/8 border-amber-500/25',
    },
    error: {
      icon: AlertCircle,
      iconClass: 'text-rose-400 light:text-rose-700',
      bgClass: 'bg-rose-500/8 border-rose-500/25',
    },
    manual: {
      icon: Activity,
      iconClass: 'text-blue-400 light:text-blue-700',
      bgClass: 'bg-blue-500/8 border-blue-500/25',
    },
  };
  const v = variants[check.status];
  const Icon = v.icon;
  return (
    <div
      className={`rounded-[var(--radius-md)] border p-4 ${v.bgClass}`}
    >
      <div className="flex items-start gap-3">
        <Icon className={`h-5 w-5 flex-shrink-0 mt-0.5 ${v.iconClass}`} />
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm">{check.label}</div>
          <div className="mt-1 text-xs text-[var(--color-text-dim)] break-all">
            {check.detail}
          </div>
          {check.action && (
            <div className="mt-2 text-xs text-[var(--color-text)] bg-[var(--color-surface-tint)] rounded px-2 py-1.5 inline-block">
              <strong>→ Action :</strong> {check.action}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface TgGetMeOk {
  ok: true;
  data: { id: number; first_name: string; username: string };
}
interface TgGetMeErr {
  ok: false;
  error: string;
}

async function fetchBotInfo(): Promise<TgGetMeOk | TgGetMeErr> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return { ok: false, error: 'TELEGRAM_BOT_TOKEN non configuré' };
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`, {
      cache: 'no-store',
    });
    const json = (await res.json()) as {
      ok: boolean;
      result?: { id: number; first_name: string; username: string };
      description?: string;
    };
    if (!json.ok || !json.result) {
      return { ok: false, error: json.description ?? 'Réponse Telegram invalide' };
    }
    return { ok: true, data: json.result };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

interface TgWebhookOk {
  ok: true;
  data: {
    url: string;
    pending_update_count?: number;
    last_error_date?: number;
    last_error_message?: string;
  };
}
interface TgWebhookErr {
  ok: false;
  error: string;
}

/**
 * Test live de la config @BotFather /setdomain.
 *
 * Telegram expose un endpoint embed que le widget appelle :
 *   https://oauth.telegram.org/embed/<bot>?origin=<our-domain>&...
 *
 * Si le domaine est dans la whitelist BotFather → 200 avec page d'auth.
 * Si pas dans la whitelist → 200 mais la page contient un message d'erreur
 * "Bot domain invalid" ou similaire.
 *
 * On parse le HTML pour détecter l'état. C'est best-effort — si Telegram
 * change leur format, on tombe en "manual check".
 */
async function checkWidgetOrigin(
  botUsername: string | undefined,
  appUrl: string | undefined
): Promise<{ status: Check['status']; detail: string; action?: string }> {
  if (!botUsername || !appUrl) {
    return {
      status: 'error',
      detail:
        'Impossible de tester : TELEGRAM_BOT_USERNAME ou NEXT_PUBLIC_APP_URL manquant.',
    };
  }

  const hostname = (() => {
    try {
      return new URL(appUrl).hostname;
    } catch {
      return null;
    }
  })();

  if (!hostname) {
    return {
      status: 'error',
      detail: `NEXT_PUBLIC_APP_URL invalide : "${appUrl}"`,
    };
  }

  try {
    const url = `https://oauth.telegram.org/embed/${encodeURIComponent(
      botUsername
    )}?origin=${encodeURIComponent(appUrl)}&size=large&request_access=write`;
    const res = await fetch(url, {
      cache: 'no-store',
      headers: { 'user-agent': 'Mozilla/5.0 (Boursikotons-Diagnostic)' },
    });

    if (!res.ok) {
      return {
        status: 'warn',
        detail: `Telegram a répondu ${res.status} — impossible de tester l'origin.`,
        action:
          'Vérifie manuellement chez @BotFather avec /setdomain → choisis le bot → ' +
          `colle "${hostname}" (sans https:// ni path).`,
      };
    }

    const body = await res.text();
    // Telegram renvoie un HTML qui contient "Bot domain invalid" si pas
    // dans la whitelist BotFather, sinon le widget se charge normalement
    // avec une iframe d'authentification.
    const lower = body.toLowerCase();
    const invalid =
      lower.includes('bot domain invalid') ||
      lower.includes('domain invalid') ||
      lower.includes('origin mismatch');

    if (invalid) {
      return {
        status: 'error',
        detail: `Telegram REFUSE l'origin "${hostname}". Le /setdomain n'est PAS configuré.`,
        action:
          `IMMÉDIAT : ouvre @BotFather sur Telegram → /setdomain → choisis @${botUsername} → ` +
          `envoie exactement "${hostname}" (sans https:// ni path). Sans ça, le widget desktop ne ` +
          `fonctionnera JAMAIS — les users reçoivent le code par DM mais le retour échoue.`,
      };
    }

    return {
      status: 'ok',
      detail: `Telegram accepte "${hostname}" comme origin (widget chargeable).`,
    };
  } catch (err) {
    return {
      status: 'warn',
      detail: `Erreur réseau au test : ${err instanceof Error ? err.message : String(err)}`,
      action:
        `Test manuel : ouvre dans un onglet privé https://oauth.telegram.org/embed/${botUsername}?origin=${appUrl}&size=large — ` +
        `si tu vois "Bot domain invalid", configure /setdomain chez @BotFather.`,
    };
  }
}

async function fetchWebhookInfo(): Promise<TgWebhookOk | TgWebhookErr> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return { ok: false, error: 'TELEGRAM_BOT_TOKEN non configuré' };
  }
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${token}/getWebhookInfo`,
      { cache: 'no-store' }
    );
    const json = (await res.json()) as {
      ok: boolean;
      result?: {
        url: string;
        pending_update_count?: number;
        last_error_date?: number;
        last_error_message?: string;
      };
      description?: string;
    };
    if (!json.ok || !json.result) {
      return { ok: false, error: json.description ?? 'Réponse Telegram invalide' };
    }
    return { ok: true, data: json.result };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
