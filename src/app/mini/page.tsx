import Script from 'next/script';
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
 * Une fois fait, les users voient un bouton "Ouvrir l'app" en bas de la
 * conversation avec le bot. Click → ouvre cette page dans un webview
 * Telegram in-app avec `initData` signé.
 *
 * Le composant client `MiniAppAuth` lit `Telegram.WebApp.initData` et
 * appelle `/api/auth/telegram-webapp` pour échanger contre un cookie de
 * session, puis redirige vers /dashboard (ou /onboarding si pas complet).
 */
export default function MiniAppPage() {
  return (
    <>
      {/* Script officiel Telegram WebApp — expose window.Telegram.WebApp.
          beforeInteractive pour qu'il soit dispo avant l'hydration React. */}
      <Script
        src="https://telegram.org/js/telegram-web-app.js"
        strategy="beforeInteractive"
      />
      <MiniAppAuth />
    </>
  );
}
