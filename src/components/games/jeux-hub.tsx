'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  BookHeart,
  Brain,
  Clock,
  Coins,
  Disc3,
  Flame,
  Gift,
  Lock,
  Rocket,
  Sparkles,
  Star,
  Target,
  Trophy,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Level } from '@/lib/games/xp';

type Category = 'all' | 'daily' | 'weekly' | 'challenges' | 'xp' | 'ranking' | 'bonus';

interface Props {
  level: { level: Level; next: Level | null; progress: number; xpToNext: number };
  xp: number;
  streak: number;
  longest: number;
  wheelAvailable: boolean;
  tapRunsLeft: number;
  challengeLabel: string;
  challengeDone: boolean;
  counts: { wheel: number; tap: number; predict: number; classement: number };
  challenges: {
    precision: { correct: number; total: number };
    streak: { current: number; target: number };
    rushXp: { current: number; target: number };
    topRank: number | null;
  };
  hasPredictionsToday: boolean;
}

const CATEGORIES: { id: Category; label: string }[] = [
  { id: 'all', label: 'Tous' },
  { id: 'daily', label: 'Quotidien' },
  { id: 'weekly', label: 'Hebdo' },
  { id: 'challenges', label: 'Défis' },
  { id: 'xp', label: 'XP' },
  { id: 'ranking', label: 'Classement' },
  { id: 'bonus', label: 'Bonus' },
];

interface CardDef {
  id: string;
  category: Category[];
  /** Si href défini → link cliquable, sinon "Bientôt" disabled */
  href?: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  title: string;
  subtitle: string;
  /** Badge top-right : XP / DISPO / ACTIF / Bientôt */
  badge?: { label: string; variant: 'xp' | 'dispo' | 'actif' | 'soon' };
  /** Métrique sous le titre : "X 1 245" ou label custom */
  metric?: { icon: React.ElementType; value: string };
  featured?: boolean;
}

