'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Play, Sparkles, Target, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { useHaptic } from '@/components/mini/telegram-webapp';
import { submitPatienceRunAction } from '@/lib/actions/games';
import { cn } from '@/lib/utils';

type Phase = 'idle' | 'playing' | 'revealed' | 'submitting';

/** Durée totale de la partie (génération du chart). */
const TOTAL_DURATION_MS = 30_000;
/** Intervalle entre 2 points (tickRate). */
const TICK_MS = 100;
/** Nombre de points total. */
const POINT_COUNT = TOTAL_DURATION_MS / TICK_MS;

interface RunResult {
  score: number;
  xpAwarded: number;
  newTotal: number;
  runsLeftToday: number;
}

export function PatienceGame({ canPlay }: { canPlay: boolean }) {
  const router = useRouter();
  const haptic = useHaptic();
  const [phase, setPhase] = useState<Phase>('idle');
  const [prices, setPrices] = useState<number[]>([]);
  const [displayedIdx, setDisplayedIdx] = useState(0);
  const [releaseIdx, setReleaseIdx] = useState<number | null>(null);
  const [result, setResult] = useState<RunResult | null>(null);
  const [pending, start] = useTransition();
  const startRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  const score = useMemo(() => {
    if (releaseIdx === null || prices.length === 0) return 0;
    const entryPrice = prices[releaseIdx];
    if (entryPrice === undefined) return 0;
    const futurePrices = prices.slice(releaseIdx + 1);
    if (futurePrices.length === 0) return 0;
    const futureMax = Math.max(...futurePrices);
    const totalMax = Math.max(...prices);
    const totalMin = Math.min(...prices);
    const range = Math.max(0.01, totalMax - totalMin);
    const benefit = futureMax - entryPrice;
    return Math.max(0, Math.min(100, Math.round((benefit / range) * 100)));
  }, [releaseIdx, prices]);

  // Boucle d'animation : avance le chart point par point
  useEffect(() => {
    if (phase !== 'playing') return;
    const tick = (ts: number) => {
      const elapsed = ts - startRef.current;
      const idx = Math.min(prices.length - 1, Math.floor(elapsed / TICK_MS));
      setDisplayedIdx(idx);
      if (idx < prices.length - 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        // Fin de chart sans release → release auto sur le dernier point
        autoRelease();
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [phase, prices]);

  function startRun() {
    if (!canPlay || phase === 'submitting') return;
    const generated = generateRandomWalk(POINT_COUNT);
    setPrices(generated);
    setDisplayedIdx(0);
    setReleaseIdx(null);
    setResult(null);
    startRef.current = performance.now();
    setPhase('playing');
    haptic.impact('light');
  }

  function release() {
    if (phase !== 'playing') return;
    haptic.impact('medium');
    const idx = displayedIdx;
    setReleaseIdx(idx);
    setDisplayedIdx(prices.length - 1); // révèle tout le chart
    setPhase('revealed');
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    // Auto-submit après 1s (laisse l'user voir le résultat)
    setTimeout(() => submit(idx), 1200);
  }

  function autoRelease() {
    // Si l'user n'a pas cliqué, on annule (run "tenu jusqu'à la fin" = 0 XP)
    setReleaseIdx(prices.length - 1);
    setPhase('revealed');
    toast({
      title: 'Trop tard',
      description: "Tu n'as pas cliqué avant la fin du chart.",
    });
    setTimeout(() => {
      setPhase('idle');
      setResult(null);
    }, 2000);
  }

  function submit(idx: number) {
    setPhase('submitting');
    const durationMs = performance.now() - startRef.current;
    const finalScore = (() => {
      // Recalcule pour être sûr (peut différer du useMemo si releaseIdx pas encore set)
      const entryPrice = prices[idx];
      if (entryPrice === undefined) return 0;
      const future = prices.slice(idx + 1);
      if (future.length === 0) return 0;
      const futureMax = Math.max(...future);
      const totalMax = Math.max(...prices);
      const totalMin = Math.min(...prices);
      const range = Math.max(0.01, totalMax - totalMin);
      return Math.max(
        0,
        Math.min(100, Math.round(((futureMax - entryPrice) / range) * 100))
      );
    })();

    start(async () => {
      const res = await submitPatienceRunAction({
        score: finalScore,
        durationHeldMs: Math.floor(durationMs),
      });
      if (!res.success) {
        haptic.error();
        toast({
          title: 'Run rejeté',
          description: res.error,
          variant: 'destructive',
        });
        setPhase('idle');
        return;
      }
      haptic.success();
      setResult(res.data);
      toast({
        title: `🎯 Score ${res.data.score}/100`,
        description: `+${res.data.xpAwarded} XP · Total ${res.data.newTotal} XP`,
      });
      router.refresh();
    });
  }

  function reset() {
    setPhase('idle');
    setResult(null);
    setReleaseIdx(null);
    setDisplayedIdx(0);
    setPrices([]);
  }

  // ============================================================
  // RENDER
  // ============================================================

  if (!canPlay && phase === 'idle' && !result) {
    return (
      <div className="glass-strong rounded-[var(--radius-lg)] p-8 text-center space-y-3 max-w-md mx-auto">
        <h3 className="font-serif text-xl">Plus de runs aujourd&apos;hui</h3>
        <p className="text-sm text-[var(--color-text-dim)]">
          Reviens demain pour 3 nouveaux essais.
        </p>
      </div>
    );
  }

  if (phase === 'submitting' && pending) {
    return (
      <div className="glass-strong rounded-[var(--radius-lg)] p-12 text-center space-y-3 max-w-md mx-auto">
        <Loader2 className="h-10 w-10 mx-auto animate-spin text-[var(--color-accent-hover)]" />
        <p className="text-sm text-[var(--color-text-dim)]">
          Calcul du score…
        </p>
      </div>
    );
  }

  if (result && phase === 'submitting') {
    // Already shown via toast, but show result card with action
    return (
      <ResultCard result={result} canPlay={canPlay} onReplay={reset} onBack={() => router.push('/jeux')} />
    );
  }

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      <ChartArea
        prices={prices}
        displayedIdx={displayedIdx}
        releaseIdx={releaseIdx}
        phase={phase}
      />

      {/* Boutons */}
      <div className="flex flex-col items-center gap-3">
        {phase === 'idle' && (
          <Button onClick={startRun} size="lg" className="gap-2">
            <Play className="h-4 w-4" />
            Démarrer le chart
          </Button>
        )}
        {phase === 'playing' && (
          <Button
            onClick={release}
            size="lg"
            className={cn(
              'gap-2 bg-gradient-to-r from-indigo-500 to-pink-500 text-white text-base px-8 py-3 h-auto',
              'shadow-[0_0_40px_-4px_rgba(168,85,247,0.6)] animate-pulse'
            )}
          >
            <Target className="h-5 w-5" />
            Entrer position maintenant
          </Button>
        )}
        {phase === 'revealed' && (
          <div className="text-center space-y-2">
            <div className="font-serif text-2xl">
              Score{' '}
              <span
                className={cn(
                  score >= 80
                    ? 'text-emerald-300'
                    : score >= 60
                      ? 'text-amber-300'
                      : score >= 30
                        ? 'text-sky-300'
                        : 'text-rose-300'
                )}
              >
                {score}/100
              </span>
            </div>
            <p className="text-xs text-[var(--color-text-dim)]">
              {score >= 80
                ? "Patience parfaite — entrée près du low, suite haussière."
                : score >= 60
                  ? "Bonne entrée — tu lis bien le rythme."
                  : score >= 30
                    ? "Moyenne — l'entrée pouvait être mieux placée."
                    : "Trop tôt ou trop haut — l'impatience t'a coûté."}
            </p>
          </div>
        )}
      </div>

      <p className="text-[10px] text-center text-[var(--color-text-faint)] uppercase tracking-wider">
        {phase === 'idle'
          ? "30 secondes de chart. Clique au bon moment pour entrer."
          : phase === 'playing'
            ? `Chart en cours · ${Math.floor((displayedIdx / POINT_COUNT) * 30)}s / 30s`
            : 'Résultat — chart révélé'}
      </p>
    </div>
  );
}

// ============================================================
// Sous-composants
// ============================================================

function ChartArea({
  prices,
  displayedIdx,
  releaseIdx,
  phase,
}: {
  prices: number[];
  displayedIdx: number;
  releaseIdx: number | null;
  phase: Phase;
}) {
  const width = 600;
  const height = 220;

  if (phase === 'idle' || prices.length === 0) {
    return (
      <div
        className="glass-strong rounded-[var(--radius-lg)] flex items-center justify-center text-sm text-[var(--color-text-faint)]"
        style={{ height: `${height}px` }}
      >
        <div className="text-center space-y-2">
          <TrendingUp className="h-10 w-10 mx-auto opacity-50" />
          <div>Le chart apparaîtra ici</div>
        </div>
      </div>
    );
  }

  const visiblePrices =
    phase === 'playing' ? prices.slice(0, displayedIdx + 1) : prices;
  const min = Math.min(...visiblePrices);
  const max = Math.max(...visiblePrices);
  const range = Math.max(0.01, max - min);

  const stepX = width / Math.max(1, prices.length - 1);

  const toPoint = (price: number, i: number) => {
    const x = i * stepX;
    const y = height - ((price - min) / range) * (height - 20) - 10;
    return { x, y };
  };

  const pastPoints = (
    phase === 'revealed' && releaseIdx !== null
      ? prices.slice(0, releaseIdx + 1)
      : visiblePrices
  ).map(toPoint);
  const futurePoints =
    phase === 'revealed' && releaseIdx !== null
      ? prices.slice(releaseIdx).map((p, i) => toPoint(p, releaseIdx + i))
      : [];

  const pathFromPoints = (pts: { x: number; y: number }[]) =>
    pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');

  const pastPath = pathFromPoints(pastPoints);
  const futurePath = pathFromPoints(futurePoints);
  const lastVisible = pastPoints[pastPoints.length - 1];

  // Position release marker
  const releasePoint =
    releaseIdx !== null && prices[releaseIdx] !== undefined
      ? toPoint(prices[releaseIdx]!, releaseIdx)
      : null;

  return (
    <div className="relative glass-strong rounded-[var(--radius-lg)] overflow-hidden">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        style={{ height: `${height}px` }}
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="patience-past" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(99,102,241,0.8)" />
            <stop offset="100%" stopColor="rgba(168,85,247,0.8)" />
          </linearGradient>
          <linearGradient id="patience-future" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(236,72,153,0.6)" />
            <stop offset="100%" stopColor="rgba(245,158,11,0.5)" />
          </linearGradient>
          <linearGradient id="patience-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(168,85,247,0.3)" />
            <stop offset="100%" stopColor="rgba(168,85,247,0)" />
          </linearGradient>
        </defs>

        {/* Grille subtile */}
        {[0.25, 0.5, 0.75].map((pct, i) => (
          <line
            key={i}
            x1="0"
            x2={width}
            y1={height * pct}
            y2={height * pct}
            stroke="currentColor"
            strokeOpacity="0.08"
            strokeDasharray="2 3"
          />
        ))}

        {/* Aire passée */}
        {pastPoints.length > 1 && (
          <path
            d={pastPath + ` L ${pastPoints[pastPoints.length - 1]!.x} ${height} L 0 ${height} Z`}
            fill="url(#patience-area)"
          />
        )}

        {/* Ligne passée (claire) */}
        {pastPoints.length > 1 && (
          <path d={pastPath} fill="none" stroke="url(#patience-past)" strokeWidth="2.5" />
        )}

        {/* Ligne future (révélée) */}
        {futurePoints.length > 1 && (
          <path
            d={futurePath}
            fill="none"
            stroke="url(#patience-future)"
            strokeWidth="2"
            strokeDasharray="6 3"
          />
        )}

        {/* Tête de la ligne (point qui suit) */}
        {phase === 'playing' && lastVisible && (
          <>
            <circle
              cx={lastVisible.x}
              cy={lastVisible.y}
              r="6"
              fill="rgba(168,85,247,0.4)"
              className="animate-pulse"
            />
            <circle cx={lastVisible.x} cy={lastVisible.y} r="3" fill="#fff" />
          </>
        )}

        {/* Marker d'entrée (release point) */}
        {releasePoint && (
          <>
            <line
              x1={releasePoint.x}
              x2={releasePoint.x}
              y1="0"
              y2={height}
              stroke="rgb(245,158,11)"
              strokeOpacity="0.6"
              strokeDasharray="4 4"
            />
            <circle
              cx={releasePoint.x}
              cy={releasePoint.y}
              r="6"
              fill="rgb(245,158,11)"
              stroke="#fff"
              strokeWidth="2"
            />
          </>
        )}
      </svg>

      {/* Overlay label */}
      <div className="absolute top-2 left-3 inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[var(--color-text-faint)]">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
        Live
      </div>
      {phase === 'revealed' && releaseIdx !== null && (
        <div className="absolute top-2 right-3 inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-amber-300">
          Ton entry · {((releaseIdx / POINT_COUNT) * 30).toFixed(1)}s
        </div>
      )}
    </div>
  );
}

function ResultCard({
  result,
  canPlay,
  onReplay,
  onBack,
}: {
  result: RunResult;
  canPlay: boolean;
  onReplay: () => void;
  onBack: () => void;
}) {
  return (
    <div className="glass-strong rounded-[var(--radius-lg)] p-8 text-center space-y-4 max-w-md mx-auto">
      <div className="font-serif text-5xl text-gradient">
        {result.score}/100
      </div>
      <div className="text-sm text-[var(--color-text-dim)]">
        +{result.xpAwarded} XP · Nouveau total {result.newTotal} XP
      </div>
      {canPlay && result.runsLeftToday > 0 ? (
        <Button onClick={onReplay} className="w-full gap-2">
          <Sparkles className="h-4 w-4" />
          Nouveau run
        </Button>
      ) : (
        <Button onClick={onBack} variant="secondary" className="w-full">
          Retour aux jeux
        </Button>
      )}
    </div>
  );
}

/**
 * Génère une marche aléatoire avec une tendance subtile (drift positif
 * ou négatif aléatoire). Volatilité modérée pour avoir des charts
 * lisibles. Pas de seed déterministe pour éviter le farming.
 */
function generateRandomWalk(length: number): number[] {
  const prices: number[] = [];
  let price = 100;
  // Drift aléatoire par run : -0.05 à +0.05 par tick
  const drift = (Math.random() - 0.5) * 0.1;
  for (let i = 0; i < length; i++) {
    // Bruit gaussien approximé (Box-Muller simplifié)
    const noise = (Math.random() + Math.random() + Math.random() - 1.5) * 0.6;
    price += drift + noise;
    // Soft floor pour éviter prices négatifs
    if (price < 20) price = 20 + Math.random() * 2;
    if (price > 200) price = 200 - Math.random() * 2;
    prices.push(price);
  }
  return prices;
}
