import type { MetadataRoute } from 'next';

/**
 * Manifest PWA — permet aux users de "installer" le site sur leur home
 * screen (iOS Add to Home Screen, Android Install app, desktop Chrome).
 *
 * On reste minimal : nom + icônes + couleurs. Les icônes pointent vers
 * les routes Next.js `/icon` et `/apple-icon` déjà générées dynamiquement.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Boursikotons',
    short_name: 'Boursikotons',
    description:
      'Formation trading pro à Dubaï et à distance. Accès groupe VIP Telegram via partenariat broker.',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#07070b',
    theme_color: '#07070b',
    lang: 'fr-FR',
    icons: [
      {
        src: '/icon',
        sizes: '32x32',
        type: 'image/png',
      },
      {
        src: '/apple-icon',
        sizes: '180x180',
        type: 'image/png',
        purpose: 'any',
      },
    ],
    categories: ['finance', 'education', 'business'],
  };
}
