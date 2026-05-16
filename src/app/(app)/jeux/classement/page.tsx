import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { requireAuth } from '@/lib/auth/server';
import { Section, SectionHeader } from '@/components/shared/section';
import {
  getLeaderboard,
  getTapLeaderboard,
  getUserRank,
} from '@/lib/games/leaderboard';
import { LeaderboardTabs } from '@/components/games/leaderboard-tabs';
import { TelegramBackButton } from '@/components/mini/telegram-controls';

export const dynamic = 'force-dynamic';

export default async function ClassementPage() {
  const { user } = await requireAuth();

  const [
    weekTop,
    monthTop,
    allTop,
    weekRank,
    monthRank,
    allRank,
    tapWeekTop,
    tapMonthTop,
    tapAllTop,
  ] = await Promise.all([
    getLeaderboard('week', 20),
    getLeaderboard('month', 20),
    getLeaderboard('all_time', 20),
    getUserRank(user.id, 'week'),
    getUserRank(user.id, 'month'),
    getUserRank(user.id, 'all_time'),
    getTapLeaderboard('week', 20),
    getTapLeaderboard('month', 20),
    getTapLeaderboard('all_time', 20),
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
          eyebrow="Classement"
          title={
            <>
              Top traders <span className="font-serif italic">Boursikotons.</span>
            </>
          }
          description="Le classement bouge à chaque XP gagné. Top 20 affiché, ta position visible en bas même si tu n'es pas dans le top."
          align="left"
        />
      </Section>

      <Section className="py-4">
        <LeaderboardTabs
          weekTop={weekTop}
          monthTop={monthTop}
          allTop={allTop}
          weekRank={weekRank}
          monthRank={monthRank}
          allRank={allRank}
          tapWeekTop={tapWeekTop}
          tapMonthTop={tapMonthTop}
          tapAllTop={tapAllTop}
          userId={user.id}
        />
      </Section>
    </>
  );
}
