import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { ThemeScript } from '@/components/theme/theme-script';
import { PostHogProvider } from '@/components/analytics/posthog-provider';
import { TelegramProvider } from '@/components/mini/telegram-webapp';
import { getThemeMode } from '@/lib/settings/theme-mode';

export const metadata: Metadata = {
  title: {
    default: 'Boursikotons — Trading professionnel',
    template: '%s — Boursikotons',
  },
  description:
    'Formation trading pro à Dubaï et à distance. Accès groupe VIP Telegram via partenariat broker.',
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  ),
  applicationName: 'Boursikotons',
  authors: [{ name: 'Boursikotons' }],
  keywords: [
    'trading',
    'formation trading',
    'forex',
    'crypto',
    'groupe VIP',
    'Dubaï',
    'IronFX',
  ],
  openGraph: {
    title: 'Boursikotons — Formation trading & VIP Telegram',
    description:
      'Formation trading pro à Dubaï et à distance. Accès groupe VIP Telegram via partenariat broker.',
    type: 'website',
    locale: 'fr_FR',
    siteName: 'Boursikotons',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Boursikotons',
    description: 'Formation trading pro · Groupe VIP Telegram',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export const viewport: Viewport = {
  themeColor: '#0a0a0f',
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Mode thème admin (both / light_only / dark_only) lu en SSR pour
  // pouvoir l'injecter dans ThemeScript avant first paint.
  const themeMode = await getThemeMode();

  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        {/* DOIT être le premier child du <head> : applique data-theme avant
            le premier paint pour éviter le flash dark→light */}
        <ThemeScript mode={themeMode} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {/* SDK Telegram WebApp — chargé au niveau racine pour que la
            détection Mini App fonctionne partout (pas juste sur /mini),
            ce qui permet le routing par start_param après auth. No-op
            sur navigateur classique (window.Telegram simplement undefined). */}
        <Script
          src="https://telegram.org/js/telegram-web-app.js"
          strategy="beforeInteractive"
        />
        {/* Skip link a11y : permet aux users clavier de sauter la nav et
            aller direct au contenu. Visible uniquement au focus clavier. */}
        <a href="#main-content" className="skip-to-content">
          Aller au contenu principal
        </a>
        <PostHogProvider>
          <TelegramProvider>
            {children}
            <Toaster />
          </TelegramProvider>
        </PostHogProvider>
      </body>
    </html>
  );
}
