import Link from 'next/link';
import { Award, Bird, CheckCircle2, Clock, Lock, Sparkles, Target, Trophy } from 'lucide-react';
import { ArrowLeft } from 'lucide-react';
import { requireAuth } from '@/lib/auth/server';
import { Section, SectionHeader } from '@/components/shared/section';
import { TelegramBackButton } from '@/components/mini/telegram-controls';
import {
  CANDLE_HOP_ACHIEVEMENTS,
  CANDLE_HOP_DAILY_LIMIT,
  CANDLE_HOP_DAILY_XP_CAP,
  CANDLE_HOP_MODES,
  CANDLE_HOP_MODE_LABELS,
  CANDLE_HOP_POWER_UPS,
  CANDLE_HOP_SKINS,
  getCandleHopState,
} from '@/lib/games/candle-hop';
import { getUserXpState } from '@/lib/games/xp';
import { CandleHopGame } from '@/components/games/candle-hop-game';

export const dynamic = 'force-dynamic';

export default async function CandleHopPage() {
  const { user } = await requireAuth();
  const [state, xpState] = await Promise.all([
    getCandleHopState(user.id),
    getUserXpState(user.id),
  ]);
  const xpTotal = xpState?.xpTotal ?? 0;

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
          eyebrow="Arcade · 5 runs / jour"
          title={
            <>
              Candle <span className="font-serif italic">Hop.</span>
            </>
          }
          description="Tap pour sauter. Évite les bougies rouges, choppe les vertes. Score = nombre de paires traversées. Vitesse augmente avec le score."
          align="left"
        />
      </Section>

      <Section className="py-3">
        <StatsBar
          bestScore={state.bestScore}
          runsLeft={state.runsLeftToday}
          runsTotal={CANDLE_HOP_DAILY_LIMIT}
          xpEarnedToday={state.xpEarnedToday}
          xpCap={CANDLE_HOP_DAILY_XP_CAP}
          totalRuns={state.totalRuns}
        />
      </Section>

      {/* Défi du jour V2 */}
      <Section className="py-3">
        <DailyChallengeCard
          label={state.dailyChallenge.challenge.label}
          bonusXp={state.dailyChallenge.challenge.bonusXp}
          done={state.dailyChallenge.done}
        />
      </Section>

      <Section className="py-4">
        {state.canPlay ? (
          <CandleHopGame
            bestScore={state.bestScore}
            bestByMode={state.bestByMode}
            runsLeftToday={state.runsLeftToday}
            xpRoomToday={Math.max(
              0,
              CANDLE_HOP_DAILY_XP_CAP - state.xpEarnedToday
            )}
            xpTotal={xpTotal}
            skins={CANDLE_HOP_SKINS.map((s) => ({
              id: s.id,
              label: s.label,
              unlockXp: s.unlockXp,
              fill: s.fill,
              border: s.border,
              glow: s.glow,
              description: s.description,
            }))}
            powerUps={CANDLE_HOP_POWER_UPS.map((p) => ({
              id: p.id,
              label: p.label,
              durationMs: p.durationMs,
              color: p.color,
              description: p.description,
            }))}
            modes={CANDLE_HOP_MODES.map((m) => ({
              id: m,
              label: CANDLE_HOP_MODE_LABELS[m].label,
              description: CANDLE_HOP_MODE_LABELS[m].description,
            }))}
          />
        ) : (
          <CooldownCard
            bestScore={state.bestScore}
            xpEarnedToday={state.xpEarnedToday}
          />
        )}
      </Section>

      {/* CTA Leaderboard */}
      <Section className="py-3">
        <Link
          href="/jeux/hop/leaderboard"
          className="group glass-strong rounded-[var(--radius-lg)] p-4 flex items-center justify-between gap-4 hover:-translate-y-0.5 transition-all border border-[var(--color-border-strong)]"
        >
          <div className="flex items-center gap-3 min-w-0">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500/30 to-orange-700/20 flex-shrink-0">
              <Trophy className="h-5 w-5 text-amber-300" />
            </span>
            <div className="min-w-0">
              <div className="font-serif text-base leading-tight">
                Leaderboard
              </div>
              <div className="text-xs text-[var(--color-text-dim)]">
                Top 20 par mode · trouve ton rang
              </div>
            </div>
          </div>
          <span className="text-xs text-[var(--color-accent-hover)] font-medium">
            Voir →
          </span>
        </Link>
      </Section>

      {/* Achievements V2 */}
      <Section className="py-4">
        <AchievementsPanel
          unlockedIds={state.achievementsUnlocked}
          allAchievements={CANDLE_HOP_ACHIEVEMENTS.map((a) => ({
            id: a.id,
            label: a.label,
            description: a.description,
            bonusXp: a.bonusXp,
          }))}
        />
      </Section>

      {state.recentRuns.length > 0 && (
        <Section className="py-4">
          <div className="glass rounded-[var(--radius-md)] p-5 space-y-3">
            <div className="flex items-center gap-2 text-sm uppercase tracking-wider text-[var(--color-text-faint)]">
              <Clock className="h-4 w-4 text-[var(--color-accent-hover)]" />
              Tes derniers runs
            </div>
            <div className="space-y-1.5">
              {state.recentRuns.slice(0, 5).map((r, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-md bg-[var(--color-surface-tint)] px-3 py-1.5 text-sm"
                >
                  <span className="font-mono tabular-nums text-[var(--color-text)]">
                    Score {r.score}
                  </span>
                  <span className="text-xs text-[var(--color-text-dim)]">
                    +{r.xpAwarded} XP ·{' '}
                    <span className="font-mono">
                      {new Date(r.createdAt).toLocaleString('fr-FR', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Section>
      )}

      <Section className="py-4">
        <div className="glass rounded-[var(--radius-md)] p-5 space-y-3">
          <div className="flex items-center gap-2 text-sm uppercase tracking-wider text-[var(--color-text-faint)]">
            <Sparkles className="h-4 w-4 text-amber-300" />
            Récompenses
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-xs">
            <Tier label="0-5" desc="+5 XP" accent="text-rose-300" />
            <Tier label="5-15" desc="+15 XP" accent="text-orange-300" />
            <Tier label="15-30" desc="+40 XP" accent="text-amber-300" />
            <Tier label="30-60" desc="+75 XP" accent="text-sky-300" />
            <Tier label="60-100" desc="+150 XP" accent="text-emerald-300" />
            <Tier label="100+" desc="+200 XP" accent="text-violet-300" />
          </div>
          <p className="text-[10px] text-[var(--color-text-faint)]">
            Bonus +50 XP si nouveau record perso. Cap quotidien : 300 XP par
            jour pour ce jeu (au-delà tu joues toujours mais sans XP).
          </p>
        </div>
      </Section>
    </>
  );
}

function StatsBar({
  bestScore,
  runsLeft,
  runsTotal,
  xpEarnedToday,
  xpCap,
  totalRuns,
}: {
  bestScore: number;
  runsLeft: number;
  runsTotal: number;
  xpEarnedToday: number;
  xpCap: number;
  totalRuns: number;
}) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <StatCard
        icon={Trophy}
        label="Record"
        value={String(bestScore)}
        accent="text-amber-300"
      />
      <StatCard
        icon={Bird}
        label="Runs restants"
        value={`${runsLeft}/${runsTotal}`}
        accent="text-emerald-300"
      />
      <StatCard
        icon={Sparkles}
        label="XP aujourd'hui"
        value={`${xpEarnedToday}/${xpCap}`}
        accent="text-sky-300"
      />
      <StatCard
        icon={Clock}
        label="Runs joués"
        value={String(totalRuns)}
        accent="text-violet-300"
      />
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="glass rounded-[var(--radius-md)] p-3 flex items-center gap-3">
      <Icon className={`h-5 w-5 flex-shrink-0 ${accent}`} />
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-faint)]">
          {label}
        </div>
        <div className="font-mono font-semibold tabular-nums text-base text-[var(--color-text)]">
          {value}
        </div>
      </div>
    </div>
  );
}

