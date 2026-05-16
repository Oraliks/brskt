'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import type {
  LeaderboardRow,
  LeaderboardWindow,
  TapLeaderboardRow,
} from '@/lib/games/leaderboard';

interface Props {
  weekTop: LeaderboardRow[];
  monthTop: LeaderboardRow[];
  allTop: LeaderboardRow[];
  weekRank: { rank: number; xp: number } | null;
  monthRank: { rank: number; xp: number } | null;
  allRank: { rank: number; xp: number } | null;
  /** Top runs du mini-jeu de clic (3 fenêtres). */
  tapWeekTop: TapLeaderboardRow[];
  tapMonthTop: TapLeaderboardRow[];
  tapAllTop: TapLeaderboardRow[];
  userId: string;
}

type Category = 'xp' | 'tap';

const WINDOWS: { id: LeaderboardWindow; label: string }[] = [
  { id: 'week', label: 'Semaine' },
  { id: 'month', label: 'Mois' },
  { id: 'all_time', label: 'All-time' },
];

const CATEGORIES: { id: Category; label: string }[] = [
  { id: 'xp', label: 'XP global' },
  { id: 'tap', label: 'Tap (record)' },
];

export function LeaderboardTabs({
  weekTop,
  monthTop,
  allTop,
  weekRank,
  monthRank,
  allRank,
  tapWeekTop,
  tapMonthTop,
  tapAllTop,
  userId,
}: Props) {
  const [category, setCategory] = useState<Category>('xp');
  const [activeWindow, setActiveWindow] =
    useState<LeaderboardWindow>('week');

  const xpData: Record<LeaderboardWindow, LeaderboardRow[]> = {
    week: weekTop,
    month: monthTop,
    all_time: allTop,
  };
  const tapData: Record<LeaderboardWindow, TapLeaderboardRow[]> = {
    week: tapWeekTop,
    month: tapMonthTop,
    all_time: tapAllTop,
  };
  const xpRanks = { week: weekRank, month: monthRank, all_time: allRank };

  return (
    <div className="space-y-4">
      {/* Catégories */}
      <div className="inline-flex rounded-full bg-[var(--color-surface-tint)] p-1">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setCategory(c.id)}
            className={cn(
              'px-4 py-1.5 text-sm rounded-full transition-colors',
              category === c.id
                ? 'bg-[var(--color-bg-elevated)] text-[var(--color-text)] shadow-sm'
                : 'text-[var(--color-text-dim)] hover:text-[var(--color-text)]'
            )}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Fenêtres */}
      <div className="inline-flex rounded-full bg-[var(--color-surface-tint)] p-1 ml-2">
        {WINDOWS.map((w) => (
          <button
            key={w.id}
            type="button"
            onClick={() => setActiveWindow(w.id)}
            className={cn(
              'px-4 py-1.5 text-sm rounded-full transition-colors',
              activeWindow === w.id
                ? 'bg-[var(--color-bg-elevated)] text-[var(--color-text)] shadow-sm'
                : 'text-[var(--color-text-dim)] hover:text-[var(--color-text)]'
            )}
          >
            {w.label}
          </button>
        ))}
      </div>

      {/* Contenu */}
      {category === 'xp' ? (
        <XpBoard
          rows={xpData[activeWindow]}
          myRank={xpRanks[activeWindow]}
          userId={userId}
        />
      ) : (
        <TapBoard rows={tapData[activeWindow]} userId={userId} />
      )}
    </div>
  );
}

// ============================================================
// XP board (existant)
// ============================================================

function XpBoard({
  rows,
  myRank,
  userId,
}: {
  rows: LeaderboardRow[];
  myRank: { rank: number; xp: number } | null;
  userId: string;
}) {
  const meInTop = rows.some((r) => r.userId === userId);
  if (rows.length === 0) {
    return (
      <div className="glass rounded-[var(--radius-md)] p-8 text-center text-sm text-[var(--color-text-dim)]">
        Personne n&apos;a encore gagné d&apos;XP sur cette période. Sois le
        premier !
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <div className="glass rounded-[var(--radius-md)] overflow-hidden">
        {rows.map((r) => (
          <XpRow key={r.userId} row={r} highlight={r.userId === userId} />
        ))}
      </div>
      {!meInTop && myRank && myRank.rank > 0 && (
        <div className="glass-strong rounded-[var(--radius-md)] p-4 border-l-2 border-l-amber-500">
          <div className="text-xs uppercase tracking-wider text-[var(--color-text-faint)] mb-2">
            Ma position
          </div>
          <XpRow
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

function XpRow({
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

// ============================================================
// Tap board
// ============================================================

function TapBoard({
  rows,
  userId,
}: {
  rows: TapLeaderboardRow[];
  userId: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="glass rounded-[var(--radius-md)] p-8 text-center text-sm text-[var(--color-text-dim)]">
        Personne n&apos;a encore joué au mini-jeu de clic sur cette période.
      </div>
    );
  }
  return (
    <div className="glass rounded-[var(--radius-md)] overflow-hidden">
      {rows.map((r) => (
        <TapRow key={r.userId} row={r} highlight={r.userId === userId} />
      ))}
    </div>
  );
}

const TAP_TIER_ICON = ['⚪', '🟢', '🟡', '🟠', '🔴', '🟣'];

function TapRow({
  row,
  highlight,
}: {
  row: TapLeaderboardRow;
  highlight?: boolean;
}) {
  const medal =
    row.rank === 1
      ? '🥇'
      : row.rank === 2
      ? '🥈'
      : row.rank === 3
      ? '🥉'
      : null;
  const icon = TAP_TIER_ICON[row.bestLevel] ?? '⚪';

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
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-rose-500 text-sm text-white flex-shrink-0">
          {row.name.charAt(0).toUpperCase()}
        </span>
      )}
      <div className="flex-1 min-w-0">
        <div className="text-sm truncate">
          {row.name}
          {row.username && (
            <span className="text-[var(--color-text-faint)] text-xs ml-1.5">
              @{row.username}
            </span>
          )}
        </div>
        <div className="text-[10px] text-[var(--color-text-faint)]">
          {icon} Niv {row.bestLevel}
        </div>
      </div>
      <div className="font-mono text-sm text-amber-300">
        {row.bestTaps} taps
      </div>
    </div>
  );
}