export function JeuxHub({
  level,
  xp,
  streak,
  longest,
  // wheelAvailable et tapRunsLeft réservés pour de futurs indicateurs
  // dispo/cooldown dans les cards — actuellement non affichés mais
  // gardés pour la signature stable.
  challengeLabel,
  challengeDone,
  counts,
  challenges,
  hasPredictionsToday,
}: Props) {
  const [active, setActive] = useState<Category>('all');

  const cards = useMemo<CardDef[]>(
    () => [
      {
        id: 'roue',
        category: ['all', 'weekly', 'bonus'],
        href: '/jeux/roue',
        icon: Disc3,
        iconBg: 'from-rose-500/30 to-red-700/20',
        iconColor: 'text-rose-300',
        title: 'Roue de la fortune',
        subtitle: '1 spin / jour',
        badge: { label: 'XP', variant: 'xp' },
        metric: { icon: Users, value: formatCount(counts.wheel) },
      },
      {
        id: 'clic',
        category: ['all', 'daily'],
        href: '/jeux/clic',
        icon: Zap,
        iconBg: 'from-sky-500/30 to-indigo-700/20',
        iconColor: 'text-sky-300',
        title: 'Combo de clic',
        subtitle: '5 paliers',
        badge: { label: 'XP', variant: 'xp' },
        metric: { icon: Users, value: formatCount(counts.tap) },
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
        badge: { label: 'XP', variant: 'xp' },
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
        badge: challengeDone
          ? { label: 'Validé', variant: 'actif' }
          : { label: 'ACTIF', variant: 'actif' },
      },
      {
        id: 'coffre',
        category: ['all', 'bonus', 'daily'],
        icon: Gift,
        iconBg: 'from-pink-500/30 to-fuchsia-700/20',
        iconColor: 'text-pink-300',
        title: 'Coffre quotidien',
        subtitle: 'Cadeau / jour',
        badge: { label: 'Bientôt', variant: 'soon' },
      },
      {
        id: 'rush',
        category: ['all', 'bonus'],
        href: '/jeux/clic',
        icon: Flame,
        iconBg: 'from-amber-500/30 to-orange-700/20',
        iconColor: 'text-amber-300',
        title: 'Rush XP',
        subtitle: 'Temps limité',
        badge: { label: 'DISPO', variant: 'dispo' },
        metric: { icon: Sparkles, value: 'XP ×2' },
      },
      {
        id: 'serie',
        category: ['all', 'challenges'],
        href: '/jeux/predict',
        icon: Star,
        iconBg: 'from-amber-500/30 to-yellow-700/20',
        iconColor: 'text-amber-300',
        title: 'Série victorieuse',
        subtitle: 'Garde ton streak',
        badge: { label: 'ACTIF', variant: 'actif' },
        metric: {
          icon: Flame,
          value: `${streak} · record ${longest}`,
        },
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
        badge: { label: 'XP', variant: 'xp' },
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
        badge: { label: 'XP', variant: 'xp' },
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
        badge: { label: 'XP', variant: 'xp' },
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
        badge: { label: 'XP', variant: 'xp' },
      },
      {
        id: 'expert',
        category: ['all', 'bonus'],
        icon: Rocket,
        iconBg: 'from-indigo-500/30 to-blue-700/20',
        iconColor: 'text-indigo-300',
        title: 'Mode expert',
        subtitle: 'Vrais traders',
        badge: { label: 'Bientôt', variant: 'soon' },
      },
    ],
    [
      counts.wheel,
      counts.tap,
      counts.classement,
      challengeLabel,
      challengeDone,
      streak,
      longest,
    ]
  );

  const filtered = cards.filter((c) => c.category.includes(active));

  // Time until end of day (Paris ~21h for predictions)
  const endsIn = useEndOfDayCountdown();

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
            Joue, monte en{' '}
            <span className="italic">niveau.</span>
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

      {/* Grid : Featured + secondaires */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,420px)_1fr]">
        {/* Featured card "Jeu du jour" — Prono express */}
        {(active === 'all' || active === 'daily') && (
          <FeaturedCard
            title="Prono express"
            subtitle="5 marchés à deviner"
            href="/jeux/predict"
            cta={hasPredictionsToday ? 'Reprendre' : 'Jouer maintenant'}
            countdown={endsIn}
          />
        )}

        {/* Grille des cards secondaires */}
        <div
          className={cn(
            'grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 auto-rows-fr',
            (active !== 'all' && active !== 'daily') && 'lg:col-span-2'
          )}
        >
          {filtered
            .filter((c) => c.id !== 'predict')
            .map((card) => (
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
            currentLabel={
              challenges.topRank ? `#${challenges.topRank}` : '—'
            }
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
// Sous-composants
// ============================================================

function FeaturedCard({
  title,
  subtitle,
  href,
  cta,
  countdown,
}: {
  title: string;
  subtitle: string;
  href: string;
  cta: string;
  countdown: string;
}) {
  return (
    <Link
      href={href}
      className="relative overflow-hidden rounded-[var(--radius-xl)] glass-strong p-6 flex flex-col gap-4 min-h-[420px] hover:-translate-y-0.5 transition-all border border-[var(--color-border-strong)] group"
      style={{
        backgroundImage:
          'radial-gradient(circle at 80% 30%, rgba(168, 85, 247, 0.25), transparent 50%), radial-gradient(circle at 30% 80%, rgba(236, 72, 153, 0.15), transparent 50%)',
      }}
    >
      <div className="flex items-center justify-between relative z-10">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-pink-500/15 border border-pink-500/30 text-pink-200 light:text-pink-800 px-3 py-1 text-[10px] uppercase tracking-wider font-medium">
          <Star className="h-3 w-3" />
          Jeu du jour
        </span>
        <span className="rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-200 light:text-purple-800 px-2.5 py-1 text-[10px] uppercase tracking-wider font-medium">
          +10 XP
        </span>
      </div>

      <div className="relative z-10">
        <h2 className="font-serif text-3xl">{title}</h2>
        <p className="text-sm text-[var(--color-text-dim)] mt-1">{subtitle}</p>
      </div>

      {/* Illustration : boule de cristal stylisée */}
      <div className="relative flex-1 flex items-center justify-center my-2">
        <CrystalBall />
      </div>

      <div className="relative z-10 space-y-2">
        <button
          type="button"
          className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white font-medium py-3 shadow-lg group-hover:shadow-xl transition-shadow"
        >
          {cta}
          <ArrowRight className="h-4 w-4" />
        </button>
        <div className="flex items-center justify-center gap-1.5 text-xs text-[var(--color-text-dim)]">
          <Clock className="h-3 w-3" />
          {countdown}
        </div>
      </div>
    </Link>
  );
}

function CrystalBall() {
  return (
    <div className="relative w-44 h-44">
      {/* Glow background */}
      <div className="absolute inset-0 rounded-full bg-gradient-radial from-purple-500/50 via-purple-700/20 to-transparent blur-2xl" />
      {/* Boule */}
      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-purple-400 via-purple-600 to-purple-900 shadow-[inset_0_0_60px_rgba(255,255,255,0.2),0_0_80px_rgba(168,85,247,0.5)] flex items-center justify-center">
        <TrendingUp className="h-16 w-16 text-pink-300 drop-shadow-lg" />
      </div>
      {/* Reflets */}
      <div className="absolute top-6 left-8 h-10 w-10 rounded-full bg-white/30 blur-sm" />
      <div className="absolute top-12 left-12 h-3 w-3 rounded-full bg-white/60" />
      {/* Socle */}
      <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-32 h-3 rounded-full bg-black/40 blur-md" />
    </div>
  );
}

function VisualCard({ card }: { card: CardDef }) {
  const disabled = !card.href;
  const Content = (
    <div
      className={cn(
        'glass-strong rounded-[var(--radius-lg)] p-4 flex flex-col gap-3 h-full transition-all',
        !disabled && 'hover:-translate-y-0.5 hover:border-[var(--color-border-strong)]',
        disabled && 'opacity-60'
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
        {card.badge && <BadgePill {...card.badge} />}
      </div>
      <div className="flex-1">
        <h3 className="font-serif text-base leading-tight">{card.title}</h3>
        <p className="text-xs text-[var(--color-text-dim)] mt-0.5 line-clamp-2">
          {card.subtitle}
        </p>
      </div>
      {card.metric && (
        <div className="flex items-center justify-between text-[10px] text-[var(--color-text-faint)]">
          <span className="inline-flex items-center gap-1">
            <card.metric.icon className="h-3 w-3" />
            {card.metric.value}
          </span>
          {!disabled && <ArrowRight className="h-3.5 w-3.5" />}
        </div>
      )}
      {!card.metric && !disabled && (
        <div className="flex justify-end">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-surface-tint)]">
            <ArrowRight className="h-3.5 w-3.5 text-[var(--color-text-dim)]" />
          </span>
        </div>
      )}
      {disabled && (
        <div className="inline-flex items-center gap-1 text-[10px] text-[var(--color-text-faint)] uppercase tracking-wider">
          <Lock className="h-3 w-3" />
          Indisponible
        </div>
      )}
    </div>
  );

  if (disabled) return Content;
  return (
    <Link href={card.href ?? '#'} className="block h-full">
      {Content}
    </Link>
  );
}

function BadgePill({
  label,
  variant,
}: {
  label: string;
  variant: 'xp' | 'dispo' | 'actif' | 'soon';
}) {
  const styles = {
    xp: 'bg-purple-500/15 border-purple-500/30 text-purple-200 light:text-purple-800',
    dispo: 'bg-amber-500/15 border-amber-500/30 text-amber-200 light:text-amber-800',
    actif: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-200 light:text-emerald-800',
    soon: 'bg-sky-500/15 border-sky-500/30 text-sky-200 light:text-sky-800',
  }[variant];
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-wider font-semibold',
        styles
      )}
    >
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
  // Pour "Top 10%" (inverted), on inverse l'affichage : rank=1 → 100%, rank=10 → 0%
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

function useEndOfDayCountdown(): string {
  // Calcule le temps jusqu'à 21h Paris (clôture pronostic).
  // Côté serveur on rend une valeur initiale stable, et le client peut
  // re-render via une useEffect (omis pour rester simple — au pire le
  // user voit un délai légèrement obsolète, refresh corrige).
  const now = new Date();
  const endOfDay = new Date();
  // 21h Paris approximatif via UTC (~19-20h UTC selon DST)
  endOfDay.setUTCHours(19, 0, 0, 0);
  if (endOfDay.getTime() < now.getTime()) {
    endOfDay.setUTCDate(endOfDay.getUTCDate() + 1);
  }
  const diffMs = endOfDay.getTime() - now.getTime();
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  return `Fin dans ${hours}h ${minutes}m`;
}

function formatCount(n: number): string {
  if (n < 1000) return String(n);
  return new Intl.NumberFormat('fr-FR').format(n);
}
