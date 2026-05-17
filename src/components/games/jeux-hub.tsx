'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  BookHeart,
  Brain,
  CheckCircle2,
  Clock,
  Coins,
  Disc3,
  Flame,
  LineChart,
  Sparkles,
  Star,
  Target,
  Trophy,
  Users,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Level } from '@/lib/games/xp';

type Category = 'all' | 'daily' | 'weekly' | 'challenges' | 'xp' | 'ranking';

interface Availability {
  tap: { runsLeft: number; runsTotal: number };
  wheel: { available: boolean; nextAt: string | null };
  predict: { submittedToday: number; totalMarkets: number };
  journal: { doneToday: boolean };
  fomo: { available: boolean; nextAt: string | null };
  patience: { runsLeft: number; runsTotal: number };
  aversion: { available: boolean; nextAt: string | null };
}

interface Props {
  level: { level: Level; next: Level | null; progress: number; xpToNext: number };
  xp: number;
  streak: number;
  longest: number;
  challengeLabel: string;
  challengeDone: boolean;
  counts: { wheel: number; tap: number; predict: number; classement: number };
  challenges: {
    precision: { correct: number; total: number };
    streak: { current: number; target: number };
    rushXp: { current: number; target: number };
    topRank: number | null;
  };
  availability: Availability;
}

const CATEGORIES: { id: Category; label: string }[] = [
  { id: 'all', label: 'Tous' },
  { id: 'daily', label: 'Quotidien' },
  { id: 'weekly', label: 'Hebdo' },
  { id: 'challenges', label: 'Défis' },
  { id: 'xp', label: 'XP' },
  { id: 'ranking', label: 'Classement' },
];

type Status =
  | { kind: 'available'; label: string }
  | { kind: 'limited'; left: number; total: number }
  | { kind: 'partial'; done: number; total: number }
  | { kind: 'cooldown'; nextAt: string | null; label: string }
  | { kind: 'done'; label: string };

interface CardDef {
  id: string;
  category: Category[];
  href: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  title: string;
  subtitle: string;
  status: Status;
  metric?: { icon: React.ElementType; value: string };
}

