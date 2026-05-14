/**
 * Décor SVG animé pour le hero du dashboard.
 *
 * Plus vivant que la version précédente :
 *  - 2 lignes de prix qui se tracent en boucle continue (pas un one-shot)
 *  - Effet de "data flow" : un point lumineux qui se déplace le long de la ligne
 *  - Candles qui apparaissent en cascade
 *  - Ticker latéral avec prix qui clignotent
 *
 * Tout CSS/SVG, pas de JS — Server Component compatible.
 * Utilisé en arrière-plan (opacity réduite) derrière le header dashboard.
 */

const PRICE_PATH =
  'M 0 60 L 40 55 L 80 62 L 120 50 L 160 56 L 200 42 L 240 48 L 280 35 L 320 38 L 360 28 L 400 22 L 440 18 L 480 14 L 520 12 L 560 8 L 600 10';
const PRICE_PATH_2 =
  'M 0 75 L 40 72 L 80 78 L 120 70 L 160 68 L 200 60 L 240 64 L 280 55 L 320 52 L 360 48 L 400 42 L 440 38 L 480 34 L 520 30 L 560 28 L 600 25';
const AREA_PATH = `${PRICE_PATH} L 600 100 L 0 100 Z`;

const CANDLES: Array<{ x: number; low: number; high: number; open: number; close: number }> = [
  { x: 80, low: 70, high: 50, open: 64, close: 56 },
  { x: 200, low: 56, high: 38, open: 50, close: 44 },
  { x: 320, low: 44, high: 30, open: 40, close: 34 },
  { x: 440, low: 30, high: 14, open: 24, close: 18 },
  { x: 540, low: 18, high: 4, open: 14, close: 9 },
];

const TICKERS = [
  { sym: 'EURUSD', value: '1.0942', delta: '+0.12%', up: true },
  { sym: 'GBPUSD', value: '1.2734', delta: '+0.31%', up: true },
  { sym: 'XAUUSD', value: '2 387', delta: '-0.18%', up: false },
  { sym: 'BTC', value: '67 240', delta: '+2.4%', up: true },
  { sym: 'ETH', value: '3 412', delta: '+1.1%', up: true },
  { sym: 'SOL', value: '162.5', delta: '-0.6%', up: false },
];

export function TradingHero() {
  return (
    <div className="trading-hero relative w-full h-40 md:h-56 pointer-events-none select-none overflow-hidden rounded-[var(--radius-md)]">
      <svg
        viewBox="0 0 600 100"
        preserveAspectRatio="none"
        className="absolute inset-0 w-full h-full"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="th-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(99,102,241,0.28)" />
            <stop offset="100%" stopColor="rgba(99,102,241,0)" />
          </linearGradient>
          <linearGradient id="th-stroke" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="60%" stopColor="#ec4899" />
            <stop offset="100%" stopColor="#14b8a6" />
          </linearGradient>
          <linearGradient id="th-stroke-2" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#14b8a6" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0.4" />
          </linearGradient>
          {/* Glow filter pour la particule qui voyage */}
          <filter id="th-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Lignes horizontales (grille subtile) */}
        <g stroke="currentColor" className="text-[var(--color-border)]" strokeWidth="0.3">
          <line x1="0" y1="25" x2="600" y2="25" />
          <line x1="0" y1="50" x2="600" y2="50" />
          <line x1="0" y1="75" x2="600" y2="75" />
        </g>

        {/* Candlesticks (apparition en cascade) */}
        <g className="trading-hero__candles">
          {CANDLES.map((c, i) => {
            const bullish = c.close < c.open;
            const bodyTop = Math.min(c.open, c.close);
            const bodyH = Math.abs(c.close - c.open);
            return (
              <g
                key={i}
                style={{ animationDelay: `${i * 0.15}s` }}
                className="trading-hero__candle"
              >
                <line
                  x1={c.x}
                  x2={c.x}
                  y1={c.high}
                  y2={c.low}
                  stroke={bullish ? '#10b981' : '#ef4444'}
                  strokeWidth="0.8"
                  opacity="0.45"
                />
                <rect
                  x={c.x - 3.5}
                  y={bodyTop}
                  width="7"
                  height={Math.max(bodyH, 1.5)}
                  fill={bullish ? '#10b981' : '#ef4444'}
                  opacity="0.45"
                  rx="0.5"
                />
              </g>
            );
          })}
        </g>

        {/* Aire sous la courbe */}
        <path d={AREA_PATH} fill="url(#th-area)" />

        {/* Courbe secondaire (en arrière) */}
        <path
          d={PRICE_PATH_2}
          fill="none"
          stroke="url(#th-stroke-2)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="trading-hero__line-bg"
        />

        {/* Courbe principale — boucle continue */}
        <path
          id="th-main-path"
          d={PRICE_PATH}
          fill="none"
          stroke="url(#th-stroke)"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="trading-hero__line"
        />

        {/* Particule qui voyage le long de la ligne (effet "data flow") */}
        <circle r="3" fill="#14b8a6" filter="url(#th-glow)">
          <animateMotion dur="4s" repeatCount="indefinite" rotate="auto">
            <mpath href="#th-main-path" />
          </animateMotion>
        </circle>

        {/* Live price dot (dernier point) */}
        <g className="trading-hero__dot">
          <circle cx="600" cy="10" r="6" fill="#14b8a6" opacity="0.25" />
          <circle cx="600" cy="10" r="2.5" fill="#14b8a6" />
        </g>
      </svg>

      {/* Ticker latéral droit — clignotant */}
      <div className="absolute right-1 top-1 flex-col gap-1 font-mono text-[9px] tabular-nums hidden md:flex">
        {TICKERS.slice(0, 4).map((t, i) => (
          <div
            key={t.sym}
            className="trading-hero__ticker flex items-center justify-end gap-1.5 px-1.5 py-0.5 rounded bg-black/30 light:bg-white/80 backdrop-blur-sm border border-white/5 light:border-black/10"
            style={{ animationDelay: `${i * 0.6}s` }}
          >
            <span className="text-[var(--color-text-faint)] light:text-[var(--color-text-dim)]">
              {t.sym}
            </span>
            <span className="text-[var(--color-text-dim)] light:text-[var(--color-text)]">
              {t.value}
            </span>
            <span
              className={
                t.up
                  ? 'text-emerald-400 light:text-emerald-700'
                  : 'text-rose-400 light:text-rose-700'
              }
            >
              {t.up ? '▲' : '▼'} {t.delta}
            </span>
          </div>
        ))}
      </div>

    </div>
  );
}
