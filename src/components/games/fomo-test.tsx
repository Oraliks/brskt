'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  CheckCircle2,
  Loader2,
  Minus,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { useHaptic } from '@/components/mini/telegram-webapp';
import { submitFomoRunAction } from '@/lib/actions/games';
import { cn } from '@/lib/utils';

type FomoChoice = 'buy' | 'hold' | 'sell';

interface Scenario {
  id: number;
  name: string;
  candles: Array<{ open: number; close: number; low: number; high: number }>;
  optimal: FomoChoice;
  explanation: string;
}

interface Decision {
  scenarioId: number;
  choice: FomoChoice;
  latencyMs: number;
}

/** Temps max par scénario (ms). */
const DECISION_TIMEOUT_MS = 4_000;
/** Délai d'affichage du feedback entre 2 scénarios. */
const FEEDBACK_MS = 1_800;

type Phase = 'intro' | 'playing' | 'feedback' | 'submitting' | 'done';

export function FomoTest({ scenarios }: { scenarios: Scenario[] }) {
  const router = useRouter();
  const haptic = useHaptic();
  const [phase, setPhase] = useState<Phase>('intro');
  const [step, setStep] = useState(0);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [lastChoice, setLastChoice] = useState<FomoChoice | null>(null);
  const [timeLeft, setTimeLeft] = useState(DECISION_TIMEOUT_MS);
  const [pending, start] = useTransition();
  const startStepRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  const current = scenarios[step];

  // Countdown timer pendant playing
  useEffect(() => {
    if (phase !== 'playing') return;
    startStepRef.current = performance.now();
    setTimeLeft(DECISION_TIMEOUT_MS);
    const tick = (ts: number) => {
      const elapsed = ts - startStepRef.current;
      const left = Math.max(0, DECISION_TIMEOUT_MS - elapsed);
      setTimeLeft(left);
      if (left <= 0) {
        // Time's up → auto 'hold' par défaut
        recordChoice('hold', DECISION_TIMEOUT_MS, true);
      } else {
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [phase, step]);

  function recordChoice(choice: FomoChoice, latencyMs: number, auto = false) {
    if (!current) return;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    if (!auto) haptic.impact('medium');
    setLastChoice(choice);
    setDecisions((arr) => [
      ...arr,
      { scenarioId: current.id, choice, latencyMs },
    ]);
    setPhase('feedback');

    setTimeout(() => {
      const nextStep = step + 1;
      if (nextStep >= scenarios.length) {
        // Submit all
        submit([
          ...decisions,
          { scenarioId: current.id, choice, latencyMs },
        ]);
      } else {
        setStep(nextStep);
        setLastChoice(null);
        setPhase('playing');
      }
    }, FEEDBACK_MS);
  }

  function onChoice(choice: FomoChoice) {
    if (phase !== 'playing') return;
    const latencyMs = Math.floor(performance.now() - startStepRef.current);
    recordChoice(choice, latencyMs);
  }

  function submit(allDecisions: Decision[]) {
    setPhase('submitting');
    start(async () => {
      const res = await submitFomoRunAction({ decisions: allDecisions });
      if (!res.success) {
        haptic.error();
        toast({
          title: 'Erreur',
          description: res.error,
          variant: 'destructive',
        });
        setPhase('intro');
        setDecisions([]);
        setStep(0);
        return;
      }
      haptic.success();
      toast({
        title: `🧠 FOMO score ${res.data.score}/100`,
        description: `+${res.data.xpAwarded} XP · Total ${res.data.newTotal} XP`,
      });
      setPhase('done');
      router.refresh();
    });
  }

  function startTest() {
    haptic.impact('light');
    setDecisions([]);
    setStep(0);
    setLastChoice(null);
    setPhase('playing');
  }

  if (phase === 'intro') {
    return (
      <div className="glass-strong rounded-[var(--radius-lg)] p-8 text-center space-y-4 max-w-2xl mx-auto">
        <div className="text-5xl">⚡</div>
        <h3 className="font-serif text-2xl">10 scénarios, 4 secondes chacun</h3>
        <p className="text-sm text-[var(--color-text-dim)] max-w-md mx-auto">
          Tu vois un pattern de chart. Tu cliques Acheter, Garder ou Vendre.
          Le bon choix dépend du pattern (pump suspect, dip réel,
          consolidation, etc.). Si tu hésites, le timer passera à
          &quot;Garder&quot; par défaut.
        </p>
        <button
          type="button"
          onClick={startTest}
          className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-pink-500 to-rose-500 text-white px-8 py-3 text-base font-medium shadow-lg hover:shadow-xl transition-shadow"
        >
          Démarrer le test
        </button>
      </div>
    );
  }

  if (phase === 'submitting' || pending) {
    return (
      <div className="glass-strong rounded-[var(--radius-lg)] p-12 text-center space-y-3 max-w-md mx-auto">
        <Loader2 className="h-10 w-10 mx-auto animate-spin text-pink-300" />
        <p className="text-sm text-[var(--color-text-dim)]">
          Calcul de ton FOMO score…
        </p>
      </div>
    );
  }

  if (phase === 'done') {
    return (
      <div className="glass-strong rounded-[var(--radius-lg)] p-8 text-center space-y-4 max-w-md mx-auto">
        <CheckCircle2 className="h-12 w-12 mx-auto text-emerald-300" />
        <h3 className="font-serif text-2xl">Test terminé</h3>
        <p className="text-sm text-[var(--color-text-dim)]">
          Ton score s&apos;affiche au-dessus. Reviens demain pour mesurer
          ton évolution.
        </p>
      </div>
    );
  }

  if (!current) return null;

  const timerPct = (timeLeft / DECISION_TIMEOUT_MS) * 100;
  const correct = lastChoice === current.optimal;

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      {/* Progress */}
      <div>
        <div className="flex items-baseline justify-between mb-2 text-xs">
          <span className="text-[var(--color-text-faint)] uppercase tracking-wider">
            Scénario {step + 1} / {scenarios.length}
          </span>
          <span className="font-medium">{current.name}</span>
        </div>
        <div className="h-1.5 bg-[var(--color-surface-tint)] rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-pink-500 to-rose-500 transition-all"
            style={{ width: `${((step + 1) / scenarios.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Timer (uniquement pendant playing) */}
      {phase === 'playing' && (
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] uppercase tracking-wider text-[var(--color-text-faint)]">
            <span>Décide</span>
            <span className={cn(timeLeft < 1500 && 'text-rose-300 font-medium')}>
              {(timeLeft / 1000).toFixed(1)}s
            </span>
          </div>
          <div className="h-1.5 bg-[var(--color-surface-tint)] rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full transition-[width] duration-100 ease-linear',
                timerPct > 60
                  ? 'bg-emerald-500'
                  : timerPct > 30
                    ? 'bg-amber-500'
                    : 'bg-rose-500'
              )}
              style={{ width: `${timerPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Chart */}
      <ChartCandles candles={current.candles} pulsing={phase === 'playing'} />

      {/* Feedback overlay */}
      {phase === 'feedback' && lastChoice && (
        <div
          className={cn(
            'rounded-[var(--radius-lg)] p-4 border-2',
            correct
              ? 'border-emerald-500/40 bg-emerald-500/10'
              : 'border-rose-500/40 bg-rose-500/10'
          )}
        >
          <div className="flex items-center gap-2 mb-2">
            {correct ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-300" />
            ) : (
              <X className="h-5 w-5 text-rose-300" />
            )}
            <span className="font-medium">
              {correct ? 'Bonne lecture' : `Optimal était : ${labelFor(current.optimal)}`}
            </span>
          </div>
          <p className="text-sm text-[var(--color-text-dim)]">
            {current.explanation}
          </p>
        </div>
      )}

      {/* Boutons */}
      <div className="grid grid-cols-3 gap-3">
        <ChoiceButton
          choice="sell"
          onClick={() => onChoice('sell')}
          disabled={phase !== 'playing'}
          highlighted={phase === 'feedback' && lastChoice === 'sell'}
          isOptimal={phase === 'feedback' && current.optimal === 'sell'}
        />
        <ChoiceButton
          choice="hold"
          onClick={() => onChoice('hold')}
          disabled={phase !== 'playing'}
          highlighted={phase === 'feedback' && lastChoice === 'hold'}
          isOptimal={phase === 'feedback' && current.optimal === 'hold'}
        />
        <ChoiceButton
          choice="buy"
          onClick={() => onChoice('buy')}
          disabled={phase !== 'playing'}
          highlighted={phase === 'feedback' && lastChoice === 'buy'}
          isOptimal={phase === 'feedback' && current.optimal === 'buy'}
        />
      </div>
    </div>
  );
}

function labelFor(choice: FomoChoice): string {
  return choice === 'buy' ? 'Acheter' : choice === 'sell' ? 'Vendre' : 'Garder';
}

function ChoiceButton({
  choice,
  onClick,
  disabled,
  highlighted,
  isOptimal,
}: {
  choice: FomoChoice;
  onClick: () => void;
  disabled: boolean;
  highlighted: boolean;
  isOptimal: boolean;
}) {
  const config = {
    sell: {
      label: 'Vendre',
      icon: TrendingDown,
      base: 'border-rose-500/40 hover:bg-rose-500/15 text-rose-300',
      active: 'border-rose-400 bg-rose-500/25 text-rose-200',
    },
    hold: {
      label: 'Garder',
      icon: Minus,
      base: 'border-sky-500/40 hover:bg-sky-500/15 text-sky-300',
      active: 'border-sky-400 bg-sky-500/25 text-sky-200',
    },
    buy: {
      label: 'Acheter',
      icon: TrendingUp,
      base: 'border-emerald-500/40 hover:bg-emerald-500/15 text-emerald-300',
      active: 'border-emerald-400 bg-emerald-500/25 text-emerald-200',
    },
  }[choice];
  const Icon = config.icon;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'group inline-flex flex-col items-center justify-center gap-1 py-4 rounded-[var(--radius-md)] border-2 transition-all',
        disabled && !highlighted && !isOptimal ? 'opacity-50' : 'active:scale-95',
        highlighted ? config.active : config.base,
        isOptimal &&
          !highlighted &&
          'ring-2 ring-amber-400/60 ring-offset-2 ring-offset-[var(--color-bg)]'
      )}
    >
      <Icon className="h-6 w-6" />
      <span className="text-sm font-medium">{config.label}</span>
    </button>
  );
}

