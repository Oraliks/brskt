'use client';

import { useEffect, useState } from 'react';
import type { MarketQuote } from '@/lib/market-quotes';

/**
 * Ticker horizontal de prix live qui défile en boucle continue.
 *
 * Stratégie :
 *  1. Au mount : utilise `initial` (Server Component fetch fait à la SSR)
 *  2. Polling toutes les 60s vers /api/market-quotes (cache CDN 60s)
 *  3. Polling pausé si l'onglet est hidden (économise les requêtes)
 *  4. Hover : le marquee CSS s'arrête (gérée en CSS, pas en JS)
 *
 * Source des données : Yahoo Finance via /api/market-quotes (gratuit,
 * pas d'API key). Si un symbol n'a pas pu être fetché, on affiche '—' pour
 * le prix mais le ticker continue de tourner avec les autres.
 */

interface Props {
  /** Quotes initiales fournies au SSR — évite le flash de loading au 1er paint.
   *  Si vide, le composant fetch au mount et affiche un placeholder discret. */
  initial?: MarketQuote[];
}

const REFRESH_INTERVAL_MS = 60_000;

export function LiveTicker({ initial = [] }: Props) {
  const [quotes, setQuotes] = useState<MarketQuote[]>(initial);

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        return;
      }
      try {
        const res = await fetch('/api/market-quotes', { cache: 'no-store' });
        if (!res.ok) return;
        const data = (await res.json()) as {
          quotes: MarketQuote[];
          fetchedAt: string;
        };
        if (!cancelled && Array.isArray(data.quotes) && data.quotes.length > 0) {
          setQuotes(data.quotes);
        }
      } catch {
        // Garde les anciennes données — silencieux.
      }
    }

    // Premier fetch immédiat si pas d'initial
    if (initial.length === 0) {
      void refresh();
    }

    const interval = setInterval(refresh, REFRESH_INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [initial.length]);

  // Pendant le 1er fetch (initial vide), on affiche un placeholder discret
  if (quotes.length === 0) {
    return (
      <div className="live-ticker relative w-full overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-tint)] py-2.5 px-4">
        <div className="text-[10px] font-mono text-[var(--color-text-faint)] uppercase tracking-wider">
          Chargement des marchés…
        </div>
      </div>
    );
  }

  // Dupliqué pour le défilement infini sans cut-off visible
  const loop = [...quotes, ...quotes];

  return (
    <div className="live-ticker relative w-full overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-tint)] py-2.5">
      <div className="live-ticker__track flex gap-8 whitespace-nowrap">
        {loop.map((q, i) => (
          <TickerItem key={i} q={q} />
        ))}
      </div>
      <div className="absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-[var(--color-surface-tint)] to-transparent pointer-events-none" />
      <div className="absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-[var(--color-surface-tint)] to-transparent pointer-events-none" />
    </div>
  );
}

function TickerItem({ q }: { q: MarketQuote }) {
  const isUp = q.up === true;
  const isDown = q.up === false;
  return (
    <div
      title={q.name}
      className="inline-flex items-center gap-2 text-xs font-mono tabular-nums"
    >
      <span className="text-[var(--color-text-dim)] uppercase tracking-wider">
        {q.symbol}
      </span>
      <span className="text-[var(--color-text)] font-medium">{q.price}</span>
      {q.deltaPct && (
        <span
          className={
            isUp
              ? 'text-emerald-400 light:text-emerald-600'
              : isDown
              ? 'text-rose-400 light:text-rose-600'
              : 'text-[var(--color-text-faint)]'
          }
        >
          {isUp ? '▲' : isDown ? '▼' : '·'} {q.deltaPct}
        </span>
      )}
    </div>
  );
}
