import Link from 'next/link';
import { ArrowLeft, Brain, Clock, TrendingDown } from 'lucide-react';
import { requireAuth } from '@/lib/auth/server';
import { Section, SectionHeader } from '@/components/shared/section';
import { TelegramBackButton } from '@/components/mini/telegram-controls';
import {
  getLossAversionState,
  interpretLambda,
  LOSS_AVERSION_QUESTIONS,
} from '@/lib/games/loss-aversion';
import { LossAversionTest } from '@/components/games/loss-aversion-test';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function AversionPage() {
  const { user } = await requireAuth();
  const state = await getLossAversionState(user.id);

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
          eyebrow="Test psy · Hebdomadaire"
          title={
            <>
              Combien tu{' '}
              <span className="font-serif italic">crains la perte ?</span>
            </>
          }
          description="10 choix binaires : option sûre ou loterie 50/50. On calcule ton coefficient λ (Kahneman ~2.25 en moyenne). Plus c'est haut, plus une perte est ressentie comme douloureuse vs un gain équivalent."
          align="left"
        />
      </Section>

      {/* Dernier résultat */}
      {state.lastRun && (
        <Section className="py-3">
          <LastResultCard
            coefficient={state.lastRun.coefficient}
            safeCount={state.lastRun.safeCount}
            completedAt={state.lastRun.completedAt}
            history={state.history}
          />
        </Section>
      )}

      {/* Test ou cooldown */}
      <Section className="py-4">
        {state.canPlay ? (
          <LossAversionTest
            questions={LOSS_AVERSION_QUESTIONS.map((q) => ({
              id: q.id,
              safe: q.safe,
              lottery: q.lottery,
              context: q.context ?? null,
            }))}
          />
        ) : (
          <CooldownCard
            nextRunAt={state.nextRunAt}
            hasLastResult={state.lastRun !== null}
          />
        )}
      </Section>

      {/* Explication scientifique */}
      <Section className="py-4">
        <div className="glass rounded-[var(--radius-md)] p-5 space-y-3">
          <div className="flex items-center gap-2 text-sm uppercase tracking-wider text-[var(--color-text-faint)]">
            <Brain className="h-4 w-4 text-indigo-300" />
            Le coefficient lambda (λ)
          </div>
          <p className="text-sm text-[var(--color-text-dim)] leading-relaxed">
            Kahneman & Tversky ont montré en 1979 (Prospect Theory) que les
            humains ressentent les pertes <strong className="text-[var(--color-text)]">
            ~2× plus fortement</strong> que les gains équivalents. C&apos;est
            l&apos;aversion à la perte : un trader qui perd 100€ en ressent
            l&apos;impact d&apos;un gain raté de ~225€.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
            <LambdaTier
              label="λ < 1.3"
              accent="text-rose-300"
              desc="Risk-seeking"
            />
            <LambdaTier
              label="1.3-1.9"
              accent="text-amber-300"
              desc="Modéré"
            />
            <LambdaTier
              label="1.9-2.6"
              accent="text-emerald-300"
              desc="Moyenne"
            />
            <LambdaTier
              label="2.6-3.5"
              accent="text-orange-300"
              desc="Forte"
            />
            <LambdaTier
              label="> 3.5"
              accent="text-rose-300"
              desc="Très forte"
            />
          </div>
          <p className="text-[10px] text-[var(--color-text-faint)]">
            Le test est anonyme et privé. Récompense : +250 XP par test
            complété (1×/semaine).
          </p>
        </div>
      </Section>
    </>
  );
}

function LastResultCard({
  coefficient,
  safeCount,
  completedAt,
  history,
}: {
  coefficient: number;
  safeCount: number;
  completedAt: Date;
  history: Array<{ coefficient: number; completedAt: Date }>;
}) {
  const interp = interpretLambda(coefficient);
  const tierColor =
    interp.level === 'low'
      ? 'text-rose-300 border-rose-500/30'
      : interp.level === 'moderate'
        ? 'text-amber-300 border-amber-500/30'
        : interp.level === 'average'
          ? 'text-emerald-300 border-emerald-500/30'
          : interp.level === 'high'
            ? 'text-orange-300 border-orange-500/30'
            : 'text-rose-300 border-rose-500/30';

  return (
    <div className="glass-strong rounded-[var(--radius-lg)] p-6 space-y-4">
      <div className="flex items-baseline justify-between flex-wrap gap-3">
        <div>
          <div className="text-xs uppercase tracking-wider text-[var(--color-text-faint)] mb-1">
            Ton dernier résultat
          </div>
          <div className="flex items-baseline gap-3">
            <span className="font-serif text-5xl text-gradient">
              λ = {coefficient.toFixed(2)}
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

      <div className="flex items-center gap-4 text-xs text-[var(--color-text-faint)]">
        <span>
          {safeCount}/10 choix sûrs · {10 - safeCount}/10 loteries
        </span>
        <span className="border-l border-[var(--color-border)] pl-4">
          Kahneman moyenne : ~2.25
        </span>
      </div>

      {history.length > 1 && (
        <div className="border-t border-[var(--color-border)] pt-3">
          <div className="text-xs uppercase tracking-wider text-[var(--color-text-faint)] mb-2">
            Évolution
          </div>
          <div className="flex items-end gap-1.5 h-12">
            {history
              .slice(0, 12)
              .reverse()
              .map((h, i) => {
                const heightPct = Math.min(100, (h.coefficient / 5) * 100);
                return (
                  <div
                    key={i}
                    title={`λ=${h.coefficient.toFixed(2)} · ${new Date(h.completedAt).toLocaleDateString('fr-FR')}`}
                    className="flex-1 bg-gradient-to-t from-indigo-500/50 to-pink-500/50 rounded-sm"
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

function CooldownCard({
  nextRunAt,
  hasLastResult,
}: {
  nextRunAt: Date | null;
  hasLastResult: boolean;
}) {
  return (
    <div className="glass-strong rounded-[var(--radius-lg)] p-8 text-center space-y-4">
      <Clock className="h-10 w-10 mx-auto text-amber-300" />
      <h3 className="font-serif text-2xl">Cooldown actif</h3>
      <p className="text-sm text-[var(--color-text-dim)] max-w-md mx-auto">
        Tu as déjà fait le test cette semaine.{' '}
        {hasLastResult && "Ton dernier coefficient est affiché ci-dessus."}
      </p>
      {nextRunAt && (
        <div className="inline-flex items-center gap-2 rounded-full bg-[var(--color-surface-tint)] px-4 py-2 text-sm">
          <TrendingDown className="h-4 w-4 text-[var(--color-accent-hover)]" />
          Prochain test :{' '}
          <span className="font-mono">
            {nextRunAt.toLocaleString('fr-FR', {
              dateStyle: 'short',
              timeStyle: 'short',
            })}
          </span>
        </div>
      )}
    </div>
  );
}

function LambdaTier({
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
