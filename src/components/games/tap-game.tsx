'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react';
import { useRouter } from 'next/navigation';
import {
  Loader2,
  MousePointer2,
  Snowflake,
  Sparkles,
  Timer,
  X,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { useHaptic } from '@/components/mini/telegram-webapp';
import { submitTapRunAction } from '@/lib/actions/games';
import { cn } from '@/lib/utils';

// ============================================================
// Constantes du gameplay
// ============================================================

interface ClientLevel {
  level: number;
  minTaps: number;
  comboMs: number;
  label: string;
  icon: string;
  gradient: string;
}

const LEVELS: ClientLevel[] = [
  {
    level: 0,
    minTaps: 0,
    comboMs: 1500,
    label: '—',
    icon: '⚪',
    gradient: 'from-indigo-500/15 to-pink-500/15',
  },
  {
    level: 1,
    minTaps: 10,
    comboMs: 1200,
    label: 'Échauffé',
    icon: '🟢',
    gradient: 'from-emerald-500/25 to-emerald-700/20',
  },
  {
    level: 2,
    minTaps: 25,
    comboMs: 1000,
    label: 'Rythme',
    icon: '🟡',
    gradient: 'from-amber-400/30 to-amber-600/20',
  },
  {
    level: 3,
    minTaps: 50,
    comboMs: 800,
    label: 'Combo',
    icon: '🟠',
    gradient: 'from-orange-500/35 to-rose-500/25',
  },
  {
    level: 4,
    minTaps: 100,
    comboMs: 650,
    label: 'Furie',
    icon: '🔴',
    gradient: 'from-rose-500/40 to-purple-600/30',
  },
  {
    level: 5,
    minTaps: 200,
    comboMs: 500,
    label: 'Légende',
    icon: '🟣',
    gradient: 'from-purple-500/50 to-fuchsia-600/40',
  },
];

const ROOT_LEVEL: ClientLevel = LEVELS[0]!;

function levelFor(taps: number): ClientLevel {
  let best = ROOT_LEVEL;
  for (const l of LEVELS) {
    if (taps >= l.minTaps) best = l;
    else break;
  }
  return best;
}

/** Durée du mode burst (ms). Doit matcher la validation serveur. */
const BURST_DURATION_MS = 10000;

/** Délai entre 2 spawns de power-up (random dans cette range). */
const POWERUP_SPAWN_MIN_MS = 10000;
const POWERUP_SPAWN_MAX_MS = 18000;
/** Durée de vie d'un power-up à l'écran avant disparition. */
const POWERUP_TTL_MS = 4500;
/** Durée de freeze sur tap power-up. */
const POWERUP_FREEZE_MS = 3000;

// ============================================================
// Types UI
// ============================================================

type Phase = 'idle' | 'playing' | 'submitting' | 'done';
type Mode = 'combo' | 'burst';

interface FloatingNumber {
  id: number;
  x: number; // % within tap area
  y: number;
  variant: 'tap' | 'level';
  text: string;
}

interface Powerup {
  id: number;
  type: 'freeze' | 'boost';
  x: number;
  y: number;
  spawnedAt: number;
}

interface DoneResult {
  taps: number;
  level: number;
  xpAwarded: number;
  bonusXp: number;
  newTotal: number;
  runsLeftToday: number;
  challengeCompleted: boolean;
  mode: Mode;
}

// ============================================================
// Composant principal
// ============================================================

interface TapGameProps {
  canPlay: boolean;
  config: { hasComboUpgrade: boolean; hasDrainUpgrade: boolean };
}

export function TapGame({ canPlay, config }: TapGameProps) {
  const router = useRouter();
  const haptic = useHaptic();
  const [phase, setPhase] = useState<Phase>('idle');
  const [mode, setMode] = useState<Mode>('combo');
  const [taps, setTaps] = useState(0);
  const [comboRemaining, setComboRemaining] = useState(0);
  const [burstTimeLeft, setBurstTimeLeft] = useState(BURST_DURATION_MS);
  const [floatingNumbers, setFloatingNumbers] = useState<FloatingNumber[]>([]);
  const [activePowerup, setActivePowerup] = useState<Powerup | null>(null);
  const [rhythmActive, setRhythmActive] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);
  const [result, setResult] = useState<DoneResult | null>(null);
  const [, start] = useTransition();

  // Refs (pas de re-render)
  const tapsRef = useRef(0);
  const lastTapAtRef = useRef(0);
  const startedAtRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const submittedRef = useRef(false);
  const intervalsRef = useRef<number[]>([]);
  const frozenUntilRef = useRef(0);
  const nextPowerupAtRef = useRef(0);
  const floatingIdRef = useRef(0);
  const powerupIdRef = useRef(0);
  const lastLevelRef = useRef(0);

  // Bonus appliqués par les upgrades (factor multiplicatif)
  const comboMultiplier = config.hasComboUpgrade ? 1.2 : 1;
  const drainMultiplier = config.hasDrainUpgrade ? 0.8 : 1;

  const currentLevel = useMemo(() => levelFor(taps), [taps]);
  const comboMaxMs = currentLevel.comboMs * comboMultiplier;
  const comboPct = Math.max(
    0,
    Math.min(100, (comboRemaining / comboMaxMs) * 100)
  );

  // ============================================================
  // Helpers
  // ============================================================

  function spawnFloating(variant: 'tap' | 'level', text: string) {
    const id = ++floatingIdRef.current;
    const x = 35 + Math.random() * 30; // centre du bouton
    const y = variant === 'level' ? 40 : 50 + Math.random() * 30;
    setFloatingNumbers((arr) => [...arr, { id, x, y, variant, text }]);
    setTimeout(() => {
      setFloatingNumbers((arr) => arr.filter((f) => f.id !== id));
    }, variant === 'level' ? 1400 : 800);
  }

  function spawnPowerup() {
    const id = ++powerupIdRef.current;
    const type = Math.random() < 0.55 ? 'freeze' : 'boost';
    const x = 15 + Math.random() * 70;
    const y = 15 + Math.random() * 70;
    setActivePowerup({ id, type, x, y, spawnedAt: performance.now() });
  }

  function triggerShake() {
    setShakeKey((k) => k + 1);
  }

  const finishRun = useCallback(
    (effectiveMode: Mode) => {
      if (submittedRef.current) return;
      submittedRef.current = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);

      const finalTaps = tapsRef.current;
      let duration = lastTapAtRef.current - startedAtRef.current;
      // Mode burst : durée fixée à BURST_DURATION_MS
      if (effectiveMode === 'burst') {
        duration = BURST_DURATION_MS;
      }

      if (finalTaps < 2 || duration < 500) {
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
          mode: effectiveMode,
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
          bonusXp: res.data.bonusXp,
          newTotal: res.data.newTotal,
          runsLeftToday: res.data.runsLeftToday,
          challengeCompleted: res.data.challengeCompleted,
          mode: effectiveMode,
        });
        setPhase('done');
        router.refresh();
      });
    },
    [haptic, router]
  );

  // ============================================================
  // Boucle d'animation
  // ============================================================

  useEffect(() => {
    if (phase !== 'playing') return;
    let lastTs = performance.now();
    nextPowerupAtRef.current =
      performance.now() +
      POWERUP_SPAWN_MIN_MS +
      Math.random() * (POWERUP_SPAWN_MAX_MS - POWERUP_SPAWN_MIN_MS);

    const tick = (ts: number) => {
      const dt = ts - lastTs;
      lastTs = ts;

      if (mode === 'combo') {
        // Drain combo (sauf si frozen)
        if (ts > frozenUntilRef.current) {
          setComboRemaining((r) => {
            const next = r - dt * drainMultiplier;
            if (next <= 0) {
              finishRun('combo');
              return 0;
            }
            return next;
          });
        }
      } else {
        // Mode burst : countdown
        setBurstTimeLeft((t) => {
          const next = t - dt;
          if (next <= 0) {
            finishRun('burst');
            return 0;
          }
          return next;
        });
      }

      // Spawn de power-up
      if (
        mode === 'combo' &&
        !activePowerup &&
        ts >= nextPowerupAtRef.current
      ) {
        spawnPowerup();
        nextPowerupAtRef.current =
          ts +
          POWERUP_SPAWN_MIN_MS +
          Math.random() * (POWERUP_SPAWN_MAX_MS - POWERUP_SPAWN_MIN_MS);
      }

      // Expire le power-up actuel s'il a TTL dépassé
      if (activePowerup && ts - activePowerup.spawnedAt > POWERUP_TTL_MS) {
        setActivePowerup(null);
      }

      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [phase, mode, activePowerup, drainMultiplier, finishRun]);

  // ============================================================
  // Détection level-up (déclenche shake + particles)
  // ============================================================

  useEffect(() => {
    if (phase !== 'playing') return;
    if (currentLevel.level > lastLevelRef.current && currentLevel.level > 0) {
      lastLevelRef.current = currentLevel.level;
      triggerShake();
      haptic.impact('heavy');
      spawnFloating('level', `${currentLevel.icon} Niveau ${currentLevel.level}`);
    }
  }, [currentLevel.level, phase, haptic]);

  // ============================================================
  // Handlers
  // ============================================================

  function startRun() {
    if (!canPlay) return;
    tapsRef.current = 0;
    lastTapAtRef.current = performance.now();
    startedAtRef.current = performance.now();
    intervalsRef.current = [];
    frozenUntilRef.current = 0;
    submittedRef.current = false;
    lastLevelRef.current = 0;
    setTaps(0);
    setComboRemaining(ROOT_LEVEL.comboMs * comboMultiplier);
    setBurstTimeLeft(BURST_DURATION_MS);
    setActivePowerup(null);
    setFloatingNumbers([]);
    setRhythmActive(false);
    setPhase('playing');
    haptic.impact('light');
  }

  function handleTap() {
    if (phase === 'idle') {
      startRun();
      return;
    }
    if (phase !== 'playing') return;

    const now = performance.now();
    const interval = now - lastTapAtRef.current;
    tapsRef.current += 1;
    lastTapAtRef.current = now;

    // Track intervals pour rythme
    if (interval > 50 && interval < 2000) {
      intervalsRef.current.push(interval);
      if (intervalsRef.current.length > 5) intervalsRef.current.shift();
    }

    // Détection rythme : 4+ intervalles consécutifs avec variance faible
    if (intervalsRef.current.length >= 4) {
      const arr = intervalsRef.current;
      const mean = arr.reduce((s, v) => s + v, 0) / arr.length;
      const variance =
        arr.reduce((s, v) => s + (v - mean) ** 2, 0) / arr.length;
      const stddev = Math.sqrt(variance);
      const isRhythm = stddev < 60 && mean < 700;
      setRhythmActive(isRhythm);
    }

    setTaps(tapsRef.current);

    if (mode === 'combo') {
      // Refill combo
      const lvl = levelFor(tapsRef.current);
      setComboRemaining(lvl.comboMs * comboMultiplier);
    }

    spawnFloating('tap', '+1');
    haptic.selection();
  }

  function usePowerup() {
    if (!activePowerup) return;
    const type = activePowerup.type;
    setActivePowerup(null);
    haptic.success();
    if (type === 'freeze') {
      frozenUntilRef.current = performance.now() + POWERUP_FREEZE_MS;
      toast({ title: '❄️ Freeze 3s' });
    } else {
      const lvl = levelFor(tapsRef.current);
      setComboRemaining(lvl.comboMs * comboMultiplier);
      toast({ title: '⚡ Boost — combo plein' });
    }
  }

  function reset() {
    setResult(null);
    setTaps(0);
    setComboRemaining(0);
    setBurstTimeLeft(BURST_DURATION_MS);
    submittedRef.current = false;
    lastLevelRef.current = 0;
    setPhase('idle');
  }

  function quitRun() {
    // Force la soumission immédiate (équivalent à un combo cassé)
    finishRun(mode);
  }

  // ============================================================
  // Render — états spéciaux
  // ============================================================

  if (!canPlay && phase === 'idle') {
    return (
      <div className="glass-strong rounded-[var(--radius-lg)] p-6 text-center space-y-3 max-w-md mx-auto">
        <h3 className="font-serif text-xl">Plus de runs aujourd&apos;hui</h3>
        <p className="text-sm text-[var(--color-text-dim)]">
          Reviens demain pour 3 nouveaux essais.
        </p>
      </div>
    );
  }

  if (phase === 'done' && result) {
    const tier = LEVELS.find((l) => l.level === result.level) ?? ROOT_LEVEL;
    return (
      <div className="glass-strong rounded-[var(--radius-lg)] p-8 text-center space-y-4 max-w-md mx-auto">
        <div className="text-6xl">{tier.icon}</div>
        <h3 className="font-serif text-3xl">
          {result.mode === 'burst' ? 'Burst' : `Niveau ${result.level}`}{' '}
          <span className="text-[var(--color-text-dim)] text-base">
            ({tier.label})
          </span>
        </h3>
        <div className="flex justify-center gap-6 py-3">
          <Stat label="Taps" value={result.taps} />
          <Stat label="XP gagné" value={`+${result.xpAwarded}`} accent />
          <Stat label="Total" value={result.newTotal} />
        </div>
        {result.challengeCompleted && (
          <div className="rounded-md bg-amber-500/15 border border-amber-500/30 px-3 py-2 text-sm text-amber-200 inline-flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Défi du jour réussi · +{result.bonusXp} XP bonus
          </div>
        )}
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

  // ============================================================
  // Render — mode IDLE (avant run)
  // ============================================================

  if (phase === 'idle' || phase === 'submitting') {
    return (
      <div className="space-y-4 max-w-md mx-auto">
        {/* Toggle mode */}
        <div className="inline-flex rounded-full bg-[var(--color-surface-tint)] p-1 mx-auto block w-fit">
          <ModeButton
            active={mode === 'combo'}
            onClick={() => setMode('combo')}
            label="Combo"
            sub="Sans casser"
          />
          <ModeButton
            active={mode === 'burst'}
            onClick={() => setMode('burst')}
            label="Burst"
            sub="10 sec"
          />
        </div>

        {/* Bouton de start */}
        <button
          type="button"
          onClick={handleTap}
          disabled={phase === 'submitting'}
          className={cn(
            'w-full aspect-square rounded-[var(--radius-lg)] relative overflow-hidden select-none transition-transform',
            'flex flex-col items-center justify-center gap-2 text-xl font-serif',
            'border-2 shadow-2xl border-amber-500/50',
            'bg-gradient-to-br from-amber-500/15 to-pink-500/15 hover:from-amber-500/25 hover:to-pink-500/25 active:scale-95'
          )}
          style={{ touchAction: 'manipulation' }}
        >
          {phase === 'submitting' ? (
            <>
              <Loader2 className="h-6 w-6 animate-spin" />
              <span>Soumission…</span>
            </>
          ) : (
            <>
              <MousePointer2 className="h-8 w-8" />
              <span>Commencer</span>
              <span className="text-xs font-sans text-[var(--color-text-dim)]">
                {mode === 'combo'
                  ? 'Tape sans laisser passer la barre'
                  : '10 secondes pour taper le maximum'}
              </span>
            </>
          )}
        </button>

        {/* Indicateurs upgrades actifs */}
        {(config.hasComboUpgrade || config.hasDrainUpgrade) && (
          <div className="flex flex-wrap justify-center gap-2 text-[10px]">
            {config.hasComboUpgrade && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 px-2 py-0.5">
                ⏱️ Combo +20%
              </span>
            )}
            {config.hasDrainUpgrade && (
              <span className="inline-flex items-center gap-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 px-2 py-0.5">
                🛡️ Drain -20%
              </span>
            )}
          </div>
        )}
      </div>
    );
  }

  // ============================================================
  // Render — mode PLAYING (fullscreen focus)
  // ============================================================

  return (
    <div
      className={cn(
        'fixed inset-0 z-[100] bg-[var(--color-bg)] flex flex-col p-4',
        'transition-colors duration-500'
      )}
      style={{ touchAction: 'manipulation' }}
    >
      {/* Background gradient by level */}
      <div
        className={cn(
          'absolute inset-0 -z-10 bg-gradient-to-br transition-opacity duration-500',
          currentLevel.gradient
        )}
      />

      {/* Top bar : niveau + compteur + quit */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{currentLevel.icon}</span>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-faint)]">
              Niveau {currentLevel.level}
            </div>
            <div className="text-sm font-medium">{currentLevel.label}</div>
          </div>
          {rhythmActive && (
            <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-[10px] text-amber-200">
              🎵 Rythme
            </span>
          )}
        </div>
        <div className="text-right">
          <div className="font-mono text-4xl font-bold tabular-nums">
            {taps}
          </div>
          <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-faint)]">
            taps {mode === 'combo' && currentLevel.level >= 1 ? `· ×${currentLevel.level}` : ''}
          </div>
        </div>
        <button
          type="button"
          onClick={quitRun}
          aria-label="Arrêter le run"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-[var(--color-surface-tint)] text-[var(--color-text-dim)]"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Barre combo (mode combo) ou timer (mode burst) */}
      {mode === 'combo' ? (
        <div className="space-y-1 mb-4">
          <div className="h-3 bg-[var(--color-surface-tint)] rounded-full overflow-hidden">
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
            <span>{(comboMaxMs / 1000).toFixed(1)}s max</span>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center gap-2 mb-4 text-3xl font-mono tabular-nums">
          <Timer className="h-6 w-6 text-amber-300" />
          <span
            className={cn(
              burstTimeLeft < 3000 ? 'text-rose-300' : 'text-amber-200'
            )}
          >
            {(burstTimeLeft / 1000).toFixed(1)}s
          </span>
        </div>
      )}

      {/* Zone de jeu : bouton tap + floating numbers + power-up */}
      <div className="flex-1 relative">
        <button
          key={shakeKey}
          type="button"
          onClick={handleTap}
          className={cn(
            'absolute inset-0 rounded-[var(--radius-lg)] select-none',
            'flex items-center justify-center font-mono font-bold',
            'border-2 border-amber-500/50 active:scale-[0.98] transition-transform',
            'bg-gradient-to-br from-amber-500/20 via-rose-500/10 to-indigo-500/20',
            'shadow-[0_0_60px_-10px_rgba(245,158,11,0.4)]',
            shakeKey > 0 && 'animate-tap-shake'
          )}
          style={{
            touchAction: 'manipulation',
            boxShadow:
              currentLevel.level >= 2
                ? `inset 0 0 ${30 + currentLevel.level * 12}px rgba(245, 158, 11, ${
                    0.2 + currentLevel.level * 0.08
                  })`
                : undefined,
          }}
        >
          <span className="text-5xl sm:text-7xl">TAP</span>

          {/* Floating numbers */}
          {floatingNumbers.map((f) => (
            <span
              key={f.id}
              className={cn(
                'pointer-events-none absolute font-bold whitespace-nowrap',
                f.variant === 'tap'
                  ? 'text-amber-200 text-2xl animate-tap-float'
                  : 'text-amber-300 text-base animate-tap-levelup'
              )}
              style={{
                left: `${f.x}%`,
                top: `${f.y}%`,
                transform: 'translate(-50%, -50%)',
              }}
            >
              {f.text}
            </span>
          ))}
        </button>

        {/* Power-up overlay */}
        {activePowerup && mode === 'combo' && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              usePowerup();
            }}
            aria-label={`Activer ${activePowerup.type}`}
            className={cn(
              'absolute z-10 h-14 w-14 rounded-full flex items-center justify-center',
              'animate-tap-powerup shadow-xl border-2',
              activePowerup.type === 'freeze'
                ? 'bg-sky-500 border-sky-200 text-white'
                : 'bg-amber-500 border-amber-200 text-white'
            )}
            style={{
              left: `${activePowerup.x}%`,
              top: `${activePowerup.y}%`,
              transform: 'translate(-50%, -50%)',
            }}
          >
            {activePowerup.type === 'freeze' ? (
              <Snowflake className="h-6 w-6" />
            ) : (
              <Zap className="h-6 w-6" />
            )}
          </button>
        )}
      </div>

      <p className="text-[10px] text-center text-[var(--color-text-faint)] uppercase tracking-wider mt-2">
        {mode === 'combo'
          ? 'Garde la barre verte — power-ups : ❄️ freeze / ⚡ boost'
          : 'Tape un max — chaque ms compte'}
      </p>
    </div>
  );
}

// ============================================================
// Sous-composants
// ============================================================

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

function ModeButton({
  active,
  onClick,
  label,
  sub,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  sub: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'px-4 py-1.5 text-sm rounded-full transition-colors',
        active
          ? 'bg-[var(--color-bg-elevated)] text-[var(--color-text)] shadow-sm'
          : 'text-[var(--color-text-dim)] hover:text-[var(--color-text)]'
      )}
    >
      <span className="block">{label}</span>
      <span className="block text-[10px] text-[var(--color-text-faint)]">
        {sub}
      </span>
    </button>
  );
}
