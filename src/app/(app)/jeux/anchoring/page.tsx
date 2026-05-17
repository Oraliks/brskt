import Link from 'next/link';
import { ArrowLeft, Anchor, Brain, Clock, TrendingDown } from 'lucide-react';
import { requireAuth } from '@/lib/auth/server';
import { Section, SectionHeader } from '@/components/shared/section';
import { TelegramBackButton } from '@/components/mini/telegram-controls';
import {
  ANCHORING_QUESTIONS,
  assignAnchorsForUser,
  getAnchoringState,
  interpretAnchoring,
} from '@/lib/games/anchoring';
import { AnchoringTest } from '@/components/games/anchoring-test';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function AnchoringPage() {
  const { user } = await requireAuth();
  const state = await getAnchoringState(user.id);
  const assigned = assignAnchorsForUser(user.id, ANCHORING_QUESTIONS);

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
              Es-tu influencé par <span className="font-serif italic">l&apos;ancre ?</span>
            </>
          }
          description="6 questions de prédiction marché. Avant chaque question, on te montre une référence chiffrée. Cette référence est arbitraire — elle ne devrait pas influencer ta réponse. On mesure si elle l'a fait."
          align="left"
        />
      </Section>

      {state.lastRun && (
        <Section className="py-3">
          <LastResultCard
            anchoringIndex={state.lastRun.anchoringIndex}
            completedAt={state.lastRun.completedAt}
            history={state.history}
          />
        </Section>
      )}

      <Section className="py-4">
        {state.canPlay ? (
          <AnchoringTest
            questions={assigned.map(({ question, variant }) => ({
              id: question.id,
              market: question.market,
              prompt: question.prompt,
              unit: question.unit,
              minAnswer: question.minAnswer,
              maxAnswer: question.maxAnswer,
              center: question.center,
              anchor: variant === 'high' ? question.anchorHigh : question.anchorLow,
              anchorVariant: variant,
            }))}
          />
        ) : (
          <CooldownCard
            nextRunAt={state.nextRunAt}
            hasLastResult={state.lastRun !== null}
          />
        )}
      </Section>

      <Section className="py-4">
        <div className="glass rounded-[var(--radius-md)] p-5 space-y-3">
          <div className="flex items-center gap-2 text-sm uppercase tracking-wider text-[var(--color-text-faint)]">
            <Brain className="h-4 w-4 text-indigo-300" />
            Le biais d&apos;ancrage
          </div>
          <p className="text-sm text-[var(--color-text-dim)] leading-relaxed">
            Tversky &amp; Kahneman (1974) ont prouvé qu&apos;un chiffre arbitraire
            affiché juste avant qu&apos;on demande une estimation influence
            massivement la réponse. En trading c&apos;est mortel : tu lis un
            target « $200 000 » sur un blog, ton cerveau s&apos;y accroche
            même si tu sais que c&apos;est du clickbait.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
            <Tier label="0-15" accent="text-emerald-300" desc="Immunisé" />
            <Tier label="15-35" accent="text-emerald-300" desc="Peu" />
            <Tier label="35-55" accent="text-amber-300" desc="Modéré" />
            <Tier label="55-75" accent="text-orange-300" desc="Fort" />
            <Tier label="75-100" accent="text-rose-300" desc="Très fort" />
          </div>
          <p className="text-[10px] text-[var(--color-text-faint)]">
            Le test est privé. Récompense : +200 XP par run + bonus +50 si tu
            résistes (indice &lt; 30). 1 run / semaine.
          </p>
        </div>
      </Section>
    </>
  );
}

function LastResultCard({
  anchoringIndex,
  completedAt,
  history,
}: {
  anchoringIndex: number;
  completedAt: Date;
  history: Array<{ anchoringIndex: number; completedAt: Date }>;
}) {
  const interp = interpretAnchoring(anchoringIndex);
  const tierColor =
    interp.level === 'immune' || interp.level === 'low'
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
            Ton dernier résultat
          </div>
          <div className="flex items-baseline gap-3">
            <span className="font-serif text-5xl text-gradient">
              {anchoringIndex} / 100
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
            Évolution
          </div>
          <div className="flex items-end gap-1.5 h-12">
            {history
              .slice(0, 12)
              .reverse()
              .map((h, i) => {
                const heightPct = Math.min(100, h.anchoringIndex);
                return (
                  <div
                    key={i}
                    title={`Index=${h.anchoringIndex} · ${new Date(h.completedAt).toLocaleDateString('fr-FR')}`}
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
        {hasLastResult && 'Ton dernier indice est affiché ci-dessus.'}
      </p>
      {nextRunAt && (
        <div className="inline-flex items-center gap-2 rounded-full bg-[var(--color-surface-tint)] px-4 py-2 text-sm">
          <Anchor className="h-4 w-4 text-[var(--color-accent-hover)]" />
          Prochain test :{' '}
          <span className="font-mono">
            {nextRunAt.toLocaleString('fr-FR', {
              dateStyle: 'short',
              timeStyle: 'short',
            })}
          </span>
        </div>
      )}
      <div className="inline-flex items-center gap-2 rounded-full bg-[var(--color-surface-tint)] px-4 py-2 text-xs text-[var(--color-text-dim)]">
        <TrendingDown className="h-3.5 w-3.5" />
        L&apos;ancrage évolue avec l&apos;expérience — reviens dans 7 jours.
      </div>
    </div>
  );
}

function Tier({
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
