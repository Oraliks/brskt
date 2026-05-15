import Link from 'next/link';
import { desc } from 'drizzle-orm';
import {
  Activity,
  ArrowUpRight,
  Bot,
  ExternalLink,
  HelpCircle,
  Settings as SettingsIcon,
  Sun,
  Wrench,
} from 'lucide-react';
import { db } from '@/lib/db';
import { webhookEvents } from '@/lib/db/schema';
import {
  AdminContainer,
  AdminPageHeader,
} from '@/components/admin/page-header';
import { SectionCard } from '@/components/admin/section-card';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BotFeaturesForm } from '@/components/admin/bot-features-form';
import { BotSidebar } from '@/components/admin/bot-sidebar';
import { DailyBriefingForm } from '@/components/admin/daily-briefing-form';
import { getBotFeatures } from '@/lib/settings/bot-features';
import { getDailyBriefing } from '@/lib/settings/daily-briefing';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

/**
 * Page d'administration du Bot Telegram.
 *  - 3 KPI cards (features actives + barre, briefing, webhook)
 *  - Tab Features (default) : layout split — toggles à gauche, sidebar à droite
 *  - Tab Briefing : éditeur complet du template
 *  - Tab Outils : commandes CLI pour exploitation
 *
 * Note : le tab actif vient de ?tab=… (server-side, pas de state client) pour
 * permettre des deep-links propres (ex: bouton "Éditer le template" qui mène
 * directement à `/admin/bot?tab=briefing`).
 */

type Tab = 'features' | 'briefing' | 'tools';

function parseTab(raw: string | undefined): Tab {
  if (raw === 'briefing' || raw === 'tools') return raw;
  return 'features';
}

function formatAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `il y a ${seconds} sec`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  return `il y a ${days}j`;
}

