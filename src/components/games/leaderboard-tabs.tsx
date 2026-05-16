'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { LeaderboardRow, LeaderboardWindow } from '@/lib/games/leaderboard';

interface Props {
  weekTop: LeaderboardRow[];
  monthTop: LeaderboardRow[];
  allTop: LeaderboardRow[];
  weekRank: { rank: number; xp: number } | null;
  monthRank: { rank: number; xp: number } | null;
  allRank: { rank: number; xp: number } | null;
  userId: string;
}

const TABS: { id: LeaderboardWindow; label: string }[] = [
  { id: 'week', label: 'Semaine' },
  { id: 'month', label: 'Mois' },
  { id: 'all_time', label: 'All-time' },
];

export function LeaderboardTabs({
  weekTop,
  monthTop,
  allTop,
  weekRank,
  monthRank,
  allRank,
  userId,
}: Props) {
  const [active, setActive] = useState<LeaderboardWindow>('week');

  const data: Record<LeaderboardWindow, LeaderboardRow[]> = {
    week: weekTop,
    month: monthTop,
    all_time: allTop,
  };
  const ranks = { week: weekRank, month: monthRank, all_time: allRank };
  const rows = data[active];
  const myRank = ranks[active];
  const meInTop = rows.some((r) => r.userId === userId);

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="inline-flex rounded-full bg-[var(--color-surface-tint)] p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActive(t.id)}
            className={cn(
              'px-4 py-1.5 text-sm rounded-full transition-colors',
              active === t.id
                ? 'bg-[var(--color-bg-elevated)] text-[var(--color-text)] shadow-sm'
                : 'text-[var(--color-text-dim)] hover:text-[var(--color-text)]'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Table */}
      {rows.length === 0 ? (
        <div className="glass rounded-[var(--radius-md)] p-8 text-center text-sm text-[var(--color-text-dim)]">
          Personne n&apos;a encore gagné d&apos;XP sur cette période. Sois le
          premier !
        </div>
      ) : (
        <div className="glass rounded-[var(--radius-md)] overflow-hidden">
          {rows.map((r) => (
            <Row key={r.userId} row={r} highlight={r.userId === userId} />
          ))}
        </div>
      )}

      {/* Ma position si hors top */}
      {!meInTop && myRank && myRank.rank > 0 && (
        <div className="glass-strong rounded-[var(--radius-md)] p-4 border-l-2 border-l-amber-500">
          <div className="text-xs uppercase tracking-wider text-[var(--color-text-faint)] mb-2">
            Ma position
          </div>
          <Row
            row={{
              rank: myRank.rank,
              userId,
              name: 'Toi',
              username: null,
              photoUrl: null,
              xp: myRank.xp,
              level: { id: 'oraliks', label: 'Oraliks', minXp: 0, icon: '🌱' },
            }}
            highlight
            isSelf
          />
        </div>
      )}
    </div>
  );
}

function Row({
  row,
  highlight,
  isSelf,
}: {
  row: LeaderboardRow;
  highlight?: boolean;
  isSelf?: boolean;
}) {
  const medal =
    row.rank === 1
      ? '🥇'
      : row.rank === 2
      ? '🥈'
      : row.rank === 3
      ? '🥉'
      : null;

  return (
    <div
      className={cn(
        'flex items-center gap-3 px-4 py-3 border-b border-[var(--color-border)] last:border-b-0',
        highlight && 'bg-amber-500/10'
      )}
    >
      <div className="w-8 text-center font-mono text-sm">
        {medal ?? `#${row.rank}`}
      </div>
      {row.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={row.photoUrl}
          alt=""
          className="h-9 w-9 rounded-full flex-shrink-0"
        />
      ) : (
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-pink-500 text-sm text-white flex-shrink-0">
          {row.name.charAt(0).toUpperCase()}
        </span>
      )}
      <div className="flex-1 min-w-0">
        <div className="text-sm truncate">
          {isSelf ? 'Toi' : row.name}
          {row.username && !isSelf && (
            <span className="text-[var(--color-text-faint)] text-xs ml-1.5">
              @{row.username}
            </span>
          )}
        </div>
        {!isSelf && (
          <div className="text-[10px] text-[var(--color-text-faint)]">
            {row.level.icon} {row.level.label}
          </div>
        )}
      </div>
      <div className="font-mono text-sm text-amber-300">{row.xp} XP</div>
    </div>
  );
}
