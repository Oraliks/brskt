'use client';

import { useTransition, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowDown, ArrowUp, Check, Loader2, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/use-toast';
import { submitPredictionAction } from '@/lib/actions/games';
import type { MarketId, MarketMeta } from '@/lib/games/markets';
import { useHaptic } from '@/components/mini/telegram-webapp';
import { cn } from '@/lib/utils';

interface Props {
  market: MarketId;
  meta: MarketMeta;
  openPrice: number | null;
  closePrice: number | null;
  userPrediction: 'up' | 'down' | null;
  resolved: boolean;
  windowOpen: boolean;
}

/**
 * Carte d'un marché avec ses 2 boutons up/down. Plusieurs états :
 *  1. Pas encore ouvert (openPrice null) → message d'attente
 *  2. Ouvert + pas prédit + fenêtre ouverte → 2 boutons cliquables
 *  3. Ouvert + déjà prédit → afficher le choix (vert si correct, rouge si faux)
 *  4. Fenêtre fermée + pas prédit → griser les boutons
 *  5. Résolu → afficher le résultat (open → close)
 */
export function MarketPredictCard({
  market,
  meta,
  openPrice,
  closePrice,
  userPrediction,
  resolved,
  windowOpen,
}: Props) {
  const router = useRouter();
  const haptic = useHaptic();
  const [pending, start] = useTransition();
  const [optimistic, setOptimistic] = useState<'up' | 'down' | null>(null);

  const effectivePrediction = userPrediction ?? optimistic;
  const isPredicted = effectivePrediction !== null;

  function predict(direction: 'up' | 'down') {
    if (isPredicted || pending) return;
    haptic.impact('medium');
    setOptimistic(direction);
    start(async () => {
      const res = await submitPredictionAction({
        market,
        direction,
      });
      if (!res.success) {
        haptic.error();
        setOptimistic(null);
        toast({
          title: 'Pronostic refusé',
          description: res.error,
          variant: 'destructive',
        });
        return;
      }
      haptic.success();
      toast({
        title: `+${res.data.xpAwarded} XP`,
        description: `Streak ${res.data.streak} jour${
          res.data.streak > 1 ? 's' : ''
        } — total ${res.data.newTotal} XP.`,
      });
      router.refresh();
    });
  }

  // Calcul résultat si résolu
  let wentUp: boolean | null = null;
  if (resolved && openPrice !== null && closePrice !== null) {
    wentUp = closePrice > openPrice;
  }
  const isCorrect =
    resolved && effectivePrediction !== null && wentUp !== null
      ? (wentUp && effectivePrediction === 'up') ||
        (!wentUp && effectivePrediction === 'down')
      : null;

  return (
    <div
      className={cn(
        'glass-strong rounded-[var(--radius-lg)] p-4 flex flex-col gap-3 transition-colors',
        resolved && isCorrect === true && 'border-emerald-500/40',
        resolved && isCorrect === false && 'border-rose-500/40'
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{meta.icon}</span>
          <div>
            <div className={cn('font-medium', meta.accentClass)}>
              {meta.label}
            </div>
            <div className="text-[10px] text-[var(--color-text-faint)]">
              {meta.description}
            </div>
          </div>
        </div>
        {resolved && (
          <Badge
            variant={isCorrect ? 'success' : 'danger'}
            className="text-[10px]"
          >
            {isCorrect ? '+50 XP' : 'raté'}
          </Badge>
        )}
      </div>

      {openPrice === null ? (
        <div className="text-xs text-[var(--color-text-faint)] py-4 text-center">
          ⏳ Marché en cours d&apos;ouverture…
        </div>
      ) : (
        <>
          <div className="flex items-baseline gap-2 text-xs text-[var(--color-text-dim)]">
            <span>Référence veille :</span>
            <span className="font-mono text-[var(--color-text)]">
              {formatPrice(openPrice)}
            </span>
            {resolved && closePrice !== null && (
              <>
                <span className="text-[var(--color-text-faint)]">→</span>
                <span
                  className={cn(
                    'font-mono',
                    wentUp ? 'text-emerald-300' : 'text-rose-300'
                  )}
                >
                  {formatPrice(closePrice)}
                </span>
              </>
            )}
          </div>

          {/* Boutons up/down */}
          <div className="grid grid-cols-2 gap-2">
            <DirectionButton
              direction="up"
              active={effectivePrediction === 'up'}
              disabled={isPredicted || !windowOpen || pending}
              resolved={resolved}
              correct={resolved && effectivePrediction === 'up' ? isCorrect : null}
              onClick={() => predict('up')}
              pending={pending && optimistic === 'up'}
            />
            <DirectionButton
              direction="down"
              active={effectivePrediction === 'down'}
              disabled={isPredicted || !windowOpen || pending}
              resolved={resolved}
              correct={resolved && effectivePrediction === 'down' ? isCorrect : null}
              onClick={() => predict('down')}
              pending={pending && optimistic === 'down'}
            />
          </div>

          {!isPredicted && !windowOpen && (
            <div className="text-[10px] text-[var(--color-text-faint)] text-center">
              Pronostics fermés pour aujourd&apos;hui
            </div>
          )}
          {isPredicted && !resolved && (
            <div className="text-[10px] text-[var(--color-accent-hover)] text-center">
              Ton pronostic est enregistré. Résultat ce soir.
            </div>
          )}
        </>
      )}
    </div>
  );
}

function DirectionButton({
  direction,
  active,
  disabled,
  resolved,
  correct,
  onClick,
  pending,
}: {
  direction: 'up' | 'down';
  active: boolean;
  disabled: boolean;
  resolved: boolean;
  correct: boolean | null;
  onClick: () => void;
  pending: boolean;
}) {
  const isUp = direction === 'up';
  const Icon = isUp ? ArrowUp : ArrowDown;
  // Classes statiques pour que Tailwind JIT les compile.
  const activeClass = isUp
    ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-200'
    : 'border-rose-500/50 bg-rose-500/15 text-rose-200';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'relative inline-flex flex-col items-center justify-center gap-1 py-3 rounded-[var(--radius-md)] border text-sm transition-all',
        active
          ? activeClass
          : 'border-[var(--color-border)] hover:bg-[var(--color-surface-tint)] text-[var(--color-text-dim)]',
        disabled && !active && 'opacity-40 cursor-not-allowed'
      )}
    >
      {pending ? (
        <Loader2 className="h-5 w-5 animate-spin" />
      ) : (
        <Icon className="h-5 w-5" />
      )}
      <span className="text-[10px] uppercase tracking-wider">
        {isUp ? 'Plus haut' : 'Plus bas'}
      </span>
      {resolved && active && correct !== null && (
        <span
          className={cn(
            'absolute top-1 right-1',
            correct ? 'text-emerald-300' : 'text-rose-300'
          )}
        >
          {correct ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
        </span>
      )}
    </button>
  );
}

function formatPrice(n: number): string {
  if (n >= 1000) {
    return n.toLocaleString('fr-FR', {
      maximumFractionDigits: 0,
    });
  }
  return n.toLocaleString('fr-FR', { maximumFractionDigits: 2 });
}
