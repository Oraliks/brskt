'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Brain,
  Coins,
  Dices,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { useHaptic } from '@/components/mini/telegram-webapp';
import { submitLossAversionAction } from '@/lib/actions/games';
import { cn } from '@/lib/utils';

interface Question {
  id: number;
  safe: { label: string; value: number };
  lottery: { winLabel: string; loseLabel: string; expectedValue: number };
  context: string | null;
}

export function LossAversionTest({ questions }: { questions: Question[] }) {
  const router = useRouter();
  const haptic = useHaptic();
  const [step, setStep] = useState(0);
  const [choices, setChoices] = useState<Array<'safe' | 'lottery'>>([]);
  const [pending, start] = useTransition();

  const progress = ((step + (choices.length === questions.length ? 1 : 0)) /
    (questions.length + 1)) *
    100;

  function pickChoice(choice: 'safe' | 'lottery') {
    haptic.selection();
    const next = [...choices, choice];
    setChoices(next);
    if (next.length < questions.length) {
      setStep(step + 1);
    } else {
      // Submit
      haptic.impact('medium');
      start(async () => {
        const res = await submitLossAversionAction({ choices: next });
        if (!res.success) {
          haptic.error();
          toast({
            title: 'Erreur',
            description: res.error,
            variant: 'destructive',
          });
          // Reset
          setChoices([]);
          setStep(0);
          return;
        }
        haptic.success();
        toast({
          title: `🧠 λ = ${res.data.coefficient.toFixed(2)}`,
          description: `+250 XP · Nouveau total ${res.data.newTotal} XP`,
        });
        router.refresh();
      });
    }
  }

  function back() {
    if (step === 0) return;
    haptic.selection();
    setChoices(choices.slice(0, -1));
    setStep(step - 1);
  }

  if (pending) {
    return (
      <div className="glass-strong rounded-[var(--radius-lg)] p-12 text-center space-y-3">
        <Loader2 className="h-10 w-10 mx-auto animate-spin text-[var(--color-accent-hover)]" />
        <p className="text-sm text-[var(--color-text-dim)]">
          On calcule ton coefficient…
        </p>
      </div>
    );
  }

  const q = questions[step];
  if (!q) return null;

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      {/* Progress */}
      <div>
        <div className="flex items-baseline justify-between mb-2 text-xs">
          <span className="text-[var(--color-text-faint)] uppercase tracking-wider">
            Question {step + 1} / {questions.length}
          </span>
          <span className="text-[var(--color-accent-hover)]">
            {choices.length}/{questions.length} choix faits
          </span>
        </div>
        <div className="h-1.5 bg-[var(--color-surface-tint)] rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 to-pink-500 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Context */}
      {q.context && (
        <div className="inline-flex items-start gap-2 text-xs text-[var(--color-text-dim)] bg-[var(--color-surface-tint)] rounded-md px-3 py-2 italic">
          <Brain className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-indigo-300" />
          {q.context}
        </div>
      )}

      <h3 className="font-serif text-2xl">Tu choisis quoi ?</h3>

      {/* Choix */}
      <div className="grid gap-3 sm:grid-cols-2">
        <ChoiceCard
          onClick={() => pickChoice('safe')}
          icon={Coins}
          accent="emerald"
          label={q.safe.label}
          sub={`${q.safe.value}€ garanti`}
          tag="Option sûre"
        />
        <ChoiceCard
          onClick={() => pickChoice('lottery')}
          icon={Dices}
          accent="rose"
          label="Pari 50/50"
          sub={`${q.lottery.winLabel} · ${q.lottery.loseLabel}`}
          tag={`Espérance : ${q.lottery.expectedValue}€`}
        />
      </div>

      {/* Back */}
      {step > 0 && (
        <div className="flex justify-center">
          <Button variant="ghost" size="sm" onClick={back}>
            ← Revenir au choix précédent
          </Button>
        </div>
      )}

      {/* Indicateurs déjà répondus */}
      {choices.length > 0 && (
        <div className="flex flex-wrap gap-1 justify-center pt-3 border-t border-[var(--color-border)]">
          {choices.map((c, i) => (
            <span
              key={i}
              className={cn(
                'h-2 w-2 rounded-full',
                c === 'safe' ? 'bg-emerald-400' : 'bg-rose-400'
              )}
              title={`Q${i + 1}: ${c === 'safe' ? 'sûr' : 'loterie'}`}
            />
          ))}
          {Array.from({ length: questions.length - choices.length }).map(
            (_, i) => (
              <span
                key={`empty-${i}`}
                className="h-2 w-2 rounded-full bg-[var(--color-surface-tint-strong)]"
              />
            )
          )}
        </div>
      )}
    </div>
  );
}

function ChoiceCard({
  onClick,
  icon: Icon,
  accent,
  label,
  sub,
  tag,
}: {
  onClick: () => void;
  icon: React.ElementType;
  accent: 'emerald' | 'rose';
  label: string;
  sub: string;
  tag: string;
}) {
  const colorClass =
    accent === 'emerald'
      ? 'border-emerald-500/40 hover:border-emerald-400 hover:bg-emerald-500/10 text-emerald-300'
      : 'border-rose-500/40 hover:border-rose-400 hover:bg-rose-500/10 text-rose-300';

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group glass-strong rounded-[var(--radius-lg)] p-6 text-left transition-all',
        'border-2 hover:-translate-y-0.5 active:scale-[0.98]',
        colorClass
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <Icon className="h-7 w-7" />
        <span
          className={cn(
            'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider',
            accent === 'emerald'
              ? 'border-emerald-500/30 bg-emerald-500/10'
              : 'border-rose-500/30 bg-rose-500/10'
          )}
        >
          {tag}
        </span>
      </div>
      <div className="font-serif text-xl text-[var(--color-text)]">{label}</div>
      <div className="text-sm text-[var(--color-text-dim)] mt-1.5">{sub}</div>
      <div className="mt-4 inline-flex items-center gap-1.5 text-xs">
        <Sparkles className="h-3 w-3" />
        Choisir
      </div>
    </button>
  );
}
