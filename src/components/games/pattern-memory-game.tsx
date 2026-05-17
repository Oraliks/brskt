'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  CheckCircle2,
  Eye,
  Loader2,
  Play,
  Sparkles,
  Timer,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { useHaptic } from '@/components/mini/telegram-webapp';
import { submitPatternMemoryAction } from '@/lib/actions/games';
import { cn } from '@/lib/utils';

interface PatternData {
  id: number;
  label: string;
  points: Array<[number, number]>;
}

interface SessionPattern extends PatternData {
  name: string;
  description: string;
}

interface Props {
  patterns: SessionPattern[];
  allPatterns: PatternData[];
}

type Phase =
  | { kind: 'intro' }
  | { kind: 'showing'; index: number }
  | { kind: 'quiz'; slot: number; answers: number[] }
  | {
      kind: 'result';
      score: number;
      xpAwarded: number;
      newTotal: number;
      correctIds: number[];
      userAnswers: number[];
    };

const SHOW_DURATION_MS = 3000;

export function PatternMemoryGame({ patterns, allPatterns }: Props) {
  const router = useRouter();
  const haptic = useHaptic();
  const [phase, setPhase] = useState<Phase>({ kind: 'intro' });
  const [pending, start] = useTransition();

  // Auto-advance pendant la phase "showing"
  useEffect(() => {
    if (phase.kind !== 'showing') return;
    const isLast = phase.index >= patterns.length - 1;
    const t = setTimeout(() => {
      haptic.selection();
      if (isLast) {
        setPhase({ kind: 'quiz', slot: 0, answers: [] });
      } else {
        setPhase({ kind: 'showing', index: phase.index + 1 });
      }
    }, SHOW_DURATION_MS);
    return () => clearTimeout(t);
  }, [phase, patterns.length, haptic]);

  function startGame() {
    haptic.impact('light');
    setPhase({ kind: 'showing', index: 0 });
  }

  function pickAnswer(patternId: number) {
    if (phase.kind !== 'quiz') return;
    haptic.selection();
    const newAnswers = [...phase.answers, patternId];
    if (newAnswers.length < patterns.length) {
      setPhase({ kind: 'quiz', slot: phase.slot + 1, answers: newAnswers });
      return;
    }
    // Submit
    haptic.impact('medium');
    start(async () => {
      const res = await submitPatternMemoryAction({
        patternsShown: patterns.map((p) => p.id),
        answers: newAnswers,
      });
      if (!res.success) {
        haptic.error();
        toast({
          title: 'Erreur',
          description: res.error,
          variant: 'destructive',
        });
        setPhase({ kind: 'intro' });
        return;
      }
      haptic.success();
      toast({
        title: `🃏 Score : ${res.data.score}/${patterns.length}`,
        description: `+${res.data.xpAwarded} XP · Nouveau total ${res.data.newTotal} XP`,
      });
      setPhase({
        kind: 'result',
        score: res.data.score,
        xpAwarded: res.data.xpAwarded,
        newTotal: res.data.newTotal,
        correctIds: res.data.correctIds,
        userAnswers: newAnswers,
      });
    });
  }

  if (pending) {
    return (
      <div className="glass-strong rounded-[var(--radius-lg)] p-12 text-center space-y-3">
        <Loader2 className="h-10 w-10 mx-auto animate-spin text-[var(--color-accent-hover)]" />
        <p className="text-sm text-[var(--color-text-dim)]">
          On compte ton score…
        </p>
      </div>
    );
  }

  if (phase.kind === 'intro') {
    return (
      <div className="glass-strong rounded-[var(--radius-lg)] p-8 text-center space-y-5 max-w-2xl mx-auto">
        <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500/30 to-pink-500/20">
          <Eye className="h-8 w-8 text-indigo-300" />
        </span>
        <div>
          <h3 className="font-serif text-2xl">Prêt à mémoriser ?</h3>
          <p className="text-sm text-[var(--color-text-dim)] mt-2 max-w-md mx-auto">
            On va te montrer {patterns.length} patterns, 3 secondes chacun.
            Concentre-toi sur la forme et le nom — tu devras les replacer
            ensuite.
          </p>
        </div>
        <Button size="lg" onClick={startGame}>
          <Play className="h-4 w-4 mr-2" />
          Commencer
        </Button>
      </div>
    );
  }

  if (phase.kind === 'showing') {
    const current = patterns[phase.index];
    if (!current) return null;
    return (
      <div className="space-y-5 max-w-3xl mx-auto">
        <ProgressBar
          current={phase.index + 1}
          total={patterns.length}
          accentText="Mémorise"
        />
        <div className="glass-strong rounded-[var(--radius-lg)] p-6 space-y-4">
          <div className="flex items-baseline justify-between">
            <div className="text-xs uppercase tracking-wider text-[var(--color-text-faint)]">
              Pattern #{phase.index + 1} / {patterns.length}
            </div>
            <CountdownPill key={phase.index} durationMs={SHOW_DURATION_MS} />
          </div>
          <PatternSvg points={current.points} large />
          <div className="text-center space-y-1">
            <div className="font-serif text-2xl">{current.label}</div>
            <p className="text-xs text-[var(--color-text-dim)] max-w-md mx-auto">
              {current.description}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (phase.kind === 'quiz') {
    const slotIndex = phase.slot;
    const correctPattern = patterns[slotIndex];
    if (!correctPattern) return null;
    const options = buildQuizOptions(correctPattern, allPatterns, slotIndex);
    return (
      <div className="space-y-5 max-w-3xl mx-auto">
        <ProgressBar
          current={slotIndex + 1}
          total={patterns.length}
          accentText="Quiz"
        />
        <div className="glass-strong rounded-[var(--radius-lg)] p-6 space-y-5">
          <h3 className="font-serif text-2xl">
            Quel pattern était en{' '}
            <span className="italic">position #{slotIndex + 1}</span> ?
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {options.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => pickAnswer(opt.id)}
                className={cn(
                  'group glass rounded-[var(--radius-md)] p-3 text-left transition-all',
                  'border-2 border-[var(--color-border)] hover:border-indigo-500/60 hover:-translate-y-0.5 active:scale-[0.98]'
                )}
              >
                <PatternSvg points={opt.points} />
                <div className="mt-2 text-sm font-medium">{opt.label}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (phase.kind === 'result') {
    return (
      <div className="space-y-4 max-w-3xl mx-auto">
        <div className="glass-strong rounded-[var(--radius-lg)] p-6 text-center space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-500/20 to-pink-500/20 border border-[var(--color-border-strong)] px-4 py-2">
            <Sparkles className="h-4 w-4 text-amber-300" />
            <span className="font-serif text-xl">
              {phase.score}/{patterns.length}
            </span>
            <span className="text-xs text-[var(--color-text-dim)]">
              · +{phase.xpAwarded} XP
            </span>
          </div>
          <p className="text-sm text-[var(--color-text-dim)] max-w-md mx-auto">
            Reviens demain pour un nouveau set.
          </p>
        </div>
        <div className="glass rounded-[var(--radius-lg)] p-4 space-y-3">
          <div className="text-xs uppercase tracking-wider text-[var(--color-text-faint)]">
            Correction
          </div>
          <div className="grid gap-2">
            {patterns.map((p, i) => {
              const userId = phase.userAnswers[i];
              const correct = userId === p.id;
              const userPattern = allPatterns.find((q) => q.id === userId);
              return (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded-md bg-[var(--color-surface-tint)] p-2"
                >
                  <span className="text-xs font-mono text-[var(--color-text-faint)] w-6">
                    #{i + 1}
                  </span>
                  {correct ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                  ) : (
                    <XCircle className="h-4 w-4 text-rose-400 flex-shrink-0" />
                  )}
                  <span className="text-sm flex-1">
                    {correct ? (
                      <span className="text-emerald-300">{p.label}</span>
                    ) : (
                      <>
                        <span className="text-rose-300 line-through">
                          {userPattern?.label ?? '—'}
                        </span>
                        <span className="text-[var(--color-text-dim)]"> → </span>
                        <span className="text-emerald-300">{p.label}</span>
                      </>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={() => router.push('/jeux')}
            className="rounded-full"
          >
            Retour aux jeux
          </Button>
        </div>
      </div>
    );
  }

  return null;
}

function PatternSvg({
  points,
  large = false,
}: {
  points: Array<[number, number]>;
  large?: boolean;
}) {
  const path = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`)
    .join(' ');
  return (
    <div
      className={cn(
        'w-full rounded-md bg-gradient-to-b from-[var(--color-surface-tint)] to-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center',
        large ? 'h-48 md:h-56' : 'h-24'
      )}
    >
      <svg viewBox="0 0 100 60" className="w-full h-full p-2">
        <path
          d={path}
          fill="none"
          stroke="url(#patternGrad)"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <defs>
          <linearGradient id="patternGrad" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#6366f1" />
            <stop offset="1" stopColor="#ec4899" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

function ProgressBar({
  current,
  total,
  accentText,
}: {
  current: number;
  total: number;
  accentText: string;
}) {
  const pct = (current / total) * 100;
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2 text-xs">
        <span className="text-[var(--color-text-faint)] uppercase tracking-wider">
          {accentText} · {current} / {total}
        </span>
      </div>
      <div className="h-1.5 bg-[var(--color-surface-tint)] rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-indigo-500 to-pink-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function CountdownPill({ durationMs }: { durationMs: number }) {
  const [remaining, setRemaining] = useState(Math.ceil(durationMs / 1000));
  useEffect(() => {
    if (remaining <= 0) return;
    const t = setTimeout(() => setRemaining(remaining - 1), 1000);
    return () => clearTimeout(t);
  }, [remaining]);
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-200 light:text-amber-800 px-2 py-0.5 text-[10px] uppercase tracking-wider font-semibold">
      <Timer className="h-3 w-3" />
      {Math.max(0, remaining)}s
    </span>
  );
}

/**
 * Construit 4 options pour le slot : le bon pattern + 3 distracteurs
 * pris parmi les autres patterns (pas forcément du run). Ordre randomisé
 * mais stable au sein d'un slot grâce au seed = pattern.id × slotIndex.
 */
function buildQuizOptions(
  correct: PatternData,
  all: PatternData[],
  slotIndex: number
): PatternData[] {
  const others = all.filter((p) => p.id !== correct.id);
  // Seed déterministe : on veut que les options ne changent pas si l'user
  // re-render le composant (par exemple haptics qui re-render).
  let seed = (correct.id * 7919 + slotIndex * 31) >>> 0;
  function rand(): number {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  }
  const shuffled = [...others];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const a = shuffled[i]!;
    const b = shuffled[j]!;
    shuffled[i] = b;
    shuffled[j] = a;
  }
  const picked = shuffled.slice(0, 3);
  const options = [correct, ...picked];
  // Shuffle again to randomize correct position
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const a = options[i]!;
    const b = options[j]!;
    options[i] = b;
    options[j] = a;
  }
  return options;
}
