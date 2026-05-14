import { LiveTicker } from './live-ticker';
import { fetchMarketQuotes } from '@/lib/market-quotes';

/**
 * Bande LIVE plein écran, à mettre juste sous la navbar dans le layout.
 *
 * Server Component : fait le 1er fetch en SSR (avec timeout 2.5s) puis
 * passe les quotes au composant client LiveTicker qui prend le relais
 * en polling.
 *
 * Si Yahoo lague, on rend le LiveTicker sans initial — il affichera un
 * petit "Chargement…" puis prendra le relais en moins d'1s côté client.
 */
export async function LiveTickerBar() {
  // Best-effort SSR fetch — timeout court car on est dans le layout.
  const quotes = await Promise.race([
    fetchMarketQuotes(),
    new Promise<never[]>((resolve) => setTimeout(() => resolve([]), 2500)),
  ]);

  return (
    <div className="relative z-10 border-b border-[var(--color-border)] bg-[var(--color-bg-elevated)]/40 backdrop-blur-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-1.5 flex items-center gap-3">
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="relative inline-flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-dim)] font-medium hidden sm:inline">
            Live
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <LiveTicker initial={quotes} />
        </div>
      </div>
    </div>
  );
}
