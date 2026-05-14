import Link from 'next/link';
import {
  Activity,
  ArrowUpRight,
  Bot,
  Settings as SettingsIcon,
  Sun,
  Wrench,
} from 'lucide-react';
import {
  AdminContainer,
  AdminPageHeader,
} from '@/components/admin/page-header';
import { SectionCard } from '@/components/admin/section-card';
import { StatCard, StatCardGrid } from '@/components/admin/stat-card';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { BotFeaturesForm } from '@/components/admin/bot-features-form';
import { DailyBriefingForm } from '@/components/admin/daily-briefing-form';
import { getBotFeatures } from '@/lib/settings/bot-features';
import { getDailyBriefing } from '@/lib/settings/daily-briefing';

export const dynamic = 'force-dynamic';

export default async function AdminBotPage() {
  const [features, briefing] = await Promise.all([
    getBotFeatures(),
    getDailyBriefing(),
  ]);

  const enabledCount = Object.values(features).filter(Boolean).length;
  const totalCount = Object.keys(features).length;

  return (
    <AdminContainer>
      <AdminPageHeader
        title="Bot Telegram"
        description="Active/désactive les features. Les changements sont immédiats — pas de redéploiement."
        actions={
          <Badge variant={enabledCount === totalCount ? 'success' : 'secondary'}>
            <Bot className="h-3 w-3 mr-1" />
            {enabledCount} / {totalCount} actives
          </Badge>
        }
      />

      <StatCardGrid cols={3} className="mb-5">
        <StatCard
          label="Features actives"
          value={`${enabledCount}/${totalCount}`}
          tone="info"
          icon={<Bot className="h-4 w-4" />}
        />
        <StatCard
          label="Briefing matinal"
          value={briefing.enabled ? 'Actif' : 'Off'}
          hint="CRON 7h UTC"
          tone={briefing.enabled ? 'success' : 'default'}
          icon={<Sun className="h-4 w-4" />}
        />
        <StatCard
          label="Webhook"
          value={<Link href="/admin/diagnostics" className="hover:underline inline-flex items-center gap-1 text-sm">Voir <ArrowUpRight className="h-3 w-3" /></Link>}
          hint="Diagnostics live"
          icon={<Activity className="h-4 w-4" />}
        />
      </StatCardGrid>

      <Tabs defaultValue="features">
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

        <TabsContent value="features">
          <SectionCard
            title="Toggles features"
            description="Désactiver une feature coupe ses commandes ET son CRON associé."
            icon={<SettingsIcon className="h-4 w-4" />}
          >
            <BotFeaturesForm initial={features} briefingEnabled={briefing.enabled} />
          </SectionCard>
        </TabsContent>

        <TabsContent value="briefing">
          <SectionCard
            title="Briefing matinal"
            description="Template envoyé à 7h UTC. Placeholder {{firstName}} supporté."
            icon={<Sun className="h-4 w-4" />}
          >
            <DailyBriefingForm initial={briefing} />
          </SectionCard>
        </TabsContent>

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
    </AdminContainer>
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