function CooldownCard({
  bestScore,
  xpEarnedToday,
}: {
  bestScore: number;
  xpEarnedToday: number;
}) {
  return (
    <div className="glass-strong rounded-[var(--radius-lg)] p-8 text-center space-y-4">
      <Bird className="h-10 w-10 mx-auto text-amber-300" />
      <h3 className="font-serif text-2xl">Tu as épuisé tes runs du jour</h3>
      <p className="text-sm text-[var(--color-text-dim)] max-w-md mx-auto">
        Tu as joué tes 5 parties sur les dernières 24h. Reviens demain pour
        en remettre une couche.
      </p>
      <div className="flex items-center justify-center gap-4 text-xs text-[var(--color-text-faint)]">
        <span className="inline-flex items-center gap-1">
          <Trophy className="h-3.5 w-3.5 text-amber-300" />
          Record : {bestScore}
        </span>
        <span className="border-l border-[var(--color-border)] pl-4">
          +{xpEarnedToday} XP gagnés aujourd&apos;hui
        </span>
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
      <div className={`font-mono font-semibold ${accent}`}>{label}</div>
      <div className="text-[10px] text-[var(--color-text-faint)]">{desc}</div>
    </div>
  );
}

function DailyChallengeCard({
  label,
  bonusXp,
  done,
}: {
  label: string;
  bonusXp: number;
  done: boolean;
}) {
  return (
    <div
      className={`glass-strong rounded-[var(--radius-lg)] p-4 flex items-center justify-between gap-3 border ${
        done
          ? 'border-emerald-500/40 bg-emerald-500/5'
          : 'border-[var(--color-border-strong)]'
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <span
          className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl ${
            done
              ? 'bg-emerald-500/20'
              : 'bg-gradient-to-br from-amber-500/30 to-orange-700/20'
          } flex-shrink-0`}
        >
          {done ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-300" />
          ) : (
            <Target className="h-5 w-5 text-amber-300" />
          )}
        </span>
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-faint)]">
            Défi du jour
          </div>
          <div className="text-sm font-medium text-[var(--color-text)] leading-tight">
            {label}
          </div>
        </div>
      </div>
      <span
        className={`text-xs font-mono font-semibold whitespace-nowrap rounded-full px-2.5 py-1 ${
          done
            ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
            : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
        }`}
      >
        {done ? '✓ Validé' : `+${bonusXp} XP`}
      </span>
    </div>
  );
}

