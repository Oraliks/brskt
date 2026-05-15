import {
  AdminContainer,
  AdminPageHeader,
} from '@/components/admin/page-header';
import {
  DiagnosticsView,
  type DiagnosticsCheck,
} from '@/components/admin/diagnostics-view';

export const dynamic = 'force-dynamic';

/**
 * Diagnostics admin : vérifie la config Telegram bot + auth + env essentiels.
 * Utile quand un user signale un problème de login ou que le bot semble HS.
 *
 * Server-side : on fetch l'état des intégrations puis on passe à un composant
 * client qui gère l'auto-refresh (router.refresh() toutes les 30s) et les
 * filtres par catégorie.
 */
export default async function AdminDiagnosticsPage() {
  const [botInfo, webhookInfo] = await Promise.all([
    fetchBotInfo(),
    fetchWebhookInfo(),
  ]);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const botUsername = process.env.TELEGRAM_BOT_USERNAME;
  const expectedUsername =
    botInfo.ok && 'username' in botInfo.data ? botInfo.data.username : null;

  const widgetOrigin = await checkWidgetOrigin(botUsername, appUrl);

  const checks: DiagnosticsCheck[] = [
    {
      id: 'telegram-token',
      label: 'TELEGRAM_BOT_TOKEN valide',
      sublabel: botInfo.ok ? `ID: ${botInfo.data.id}` : undefined,
      category: 'telegram',
      status: botInfo.ok ? 'ok' : 'error',
      detail: botInfo.ok ? 'Token présent et valide' : botInfo.error,
      action: !botInfo.ok
        ? 'Vérifier TELEGRAM_BOT_TOKEN dans Vercel → Environment Variables. Régénérer via @BotFather (/token) si compromis.'
        : undefined,
      copyValue: botInfo.ok ? String(botInfo.data.id) : undefined,
      recheckable: true,
    },
    {
      id: 'telegram-username',
      label: 'TELEGRAM_BOT_USERNAME correspond',
      sublabel:
        botUsername && expectedUsername
          ? `Config: @${botUsername} · Telegram: @${expectedUsername}`
          : undefined,
      category: 'telegram',
      status: !botUsername
        ? 'error'
        : !expectedUsername
        ? 'warn'
        : botUsername.toLowerCase() === expectedUsername.toLowerCase()
        ? 'ok'
        : 'warn',
      detail: !botUsername
        ? 'Variable manquante.'
        : expectedUsername
        ? botUsername.toLowerCase() === expectedUsername.toLowerCase()
          ? 'Username correspond'
          : 'Mismatch entre config et Telegram'
        : 'Telegram API inaccessible.',
      action:
        botUsername &&
        expectedUsername &&
        botUsername.toLowerCase() !== expectedUsername.toLowerCase()
          ? `Mismatch : aligner sur @${expectedUsername} dans Vercel.`
          : undefined,
      copyValue: expectedUsername ?? botUsername ?? undefined,
    },
    {
      id: 'app-url-https',
      label: 'NEXT_PUBLIC_APP_URL en HTTPS',
      sublabel: appUrl ?? undefined,
      category: 'env',
      status: !appUrl ? 'error' : appUrl.startsWith('https://') ? 'ok' : 'warn',
      detail: !appUrl
        ? 'manquant'
        : appUrl.startsWith('https://')
        ? 'HTTPS OK'
        : 'HTTP non sécurisé',
      action: appUrl?.startsWith('http://')
        ? 'Telegram widget refuse HTTP en prod. Forcer HTTPS dans NEXT_PUBLIC_APP_URL.'
        : undefined,
      copyValue: appUrl,
    },
    {
      id: 'setdomain',
      label: 'BotFather /setdomain',
      sublabel: widgetOrigin.hostname
        ? `Telegram accepte "${widgetOrigin.hostname}" comme origin.`
        : undefined,
      category: 'telegram',
      status: widgetOrigin.status,
      detail:
        widgetOrigin.status === 'ok'
          ? 'Domaine configuré'
          : widgetOrigin.detail,
      action: widgetOrigin.action,
      docUrl: 'https://core.telegram.org/widgets/login#setting-up-a-widget',
    },
    {
      id: 'webhook',
      label: 'Webhook Telegram configuré',
      sublabel:
        webhookInfo.ok && webhookInfo.data.url ? webhookInfo.data.url : undefined,
      category: 'webhook',
      status: webhookInfo.ok && webhookInfo.data.url ? 'ok' : 'warn',
      detail: webhookInfo.ok
        ? webhookInfo.data.url
          ? webhookInfo.data.last_error_message
            ? `Webhook actif · ⚠ ${webhookInfo.data.last_error_message}`
            : webhookInfo.data.pending_update_count
            ? `Webhook actif · ${webhookInfo.data.pending_update_count} en attente`
            : 'Webhook actif'
          : 'Aucun webhook set.'
        : webhookInfo.error,
      action:
        webhookInfo.ok && !webhookInfo.data.url
          ? 'Lancer `pnpm telegram:setup` pour configurer le webhook.'
          : undefined,
      recheckable: true,
    },
    {
      id: 'magic-link-secret',
      label: 'Magic-link secret',
      sublabel: process.env.MAGIC_LINK_SECRET?.trim()
        ? 'MAGIC_LINK_SECRET set'
        : process.env.BETTER_AUTH_SECRET?.trim()
        ? 'BETTER_AUTH_SECRET (fallback)'
        : undefined,
      category: 'auth',
      status:
        process.env.MAGIC_LINK_SECRET?.trim() ||
        process.env.BETTER_AUTH_SECRET?.trim()
          ? 'ok'
          : 'error',
      detail:
        process.env.MAGIC_LINK_SECRET?.trim() ||
        process.env.BETTER_AUTH_SECRET?.trim()
          ? 'Secret configuré'
          : 'Aucun secret — /login bot HS.',
      action:
        !process.env.MAGIC_LINK_SECRET?.trim() &&
        !process.env.BETTER_AUTH_SECRET?.trim()
          ? 'Ajouter MAGIC_LINK_SECRET (32+ chars) dans Vercel → Environment Variables.'
          : undefined,
    },
    {
      id: 'admin-ids',
      label: 'ADMIN_TELEGRAM_IDS',
      sublabel: process.env.ADMIN_TELEGRAM_IDS
        ? `${process.env.ADMIN_TELEGRAM_IDS.split(',').length} ID(s) déclarés`
        : undefined,
      category: 'auth',
      status: process.env.ADMIN_TELEGRAM_IDS?.trim() ? 'ok' : 'error',
      detail: process.env.ADMIN_TELEGRAM_IDS
        ? `${process.env.ADMIN_TELEGRAM_IDS.split(',').length} ID(s) configurés`
        : 'Manquant — aucun admin ne pourra accéder à /admin.',
      action: !process.env.ADMIN_TELEGRAM_IDS?.trim()
        ? 'Ajouter ADMIN_TELEGRAM_IDS=123,456 dans Vercel → Environment Variables.'
        : undefined,
      copyValue: process.env.ADMIN_TELEGRAM_IDS ?? undefined,
    },
  ];

  return (
    <AdminContainer>
      <AdminPageHeader
        title="Diagnostics"
        description="Vérification live de la configuration Telegram et auth."
      />

      <DiagnosticsView
        checks={checks}
        fetchedAt={new Date().toISOString()}
      />
    </AdminContainer>
  );
}

