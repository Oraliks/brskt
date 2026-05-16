import Link from 'next/link';
import { ArrowLeft, Flame, Info, Trophy } from 'lucide-react';
import { requireAuth } from '@/lib/auth/server';
import { Section, SectionHeader } from '@/components/shared/section';
import { TapGame } from '@/components/games/tap-game';
import { TelegramBackButton } from '@/components/mini/telegram-controls';
import {
  getTapRunHistory,
  getTapState,
  TAP_DAILY_LIMIT,
  TAP_LEVELS,
} from '@/lib/games/tap';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function ClicPage() {
  const { user } = await requireAuth();
  const [state, history] = await Promise.all([
    getTapState(user.id),
    getTapRunHistory(user.id, 10),
  ]);

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
          eyebrow="Combo de clic"
          title={
            <>
              Tape, tape,{' '}
              <span className="font-serif italic">tape — sans casser.</span>
            </>
          }
          description="Enchaîne les clics sans laisser passer la barre de combo. Plus tu tiens, plus tu montes de niveau, plus tu gagnes d'XP."
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
            {state.runsLeftToday} / {TAP_DAILY_LIMIT} runs aujourd&apos;hui
          </span>
          {state.bestTaps > 0 && (
            <span className="inline-flex items-center gap-1.5 text-amber-300">
              <Trophy className="h-3 w-3" />
              Record : {state.bestTaps} taps (Niv {state.bestLevel})
            </span>
          )}
        </div>
      </Section>

      <Section className="py-6">
        <TapGame canPlay={state.runsLeftToday > 0} />
      </Section>

      <Section className="py-4">
        <div className="glass rounded-[var(--radius-md)] p-4 flex gap-3 text-xs text-[var(--color-text-dim)]">
          <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <div className="space-y-2 flex-1">
            <p>
              <strong className="text-[var(--color-text)]">Règles.</strong>{' '}
              Tape sur le bouton dès que tu peux. La barre de combo descend
              en continu — quand elle atteint 0, le run est fini. Les
              paliers se déclenchent à 10, 25, 50, 100 et 200 taps. Plus
              tu montes haut, plus le combo descend vite. 3 runs par jour.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              {TAP_LEVELS.map((l) => (
                <span
                  key={l.level}
                  className="inline-flex items-center gap-1 rounded-md bg-[var(--color-surface-tint)] px-2 py-1 text-[10px]"
                >
                  <span>{l.icon}</span>
                  Niv {l.level} · {l.minTaps} taps · +{l.bonusXp} XP
                </span>
              ))}
            </div>
          </div>
        </div>
      </Section>

      {history.length > 0 && (
        <Section className="py-4">
          <h3 className="text-sm uppercase tracking-wider text-[var(--color-text-faint)] mb-3">
            Mes derniers runs
          </h3>
          <div className="glass rounded-[var(--radius-md)] divide-y divide-[var(--color-border)]">
            {history.map((r) => {
              const tier = TAP_LEVELS.find((t) => t.level === r.maxLevel);
              return (
                <div
                  key={r.id}
                  className="px-4 py-3 flex items-center justify-between gap-3 text-sm"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{tier?.icon ?? '⚪'}</span>
                    <div>
                      <div>
                        Niveau {r.maxLevel} ·{' '}
                        <span className="font-mono">{r.taps} taps</span>
                      </div>
                      <div className="text-[10px] text-[var(--color-text-faint)] font-mono">
                        {(r.durationMs / 1000).toFixed(1)}s ·{' '}
                        {new Date(r.createdAt).toLocaleDateString('fr-FR')}
                      </div>
                    </div>
                  </div>
                  <span className="font-mono text-emerald-300">
                    +{r.xpAwarded} XP
                  </span>
                </div>
              );
            })}
          </div>
        </Section>
      )}
    </>
  );
}
