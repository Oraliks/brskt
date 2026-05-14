import {
  AdminContainer,
  AdminPageHeader,
} from '@/components/admin/page-header';
import { BotFeaturesForm } from '@/components/admin/bot-features-form';
import { getBotFeatures } from '@/lib/settings/bot-features';
import { getDailyBriefing } from '@/lib/settings/daily-briefing';

export const dynamic = 'force-dynamic';

/**
 * Page admin pour gérer le bot : activer/désactiver chaque feature.
 *
 * Quand une feature est désactivée :
 *  - Les CRONs associés ne tournent pas
 *  - Les commandes bot répondent "désactivé temporairement"
 *  - L'inline mode (si toggle off) ne répond plus
 *
 * Pas de redémarrage nécessaire — les checks sont à chaque appel,
 * donc l'effet est immédiat après save.
 */
export default async function AdminBotPage() {
  const [features, briefing] = await Promise.all([
    getBotFeatures(),
    getDailyBriefing(),
  ]);

  return (
    <AdminContainer>
      <AdminPageHeader
        title="Bot Telegram"
        description="Active ou désactive les features du bot. Les changements sont immédiats — pas de redéploiement."
      />

      <div className="max-w-3xl">
        <BotFeaturesForm initial={features} briefingEnabled={briefing.enabled} />
      </div>
    </AdminContainer>
  );
}
