import { ArrowDown, ArrowUp, Check, Clock, X } from 'lucide-react';
import { MARKETS, type MarketId } from '@/lib/games/markets';
import { cn } from '@/lib/utils';

interface Item {
  id: string;
  market: MarketId;
  date: string;
  direction: 'up' | 'down';
  correct: boolean | null;
  resolved: boolean;
  openPrice: number | null;
  closePrice: number | null;
  xpAwarded: number;
}

export function PredictionHistory({ items }: { items: Item[] }) {
  return (
    <div className="glass rounded-[var(--radius-md)] overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-[var(--color-surface-tint)]">
          <tr className="text-left text-[10px] uppercase tracking-wider text-[var(--color-text-faint)]">
            <th className="px-3 py-2">Date</th>
            <th className="px-3 py-2">Marché</th>
            <th className="px-3 py-2">Pronostic</th>
            <th className="px-3 py-2">Résultat</th>
            <th className="px-3 py-2 text-right">XP</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it) => (
            <tr
              key={it.id}
              className="border-t border-[var(--color-border)] hover:bg-[var(--color-surface-tint)]/50"
            >
              <td className="px-3 py-2 text-[var(--color-text-dim)] font-mono text-xs">
                {it.date}
              </td>
              <td className="px-3 py-2">
                <span className="inline-flex items-center gap-1.5">
                  <span>{MARKETS[it.market].icon}</span>
                  <span className={MARKETS[it.market].accentClass}>
                    {MARKETS[it.market].label}
                  </span>
                </span>
              </td>
              <td className="px-3 py-2">
                {it.direction === 'up' ? (
                  <span className="inline-flex items-center gap-1 text-emerald-300">
                    <ArrowUp className="h-3 w-3" />
                    Haut
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-rose-300">
                    <ArrowDown className="h-3 w-3" />
                    Bas
                  </span>
                )}
              </td>
              <td className="px-3 py-2">
                {!it.resolved ? (
                  <span className="inline-flex items-center gap-1 text-[var(--color-text-faint)]">
                    <Clock className="h-3 w-3" />
                    En attente
                  </span>
                ) : it.correct ? (
                  <span className="inline-flex items-center gap-1 text-emerald-300">
                    <Check className="h-3 w-3" />
                    Bonne réponse
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-rose-300">
                    <X className="h-3 w-3" />
                    Raté
                  </span>
                )}
              </td>
              <td
                className={cn(
                  'px-3 py-2 text-right font-mono text-xs',
                  it.xpAwarded > 0
                    ? 'text-emerald-300'
                    : 'text-[var(--color-text-faint)]'
                )}
              >
                {it.xpAwarded > 0 ? `+${it.xpAwarded}` : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
