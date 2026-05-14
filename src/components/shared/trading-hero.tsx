/**
 * Décor SVG animé pour le hero du dashboard : ligne de prix stylisée +
 * candlesticks subtils + petit "live price" qui pulse. Tout CSS/SVG,
 * pas de JS — Server Component compatible.
 *
 * Vit dans le vide entre le welcome et les 3 cards pour donner une
 * texture visuelle au lieu d'un grand espace blanc.
 */

const PRICE_PATH =
  'M 0 60 L 40 55 L 80 62 L 120 50 L 160 56 L 200 42 L 240 48 L 280 35 L 320 38 L 360 28 L 400 22 L 440 18 L 480 14 L 520 12 L 560 8 L 600 10';
// Aire sous la courbe (referme en bas)
const AREA_PATH = `${PRICE_PATH} L 600 100 L 0 100 Z`;

// Quelques "candles" pour décorer — positions (x, low, high, open, close)
const CANDLES: Array<{ x: number; low: number; high: number; open: number; close: number }> = [
  { x: 80, low: 70, high: 50, open: 64, close: 56 },
  { x: 200, low: 56, high: 38, open: 50, close: 44 },
  { x: 320, low: 44, high: 30, open: 40, close: 34 },
  { x: 440, low: 30, high: 14, open: 24, close: 18 },
  { x: 540, low: 18, high: 4, open: 14, close: 9 },
];

export function TradingHero() {
  return (
    <div className="trading-hero relative w-full h-32 md:h-44 pointer-events-none select-none overflow-hidden">
      <svg
        viewBox="0 0 600 100"
        preserveAspectRatio="none"
        className="absolute inset-0 w-full h-full"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="th-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(99,102,241,0.22)" />
            <stop offset="100%" stopColor="rgba(99,102,241,0)" />
          </linearGradient>
          <linearGradient id="th-stroke" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="60%" stopColor="#ec4899" />
            <stop offset="100%" stopColor="#14b8a6" />
          </linearGradient>
        </defs>

        {/* Lignes horizontales de grille (très subtiles) */}
        <g stroke="currentColor" className="text-[var(--color-border)]" strokeWidth="0.3">
          <line x1="0" y1="25" x2="600" y2="25" />
          <line x1="0" y1="50" x2="600" y2="50" />
          <line x1="0" y1="75" x2="600" y2="75" />
        </g>

        {/* Candlesticks */}
        <g className="trading-hero__candles">
          {CANDLES.map((c, i) => {
            const bullish = c.close < c.open; // y inversé donc close < open = bullish (price up)
            const bodyTop = Math.min(c.open, c.close);
            const bodyH = Math.abs(c.close - c.open);
            return (
              <g
                key={i}
                style={{ animationDelay: `${i * 0.15}s` }}
                className="trading-hero__candle"
              >
                {/* Wick */}
                <line
                  x1={c.x}
                  x2={c.x}
                  y1={c.high}
                  y2={c.low}
                  stroke={bullish ? '#10b981' : '#ef4444'}
                  strokeWidth="0.8"
                  opacity="0.35"
                />
                {/* Body */}
                <rect
                  x={c.x - 3.5}
                  y={bodyTop}
                  width="7"
                  height={Math.max(bodyH, 1.5)}
                  fill={bullish ? '#10b981' : '#ef4444'}
                  opacity="0.35"
                  rx="0.5"
                />
              </g>
            );
          })}
        </g>

        {/* Aire sous la courbe */}
        <path d={AREA_PATH} fill="url(#th-area)" />

        {/* Courbe principale — animée via stroke-dashoffset */}
        <path
          d={PRICE_PATH}
          fill="none"
          stroke="url(#th-stroke)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="trading-hero__line"
        />

        {/* Live price dot (dernier point) */}
        <g className="trading-hero__dot">
          <circle cx="600" cy="10" r="6" fill="#14b8a6" opacity="0.25" />
          <circle cx="600" cy="10" r="2.5" fill="#14b8a6" />
        </g>
      </svg>

      {/* Ticker latéral droit avec un mini "ladder" de prix */}
      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex-col gap-0.5 font-mono text-[9px] text-[var(--color-text-faint)] tabular-nums hidden md:flex">
        <span>1.0942</span>
        <span className="text-emerald-400 light:text-emerald-600">▲ 0.12%</span>
        <span>1.0930</span>
        <span>1.0918</span>
      </div>

      {/* Fade gauche pour intégrer dans la mise en page */}
      <div className="absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-[var(--color-bg)] to-transparent" />
    </div>
  );
}
