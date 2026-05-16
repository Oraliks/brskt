import Link from 'next/link';
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Flame,
  Info,
  Lock,
  Trophy,
} from 'lucide-react';
import { requireAuth } from '@/lib/auth/server';
import { Section, SectionHeader } from '@/components/shared/section';
import { Badge } from '@/components/ui/badge';
import { TapGame } from '@/components/games/tap-game';
import { TapUpgradeButton } from '@/components/games/tap-upgrade-button';
import { TelegramBackButton } from '@/components/mini/telegram-controls';
import {
  getTapMeta,
  getTapRunHistory,
  TAP_DAILY_LIMIT,
  TAP_LEVELS,
  TAP_UPGRADES,
} from '@/lib/games/tap';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function ClicPage() {
  const { user } = await requireAuth();
  const [meta, history] = await Promise.all([
    getTapMeta(user.id),
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
          description="2 modes : enchaîne en gardant la barre de combo, ou explose le compteur en 10 secondes."
          align="left"
        />
      </Section>

      <Section className="py-2">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-3 py-1 border',
              meta.runsLeftToday > 0
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                : 'border-rose-500/30 bg-rose-500/10 text-rose-200'
            )}
          >
            <Flame className="h-3 w-3" />
            {meta.runsLeftToday} / {TAP_DAILY_LIMIT} runs aujourd&apos;hui
          </span>
          {meta.bestTaps > 0 && (
            <span className="inline-flex items-center gap-1.5 text-amber-300">
              <Trophy className="h-3 w-3" />
              Record : {meta.bestTaps} taps (Niv {meta.bestLevel})
            </span>
          )}
        </div>
      </Section>

      {/* Défi du jour */}
      <Section className="py-3">
        <div
          className={cn(
            'glass-strong rounded-[var(--radius-lg)] p-4 border-l-2',
            meta.challengeDoneToday
              ? 'border-l-emerald-500'
              : 'border-l-amber-500'
          )}
        >
          <div className="flex items-start gap-3">
            <Calendar className="h-5 w-5 text-amber-300 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-faint)]">
                  Défi du jour
                </span>
                {meta.challengeDoneToday ? (
                  <Badge variant="success" className="text-[10px]">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Validé
                  </Badge>
                ) : (
                  <Badge variant="gold" className="text-[10px]">
                    +{meta.challenge.bonusXp} XP
                  </Badge>
                )}
              </div>
              <div className="font-medium text-sm">{meta.challenge.label}</div>
              <p className="text-xs text-[var(--color-text-dim)] mt-0.5">
                {meta.challenge.description}
              </p>
            </div>
          </div>
        </div>
      </Section>

      <Section className="py-6">
        <TapGame
          canPlay={meta.runsLeftToday > 0}
          config={{
            hasComboUpgrade: meta.upgrades.combo,
            hasDrainUpgrade: meta.upgrades.drain,
          }}
        />
      </Section>

      {/* Améliorations permanentes */}
      <Section className="py-4">
        <h3 className="text-sm uppercase tracking-wider text-[var(--color-text-faint)] mb-3">
          Améliorations permanentes
        </h3>
        <div className="grid gap-3 md:grid-cols-3">
          {(['combo', 'drain', 'xp'] as const).map((id) => {
            const upgrade = TAP_UPGRADES[id];
            const owned = meta.upgrades[id];
            const canAfford = meta.xpTotal >= upgrade.cost;
            return (
              <div
                key={id}
                className={cn(
                  'glass rounded-[var(--radius-md)] p-4 flex flex-col gap-2',
                  owned && 'border border-emerald-500/40'
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{upgrade.icon}</span>
                    <span className="font-medium text-sm">{upgrade.label}</span>
                  </div>
                  {owned ? (
                    <Badge variant="success" className="text-[10px]">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Acquis
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px]">
                      {upgrade.cost} XP
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-[var(--color-text-dim)] flex-1">
                  {upgrade.description}
                </p>
                {!owned && (
                  <TapUpgradeButton
                    upgradeId={id}
                    disabled={!canAfford}
                    label={
                      canAfford
                        ? `Acheter (${upgrade.cost} XP)`
                        : `Manque ${upgrade.cost - meta.xpTotal} XP`
                    }
                    icon={canAfford ? undefined : <Lock className="h-3.5 w-3.5" />}
                  />
                )}
              </div>
            );
          })}
        </div>
      </Section>

      <Section className="py-4">
        <div className="glass rounded-[var(--radius-md)] p-4 flex gap-3 text-xs text-[var(--color-text-dim)]">
          <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <div className="space-y-2 flex-1">
            <p>
              <strong className="text-[var(--color-text)]">Règles.</strong>{' '}
              Mode <strong>Combo</strong> : tape sans laisser la barre
              atteindre 0. Mode <strong>Burst</strong> : 10 secondes pour
              taper le plus possible. Power-ups (❄️ freeze 3s, ⚡ boost)
              apparaissent en mode Combo. 3 runs / 24h.
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