// ============================================================
// Fetchers Telegram (server-side, no-store)
// ============================================================

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

async function checkWidgetOrigin(
  botUsername: string | undefined,
  appUrl: string | undefined
): Promise<{
  status: 'ok' | 'warn' | 'error';
  detail: string;
  action?: string;
  hostname?: string;
}> {
  if (!botUsername || !appUrl) {
    return {
      status: 'error',
      detail: 'TELEGRAM_BOT_USERNAME ou NEXT_PUBLIC_APP_URL manquant.',
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
        detail: `Telegram a répondu ${res.status}.`,
        action: `Test manuel : @BotFather /setdomain → @${botUsername} → "${hostname}".`,
        hostname,
      };
    }

    const body = (await res.text()).toLowerCase();
    const invalid =
      body.includes('bot domain invalid') ||
      body.includes('domain invalid') ||
      body.includes('origin mismatch');

    if (invalid) {
      return {
        status: 'error',
        detail: `Telegram REFUSE "${hostname}". Le /setdomain n'est PAS configuré.`,
        action: `@BotFather → /setdomain → @${botUsername} → envoie "${hostname}" (sans https:// ni path).`,
        hostname,
      };
    }

    return {
      status: 'ok',
      detail: `Telegram accepte "${hostname}" comme origin.`,
      hostname,
    };
  } catch (err) {
    return {
      status: 'warn',
      detail: `Erreur réseau : ${err instanceof Error ? err.message : String(err)}`,
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