export default async function AdminBotPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const params = await searchParams;
  const activeTab = parseTab(params.tab);

  const [features, briefing, lastTelegramEvent] = await Promise.all([
    getBotFeatures(),
    getDailyBriefing(),
    // On essaie de récupérer un éventuel dernier event webhook Telegram
    // depuis la table webhook_events (utilisée pour idempotence). Si la
    // table ne track pas les events Telegram (probable selon le pattern
    // payments-only), on ignore.
    db.query.webhookEvents
      .findFirst({
        orderBy: [desc(webhookEvents.createdAt)],
      })
      .catch(() => null),
  ]);

  const enabledCount = Object.values(features).filter(Boolean).length;
  const totalCount = Object.keys(features).length;
  const enabledPct = totalCount > 0 ? (enabledCount / totalCount) * 100 : 0;

  const webhookConfigured = Boolean(process.env.TELEGRAM_WEBHOOK_SECRET);
  const webhookEndpoint = '/api/webhooks/telegram';
  const lastWebhookEventAgo = lastTelegramEvent
    ? formatAgo(lastTelegramEvent.createdAt)
    : null;

  return (
    <AdminContainer>
      <AdminPageHeader
        title="Bot Telegram"
        description="Active/désactive les features. Les changements sont immédiats — pas de redéploiement."
        actions={
          <Badge
            variant={enabledCount === totalCount ? 'success' : 'secondary'}
            className="text-xs"
          >
            <span
              className={cn(
                'inline-block h-1.5 w-1.5 rounded-full mr-1.5',
                enabledCount === totalCount
                  ? 'bg-emerald-400'
                  : 'bg-amber-400'
              )}
            />
            {enabledCount} / {totalCount} actives
          </Badge>
        }
      />

      {/* 3 KPI cards améliorés */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
        <KpiCard
          icon={<Bot className="h-4 w-4" />}
          iconTone="info"
          label="Features actives"
          value={`${enabledCount} / ${totalCount}`}
          hint={`${enabledPct.toFixed(1)}% des features activées`}
          progressPct={enabledPct}
        />
        <KpiCard
          icon={<Sun className="h-4 w-4" />}
          iconTone={briefing.enabled ? 'success' : 'default'}
          label="Briefing matinal"
          value={
            <span
              className={
                briefing.enabled
                  ? 'text-emerald-300 light:text-emerald-700'
                  : 'text-[var(--color-text-dim)]'
              }
            >
              {briefing.enabled ? 'Actif' : 'Off'}
            </span>
          }
          hint="CRON · 7h UTC"
        />
        <KpiCard
          icon={<Activity className="h-4 w-4" />}
          iconTone={webhookConfigured ? 'info' : 'danger'}
          label="Webhook"
          value={
            <span
              className={
                webhookConfigured
                  ? 'text-sky-300 light:text-sky-700'
                  : 'text-rose-300 light:text-rose-700'
              }
            >
              {webhookConfigured ? 'Connecté' : 'Non configuré'}
            </span>
          }
          hint="Diagnostics live"
          action={
            <Button asChild size="sm" variant="secondary" className="h-7 px-2">
              <Link href="/admin/diagnostics" className="gap-1 text-[11px]">
                Voir
                <ExternalLink className="h-3 w-3" />
              </Link>
            </Button>
          }
        />
      </div>

      <Tabs defaultValue={activeTab}>
        <TabsList className="w-full sm:w-auto flex-wrap">
          <TabsTrigger value="features" className="gap-1.5">
            <SettingsIcon className="h-3.5 w-3.5" />
            Features
          </TabsTrigger>
          <TabsTrigger value="briefing" className="gap-1.5">
            <Sun className="h-3.5 w-3.5" />
            Briefing
          </TabsTrigger>
          <TabsTrigger value="tools" className="gap-1.5">
            <Wrench className="h-3.5 w-3.5" />
            Outils
          </TabsTrigger>
        </TabsList>

        {/* TAB FEATURES — split toggles + sidebar */}
        <TabsContent value="features">
          <div className="grid lg:grid-cols-[1.6fr_1fr] gap-4">
            <div className="glass rounded-[var(--radius-lg)] p-5">
              <div className="mb-4">
                <h2 className="text-base font-semibold">
                  Features disponibles
                </h2>
                <p className="text-xs text-[var(--color-text-dim)] mt-0.5">
                  Activez ou désactivez les fonctionnalités du bot.
                </p>
              </div>
              <BotFeaturesForm initial={features} />
            </div>
            <BotSidebar
              briefing={briefing}
              webhookConfigured={webhookConfigured}
              webhookEndpoint={webhookEndpoint}
              lastWebhookEventAgo={lastWebhookEventAgo}
            />
          </div>
        </TabsContent>

        {/* TAB BRIEFING — éditeur complet template */}
        <TabsContent value="briefing">
          <SectionCard
            title="Briefing matinal"
            description="Template envoyé à 7h UTC. Placeholder {{firstName}} supporté."
            icon={<Sun className="h-4 w-4" />}
          >
            <DailyBriefingForm initial={briefing} />
          </SectionCard>
        </TabsContent>

        {/* TAB OUTILS — commandes CLI */}
        <TabsContent value="tools">
          <SectionCard
            title="Outils opérationnels"
            description="Commandes utiles à connaître pour exploiter le bot."
            icon={<Wrench className="h-4 w-4" />}
          >
            <div className="grid sm:grid-cols-2 gap-3 text-sm">
              <ToolCard
                title="Configurer le webhook"
                command="pnpm telegram:setup"
                description="Re-set le webhook Telegram pointant vers /api/webhooks/telegram. À lancer après tout changement de domaine."
              />
              <ToolCard
                title="Tester le webhook IronFX"
                command="pnpm test:ironfx"
                description="Émet un postback test vers /api/webhooks/ironfx pour vérifier le pipeline en mode 'api'."
              />
              <ToolCard
                title="Promouvoir un admin"
                command="pnpm promote-admin <telegram_id>"
                description="Whitelist un user en admin DB. Alternativement, ajouter son ID dans ADMIN_TELEGRAM_IDS."
              />
              <ToolCard
                title="Lister les users"
                command="pnpm tsx scripts/list-users.ts"
                description="Dump CLI des derniers users pour debug rapide (téléphone, telegram_id, rôle)."
              />
            </div>
            <div className="mt-4 text-xs text-[var(--color-text-faint)]">
              Pour les diagnostics réseau du bot (webhook, /setdomain),
              ouvrir{' '}
              <Link
                href="/admin/diagnostics"
                className="text-[var(--color-accent-hover)] hover:underline inline-flex items-center gap-1"
              >
                /admin/diagnostics <ArrowUpRight className="h-3 w-3" />
              </Link>
              .
            </div>
          </SectionCard>
        </TabsContent>
      </Tabs>

      {/* Footer "Besoin d'aide ?" */}
      <div className="mt-5 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-tint)] p-4 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 light:text-indigo-700">
            <HelpCircle className="h-4 w-4" />
          </span>
          <div>
            <div className="text-sm font-medium">Besoin d&apos;aide ?</div>
            <p className="text-xs text-[var(--color-text-dim)]">
              Consultez la documentation ou contactez le support pour toute
              question liée au bot Telegram.
            </p>
          </div>
        </div>
        <Button asChild variant="secondary" size="sm">
          <Link
            href="https://core.telegram.org/bots/api"
            target="_blank"
            rel="noopener noreferrer"
            className="gap-1.5"
          >
            Voir la documentation
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>
    </AdminContainer>
  );
}

