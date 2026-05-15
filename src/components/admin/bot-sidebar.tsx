import Link from 'next/link';
import {
  Activity,
  ArrowUpRight,
  Edit3,
  MessageSquare,
  RefreshCw,
  Send,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { DailyBriefing } from '@/lib/settings/daily-briefing';

interface Props {
  briefing: DailyBriefing;
  webhookConfigured: boolean;
  webhookEndpoint: string;
  lastWebhookEventAgo: string | null;
}

/**
 * Sidebar de la page Bot : résumé du briefing + info webhook + actions rapides.
 * Server Component pur — pas d'état client, juste du rendu.
 */
export function BotSidebar({
  briefing,
  webhookConfigured,
  webhookEndpoint,
  lastWebhookEventAgo,
}: Props) {
  return (
    <div className="space-y-4">
      <BriefingPanel briefing={briefing} />
      <WebhookPanel
        configured={webhookConfigured}
        endpoint={webhookEndpoint}
        lastEventAgo={lastWebhookEventAgo}
      />
      <ActionsPanel />
    </div>
  );
}

function BriefingPanel({ briefing }: { briefing: DailyBriefing }) {
  return (
    <div className="glass rounded-[var(--radius-lg)] p-5">
      <div className="mb-3">
        <h3 className="text-sm font-semibold">Briefing matinal</h3>
        <p className="text-xs text-[var(--color-text-dim)] mt-0.5">
          Template envoyé chaque jour à 7h UTC.
        </p>
      </div>

      <div className="rounded-[var(--radius-md)] bg-[var(--color-surface-tint)] border border-[var(--color-border)] p-3 flex items-start gap-3 mb-3">
        <span
          className={cn(
            'inline-flex h-9 w-9 items-center justify-center rounded-md flex-shrink-0 border',
            briefing.enabled
              ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300 light:text-emerald-700'
              : 'bg-[var(--color-surface-tint-strong)] border-[var(--color-border)] text-[var(--color-text-faint)]'
          )}
        >
          <MessageSquare className="h-4 w-4" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium">
            {briefing.enabled ? 'Briefing activé' : 'Briefing désactivé'}
          </div>
          <div className="text-[10px] text-[var(--color-text-dim)] mt-0.5">
            Push CRON à 7h UTC aux opt-in.
          </div>
        </div>
        <Badge
          variant={briefing.enabled ? 'success' : 'secondary'}
          className="text-[10px]"
        >
          {briefing.enabled ? 'ON' : 'OFF'}
        </Badge>
      </div>

      {/* Preview template — premières 6 lignes max */}
      <div>
        <div className="flex items-baseline justify-between mb-1.5">
          <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-dim)]">
            Template HTML
          </span>
          <span className="text-[10px] text-[var(--color-text-faint)] tabular-nums">
            {briefing.template.length} / 4000
          </span>
        </div>
        <pre className="bg-[var(--color-surface-tint)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-3 text-[10px] font-mono leading-relaxed overflow-hidden text-[var(--color-text-dim)] max-h-32">
          {briefing.template.split('\n').slice(0, 6).join('\n')}
          {briefing.template.split('\n').length > 6 ? '\n…' : ''}
        </pre>
      </div>

      <Button variant="secondary" size="sm" asChild className="mt-3 gap-1.5">
        <Link href="/admin/bot?tab=briefing">
          <Edit3 className="h-3.5 w-3.5" />
          Éditer le template
        </Link>
      </Button>
    </div>
  );
}

function WebhookPanel({
  configured,
  endpoint,
  lastEventAgo,
}: {
  configured: boolean;
  endpoint: string;
  lastEventAgo: string | null;
}) {
  return (
    <div className="glass rounded-[var(--radius-lg)] p-5">
      <h3 className="text-sm font-semibold mb-3">Webhooks &amp; intégrations</h3>

      <dl className="space-y-2 text-xs">
        <Row label="Statut actuel">
          <Badge variant={configured ? 'success' : 'danger'} className="text-[10px]">
            {configured ? 'Connecté' : 'Non configuré'}
          </Badge>
        </Row>
        <Row label="Endpoint Telegram">
          <code className="font-mono text-[10px] text-[var(--color-text-dim)]">
            {endpoint}
          </code>
        </Row>
        {lastEventAgo && (
          <Row label="Dernier événement">
            <span className="text-[var(--color-text-dim)]">
              {lastEventAgo}
            </span>
          </Row>
        )}
        <Row label="Webhook secret">
          <span className="font-mono text-[10px] text-[var(--color-text-dim)]">
            {configured ? '••••••••••••' : '—'}
          </span>
        </Row>
      </dl>

      <Button variant="secondary" size="sm" asChild className="mt-4 gap-1.5">
        <Link href="/admin/diagnostics">
          <Activity className="h-3.5 w-3.5" />
          Voir les diagnostics
          <ArrowUpRight className="h-3 w-3 ml-auto" />
        </Link>
      </Button>
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-[var(--color-text-dim)] flex-shrink-0">{label}</dt>
      <dd className="text-right truncate min-w-0">{children}</dd>
    </div>
  );
}

function ActionsPanel() {
  // 4 cards d'actions : commandes CLI ou raccourcis vers d'autres pages admin.
  // Les commandes CLI sont copiables via clic (TODO si besoin) ; pour l'instant
  // c'est juste de l'affichage informatif + des liens où ça a du sens.
  return (
    <div className="glass rounded-[var(--radius-lg)] p-5">
      <h3 className="text-sm font-semibold mb-3">Actions rapides</h3>
      <div className="grid grid-cols-2 gap-2">
        <ActionCard
          icon={Send}
          title="Tester webhook"
          subtitle="pnpm test:telegram"
        />
        <ActionCard
          icon={Users}
          title="Lister les users"
          subtitle="Dump CLI (téléphone, id, rôle)"
          href="/admin/users"
        />
        <ActionCard
          icon={ShieldCheck}
          title="Promouvoir un admin"
          subtitle="Accorder les droits"
          href="/admin/users"
        />
        <ActionCard
          icon={RefreshCw}
          title="Réinitialiser webhook"
          subtitle="Re-configurer l'endpoint"
        />
      </div>
    </div>
  );
}

function ActionCard({
  icon: Icon,
  title,
  subtitle,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  href?: string;
}) {
  const inner = (
    <>
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-[var(--color-surface-tint-strong)] border border-[var(--color-border)] mb-2">
        <Icon className="h-3.5 w-3.5 text-[var(--color-text-dim)]" />
      </span>
      <div className="text-[11px] font-medium leading-tight">{title}</div>
      <div className="mt-0.5 text-[10px] text-[var(--color-text-faint)] leading-tight">
        {subtitle}
      </div>
    </>
  );
  const className =
    'rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-tint)] p-3 flex flex-col text-left hover:bg-[var(--color-surface-tint-strong)] transition-colors';
  if (href) {
    return (
      <Link href={href} className={className}>
        {inner}
      </Link>
    );
  }
  return <div className={className}>{inner}</div>;
}
