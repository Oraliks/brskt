'use client';

import { Suspense, useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import posthog from 'posthog-js';
import { PostHogProvider as PHProvider } from 'posthog-js/react';

/**
 * Provider PostHog client. Init paresseuse, no-op si la clé n'est pas set.
 * Track page_view automatiquement à chaque changement de route App Router.
 */
export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    const host = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://eu.i.posthog.com';
    if (!key) return;

    posthog.init(key, {
      api_host: host,
      // App Router fait le routing en JS — on désactive l'auto-capture et
      // on émet manuellement les page_view depuis PageViewTracker
      capture_pageview: false,
      capture_pageleave: true,
      persistence: 'localStorage+cookie',
      // Pas de session replay par défaut côté client (coût ↑)
      disable_session_recording: true,
      autocapture: false,
      loaded: (ph) => {
        if (process.env.NODE_ENV === 'development') ph.debug(false);
      },
    });
  }, []);

  return (
    <PHProvider client={posthog}>
      <Suspense fallback={null}>
        <PageViewTracker />
      </Suspense>
      {children}
    </PHProvider>
  );
}

function PageViewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
    if (!pathname) return;
    const search = searchParams?.toString();
    const url = search ? `${pathname}?${search}` : pathname;
    posthog.capture('$pageview', { $current_url: url });
  }, [pathname, searchParams]);

  return null;
}