// ============================================================
// KPI CARD (variante avec barre de progression optionnelle)
// ============================================================

function KpiCard({
  icon,
  iconTone = 'default',
  label,
  value,
  hint,
  progressPct,
  action,
}: {
  icon: React.ReactNode;
  iconTone?: 'default' | 'info' | 'success' | 'warning' | 'danger';
  label: string;
  value: React.ReactNode;
  hint?: string;
  progressPct?: number;
  action?: React.ReactNode;
}) {
  const TONE_BG: Record<NonNullable<typeof iconTone>, string> = {
    default:
      'bg-[var(--color-surface-tint-strong)] border-[var(--color-border)] text-[var(--color-text-dim)]',
    info: 'bg-indigo-500/15 border-indigo-500/30 text-indigo-300 light:text-indigo-700',
    success:
      'bg-emerald-500/15 border-emerald-500/30 text-emerald-300 light:text-emerald-700',
    warning:
      'bg-amber-400/15 border-amber-400/30 text-amber-300 light:text-amber-700',
    danger: 'bg-rose-500/15 border-rose-500/30 text-rose-300 light:text-rose-700',
  };

  return (
    <div className="glass rounded-[var(--radius-lg)] p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span
            className={cn(
              'inline-flex h-9 w-9 items-center justify-center rounded-md border flex-shrink-0',
              TONE_BG[iconTone]
            )}
          >
            {icon}
          </span>
          <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-dim)]">
            {label}
          </span>
        </div>
        {action}
      </div>
      <div className="mt-3 text-2xl md:text-3xl font-semibold tabular-nums">
        {value}
      </div>
      {hint && (
        <div className="mt-1 text-xs text-[var(--color-text-dim)]">{hint}</div>
      )}
      {typeof progressPct === 'number' && (
        <div className="mt-2 h-1.5 w-full rounded-full bg-[var(--color-surface-tint)] overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-pink-500 transition-all"
            style={{ width: `${Math.max(progressPct, 2)}%` }}
          />
        </div>
      )}
    </div>
  );
}

function ToolCard({
  title,
  command,
  description,
}: {
  title: string;
  command: string;
  description: string;
}) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-tint)] p-3">
      <div className="text-sm font-medium">{title}</div>
      <code className="block mt-1.5 text-[11px] font-mono bg-black/30 light:bg-black/5 px-2 py-1 rounded text-[var(--color-text)]">
        {command}
      </code>
      <p className="mt-2 text-xs text-[var(--color-text-dim)] leading-relaxed">
        {description}
      </p>
    </div>
  );
}
