import { ArrowLeft, Clock, Flame, Info } from 'lucide-react';
import Link from 'next/link';
import { requireAuth } from '@/lib/auth/server';
import { Section, SectionHeader } from '@/components/shared/section';
import { Badge } from '@/components/ui/badge';
import {
  getTodayMarkets,
  getUserPredictionHistory,
} from '@/lib/games/predictions';
import {
  getParisDate,
  isPredictionWindowOpen,
  MARKETS,
  PREDICTION_LOCK_HOUR_PARIS,
} from '@/lib/games/markets';
import { getUserXpState } from '@/lib/games/xp';
import { MarketPredictCard } from '@/components/games/market-predict-card';
import { PredictionHistory } from '@/components/games/prediction-history';
import { TelegramBackButton } from '@/components/mini/telegram-controls';

export const dynamic = 'force-dynamic';

export default async function PredictPage() {
  const { user } = await requireAuth();
  const [markets, history, xpState] = await Promise.all([
    getTodayMarkets(user.id),
    getUserPredictionHistory(user.id, 15),
    getUserXpState(user.id),
  ]);

  const windowOpen = isPredictionWindowOpen();
  const today = getParisDate();

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
          eyebrow="Pronostic du jour"
          title={
            <>
              Le marché finit{' '}
              <span className="font-serif italic">haut ou bas ?</span>
            </>
          }
          description="Pour chaque marché ci-dessous, prédis si la clôture du jour sera supérieure ou inférieure à celle de la veille. +10 XP par participation, +50 XP si tu as raison."
          align="left"
        />
      </Section>

      <Section className="py-2">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <Badge variant="outline">
            <Clock className="h-3 w-3 mr-1" />
            {today}
          </Badge>
          {windowOpen ? (
            <span className="text-emerald-300 inline-flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Fenêtre ouverte — clôture à {PREDICTION_LOCK_HOUR_PARIS}h Paris
            </span>
          ) : (
            <span className="text-rose-300 inline-flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
              Fenêtre fermée — reviens demain matin
            </span>
          )}
          {xpState && (
            <span className="text-amber-300 inline-flex items-center gap-1">
              <Flame className="h-3 w-3" />
              Streak {xpState.predictionStreakCount}
            </span>
          )}
        </div>
      </Section>

      <Section className="py-4">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {markets.map((m) => (
            <MarketPredictCard
              key={m.market}
              market={m.market}
              meta={MARKETS[m.market]}
              openPrice={m.openPrice}
              closePrice={m.closePrice}
              userPrediction={m.userPrediction}
              resolved={m.resolved}
              windowOpen={windowOpen}
            />
          ))}
        </div>
      </Section>

      <Section className="py-6">
        <div className="glass rounded-[var(--radius-md)] p-4 flex gap-3 text-xs text-[var(--color-text-dim)]">
          <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <p>
            <strong className="text-[var(--color-text)]">
              Comment ça marche.
            </strong>{' '}
            Chaque jour, le prix de référence est le close de la veille. Tu
            choisis « plus haut » ou « plus bas » avant 21h Paris. Le
            résultat tombe en soirée, ton XP est crédité automatiquement.
            Reviens chaque jour pour entretenir ton streak — les
            milestones (7, 14, 30, 90 jours) donnent un gros bonus.
          </p>
        </div>
      </Section>

      {history.length > 0 && (
        <Section className="py-4">
          <h3 className="text-sm uppercase tracking-wider text-[var(--color-text-faint)] mb-3">
            Mon historique
          </h3>
          <PredictionHistory items={history} />
        </Section>
      )}
    </>
  );
}
