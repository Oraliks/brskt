/**
 * Ticker horizontal de prix qui défile en boucle continue (CSS marquee).
 *
 * Tout SVG/CSS, pas de JS, Server Component compatible. Donne une vraie
 * impression de "salle de trading live" au-dessus / en dessous d'un chart.
 *
 * Les prix sont actuellement statiques (placeholder visuel). À terme on
 * pourra les brancher sur un feed live via un client component séparé.
 */

interface Tick {
  sym: string;
  price: string;
  delta: string;
  up: boolean;
}

const TICKERS: Tick[] = [
  { sym: 'EUR/USD', price: '1.0942', delta: '+0.12%', up: true },
  { sym: 'GBP/USD', price: '1.2734', delta: '+0.31%', up: true },
  { sym: 'USD/JPY', price: '149.84', delta: '-0.08%', up: false },
  { sym: 'XAU/USD', price: '2 387', delta: '-0.18%', up: false },
  { sym: 'WTI', price: '78.42', delta: '+0.94%', up: true },
  { sym: 'BTC', price: '67 240', delta: '+2.4%', up: true },
  { sym: 'ETH', price: '3 412', delta: '+1.1%', up: true },
  { sym: 'SOL', price: '162.5', delta: '-0.6%', up: false },
  { sym: 'BNB', price: '598', delta: '+0.4%', up: true },
  { sym: 'NAS100', price: '20 412', delta: '+0.7%', up: true },
  { sym: 'SPX500', price: '5 842', delta: '+0.3%', up: true },
  { sym: 'DAX', price: '19 224', delta: '-0.2%', up: false },
];

// Duplique pour le défilement infini sans cut-off
const LOOP = [...TICKERS, ...TICKERS];

export function LiveTicker() {
  return (
    <div className="live-ticker relative w-full overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-tint)] py-2.5">
      <div className="live-ticker__track flex gap-8 whitespace-nowrap">
        {LOOP.map((t, i) => (
          <TickerItem key={i} t={t} />
        ))}
      </div>
      {/* Fade gauche & droite pour estomper les bords */}
      <div className="absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-[var(--color-surface-tint)] to-transparent pointer-events-none" />
      <div className="absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-[var(--color-surface-tint)] to-transparent pointer-events-none" />
    </div>
  );
}

function TickerItem({ t }: { t: Tick }) {
  return (
    <div className="inline-flex items-center gap-2 text-xs font-mono tabular-nums">
      <span className="text-[var(--color-text-dim)] uppercase tracking-wider">
        {t.sym}
      </span>
      <span className="text-[var(--color-text)] font-medium">{t.price}</span>
      <span
        className={
          t.up
            ? 'text-emerald-400 light:text-emerald-600'
            : 'text-rose-400 light:text-rose-600'
        }
      >
        {t.up ? '▲' : '▼'} {t.delta}
      </span>
    </div>
  );
}
