import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { ThemeScript } from '@/components/theme/theme-script';
import { PostHogProvider } from '@/components/analytics/posthog-provider';

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

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        {/* DOIT être le premier child du <head> : applique data-theme avant
            le premier paint pour éviter le flash dark→light */}
        <ThemeScript />
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
        <PostHogProvider>
          {children}
          <Toaster />
        </PostHogProvider>
      </body>
    </html>
  );
}