function ChartCandles({
  candles,
  pulsing,
}: {
  candles: Array<{ open: number; close: number; low: number; high: number }>;
  pulsing: boolean;
}) {
  const width = 600;
  const height = 220;

  const allValues = candles.flatMap((c) => [c.low, c.high]);
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const range = Math.max(1, max - min);

  const candleWidth = width / candles.length;
  const bodyWidth = candleWidth * 0.6;

  const toY = useMemo(
    () => (value: number) => height - ((value - min) / range) * (height - 20) - 10,
    [min, range]
  );

  return (
    <div className="glass-strong rounded-[var(--radius-lg)] overflow-hidden">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        style={{ height: `${height}px` }}
        preserveAspectRatio="none"
      >
        {[0.25, 0.5, 0.75].map((pct, i) => (
          <line
            key={i}
            x1="0"
            x2={width}
            y1={height * pct}
            y2={height * pct}
            stroke="currentColor"
            strokeOpacity="0.08"
          />
        ))}
        {candles.map((c, i) => {
          const x = i * candleWidth + candleWidth / 2;
          const isLast = i === candles.length - 1;
          const bullish = c.close > c.open;
          const bodyTop = toY(Math.max(c.open, c.close));
          const bodyBottom = toY(Math.min(c.open, c.close));
          const bodyHeight = Math.max(1, bodyBottom - bodyTop);
          const color = bullish ? '#10b981' : '#f43f5e';
          return (
            <g
              key={i}
              className={cn(isLast && pulsing && 'animate-pulse')}
              style={isLast && pulsing ? { transformOrigin: `${x}px center` } : undefined}
            >
              {/* Wick */}
              <line
                x1={x}
                x2={x}
                y1={toY(c.high)}
                y2={toY(c.low)}
                stroke={color}
                strokeWidth="1.5"
              />
              {/* Body */}
              <rect
                x={x - bodyWidth / 2}
                y={bodyTop}
                width={bodyWidth}
                height={bodyHeight}
                fill={color}
                rx="1"
              />
              {/* Glow sur la dernière candle */}
              {isLast && pulsing && (
                <rect
                  x={x - bodyWidth / 2 - 4}
                  y={bodyTop - 4}
                  width={bodyWidth + 8}
                  height={bodyHeight + 8}
                  fill="none"
                  stroke={color}
                  strokeOpacity="0.4"
                  strokeWidth="2"
                  rx="3"
                />
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