function AchievementsPanel({
  unlockedIds,
  allAchievements,
}: {
  unlockedIds: string[];
  allAchievements: Array<{
    id: string;
    label: string;
    description: string;
    bonusXp: number;
  }>;
}) {
  const set = new Set(unlockedIds);
  const unlockedCount = allAchievements.filter((a) => set.has(a.id)).length;
  return (
    <div className="glass rounded-[var(--radius-md)] p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm uppercase tracking-wider text-[var(--color-text-faint)]">
          <Award className="h-4 w-4 text-amber-300" />
          Achievements
        </div>
        <span className="text-xs text-[var(--color-text-dim)] font-mono">
          {unlockedCount} / {allAchievements.length}
        </span>
      </div>
      <div className="grid sm:grid-cols-2 gap-2">
        {allAchievements.map((a) => {
          const unlocked = set.has(a.id);
          return (
            <div
              key={a.id}
              className={`rounded-md px-3 py-2 flex items-center gap-3 ${
                unlocked
                  ? 'bg-amber-500/10 border border-amber-500/30'
                  : 'bg-[var(--color-surface-tint)] border border-[var(--color-border)] opacity-60'
              }`}
            >
              {unlocked ? (
                <Award className="h-4 w-4 text-amber-300 flex-shrink-0" />
              ) : (
                <Lock className="h-4 w-4 text-[var(--color-text-faint)] flex-shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-[var(--color-text)] leading-tight">
                  {a.label}
                </div>
                <div className="text-[10px] text-[var(--color-text-dim)]">
                  {a.description}
                </div>
              </div>
              <span className="text-[10px] font-mono text-amber-300 whitespace-nowrap">
                +{a.bonusXp} XP
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
