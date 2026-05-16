'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
} from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, MousePointer2, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { useHaptic } from '@/components/mini/telegram-webapp';
import { submitTapRunAction } from '@/lib/actions/games';
import { cn } from '@/lib/utils';

/**
 * Paliers (doivent matcher TAP_LEVELS côté serveur).
 * Le `comboMs` est le temps max entre 2 taps avant de casser le combo
 * — il diminue avec les paliers pour devenir de plus en plus serré.
 */
interface ClientLevel {
  level: number;
  minTaps: number;
  comboMs: number;
  label: string;
  icon: string;
}

const LEVELS: ClientLevel[] = [
  { level: 0, minTaps: 0, comboMs: 1500, label: '—', icon: '⚪' },
  { level: 1, minTaps: 10, comboMs: 1200, label: 'Échauffé', icon: '🟢' },
  { level: 2, minTaps: 25, comboMs: 1000, label: 'Rythme', icon: '🟡' },
  { level: 3, minTaps: 50, comboMs: 800, label: 'Combo', icon: '🟠' },
  { level: 4, minTaps: 100, comboMs: 650, label: 'Furie', icon: '🔴' },
  { level: 5, minTaps: 200, comboMs: 500, label: 'Légende', icon: '🟣' },
];

const ROOT_LEVEL: ClientLevel = LEVELS[0] ?? {
  level: 0,
  minTaps: 0,
  comboMs: 1500,
  label: '—',
  icon: '⚪',
};

function levelFor(taps: number): ClientLevel {
  let best: ClientLevel = ROOT_LEVEL;
  for (const l of LEVELS) {
    if (taps >= l.minTaps) best = l;
    else break;
  }
  return best;
}

type Phase = 'idle' | 'playing' | 'submitting' | 'done';

interface DoneResult {
  taps: number;
  level: number;
  xpAwarded: number;
  newTotal: number;
  runsLeftToday: number;
}

/**
 * Bouton de tap principal + barre de combo animée par requestAnimationFrame.
 *
 *  - `phase = 'idle'`     : prêt à démarrer, bouton "Commencer"
 *  - `phase = 'playing'`  : on compte les taps, la barre descend en continu
 *  - `phase = 'submitting'` : envoi server action, attente
 *  - `phase = 'done'`     : écran de résultat
 */