export function JeuxHub({
  level,
  xp,
  streak,
  longest,
  challengeLabel,
  challengeDone,
  counts,
  challenges,
  availability,
}: Props) {
  const [active, setActive] = useState<Category>('all');

  const cards = useMemo<CardDef[]>(
    () => [
      {
        id: 'roue',
        category: ['all', 'weekly'],
        href: '/jeux/roue',
        icon: Disc3,
        iconBg: 'from-rose-500/30 to-red-700/20',
        iconColor: 'text-rose-300',
        title: 'Roue de la fortune',
        subtitle: '1 spin / semaine',
        status: availability.wheel.available
          ? { kind: 'available', label: 'Dispo' }
          : { kind: 'cooldown', nextAt: availability.wheel.nextAt, label: 'Cooldown' },
        metric: { icon: Users, value: formatCount(counts.wheel) },
      },
      {
        id: 'predict',
        category: ['all', 'daily'],
        href: '/jeux/predict',
        icon: LineChart,
        iconBg: 'from-purple-500/30 to-pink-700/20',
        iconColor: 'text-purple-300',
        title: 'Prono express',
        subtitle: '5 marchés à deviner',
        status:
          availability.predict.submittedToday >= availability.predict.totalMarkets
            ? { kind: 'done', label: 'Tous faits' }
            : availability.predict.submittedToday > 0
              ? {
                  kind: 'partial',
                  done: availability.predict.submittedToday,
                  total: availability.predict.totalMarkets,
                }
              : { kind: 'available', label: 'Dispo' },
        metric: { icon: Users, value: formatCount(counts.predict) },
      },
      {
        id: 'classement',
        category: ['all', 'ranking', 'xp'],
        href: '/jeux/classement',
        icon: Trophy,
        iconBg: 'from-indigo-500/30 to-purple-700/20',
        iconColor: 'text-indigo-300',
        title: 'Top trader',
        subtitle: 'Hebdo',
        status: { kind: 'available', label: 'Voir' },
        metric: { icon: Users, value: formatCount(counts.classement) },
      },
      {
        id: 'defi',
        category: ['all', 'challenges', 'daily'],
        href: '/jeux/clic',
        icon: Target,
        iconBg: 'from-pink-500/30 to-rose-700/20',
        iconColor: 'text-pink-300',
        title: 'Défi du jour',
        subtitle: challengeLabel.length > 30 ? 'Objectif unique' : challengeLabel,
        status: challengeDone
          ? { kind: 'done', label: 'Validé' }
          : { kind: 'available', label: 'À faire' },
      },
      {
        id: 'journal',
        category: ['all', 'daily', 'challenges'],
        href: '/jeux/journal',
        icon: BookHeart,
        iconBg: 'from-rose-500/30 to-pink-700/20',
        iconColor: 'text-rose-300',
        title: "Journal d'émotion",
        subtitle: 'Daily mood check',
        status: availability.journal.doneToday
          ? { kind: 'done', label: 'Fait' }
          : { kind: 'available', label: 'À noter' },
      },
      {
        id: 'fomo',
        category: ['all', 'daily', 'challenges'],
        href: '/jeux/fomo',
        icon: Brain,
        iconBg: 'from-pink-500/30 to-rose-700/20',
        iconColor: 'text-pink-300',
        title: 'FOMO Test',
        subtitle: '10 décisions · 4s',
        status: availability.fomo.available
          ? { kind: 'available', label: 'Dispo' }
          : { kind: 'cooldown', nextAt: availability.fomo.nextAt, label: 'Demain' },
      },
      {
        id: 'patience',
        category: ['all', 'daily', 'challenges'],
        href: '/jeux/patience',
        icon: Target,
        iconBg: 'from-purple-500/30 to-indigo-700/20',
        iconColor: 'text-purple-300',
        title: 'Patience Trainer',
        subtitle: 'Lâche au bon moment',
        status:
          availability.patience.runsLeft > 0
            ? {
                kind: 'limited',
                left: availability.patience.runsLeft,
                total: availability.patience.runsTotal,
              }
            : { kind: 'done', label: 'Limite' },
      },
      {
        id: 'aversion',
        category: ['all', 'weekly', 'challenges'],
        href: '/jeux/aversion',
        icon: Coins,
        iconBg: 'from-amber-500/30 to-orange-700/20',
        iconColor: 'text-amber-300',
        title: 'Aversion à la perte',
        subtitle: 'Test Kahneman',
        status: availability.aversion.available
          ? { kind: 'available', label: 'Dispo' }
          : { kind: 'cooldown', nextAt: availability.aversion.nextAt, label: 'Cooldown' },
      },
    ],
    [
      counts.wheel,
      counts.predict,
      counts.classement,
      challengeLabel,
      challengeDone,
      availability,
    ]
  );

  const filtered = cards.filter((c) => c.category.includes(active));

  return (
    <div className="px-4 sm:px-6 lg:px-8 pt-6 pb-12 max-w-7xl mx-auto space-y-6">
      {/* Hero + XP bar */}
      <div className="grid gap-5 lg:grid-cols-[1fr_auto]">
        <div>
          <div className="inline-flex items-center gap-2 mb-2">
            <span className="h-px w-6 bg-[var(--color-accent)]" />
            <span className="text-xs uppercase tracking-[0.2em] text-[var(--color-accent-hover)] font-medium">
              Jeux
            </span>
          </div>
          <h1 className="font-serif text-4xl md:text-5xl tracking-tight">
            Joue, monte en <span className="italic">niveau.</span>
          </h1>
          <p className="text-sm text-[var(--color-text-dim)] mt-2 max-w-xl">
            Des jeux trading pour progresser chaque jour.
          </p>
        </div>

        <div className="glass-strong rounded-[var(--radius-lg)] p-4 flex items-center gap-4 min-w-[260px]">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500/30 to-pink-500/30 text-2xl flex-shrink-0">
            {level.level.icon}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="font-serif text-base">{level.level.label}</span>
              <span className="text-[10px] text-[var(--color-text-dim)] font-mono">
                {xp} / {level.next?.minXp ?? xp} XP
              </span>
            </div>
            <div className="mt-1.5 h-1.5 bg-[var(--color-surface-tint)] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-pink-500 transition-all"
                style={{ width: `${Math.round(level.progress * 100)}%` }}
              />
            </div>
            <div className="text-[10px] text-[var(--color-text-faint)] mt-1">
              {level.next
                ? `Encore ${level.xpToNext} XP → ${level.next.icon} ${level.next.label}`
                : 'Niveau max'}
            </div>
          </div>
          <div className="flex flex-col items-center gap-0.5 border-l border-[var(--color-border)] pl-3">
            <Flame className="h-3.5 w-3.5 text-amber-300" />
            <span className="text-base font-serif text-amber-300 leading-none">
              {streak}
            </span>
            <span className="text-[9px] uppercase tracking-wider text-[var(--color-text-faint)]">
              streak
            </span>
          </div>
          <div className="flex flex-col items-center gap-0.5 border-l border-[var(--color-border)] pl-3">
            <Trophy className="h-3.5 w-3.5 text-emerald-300" />
            <span className="text-base font-serif text-emerald-300 leading-none">
              {longest}
            </span>
            <span className="text-[9px] uppercase tracking-wider text-[var(--color-text-faint)]">
              record
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setActive(c.id)}
            className={cn(
              'px-4 py-2 text-sm rounded-full transition-colors border',
              active === c.id
                ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white border-transparent shadow-lg'
                : 'border-[var(--color-border)] text-[var(--color-text-dim)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-tint)]'
            )}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Grid : Featured (Combo de clic) + cards secondaires */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,420px)_1fr]">
        {(active === 'all' || active === 'daily') && (
          <FeaturedCard
            href="/jeux/clic"
            runsLeft={availability.tap.runsLeft}
            runsTotal={availability.tap.runsTotal}
          />
        )}

        <div
          className={cn(
            'grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 auto-rows-fr',
            active !== 'all' && active !== 'daily' && 'lg:col-span-2'
          )}
        >
          {filtered.map((card) => (
            <VisualCard key={card.id} card={card} />
          ))}
        </div>
      </div>

      {/* Défis en cours */}
      <div className="glass rounded-[var(--radius-lg)] p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm uppercase tracking-wider text-[var(--color-text-faint)] inline-flex items-center gap-2">
            <Target className="h-4 w-4 text-[var(--color-accent-hover)]" />
            Défis en cours
          </h2>
          <Link
            href="/jeux/classement"
            className="text-xs text-[var(--color-accent-hover)] hover:underline"
          >
            Voir tous
          </Link>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <ChallengeBar
            icon={Target}
            iconColor="text-indigo-300"
            label="Précision"
            current={challenges.precision.correct}
            target={Math.max(challenges.precision.total, 10)}
            reward="+20 XP"
          />
          <ChallengeBar
            icon={Flame}
            iconColor="text-amber-300"
            label="Série"
            current={challenges.streak.current}
            target={challenges.streak.target}
            reward="+15 XP"
          />
          <ChallengeBar
            icon={Zap}
            iconColor="text-sky-300"
            label="Rush XP"
            current={challenges.rushXp.current}
            target={challenges.rushXp.target}
            reward="+25 XP"
          />
          <ChallengeBar
            icon={Trophy}
            iconColor="text-amber-300"
            label="Top 10%"
            currentLabel={challenges.topRank ? `#${challenges.topRank}` : '—'}
            current={challenges.topRank ?? 0}
            target={10}
            inverted
            reward="+50 XP"
          />
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Featured card — Combo de clic (Jeu du jour)
// ============================================================

