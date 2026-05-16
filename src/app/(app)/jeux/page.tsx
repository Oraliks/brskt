import Link from 'next/link';
import {
  ArrowRight,
  Flame,
  LineChart,
  Trophy,
  Disc,
  Sparkles,
} from 'lucide-react';
import { requireAuth } from '@/lib/auth/server';
import { getLevel, getUserXpState } from '@/lib/games/xp';
import { getWheelStatus } from '@/lib/games/wheel';
import { Section, SectionHeader } from '@/components/shared/section';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

/**
 * Hub des mini-jeux. 4 entrées : pronostic du jour, roue, classement,
 * sa progression XP. Page volontairement compacte pour rester rapide à
 * naviguer en Mini App.
 */
export default async function JeuxPage() {
  const { user } = await requireAuth();
  const [xpState, wheelStatus] = await Promise.all([
    getUserXpState(user.id),
    getWheelStatus(user.id),
  ]);

  const xp = xpState?.xpTotal ?? 0;
  const streak = xpState?.predictionStreakCount ?? 0;
  const longest = xpState?.predictionStreakLongest ?? 0;
  const { level, next, progress, xpToNext } = getLevel(xp);

  return (
    <>
      <Section className="pt-10 pb-4">
        <SectionHeader
          eyebrow="Jeux"
          title={
            <>
              Joue, monte en{' '}
              <span className="font-serif italic">niveau.</span>
            </>
          }
          description="Pronostique les marchés, fais ta roue de la semaine, grimpe au classement."
          align="left"
        />
      </Section>

      {/* Bandeau profil XP — compact, toujours visible */}
      <Section className="py-2">
        <div className="glass-strong rounded-[var(--radius-lg)] p-5 flex flex-col sm:flex-row sm:items-center gap-5">
          <div className="flex items-center gap-4 flex-1">
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500/30 to-pink-500/30 text-2xl">
              {level.icon}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-serif text-xl">{level.label}</span>
                {next && (
                  <Badge variant="outline" className="text-[10px]">
                    {xp} / {next.minXp} XP
                  </Badge>
                )}
                {!next && <Badge variant="gold">MAX</Badge>}
              </div>
              {next ? (
                <>
                  <div className="h-1.5 bg-[var(--color-surface-tint)] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 to-pink-500 transition-all"
                      style={{ width: `${Math.round(progress * 100)}%` }}
                    />
                  </div>
                  <div className="text-xs text-[var(--color-text-faint)] mt-1">
                    Encore {xpToNext} XP → {next.icon} {next.label}
                  </div>
                </>
              ) : (
                <div className="text-xs text-[var(--color-text-faint)]">
                  Niveau max atteint, légende vivante.
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4 sm:border-l sm:border-[var(--color-border)] sm:pl-5">
            <Stat icon={Flame} label="Streak" value={streak} accent="amber" />
            <Stat icon={Trophy} label="Record" value={longest} accent="emerald" />
          </div>
        </div>
      </Section>

      {/* Cards des jeux */}
      <Section className="py-4">
        <div className="grid gap-4 md:grid-cols-2">
          <GameCard
            href="/jeux/predict"
            icon={LineChart}
            badge="Quotidien"
            title="Pronostic chandelier"
            description="5 marchés. Tu prédis si chaque clôture du jour finit au-dessus ou en dessous de la veille. +10 XP par participation, +50 par bonne réponse."
            cta="Faire mes pronostics"
            highlight
          />
          <GameCard
            href="/jeux/roue"
            icon={Disc}
            badge="Hebdomadaire"
            title="Roue de la fortune"
            description="1 spin par semaine. XP, jackpot 1000 XP, ou codes promo formation. Garantit toujours quelque chose."
            cta={wheelStatus.canSpin ? 'Tourner la roue' : 'Voir le compteur'}
            note={wheelStatus.canSpin ? 'Disponible maintenant' : 'En cooldown'}
          />
          <GameCard
            href="/jeux/classement"
            icon={Trophy}
            badge="Classement"
            title="Top trader"
            description="3 leaderboards : semaine, mois, all-time. Les plus actifs montent."
            cta="Voir le classement"
          />
          <GameCard
            href="/dashboard"
            icon={Sparkles}
            badge="Retour"
            title="Mon espace"
            description="Tes formations, tes réservations, ton lien d'invitation."
            cta="Aller au dashboard"
          />
        </div>
      </Section>
    </>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  accent: 'amber' | 'emerald';
}) {
  const colorClass = accent === 'amber' ? 'text-amber-300' : 'text-emerald-300';
  return (
    <div className="flex items-center gap-2">
      <Icon className={cn('h-4 w-4', colorClass)} />
      <div>
        <div className={cn('font-serif text-lg leading-none', colorClass)}>
          {value}
        </div>
        <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-faint)]">
          {label}
        </div>
      </div>
    </div>
  );
}

function GameCard({
  href,
  icon: Icon,
  badge,
  title,
  description,
  cta,
  note,
  highlight,
}: {
  href: string;
  icon: React.ElementType;
  badge: string;
  title: string;
  description: string;
  cta: string;
  note?: string;
  highlight?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'glass-strong rounded-[var(--radius-lg)] p-5 flex flex-col gap-3 transition-all hover:-translate-y-0.5 hover:border-[var(--color-border-strong)]',
        highlight && 'ring-1 ring-amber-500/30'
      )}
    >
      <div className="flex items-center justify-between">
        <Badge variant={highlight ? 'gold' : 'outline'}>
          <Icon className="h-3 w-3 mr-1" />
          {badge}
        </Badge>
        {note && (
          <span className="text-[10px] text-[var(--color-text-faint)] uppercase tracking-wider">
            {note}
          </span>
        )}
      </div>
      <h3 className="font-serif text-xl">{title}</h3>
      <p className="text-sm text-[var(--color-text-dim)] flex-1">
        {description}
      </p>
      <span className="inline-flex items-center gap-1.5 text-sm text-[var(--color-accent-hover)]">
        {cta}
        <ArrowRight className="h-4 w-4" />
      </span>
    </Link>
  );
}
