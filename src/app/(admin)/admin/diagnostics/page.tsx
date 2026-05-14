import {
  Activity,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
} from 'lucide-react';
import {
  AdminContainer,
  AdminPageHeader,
} from '@/components/admin/page-header';
import { SectionCard } from '@/components/admin/section-card';
import { StatCard, StatCardGrid } from '@/components/admin/stat-card';
import { Badge } from '@/components/ui/badge';

export const dynamic = 'force-dynamic';

/**
 * Diagnostics admin : vérifie la config Telegram bot + autres env vars
 * essentiels. Utile quand un user signale un problème de login.
 */
export default async function AdminDiagnosticsPage() {
  const botInfo = await fetchBotInfo();
  const webhookInfo = await fetchWebhookInfo();

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const botUsername = process.env.TELEGRAM_BOT_USERNAME;
  const expectedUsername =
    botInfo.ok && 'username' in botInfo.data ? botInfo.data.username : null;

  const widgetOrigin = await checkWidgetOrigin(botUsername, appUrl);

  const checks: Check[] = [
    {
      label: 'TELEGRAM_BOT_TOKEN valide',
      status: botInfo.ok ? 'ok' : 'error',
      detail: botInfo.ok
        ? `${botInfo.data.first_name} (@${botInfo.data.username}) · ID ${botInfo.data.id}`
        : botInfo.error,
      action: !botInfo.ok
        ? 'Vérifier TELEGRAM_BOT_TOKEN dans Vercel. Régénérer via @BotFather (/token) si compromis.'
        : undefined,
    },
    {
      label: 'TELEGRAM_BOT_USERNAME correspond',
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
        ? `Config : @${botUsername} · Telegram : @${expectedUsername}`
        : 'Telegram API inaccessible.',
      action:
        botUsername &&
        expectedUsername &&
        botUsername.toLowerCase() !== expectedUsername.toLowerCase()
          ? `Mismatch : aligner sur @${expectedUsername} dans Vercel.`
          : undefined,
    },
    {
      label: 'NEXT_PUBLIC_APP_URL en HTTPS',
      status: !appUrl ? 'error' : appUrl.startsWith('https://') ? 'ok' : 'warn',
      detail: appUrl ?? 'manquant',
      action: appUrl?.startsWith('http://')
        ? 'Telegram widget refuse HTTP en prod. Forcer HTTPS.'
        : undefined,
    },
    {
      label: 'BotFather /setdomain',
      status: widgetOrigin.status,
      detail: widgetOrigin.detail,
      action: widgetOrigin.action,
    },
    {
      label: 'Webhook Telegram configuré',
      status: webhookInfo.ok && webhookInfo.data.url ? 'ok' : 'warn',
      detail: webhookInfo.ok
        ? webhookInfo.data.url
          ? `${webhookInfo.data.url}${
              webhookInfo.data.pending_update_count
                ? ` · ${webhookInfo.data.pending_update_count} en attente`
                : ''
            }${
              webhookInfo.data.last_error_message
                ? ` · ⚠ ${webhookInfo.data.last_error_message}`
                : ''
            }`
          : 'Aucun webhook set.'
        : webhookInfo.error,
      action:
        webhookInfo.ok && !webhookInfo.data.url
          ? 'Lancer `pnpm telegram:setup` pour configurer le webhook.'
          : undefined,
    },
    {
      label: 'Magic-link secret',
      status:
        process.env.MAGIC_LINK_SECRET?.trim() ||
        process.env.BETTER_AUTH_SECRET?.trim()
          ? 'ok'
          : 'error',
      detail: process.env.MAGIC_LINK_SECRET?.trim()
        ? 'MAGIC_LINK_SECRET set'
        : process.env.BETTER_AUTH_SECRET?.trim()
        ? 'BETTER_AUTH_SECRET (fallback)'
        : 'Aucun secret — /login bot HS.',
      action:
        !process.env.MAGIC_LINK_SECRET?.trim() &&
        !process.env.BETTER_AUTH_SECRET?.trim()
          ? 'Ajouter MAGIC_LINK_SECRET (32+ chars) dans Vercel → Environment Variables.'
          : undefined,
    },
    {
      label: 'ADMIN_TELEGRAM_IDS',
      status: process.env.ADMIN_TELEGRAM_IDS?.trim() ? 'ok' : 'error',
      detail: process.env.ADMIN_TELEGRAM_IDS
        ? `${process.env.ADMIN_TELEGRAM_IDS.split(',').length} ID(s) déclarés`
        : 'Manquant — aucun admin ne pourra accéder à /admin.',
    },
  ];

  const counts = {
    ok: checks.filter((c) => c.status === 'ok').length,
    warn: checks.filter((c) => c.status === 'warn').length,
    error: checks.filter((c) => c.status === 'error').length,
  };

  return (
    <AdminContainer>
      <AdminPageHeader
        title="Diagnostics"
        description="Vérification live de la configuration Telegram et auth."
        actions={
          <Badge variant="secondary">
            <Activity className="h-3 w-3 mr-1" />
            Live
          </Badge>
        }
      />

      <StatCardGrid cols={3} className="mb-5">
        <StatCard
          label="OK"
          value={counts.ok}
          tone="success"
          icon={<CheckCircle2 className="h-4 w-4 text-emerald-400" />}
        />
        <StatCard
          label="Avertissements"
          value={counts.warn}
          tone={counts.warn > 0 ? 'warning' : 'default'}
          icon={<AlertTriangle className="h-4 w-4 text-amber-400" />}
        />
        <StatCard
          label="Erreurs"
          value={counts.error}
          tone={counts.error > 0 ? 'danger' : 'default'}
          icon={<AlertCircle className="h-4 w-4 text-rose-400" />}
        />
      </StatCardGrid>

      <SectionCard
        title="Checks"
        description="Cliquer sur une ligne en erreur pour voir l'action à effectuer."
        icon={<Activity className="h-4 w-4" />}
        bodyClassName="p-0"
      >
        <div className="divide-y divide-[var(--color-border)]">
          {checks.map((c) => (
            <CheckRow key={c.label} check={c} />
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="Si un user n'arrive pas à se connecter"
        icon={<HelpCircle className="h-4 w-4" />}
        className="mt-4"
      >
        <ol className="list-decimal list-inside space-y-1.5 text-sm text-[var(--color-text-dim)]">
          <li>
            Vérifier que tous les checks sont au vert (surtout{' '}
            <code>/setdomain</code> chez @BotFather).
          </li>
          <li>
            Demander d&apos;envoyer <code>/start</code> au bot, puis revenir sur
            la page de login.
          </li>
          <li>
            En dernier recours : <code>/login</code> dans le bot DM — magic-link
            valable 10 min.
          </li>
          <li>
            Sur desktop : vérifier que la popup Telegram n&apos;est pas bloquée.
          </li>
        </ol>
      </SectionCard>
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
      dotBg: 'bg-emerald-500/15',
    },
    warn: {
      icon: AlertTriangle,
      iconClass: 'text-amber-400 light:text-amber-700',
      dotBg: 'bg-amber-500/15',
    },
    error: {
      icon: AlertCircle,
      iconClass: 'text-rose-400 light:text-rose-700',
      dotBg: 'bg-rose-500/15',
    },
    manual: {
      icon: Activity,
      iconClass: 'text-sky-400 light:text-sky-700',
      dotBg: 'bg-sky-500/15',
    },
  };
  const v = variants[check.status];
  const Icon = v.icon;
  return (
    <div className="flex items-start gap-3 px-4 py-3 hover:bg-white/[0.02]">
      <span
        className={`inline-flex h-7 w-7 items-center justify-center rounded-full flex-shrink-0 ${v.dotBg}`}
      >
        <Icon className={`h-3.5 w-3.5 ${v.iconClass}`} />
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium">{check.label}</div>
        <div className="mt-0.5 text-xs text-[var(--color-text-dim)] break-words">
          {check.detail}
        </div>
        {check.action && (
          <div className="mt-1.5 text-xs text-[var(--color-text)] bg-[var(--color-surface-tint)] rounded-md px-2.5 py-1.5 border border-[var(--color-border)]">
            <strong className="text-amber-300 light:text-amber-700">→</strong>{' '}
            {check.action}
          </div>
        )}
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

async function checkWidgetOrigin(
  botUsername: string | undefined,
  appUrl: string | undefined
): Promise<{ status: Check['status']; detail: string; action?: string }> {
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
    return { status: 'error', detail: `NEXT_PUBLIC_APP_URL invalide : "${appUrl}"` };
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
      };
    }

    return {
      status: 'ok',
      detail: `Telegram accepte "${hostname}" comme origin.`,
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
