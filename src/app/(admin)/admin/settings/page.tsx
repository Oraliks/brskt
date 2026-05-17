import { Coins, Database, Gift, KeyRound, Palette, Sun, Users } from 'lucide-react';
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
import { IronFxModeForm } from '@/components/admin/ironfx-mode-form';
import { WelcomeBonusForm } from '@/components/admin/welcome-bonus-form';
import { DailyBriefingForm } from '@/components/admin/daily-briefing-form';
import { CommunityCountForm } from '@/components/admin/community-count-form';
import { VipPaidAccessConfigForm } from '@/components/admin/vip-paid-access-config-form';
import { ThemeModeForm } from '@/components/admin/theme-mode-form';
import { getIronFXMode } from '@/lib/ironfx';
import { getWelcomeBonus } from '@/lib/settings/welcome-bonus';
import { getDailyBriefing } from '@/lib/settings/daily-briefing';
import { getCommunityCountOverride } from '@/lib/settings/community-count';
import { getVipPaidAccessConfig } from '@/lib/settings/vip-paid-access';
import { getThemeMode } from '@/lib/settings/theme-mode';

export const dynamic = 'force-dynamic';

export default async function AdminSettingsPage() {
  const [mode, welcomeBonus, briefing, communityCount, vipPaidConfig, themeMode] =
    await Promise.all([
      getIronFXMode(),
      getWelcomeBonus(),
      getDailyBriefing(),
      getCommunityCountOverride(),
      getVipPaidAccessConfig(),
      getThemeMode(),
    ]);

  return (
    <AdminContainer>
      <AdminPageHeader
        title="Paramètres"
        description="Configuration de la plateforme. Les modifications sont immédiates — pas de redéploiement."
      />

      <Tabs defaultValue="ironfx">
        <TabsList className="w-full sm:w-auto flex-wrap">
          <TabsTrigger value="ironfx" className="gap-1.5">
            <Database className="h-3.5 w-3.5" />
            IronFX
          </TabsTrigger>
          <TabsTrigger value="bonus" className="gap-1.5">
            <Gift className="h-3.5 w-3.5" />
            Welcome bonus
          </TabsTrigger>
          <TabsTrigger value="briefing" className="gap-1.5">
            <Sun className="h-3.5 w-3.5" />
            Daily briefing
          </TabsTrigger>
          <TabsTrigger value="community" className="gap-1.5">
            <Users className="h-3.5 w-3.5" />
            Communauté
          </TabsTrigger>
          <TabsTrigger value="vip-paid" className="gap-1.5">
            <Coins className="h-3.5 w-3.5" />
            VIP payant
          </TabsTrigger>
          <TabsTrigger value="theme" className="gap-1.5">
            <Palette className="h-3.5 w-3.5" />
            Thème
          </TabsTrigger>
          <TabsTrigger value="env" className="gap-1.5">
            <KeyRound className="h-3.5 w-3.5" />
            Environnement
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ironfx">
          <SectionCard
            title="Mode IronFX"
            description="Contrôle comment Boursikotons récupère le statut des comptes broker."
            icon={<Database className="h-4 w-4" />}
          >
            <IronFxModeForm currentMode={mode} />
          </SectionCard>
        </TabsContent>

        <TabsContent value="bonus">
          <SectionCard
            title="Welcome bonus IronFX"
            description="Bandeau affiché sur /vip et la landing quand activé."
            icon={<Gift className="h-4 w-4" />}
          >
            <WelcomeBonusForm initial={welcomeBonus} />
          </SectionCard>
        </TabsContent>

        <TabsContent value="briefing">
          <SectionCard
            title="Briefing matinal Telegram"
            description="Push CRON quotidien à 7h UTC aux opt-in. Supporte {{firstName}}."
            icon={<Sun className="h-4 w-4" />}
          >
            <DailyBriefingForm initial={briefing} />
          </SectionCard>
        </TabsContent>

        <TabsContent value="community">
          <SectionCard
            title="Compteur de membres du canal"
            description="Affiché sur le dashboard user et /admin. Si Telegram ne permet pas d'ajouter le bot au canal, override manuellement la valeur ici."
            icon={<Users className="h-4 w-4" />}
          >
            <CommunityCountForm initial={communityCount} />
          </SectionCard>
        </TabsContent>

        <TabsContent value="vip-paid">
          <SectionCard
            title="Accès VIP direct payant"
            description="Active ou désactive l'option d'accès direct payant sur /vip (alternative au funnel affilié). Configure le prix."
            icon={<Coins className="h-4 w-4" />}
          >
            <VipPaidAccessConfigForm initial={vipPaidConfig} />
          </SectionCard>
        </TabsContent>

        <TabsContent value="theme">
          <SectionCard
            title="Mode d'affichage du thème"
            description="Choisis si les users peuvent toggler light/dark, ou si tu forces un seul thème pour toute la plateforme."
            icon={<Palette className="h-4 w-4" />}
          >
            <ThemeModeForm initial={themeMode} />
          </SectionCard>
        </TabsContent>

        <TabsContent value="env">
          <SectionCard
            title="Variables d'environnement"
            description="Configurées via Vercel ou .env.local — lecture seule depuis ici."
            icon={<KeyRound className="h-4 w-4" />}
          >
            <div className="grid sm:grid-cols-2 gap-2">
              <EnvStatus name="TELEGRAM_BOT_TOKEN" />
              <EnvStatus name="TELEGRAM_BOT_USERNAME" />
              <EnvStatus name="VIP_GROUP_CHAT_ID" />
              <EnvStatus name="PADDLE_API_KEY" />
              <EnvStatus name="PAYPAL_CLIENT_ID" />
              <EnvStatus name="NOWPAYMENTS_API_KEY" />
              <EnvStatus name="IRONFX_API_KEY" optional />
              <EnvStatus name="RESEND_API_KEY" />
              <EnvStatus name="CRON_SECRET" />
              <EnvStatus name="MAGIC_LINK_SECRET" />
              <EnvStatus name="ADMIN_TELEGRAM_IDS" />
              <EnvStatus name="NEXT_PUBLIC_POSTHOG_KEY" optional />
              <EnvStatus name="SENTRY_DSN" optional />
            </div>
          </SectionCard>
        </TabsContent>
      </Tabs>
    </AdminContainer>
  );
}

function EnvStatus({
  name,
  optional,
}: {
  name: string;
  optional?: boolean;
}) {
  const set = Boolean(process.env[name]);
  return (
    <div className="flex items-center justify-between rounded-md bg-white/[0.02] border border-[var(--color-border)] px-3 py-1.5 text-xs">
      <code className="font-mono">{name}</code>
      <span
        className={
          set
            ? 'text-emerald-300 light:text-emerald-700'
            : optional
            ? 'text-[var(--color-text-faint)]'
            : 'text-rose-300 light:text-rose-700'
        }
      >
        {set ? '✓ set' : optional ? '— absent' : '✗ manquant'}
      </span>
    </div>
  );
}
