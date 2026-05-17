import Link from 'next/link';
import { ArrowLeft, Clock3, Flame, Trophy } from 'lucide-react';
import { requireAuth } from '@/lib/auth/server';
import { Section, SectionHeader } from '@/components/shared/section';
import { TelegramBackButton } from '@/components/mini/telegram-controls';
import {
  getPatienceState,
  PATIENCE_DAILY_LIMIT,
} from '@/lib/games/patience';
import { PatienceGame } from '@/components/games/patience-game';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function PatiencePage() {
  const { user } = await requireAuth();
  const state = await getPatienceState(user.id);

  return (
    <>
      <TelegramBackButton />
      <Section className="pt-10 pb-3">
        <div className="flex items-center gap-2 text-xs text-[var(--color-text-dim)] mb-4">
          <Link
            href="/jeux"
            className="inline-flex items-center gap-1 hover:text-[var(--color-text)]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Jeux
          </Link>
        </div>
        <SectionHeader
          eyebrow="Patience Trainer · Quotidien"
          title={
            <>
              Lâche au{' '}
              <span className="font-serif italic">bon moment.</span>
            </>
          }
          description="Un chart se trace en temps réel. Tu observes, tu lis le rythme. Quand tu penses que c'est le bon moment d'entrer, tu cliques. La suite du chart est révélée et tu vois si tu as bien lu — ou si t'as cédé à l'impatience."
          align="left"
        />
      </Section>

      <Section className="py-2">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-3 py-1 border',
              state.runsLeftToday > 0
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                : 'border-rose-500/30 bg-rose-500/10 text-rose-200'
            )}
          >
            <Flame className="h-3 w-3" />
            {state.runsLeftToday} / {PATIENCE_DAILY_LIMIT} runs aujourd&apos;hui
          </span>
          {state.bestScore > 0 && (
            <span className="inline-flex items-center gap-1.5 text-amber-300">
              <Trophy className="h-3 w-3" />
              Record : {state.bestScore}/100
            </span>
          )}
        </div>
      </Section>

      <Section className="py-6">
        <PatienceGame canPlay={state.runsLeftToday > 0} />
      </Section>

      {state.recentRuns.length > 0 && (
        <Section className="py-4">
          <h3 className="text-sm uppercase tracking-wider text-[var(--color-text-faint)] mb-3">
            Mes derniers runs
          </h3>
          <div className="glass rounded-[var(--radius-md)] divide-y divide-[var(--color-border)]">
            {state.recentRuns.map((r, i) => (
              <div
                key={i}
                className="px-4 py-3 flex items-center justify-between gap-3 text-sm"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      'inline-flex h-9 w-9 items-center justify-center rounded-full font-mono text-xs font-bold',
                      r.score >= 80
                        ? 'bg-emerald-500/15 text-emerald-300'
                        : r.score >= 60
                          ? 'bg-amber-500/15 text-amber-300'
                          : r.score >= 30
                            ? 'bg-sky-500/15 text-sky-300'
                            : 'bg-rose-500/15 text-rose-300'
                    )}
                  >
                    {r.score}
                  </div>
                  <div>
                    <div>Score {r.score}/100</div>
                    <div className="text-[10px] text-[var(--color-text-faint)] font-mono inline-flex items-center gap-1">
                      <Clock3 className="h-3 w-3" />
                      Tenu {(r.durationMs / 1000).toFixed(1)}s ·{' '}
                      {new Date(r.createdAt).toLocaleDateString('fr-FR')}
                    </div>
                  </div>
                </div>
                <span className="font-mono text-emerald-300">+{r.xp} XP</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section className="py-4">
        <div className="glass rounded-[var(--radius-md)] p-4 text-xs text-[var(--color-text-dim)]">
          <strong className="text-[var(--color-text)]">Barème.</strong>{' '}
          0-30 : +5 XP (essai) · 30-60 : +25 XP (moyen) · 60-80 : +75 XP
          (bon) · 80-100 : +150 XP (excellent). Le score reflète à quel
          point ton entrée était bien placée par rapport à la suite du
          chart — entrer au plus bas avant une hausse = score élevé.
          3 runs / 24h.
        </div>
      </Section>
    </>
  );
}
