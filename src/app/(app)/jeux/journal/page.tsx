import Link from 'next/link';
import { ArrowLeft, BookHeart, Flame, TrendingUp } from 'lucide-react';
import { requireAuth } from '@/lib/auth/server';
import { Section, SectionHeader } from '@/components/shared/section';
import { TelegramBackButton } from '@/components/mini/telegram-controls';
import {
  getEmotionHistory,
  getEmotionStats,
} from '@/lib/games/emotion-journal';
import { EmotionForm } from '@/components/games/emotion-form';
import { EmotionHistory } from '@/components/games/emotion-history';

export const dynamic = 'force-dynamic';

export default async function JournalPage() {
  const { user } = await requireAuth();
  const [stats, history] = await Promise.all([
    getEmotionStats(user.id),
    getEmotionHistory(user.id, 30),
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
          eyebrow="Journal d'émotion"
          title={
            <>
              Comment tu te{' '}
              <span className="font-serif italic">sens ?</span>
            </>
          }
          description="Note ton état mental face au trading chaque jour. Au bout d'un mois, tu vois ta vraie courbe émotionnelle — la clé pour comprendre quand tu trades bien et quand tu te plantes."
          align="left"
        />
      </Section>

      {/* Stats rapides */}
      <Section className="py-3">
        <div className="grid grid-cols-3 gap-3">
          <StatCard
            label="Entrées"
            value={stats.totalEntries}
            icon={BookHeart}
            accent="indigo"
          />
          <StatCard
            label="Streak"
            value={stats.currentStreak}
            icon={Flame}
            accent="amber"
          />
          <StatCard
            label="Moyenne"
            value={
              stats.averageMood > 0
                ? `${stats.averageMood.toFixed(1)}/10`
                : '—'
            }
            icon={TrendingUp}
            accent="emerald"
          />
        </div>
      </Section>

      <Section className="py-4">
        <EmotionForm
          alreadyToday={stats.todayMood !== null}
          todayMood={stats.todayMood ?? 5}
        />
      </Section>

      {history.length > 0 && (
        <Section className="py-4">
          <h3 className="text-sm uppercase tracking-wider text-[var(--color-text-faint)] mb-3">
            30 derniers jours
          </h3>
          <EmotionHistory entries={history} />
        </Section>
      )}
    </>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: number | string;
  icon: React.ElementType;
  accent: 'indigo' | 'amber' | 'emerald';
}) {
  const colorClass =
    accent === 'amber'
      ? 'text-amber-300'
      : accent === 'emerald'
        ? 'text-emerald-300'
        : 'text-indigo-300';
  return (
    <div className="glass rounded-[var(--radius-md)] p-3 text-center space-y-1">
      <Icon className={`h-4 w-4 mx-auto ${colorClass}`} />
      <div className={`font-mono text-2xl font-semibold ${colorClass}`}>
        {value}
      </div>
      <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-faint)]">
        {label}
      </div>
    </div>
  );
}