function FeaturedCard({
  href,
  runsLeft,
  runsTotal,
}: {
  href: string;
  runsLeft: number;
  runsTotal: number;
}) {
  const exhausted = runsLeft === 0;
  return (
    <Link
      href={href}
      className="relative overflow-hidden rounded-[var(--radius-xl)] glass-strong p-6 flex flex-col gap-4 min-h-[420px] hover:-translate-y-0.5 transition-all border border-[var(--color-border-strong)] group"
      style={{
        backgroundImage:
          'radial-gradient(circle at 80% 30%, rgba(59, 130, 246, 0.25), transparent 50%), radial-gradient(circle at 30% 80%, rgba(168, 85, 247, 0.18), transparent 50%)',
      }}
    >
      <div className="flex items-center justify-between relative z-10">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-pink-500/15 border border-pink-500/30 text-pink-200 light:text-pink-800 px-3 py-1 text-[10px] uppercase tracking-wider font-medium">
          <Star className="h-3 w-3" />
          Jeu du jour
        </span>
        <span
          className={cn(
            'rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-wider font-medium',
            exhausted
              ? 'bg-rose-500/15 border-rose-500/30 text-rose-200 light:text-rose-800'
              : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-200 light:text-emerald-800'
          )}
        >
          {exhausted ? 'Limite atteinte' : `${runsLeft}/${runsTotal} runs`}
        </span>
      </div>

      <div className="relative z-10">
        <h2 className="font-serif text-3xl">Combo de clic</h2>
        <p className="text-sm text-[var(--color-text-dim)] mt-1">
          Tape, garde la barre verte, monte les paliers.
        </p>
      </div>

      {/* Illustration : éclair stylisé */}
      <div className="relative flex-1 flex items-center justify-center my-2">
        <LightningOrb />
      </div>

      <div className="relative z-10 space-y-2">
        <button
          type="button"
          className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-indigo-500 via-sky-500 to-purple-500 text-white font-medium py-3 shadow-lg group-hover:shadow-xl transition-shadow"
        >
          {exhausted ? 'Voir mon record' : 'Jouer maintenant'}
          <ArrowRight className="h-4 w-4" />
        </button>
        <div className="flex items-center justify-center gap-1.5 text-xs text-[var(--color-text-dim)]">
          <Zap className="h-3 w-3 text-amber-300" />
          5 paliers · jusqu&apos;à 200 XP par run
        </div>
      </div>
    </Link>
  );
}

