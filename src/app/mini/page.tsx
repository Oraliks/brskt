import { MiniAppAuth } from '@/components/mini/mini-app-auth';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Boursikotons',
  robots: { index: false, follow: false },
};

/**
 * Page d'entrée du Mini App Telegram.
 *
 * Configuration côté @BotFather :
 *   1. /mybots → choisir le bot
 *   2. Bot Settings → Menu Button → Configure menu button
 *   3. URL : https://brskt.vercel.app/mini
 *   4. Texte : "Ouvrir l'app"
 *
 * Le SDK Telegram WebApp est chargé au niveau racine (app/layout.tsx) →
 * disponible partout, pas seulement ici. Le routing `start_param` est
 * géré par `MiniAppAuth` (cf. `routeForStartParam`).
 */
export default function MiniAppPage() {
  return <MiniAppAuth />;
}
