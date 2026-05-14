import type { MetadataRoute } from 'next';

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? 'https://boursikotons.com';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        // Pages indexables — landing + funnels publics
        allow: ['/', '/formation', '/vip', '/legal'],
        // Tout le back-office, l'auth, et les routes utilisateur restent privés
        disallow: [
          '/admin',
          '/admin/*',
          '/api/*',
          '/dashboard',
          '/dashboard/*',
          '/checkout/*',
          '/onboarding',
          '/login',
          '/login/*',
        ],
      },
    ],
    sitemap: `${APP_URL}/sitemap.xml`,
    host: APP_URL,
  };
}
