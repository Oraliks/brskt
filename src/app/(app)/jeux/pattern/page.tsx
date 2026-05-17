import Link from 'next/link';
import { ArrowLeft, Clock, Eye, Trophy } from 'lucide-react';
import { requireAuth } from '@/lib/auth/server';
import { Section, SectionHeader } from '@/components/shared/section';
import { TelegramBackButton } from '@/components/mini/telegram-controls';
import {
  CHART_PATTERNS,
  getPatternMemoryState,
  pickPatternsForRun,
} from '@/lib/games/pattern-memory';
import { PatternMemoryGame } from '@/components/games/pattern-memory-game';

export const dynamic = 'force-dynamic';

export default async function PatternMemoryPage() {
  const { user } = await requireAuth();
  const state = await getPatternMemoryState(user.id);

  // On génère 5 patterns côté serveur. Le client les recevra et les
  // flashera 3s chacun, puis demandera de les replacer dans l'ordre.
  const session = state.canPlay
    ? pickPatternsForRun().map((p) => ({
        id: p.id,
        name: p.name,
        label: p.label,
        description: p.description,
        points: p.points,
      }))
    : [];

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
          eyebrow="Mémoire visuelle · Quotidien"
          title={
            <>
              Reconnais le pattern{' '}
              <span className="font-serif italic">en 3 secondes.</span>
            </>
          }
          description="5 figures techniques flashées 3 secondes chacune. Tu dois les replacer dans l'ordre. Entraînement de la reconnaissance rapide — l'arme du scalpeur."
          align="left"
        />
      </Section>

      {state.lastRun && (
        <Section className="py-3">
          <LastResultCard
            score={state.lastRun.score}
            xpAwarded={state.lastRun.xpAwarded}
            bestScore={state.bestScore}
            createdAt={state.lastRun.createdAt}
            history={state.history}
          />
        </Section>
      )}

      <Section className="py-4">
        {state.canPlay ? (
          <PatternMemoryGame
            patterns={session}
            allPatterns={CHART_PATTERNS.map((p) => ({
              id: p.id,
              label: p.label,
              points: p.points,
            }))}
          />
        ) : (
          <CooldownCard />
        )}
      </Section>

      <Section className="py-4">
        <div className="glass rounded-[var(--radius-md)] p-5 space-y-3">
          <div className="flex items-center gap-2 text-sm uppercase tracking-wider text-[var(--color-text-faint)]">
            <Eye className="h-4 w-4 text-indigo-300" />
            Pourquoi c&apos;est utile
          </div>
          <p className="text-sm text-[var(--color-text-dim)] leading-relaxed">
            Un trader expérimenté reconnaît un drapeau ou une tête-épaules en
            une fraction de seconde. Cette vitesse vient d&apos;années
            d&apos;exposition. Ce mini-jeu accélère ton entraînement à la
            reconnaissance — sans bruit, sans risque.
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 text-xs">
            <Tier label="0-1" desc="+10 XP" accent="text-rose-300" />
            <Tier label="2" desc="+25 XP" accent="text-orange-300" />
            <Tier label="3" desc="+50 XP" accent="text-amber-300" />
            <Tier label="4" desc="+100 XP" accent="text-sky-300" />
            <Tier label="5" desc="+150 XP" accent="text-emerald-300" />
          </div>
          <p className="text-[10px] text-[var(--color-text-faint)]">
            1 run / jour. Score = nombre de patterns correctement replacés.
          </p>
        </div>
      </Section>
    </>
  );
}

function LastResultCard({
  score,
  xpAwarded,
  bestScore,
  createdAt,
  history,
}: {
  score: number;
  xpAwarded: number;
  bestScore: number;
  createdAt: Date;
  history: Array<{ score: number; createdAt: Date }>;
}) {
  const accent =
    score >= 5
      ? 'text-emerald-300 border-emerald-500/30'
      : score >= 3
        ? 'text-amber-300 border-amber-500/30'
        : 'text-rose-300 border-rose-500/30';
  return (
    <div className="glass-strong rounded-[var(--radius-lg)] p-6 space-y-4">
      <div className="flex items-baseline justify-between flex-wrap gap-3">
        <div>
          <div className="text-xs uppercase tracking-wider text-[var(--color-text-faint)] mb-1">
            Ton dernier score
          </div>
          <div className="flex items-baseline gap-3">
            <span className="font-serif text-5xl text-gradient">{score}/5</span>
            <span
              className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${accent}`}
            >
              +{xpAwarded} XP
            </span>
          </div>
        </div>
        <div className="text-xs text-[var(--color-text-faint)] font-mono">
          {new Date(createdAt).toLocaleDateString('fr-FR')}
        </div>
      </div>
      <div className="flex items-center gap-4 text-xs text-[var(--color-text-faint)]">
        <span className="inline-flex items-center gap-1">
          <Trophy className="h-3.5 w-3.5 text-amber-300" />
          Record : {bestScore}/5
        </span>
        <span className="border-l border-[var(--color-border)] pl-4">
          {history.length} runs au total
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
                const heightPct = (h.score / 5) * 100;
                return (
                  <div
                    key={i}
                    title={`${h.score}/5 · ${new Date(h.createdAt).toLocaleDateString('fr-FR')}`}
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

function CooldownCard() {
  return (
    <div className="glass-strong rounded-[var(--radius-lg)] p-8 text-center space-y-4">
      <Clock className="h-10 w-10 mx-auto text-amber-300" />
      <h3 className="font-serif text-2xl">Tu as déjà joué aujourd&apos;hui</h3>
      <p className="text-sm text-[var(--color-text-dim)] max-w-md mx-auto">
        Reviens demain pour un nouveau set de patterns.
      </p>
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
      <div className={`font-mono font-semibold ${accent}`}>{label}/5</div>
      <div className="text-[10px] text-[var(--color-text-faint)]">{desc}</div>
    </div>
  );
}