function LightningOrb() {
  return (
    <div className="relative w-44 h-44">
      {/* Glow purple/blue background */}
      <div className="absolute inset-0 rounded-full bg-gradient-radial from-sky-400/50 via-purple-700/30 to-transparent blur-2xl" />
      {/* Boule */}
      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-sky-400 via-indigo-500 to-purple-700 shadow-[inset_0_0_60px_rgba(255,255,255,0.2),0_0_80px_rgba(59,130,246,0.5)] flex items-center justify-center">
        <Zap className="h-20 w-20 text-amber-300 drop-shadow-lg" fill="currentColor" />
      </div>
      {/* Reflets */}
      <div className="absolute top-6 left-8 h-10 w-10 rounded-full bg-white/30 blur-sm" />
      <div className="absolute top-12 left-12 h-3 w-3 rounded-full bg-white/60" />
      {/* Socle */}
      <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-32 h-3 rounded-full bg-black/40 blur-md" />
    </div>
  );
}

// ============================================================
// Visual card secondaire
// ============================================================

function VisualCard({ card }: { card: CardDef }) {
  const dimmed =
    card.status.kind === 'done' || card.status.kind === 'cooldown';

  return (
    <Link
      href={card.href}
      className={cn(
        'glass-strong rounded-[var(--radius-lg)] p-4 flex flex-col gap-3 h-full transition-all relative overflow-hidden',
        'hover:-translate-y-0.5 hover:border-[var(--color-border-strong)]',
        dimmed && 'opacity-70 hover:opacity-100'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className={cn(
            'inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br shadow-inner',
            card.iconBg
          )}
        >
          <card.icon className={cn('h-6 w-6', card.iconColor)} />
        </span>
        <StatusPill status={card.status} />
      </div>
      <div className="flex-1">
        <h3 className="font-serif text-base leading-tight">{card.title}</h3>
        <p className="text-xs text-[var(--color-text-dim)] mt-0.5 line-clamp-2">
          {card.subtitle}
        </p>
      </div>
      <div className="flex items-center justify-between text-[10px] text-[var(--color-text-faint)]">
        {card.metric ? (
          <span className="inline-flex items-center gap-1">
            <card.metric.icon className="h-3 w-3" />
            {card.metric.value}
          </span>
        ) : (
          <span />
        )}
        <ArrowRight className="h-3.5 w-3.5" />
      </div>

      {/* Overlay subtil "done" si limite atteinte / fait */}
      {card.status.kind === 'done' && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500/40" />
      )}
      {card.status.kind === 'cooldown' && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-amber-500/40" />
      )}
    </Link>
  );
}

