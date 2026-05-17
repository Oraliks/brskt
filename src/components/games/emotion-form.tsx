'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Loader2, Save, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { useHaptic } from '@/components/mini/telegram-webapp';
import { submitEmotionEntryAction } from '@/lib/actions/games';
import { cn } from '@/lib/utils';

interface Props {
  alreadyToday: boolean;
  todayMood: number;
}

const MOOD_LABELS: Record<number, { emoji: string; label: string }> = {
  1: { emoji: '😰', label: 'Très anxieux' },
  2: { emoji: '😟', label: 'Inquiet' },
  3: { emoji: '😕', label: 'Préoccupé' },
  4: { emoji: '😐', label: 'Plat' },
  5: { emoji: '🙂', label: 'Neutre' },
  6: { emoji: '😌', label: 'Calme' },
  7: { emoji: '😊', label: 'Confiant' },
  8: { emoji: '😄', label: 'Motivé' },
  9: { emoji: '🚀', label: 'En forme' },
  10: { emoji: '🔥', label: 'Au top' },
};

export function EmotionForm({ alreadyToday, todayMood }: Props) {
  const router = useRouter();
  const haptic = useHaptic();
  const [mood, setMood] = useState<number>(todayMood);
  const [note, setNote] = useState('');
  const [pending, start] = useTransition();

  const current = MOOD_LABELS[mood] ?? MOOD_LABELS[5];

  function submit() {
    haptic.impact('medium');
    start(async () => {
      const result = await submitEmotionEntryAction({
        mood,
        note: note.trim() || null,
      });
      if (!result.success) {
        haptic.error();
        toast({
          title: 'Erreur',
          description: result.error,
          variant: 'destructive',
        });
        return;
      }
      haptic.success();
      if (result.data.created) {
        toast({
          title: `📝 +${result.data.xpAwarded} XP`,
          description:
            result.data.bonusAwarded > 0
              ? `Streak ${result.data.newStreak} jours · bonus +${result.data.bonusAwarded} XP`
              : `Streak ${result.data.newStreak} jour${
                  result.data.newStreak > 1 ? 's' : ''
                }`,
        });
      } else {
        toast({
          title: '✓ Entrée mise à jour',
          description: "Pas d'XP supplémentaire (déjà attribué aujourd'hui).",
        });
      }
      setNote('');
      router.refresh();
    });
  }

  return (
    <div className="glass-strong rounded-[var(--radius-lg)] p-6 space-y-6">
      {alreadyToday && (
        <div className="rounded-md bg-emerald-500/10 border border-emerald-500/30 px-3 py-2 text-sm text-emerald-200 inline-flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" />
          Entrée du jour validée — tu peux la modifier ci-dessous.
        </div>
      )}

      {/* Mood emoji + label */}
      <div className="text-center space-y-2">
        <div className="text-6xl">{current?.emoji}</div>
        <div className="font-serif text-xl">{current?.label}</div>
        <div className="text-xs text-[var(--color-text-faint)]">
          {mood}/10
        </div>
      </div>

      {/* Slider */}
      <div>
        <input
          type="range"
          min={1}
          max={10}
          step={1}
          value={mood}
          onChange={(e) => {
            haptic.selection();
            setMood(Number(e.target.value));
          }}
          className={cn(
            'w-full h-2 rounded-lg appearance-none cursor-pointer',
            'bg-gradient-to-r from-rose-500 via-amber-400 to-emerald-500'
          )}
          aria-label="Note d'humeur 1-10"
        />
        <div className="flex justify-between text-[10px] text-[var(--color-text-faint)] mt-1 px-1">
          <span>😰 1</span>
          <span>🙂 5</span>
          <span>🔥 10</span>
        </div>
      </div>

      {/* Note */}
      <div>
        <label htmlFor="note" className="text-xs uppercase tracking-wider text-[var(--color-text-faint)] mb-1.5 block">
          Note (optionnel · 500 max)
        </label>
        <textarea
          id="note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
          rows={3}
          placeholder="Ce que tu penses du marché, ton état avant/après séance, une décision regretté…"
          className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface-tint)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent-hover)] resize-none"
        />
        <div className="text-[10px] text-[var(--color-text-faint)] text-right mt-1">
          {note.length}/500
        </div>
      </div>

      <Button onClick={submit} disabled={pending} className="w-full gap-2">
        {pending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Enregistrement…
          </>
        ) : alreadyToday ? (
          <>
            <Save className="h-4 w-4" />
            Mettre à jour
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" />
            Valider — +20 XP
          </>
        )}
      </Button>

      <p className="text-[10px] text-center text-[var(--color-text-faint)] leading-relaxed">
        Ton journal est privé. Personne d&apos;autre n&apos;y a accès.
        Streak milestones : 7j (+75 XP), 30j (+250), 90j (+750), 180j (+2000).
      </p>
    </div>
  );
}
