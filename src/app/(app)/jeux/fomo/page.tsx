import Link from 'next/link';
import { ArrowLeft, Brain, Clock } from 'lucide-react';
import { requireAuth } from '@/lib/auth/server';
import { Section, SectionHeader } from '@/components/shared/section';
import { TelegramBackButton } from '@/components/mini/telegram-controls';
import {
  FOMO_SCENARIOS,
  getFomoState,
  interpretFomoScore,
} from '@/lib/games/fomo';
import { FomoTest } from '@/components/games/fomo-test';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function FomoPage() {
  const { user } = await requireAuth();
  const state = await getFomoState(user.id);

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
          eyebrow="FOMO Test · Quotidien"
          title={
            <>
              4 secondes pour{' '}
              <span className="font-serif italic">décider.</span>
            </>
          }
          description="10 patterns de chart, chacun avec une lecture optimale (acheter, garder, ou vendre). Tu as 4 secondes par scénario. Plus tu cliques vite et mal, plus ton FOMO score monte. Objectif : score bas."
          align="left"
        />
      </Section>

      {state.lastRun && (
        <Section className="py-3">
          <LastResultCard
            score={state.lastRun.score}
            completedAt={state.lastRun.completedAt}
            history={state.history}
          />
        </Section>
      )}

      <Section className="py-4">
        {state.canPlay ? (
          <FomoTest
            scenarios={FOMO_SCENARIOS.map((s) => ({
              id: s.id,
              name: s.name,
              candles: s.candles,
              optimal: s.optimal,
              explanation: s.explanation,
            }))}
          />
        ) : (
          <CooldownCard nextRunAt={state.nextRunAt} />
        )}
      </Section>

      <Section className="py-4">
        <div className="glass rounded-[var(--radius-md)] p-5 space-y-3">
          <div className="flex items-center gap-2 text-sm uppercase tracking-wider text-[var(--color-text-faint)]">
            <Brain className="h-4 w-4 text-pink-300" />
            Qu&apos;est-ce que le FOMO ?
          </div>
          <p className="text-sm text-[var(--color-text-dim)] leading-relaxed">
            <strong className="text-[var(--color-text)]">FOMO = Fear Of
            Missing Out.</strong>{' '}
            La peur de rater une opportunité te pousse à entrer trop tard
            (sur un pump déjà mature) ou trop tôt (sur un setup non
            confirmé). C&apos;est l&apos;ennemi numéro un du trader
            débutant. Mesurer ton FOMO score régulièrement = première étape
            pour le contrôler.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <ScoreTier label="0-20" accent="text-emerald-300" desc="Patient" />
            <ScoreTier label="20-40" accent="text-amber-300" desc="Léger" />
            <ScoreTier label="40-60" accent="text-orange-300" desc="Marqué" />
            <ScoreTier label="60-100" accent="text-rose-300" desc="Très fort" />
          </div>
          <p className="text-[10px] text-[var(--color-text-faint)]">
            Récompense : +200 XP (score &le; 20), +100 (&le; 40), +50 (&le; 60),
            +20 (&gt; 60). 1 run / 24h.
          </p>
        </div>
      </Section>
    </>
  );
}

function LastResultCard({
  score,
  completedAt,
  history,
}: {
  score: number;
  completedAt: Date;
  history: Array<{ score: number; createdAt: Date }>;
}) {
  const interp = interpretFomoScore(score);
  const tierColor =
    interp.level === 'low'
      ? 'text-emerald-300 border-emerald-500/30'
      : interp.level === 'moderate'
        ? 'text-amber-300 border-amber-500/30'
        : interp.level === 'high'
          ? 'text-orange-300 border-orange-500/30'
          : 'text-rose-300 border-rose-500/30';

  return (
    <div className="glass-strong rounded-[var(--radius-lg)] p-6 space-y-4">
      <div className="flex items-baseline justify-between flex-wrap gap-3">
        <div>
          <div className="text-xs uppercase tracking-wider text-[var(--color-text-faint)] mb-1">
            Ton dernier FOMO score
          </div>
          <div className="flex items-baseline gap-3 flex-wrap">
            <span className="font-serif text-5xl text-gradient">
              {score}/100
            </span>
            <span
              className={cn(
                'inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium',
                tierColor
              )}
            >
              {interp.label}
            </span>
          </div>
        </div>
        <div className="text-xs text-[var(--color-text-faint)] font-mono">
          {new Date(completedAt).toLocaleDateString('fr-FR')}
        </div>
      </div>

      <p className="text-sm text-[var(--color-text-dim)]">{interp.desc}</p>

      {history.length > 1 && (
        <div className="border-t border-[var(--color-border)] pt-3">
          <div className="text-xs uppercase tracking-wider text-[var(--color-text-faint)] mb-2">
            Évolution (objectif : ↓)
          </div>
          <div className="flex items-end gap-1.5 h-12">
            {history
              .slice(0, 14)
              .reverse()
              .map((h, i) => {
                const heightPct = Math.max(5, h.score);
                const color =
                  h.score <= 20
                    ? 'from-emerald-500/60 to-emerald-500/30'
                    : h.score <= 40
                      ? 'from-amber-500/60 to-amber-500/30'
                      : h.score <= 60
                        ? 'from-orange-500/60 to-orange-500/30'
                        : 'from-rose-500/60 to-rose-500/30';
                return (
                  <div
                    key={i}
                    title={`Score ${h.score}/100 · ${new Date(h.createdAt).toLocaleDateString('fr-FR')}`}
                    className={cn(
                      'flex-1 bg-gradient-to-t rounded-sm',
                      color
                    )}
                    style={{ height: `${heightPct}%` }}
                  />
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}

function CooldownCard({ nextRunAt }: { nextRunAt: Date | null }) {
  return (
    <div className="glass-strong rounded-[var(--radius-lg)] p-8 text-center space-y-4">
      <Clock className="h-10 w-10 mx-auto text-amber-300" />
      <h3 className="font-serif text-2xl">Reviens demain</h3>
      <p className="text-sm text-[var(--color-text-dim)] max-w-md mx-auto">
        Tu as déjà fait le test aujourd&apos;hui. 1 run / 24h pour que le
        score reste représentatif.
      </p>
      {nextRunAt && (
        <div className="inline-flex items-center gap-2 rounded-full bg-[var(--color-surface-tint)] px-4 py-2 text-sm font-mono">
          {nextRunAt.toLocaleString('fr-FR', {
            dateStyle: 'short',
            timeStyle: 'short',
          })}
        </div>
      )}
    </div>
  );
}

function ScoreTier({
  label,
  desc,
  accent,
}: {
  label: string;
  desc: string;
  accent: string;
}) {
  return (
    <div className="rounded-md bg-[var(--color-surface-tint)] px-2 py-1.5 text-center">
      <div className={cn('font-mono font-semibold', accent)}>{label}</div>
      <div className="text-[10px] text-[var(--color-text-faint)]">{desc}</div>
    </div>
  );
}
