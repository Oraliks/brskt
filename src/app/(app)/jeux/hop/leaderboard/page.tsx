import Link from 'next/link';
import { ArrowLeft, Crown, Medal, Trophy } from 'lucide-react';
import { requireAuth } from '@/lib/auth/server';
import { Section, SectionHeader } from '@/components/shared/section';
import { TelegramBackButton } from '@/components/mini/telegram-controls';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { inArray } from 'drizzle-orm';
import {
  CANDLE_HOP_MODES,
  CANDLE_HOP_MODE_LABELS,
  getCandleHopTopScores,
  getCandleHopUserRank,
  type CandleHopMode,
} from '@/lib/games/candle-hop';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ mode?: string }>;
}

export default async function CandleHopLeaderboardPage({ searchParams }: PageProps) {
  const { user } = await requireAuth();
  const params = await searchParams;
  const mode: CandleHopMode = CANDLE_HOP_MODES.includes(
    params.mode as CandleHopMode
  )
    ? (params.mode as CandleHopMode)
    : 'endless';

  const [topScores, userRank] = await Promise.all([
    getCandleHopTopScores(mode, 20),
    getCandleHopUserRank(user.id, mode),
  ]);

  // Récupère les usernames pour les top
  const userIds = topScores.map((s) => s.userId);
  const userRows =
    userIds.length > 0
      ? await db
          .select({
            id: users.id,
            telegramUsername: users.telegramUsername,
            firstName: users.telegramFirstName,
            name: users.name,
          })
          .from(users)
          .where(inArray(users.id, userIds))
      : [];
  const userMap = new Map(userRows.map((u) => [u.id, u]));

  return (
    <>
      <TelegramBackButton />
      <Section className="pt-10 pb-3">
        <div className="flex items-center gap-2 text-xs text-[var(--color-text-dim)] mb-4">
          <Link
            href="/jeux/hop"
            className="inline-flex items-center gap-1 hover:text-[var(--color-text)]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Candle Hop
          </Link>
        </div>
        <SectionHeader
          eyebrow="Leaderboard"
          title={
            <>
              Les <span className="font-serif italic">légendes</span> du graph.
            </>
          }
          description="Top 20 scores par mode. Ton meilleur score affiché en bas si tu n'es pas dans le top."
          align="left"
        />
      </Section>

      {/* Tabs modes */}
      <Section className="py-3">
        <div className="flex flex-wrap gap-2">
          {CANDLE_HOP_MODES.map((m) => (
            <Link
              key={m}
              href={`/jeux/hop/leaderboard?mode=${m}`}
              className={cn(
                'px-4 py-2 rounded-full text-sm border transition-colors',
                m === mode
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white border-transparent shadow-lg'
                  : 'border-[var(--color-border)] text-[var(--color-text-dim)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-tint)]'
              )}
            >
              {CANDLE_HOP_MODE_LABELS[m].label}
            </Link>
          ))}
        </div>
      </Section>

      <Section className="py-4">
        <div className="glass rounded-[var(--radius-lg)] p-4 space-y-2">
          {topScores.length === 0 ? (
            <div className="text-center py-12 text-sm text-[var(--color-text-dim)]">
              Personne n&apos;a encore joué en mode{' '}
              <span className="text-[var(--color-text)] font-medium">
                {CANDLE_HOP_MODE_LABELS[mode].label}
              </span>
              . Sois le premier.
            </div>
          ) : (
            topScores.map((row, idx) => {
              const u = userMap.get(row.userId);
              const isMe = row.userId === user.id;
              return (
                <LeaderboardRow
                  key={row.userId}
                  rank={idx + 1}
                  name={
                    u
                      ? u.telegramUsername
                        ? `@${u.telegramUsername}`
                        : (u.firstName ?? u.name ?? '—')
                      : '—'
                  }
                  score={row.bestScore}
                  isMe={isMe}
                />
              );
            })
          )}
        </div>

        {/* Ton rang si pas dans top */}
        {userRank && userRank.rank > topScores.length && (
          <div className="mt-4 glass-strong rounded-[var(--radius-md)] p-3 flex items-center gap-3 border border-amber-500/30">
            <span className="font-mono text-amber-300 font-semibold">
              #{userRank.rank}
            </span>
            <span className="flex-1 text-sm text-[var(--color-text)]">Toi</span>
            <span className="font-mono font-semibold tabular-nums">
              {userRank.bestScore}
            </span>
          </div>
        )}
      </Section>
    </>
  );
}

function LeaderboardRow({
  rank,
  name,
  score,
  isMe,
}: {
  rank: number;
  name: string;
  score: number;
  isMe: boolean;
}) {
  const medal =
    rank === 1 ? (
      <Crown className="h-4 w-4 text-amber-300" />
    ) : rank === 2 ? (
      <Medal className="h-4 w-4 text-slate-300" />
    ) : rank === 3 ? (
      <Medal className="h-4 w-4 text-orange-400" />
    ) : (
      <span className="font-mono text-xs text-[var(--color-text-faint)] w-4 inline-block text-center">
        {rank}
      </span>
    );

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-md px-3 py-2',
        isMe
          ? 'bg-gradient-to-r from-amber-500/10 to-pink-500/5 border border-amber-500/30'
          : 'bg-[var(--color-surface-tint)]'
      )}
    >
      <div className="w-6 flex items-center justify-center">{medal}</div>
      <span className="flex-1 text-sm truncate">
        {name}
        {isMe && (
          <span className="ml-2 text-[10px] text-amber-300 uppercase tracking-wider font-mono">
            Toi
          </span>
        )}
      </span>
      <span className="font-mono font-semibold tabular-nums text-sm">
        {score}
      </span>
      <Trophy className="h-3 w-3 text-[var(--color-text-faint)]" />
    </div>
  );
}