function StatusPill({ status }: { status: Status }) {
  const stylesMap: Record<Status['kind'], string> = {
    available:
      'bg-emerald-500/15 border-emerald-500/40 text-emerald-200 light:text-emerald-800',
    limited:
      'bg-sky-500/15 border-sky-500/40 text-sky-200 light:text-sky-800',
    partial:
      'bg-amber-500/15 border-amber-500/40 text-amber-200 light:text-amber-800',
    cooldown:
      'bg-rose-500/15 border-rose-500/40 text-rose-200 light:text-rose-800',
    done: 'bg-[var(--color-surface-tint)] border-[var(--color-border)] text-[var(--color-text-dim)]',
  };

  let label = '';
  let Icon: React.ElementType | null = null;
  let style: string = stylesMap.available;

  switch (status.kind) {
    case 'available':
      label = status.label;
      style = stylesMap.available;
      Icon = Sparkles;
      break;
    case 'limited':
      label = `${status.left}/${status.total}`;
      style = stylesMap.limited;
      break;
    case 'partial':
      label = `${status.done}/${status.total}`;
      style = stylesMap.partial;
      break;
    case 'cooldown':
      label = status.label;
      style = stylesMap.cooldown;
      Icon = Clock;
      break;
    case 'done':
      label = status.label;
      style = stylesMap.done;
      Icon = CheckCircle2;
      break;
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-wider font-semibold whitespace-nowrap',
        style
      )}
    >
      {Icon ? <Icon className="h-3 w-3" /> : null}
      {label}
    </span>
  );
}

function ChallengeBar({
  icon: Icon,
  iconColor,
  label,
  current,
  target,
  currentLabel,
  reward,
  inverted = false,
}: {
  icon: React.ElementType;
  iconColor: string;
  label: string;
  current: number;
  target: number;
  currentLabel?: string;
  reward: string;
  inverted?: boolean;
}) {
  const pct = target > 0
    ? Math.max(0, Math.min(100, (current / target) * 100))
    : 0;
  const displayPct = inverted
    ? current === 0
      ? 0
      : Math.max(0, Math.min(100, ((target - current + 1) / target) * 100))
    : pct;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <Icon className={cn('h-4 w-4', iconColor)} />
        <span className="text-sm font-medium flex-1">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="font-mono text-sm tabular-nums">
          {currentLabel ?? current}
        </span>
        <span className="text-[10px] text-[var(--color-text-faint)]">
          {inverted ? `/ top ${target}` : `/ ${target}`}
        </span>
      </div>
      <div className="h-1.5 bg-[var(--color-surface-tint)] rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all"
          style={{ width: `${displayPct}%` }}
        />
      </div>
      <div className="text-[10px] text-[var(--color-accent-hover)] text-right font-mono">
        {reward}
      </div>
    </div>
  );
}

function formatCount(n: number): string {
  if (n < 1000) return String(n);
  return new Intl.NumberFormat('fr-FR').format(n);
}