export function TapGame({ canPlay }: { canPlay: boolean }) {
  const router = useRouter();
  const haptic = useHaptic();
  const [phase, setPhase] = useState<Phase>('idle');
  const [taps, setTaps] = useState(0);
  /** Combo en ms restants entre 0 et comboMs(level). Recharge sur tap. */
  const [comboRemaining, setComboRemaining] = useState(0);
  const [result, setResult] = useState<DoneResult | null>(null);
  const [pending, start] = useTransition();

  // Refs (pas de re-render) pour le loop d'animation
  const tapsRef = useRef(0);
  const lastTapAtRef = useRef(0);
  const startedAtRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const submittedRef = useRef(false);

  const currentLevel = levelFor(taps);
  const comboMaxMs = currentLevel.comboMs;
  const comboPct = Math.max(
    0,
    Math.min(100, (comboRemaining / comboMaxMs) * 100)
  );

  const finishRun = useCallback(() => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    const finalTaps = tapsRef.current;
    const duration = lastTapAtRef.current - startedAtRef.current;

    if (finalTaps < 2 || duration < 500) {
      // Trop court pour soumettre, on reset
      haptic.warning();
      toast({
        title: 'Run trop court',
        description: 'Enchaîne au moins 2 clics rapidement.',
      });
      setPhase('idle');
      submittedRef.current = false;
      return;
    }

    setPhase('submitting');
    start(async () => {
      const res = await submitTapRunAction({
        taps: finalTaps,
        durationMs: duration,
      });
      if (!res.success) {
        haptic.error();
        toast({
          title: 'Run rejeté',
          description: res.error,
          variant: 'destructive',
        });
        setPhase('idle');
        submittedRef.current = false;
        return;
      }
      haptic.success();
      setResult({
        taps: finalTaps,
        level: res.data.levelReached,
        xpAwarded: res.data.xpAwarded,
        newTotal: res.data.newTotal,
        runsLeftToday: res.data.runsLeftToday,
      });
      setPhase('done');
      router.refresh();
    });
  }, [haptic, router]);

  // Loop : décrémente comboRemaining chaque frame, déclenche finishRun à 0
  useEffect(() => {
    if (phase !== 'playing') return;
    let lastTs = performance.now();
    const tick = (ts: number) => {
      const dt = ts - lastTs;
      lastTs = ts;
      setComboRemaining((r) => {
        const next = r - dt;
        if (next <= 0) {
          finishRun();
          return 0;
        }
        return next;
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [phase, finishRun]);

  function handleTap() {
    if (phase === 'idle') {
      // Démarrage : 1er tap initie le run
      if (!canPlay) return;
      tapsRef.current = 1;
      startedAtRef.current = performance.now();
      lastTapAtRef.current = startedAtRef.current;
      submittedRef.current = false;
      setTaps(1);
      setComboRemaining(ROOT_LEVEL.comboMs);
      setPhase('playing');
      haptic.impact('light');
      return;
    }
    if (phase === 'playing') {
      const now = performance.now();
      tapsRef.current += 1;
      lastTapAtRef.current = now;
      setTaps(tapsRef.current);
      const lvl = levelFor(tapsRef.current);
      // Recharge le combo à fond
      setComboRemaining(lvl.comboMs);
      haptic.selection();
    }
  }

  function reset() {
    setResult(null);
    setTaps(0);
    setComboRemaining(0);
    submittedRef.current = false;
    setPhase('idle');
  }

  // ===== RENDER =====

  if (!canPlay && phase === 'idle') {
    return (
      <div className="glass-strong rounded-[var(--radius-lg)] p-6 text-center space-y-3">
        <h3 className="font-serif text-xl">Plus de runs aujourd&apos;hui</h3>
        <p className="text-sm text-[var(--color-text-dim)]">
          Reviens demain pour 3 nouveaux essais.
        </p>
      </div>
    );
  }

  if (phase === 'done' && result) {
    const tier =
      LEVELS.find((l) => l.level === result.level) ?? ROOT_LEVEL;
    return (
      <div className="glass-strong rounded-[var(--radius-lg)] p-8 text-center space-y-4 max-w-md mx-auto">
        <div className="text-6xl">{tier.icon}</div>
        <h3 className="font-serif text-3xl">
          Niveau {result.level}{' '}
          <span className="text-[var(--color-text-dim)] text-base">
            ({tier.label})
          </span>
        </h3>
        <div className="flex justify-center gap-6 py-3">
          <Stat label="Taps" value={result.taps} />
          <Stat label="XP gagné" value={`+${result.xpAwarded}`} accent />
          <Stat label="Total" value={result.newTotal} />
        </div>
        <div className="text-xs text-[var(--color-text-faint)]">
          {result.runsLeftToday > 0
            ? `Il te reste ${result.runsLeftToday} run${
                result.runsLeftToday > 1 ? 's' : ''
              } aujourd'hui.`
            : 'Tu as utilisé tous tes runs du jour.'}
        </div>
        {result.runsLeftToday > 0 ? (
          <Button onClick={reset} size="lg" className="w-full gap-2">
            <Zap className="h-4 w-4" />
            Nouveau run
          </Button>
        ) : (
          <Button
            onClick={() => router.push('/jeux')}
            size="lg"
            variant="secondary"
            className="w-full"
          >
            Retour aux jeux
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-md mx-auto">
      {/* Indicateur niveau + compteur taps */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{currentLevel.icon}</span>
          <div>
            <div className="text-xs uppercase tracking-wider text-[var(--color-text-faint)]">
              Niveau {currentLevel.level}
            </div>
            <div className="text-sm font-medium">{currentLevel.label}</div>
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono text-3xl font-bold tabular-nums">
            {taps}
          </div>
          <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-faint)]">
            taps
          </div>
        </div>
      </div>

      {/* Barre de combo */}
      <div className="space-y-1">
        <div className="h-2.5 bg-[var(--color-surface-tint)] rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full transition-[width] duration-75 ease-linear',
              comboPct > 60
                ? 'bg-gradient-to-r from-emerald-500 to-emerald-400'
                : comboPct > 30
                ? 'bg-gradient-to-r from-amber-500 to-amber-400'
                : 'bg-gradient-to-r from-rose-500 to-rose-400'
            )}
            style={{ width: `${comboPct}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-[var(--color-text-faint)] uppercase tracking-wider">
          <span>Combo</span>
          <span>{phase === 'playing' ? `${(comboMaxMs / 1000).toFixed(1)}s entre taps` : 'Prêt'}</span>
        </div>
      </div>

      {/* Bouton de tap */}
      <button
        type="button"
        onClick={handleTap}
        disabled={phase === 'submitting'}
        className={cn(
          'w-full aspect-square rounded-[var(--radius-lg)] relative overflow-hidden select-none transition-transform',
          'flex items-center justify-center gap-3 text-xl font-serif',
          'border-2 shadow-2xl',
          phase === 'playing'
            ? 'border-amber-500/50 bg-gradient-to-br from-amber-500/20 via-rose-500/10 to-indigo-500/20 active:scale-95'
            : phase === 'submitting'
            ? 'border-[var(--color-border-strong)] bg-[var(--color-surface-tint)] opacity-60'
            : 'border-amber-500/50 bg-gradient-to-br from-amber-500/15 to-pink-500/15 hover:from-amber-500/25 hover:to-pink-500/25 active:scale-95'
        )}
      >
        {phase === 'submitting' ? (
          <>
            <Loader2 className="h-6 w-6 animate-spin" />
            <span>Soumission…</span>
          </>
        ) : phase === 'idle' ? (
          <>
            <MousePointer2 className="h-6 w-6" />
            <span>Commencer</span>
          </>
        ) : (
          <span className="font-mono text-4xl font-bold">TAP</span>
        )}

        {/* Halo de combo en arrière-plan, intensité = niveau */}
        {phase === 'playing' && currentLevel.level >= 2 && (
          <div
            className="pointer-events-none absolute inset-0 rounded-[var(--radius-lg)]"
            style={{
              boxShadow: `inset 0 0 ${20 + currentLevel.level * 8}px rgba(245, 158, 11, ${
                0.15 + currentLevel.level * 0.08
              })`,
            }}
          />
        )}
      </button>

      <p className="text-[10px] text-center text-[var(--color-text-faint)] uppercase tracking-wider">
        {phase === 'playing'
          ? 'Garde la barre verte — tape plus vite'
          : phase === 'idle'
          ? 'Le premier clic démarre le run'
          : ''}
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
}) {
  return (
    <div>
      <div
        className={cn(
          'font-mono text-2xl font-semibold tabular-nums',
          accent && 'text-amber-300'
        )}
      >
        {value}
      </div>
      <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-faint)]">
        {label}
      </div>
    </div>
  );
}
