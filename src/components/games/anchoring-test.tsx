'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Anchor,
  ArrowRight,
  Brain,
  Info,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { useHaptic } from '@/components/mini/telegram-webapp';
import { submitAnchoringAction } from '@/lib/actions/games';
import { cn } from '@/lib/utils';

interface AssignedQuestion {
  id: number;
  market: string;
  prompt: string;
  unit: '%' | '$' | '€' | 'pts';
  minAnswer: number;
  maxAnswer: number;
  center: number;
  anchor: { context: string; value: number; display: string };
  anchorVariant: 'high' | 'low';
}

export function AnchoringTest({ questions }: { questions: AssignedQuestion[] }) {
  const router = useRouter();
  const haptic = useHaptic();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<
    Array<{ questionId: number; anchorVariant: 'high' | 'low'; userValue: number }>
  >([]);
  const [draft, setDraft] = useState<string>('');
  const [pending, start] = useTransition();

  const total = questions.length;
  const progress = ((answers.length + (pending ? 1 : 0)) / (total + 1)) * 100;
  const q = questions[step];

  function submitStep() {
    if (!q) return;
    const value = parseFloat(draft.replace(',', '.'));
    if (!Number.isFinite(value) || value < q.minAnswer || value > q.maxAnswer) {
      haptic.error();
      toast({
        title: 'Valeur invalide',
        description: `Entre ${q.minAnswer} et ${q.maxAnswer} ${q.unit}.`,
        variant: 'destructive',
      });
      return;
    }
    haptic.selection();
    const next = [
      ...answers,
      { questionId: q.id, anchorVariant: q.anchorVariant, userValue: value },
    ];
    setAnswers(next);
    setDraft('');
    if (next.length < total) {
      setStep(step + 1);
    } else {
      haptic.impact('medium');
      start(async () => {
        const res = await submitAnchoringAction({ predictions: next });
        if (!res.success) {
          haptic.error();
          toast({
            title: 'Erreur',
            description: res.error,
            variant: 'destructive',
          });
          setAnswers([]);
          setStep(0);
          return;
        }
        haptic.success();
        toast({
          title: `⚓ Indice d'ancrage : ${res.data.anchoringIndex}/100`,
          description: `+${res.data.xpAwarded} XP · Nouveau total ${res.data.newTotal} XP`,
        });
        router.refresh();
      });
    }
  }

  if (pending) {
    return (
      <div className="glass-strong rounded-[var(--radius-lg)] p-12 text-center space-y-3">
        <Loader2 className="h-10 w-10 mx-auto animate-spin text-[var(--color-accent-hover)]" />
        <p className="text-sm text-[var(--color-text-dim)]">
          On calcule ton indice d&apos;ancrage…
        </p>
      </div>
    );
  }

  if (!q) return null;

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      <div>
        <div className="flex items-baseline justify-between mb-2 text-xs">
          <span className="text-[var(--color-text-faint)] uppercase tracking-wider">
            Question {step + 1} / {total}
          </span>
          <span className="text-[var(--color-accent-hover)]">
            {answers.length}/{total} répondu
          </span>
        </div>
        <div className="h-1.5 bg-[var(--color-surface-tint)] rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 to-pink-500 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="glass-strong rounded-[var(--radius-lg)] p-6 space-y-5">
        <div className="inline-flex items-center gap-2 text-xs uppercase tracking-wider text-[var(--color-text-faint)]">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500/30 to-pink-500/20">
            <Brain className="h-3.5 w-3.5 text-indigo-300" />
          </span>
          Marché : <span className="text-[var(--color-text)] not-italic">{q.market}</span>
        </div>

        <div className="rounded-md bg-[var(--color-surface-tint)] border border-[var(--color-border)] p-4 flex items-start gap-3">
          <Anchor className="h-5 w-5 text-amber-300 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-faint)] mb-1">
              Pour info
            </div>
            <p className="text-sm text-[var(--color-text-dim)]">{q.anchor.context}</p>
          </div>
          <span className="font-mono font-semibold text-amber-300 text-lg whitespace-nowrap">
            {q.anchor.display}
          </span>
        </div>

        <h3 className="font-serif text-2xl leading-tight">{q.prompt}</h3>

        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className="text-xs text-[var(--color-text-faint)] uppercase tracking-wider mb-1.5 block">
              Ta prédiction
            </label>
            <div className="flex items-center gap-2 rounded-md border-2 border-[var(--color-border-strong)] bg-[var(--color-surface)] focus-within:border-indigo-500/60 transition-colors">
              <input
                type="number"
                inputMode="decimal"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={`Entre ${q.minAnswer} et ${q.maxAnswer}`}
                className="flex-1 bg-transparent px-3 py-2.5 text-base font-mono outline-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submitStep();
                }}
              />
              <span className="text-sm text-[var(--color-text-dim)] pr-3 font-mono">
                {q.unit}
              </span>
            </div>
          </div>
          <Button onClick={submitStep} size="lg" className="h-12">
            {step + 1 === total ? 'Terminer' : 'Suivant'}
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </div>

        <div className="flex items-start gap-2 text-xs text-[var(--color-text-faint)] italic">
          <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
          La référence ci-dessus est arbitraire. Ne te fie qu&apos;à ton analyse.
        </div>
      </div>

      {answers.length > 0 && (
        <div className="flex flex-wrap gap-1 justify-center pt-3 border-t border-[var(--color-border)]">
          {answers.map((a, i) => (
            <span
              key={i}
              className={cn(
                'h-2 w-2 rounded-full',
                a.anchorVariant === 'high' ? 'bg-amber-400' : 'bg-sky-400'
              )}
              title={`Q${i + 1}: ${a.userValue}`}
            />
          ))}
          {Array.from({ length: total - answers.length }).map((_, i) => (
            <span
              key={`empty-${i}`}
              className="h-2 w-2 rounded-full bg-[var(--color-surface-tint-strong)]"
            />
          ))}
        </div>
      )}
    </div>
  );
}
