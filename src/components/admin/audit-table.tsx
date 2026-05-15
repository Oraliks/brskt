'use client';

import { useState } from 'react';
import {
  Activity,
  Bot,
  Briefcase,
  CalendarCheck,
  CalendarX,
  ChevronRight,
  Clock,
  ExternalLink,
  GraduationCap,
  Key,
  MessageSquare,
  Pencil,
  Settings as SettingsIcon,
  Shield,
  ShieldCheck,
  Sparkles,
  Sun,
  Tag,
  Users,
  Zap,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

export interface AuditLogRow {
  id: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  createdAt: Date;
  adminId: string | null;
  adminName: string | null;
  adminEmail: string | null;
  adminTelegramUsername: string | null;
}

/**
 * Mapping action → icône + tone (couleur du badge).
 * Pattern : préfixe d'action → famille.
 * Fallback : Shield gris pour les actions non répertoriées.
 */
function getActionVisual(action: string): {
  icon: React.ComponentType<{ className?: string }>;
  tone: 'indigo' | 'emerald' | 'amber' | 'rose' | 'pink' | 'sky' | 'gold' | 'slate';
} {
  if (action.startsWith('ical_token'))
    return { icon: Key, tone: 'indigo' };
  if (action.startsWith('automations'))
    return { icon: Zap, tone: 'indigo' };
  if (action === 'community_count_override')
    return { icon: Users, tone: 'indigo' };
  if (action.startsWith('testimonial'))
    return { icon: MessageSquare, tone: 'pink' };
  if (action === 'booking_confirm')
    return { icon: CalendarCheck, tone: 'emerald' };
  if (action === 'booking_propose_alternative')
    return { icon: Clock, tone: 'amber' };
  if (
    action === 'booking_refuse' ||
    action === 'booking_force_cancel'
  )
    return { icon: CalendarX, tone: 'rose' };
  if (action === 'booking_update_notes')
    return { icon: Pencil, tone: 'slate' };
  if (action === 'progress_set')
    return { icon: Activity, tone: 'indigo' };
  if (action.startsWith('vip_override'))
    return { icon: Sparkles, tone: 'gold' };
  if (action === 'daily_briefing_update')
    return { icon: Sun, tone: 'amber' };
  if (action === 'bot_features_update')
    return { icon: Bot, tone: 'indigo' };
  if (action.startsWith('formation'))
    return { icon: GraduationCap, tone: 'indigo' };
  if (action.startsWith('promo'))
    return { icon: Tag, tone: 'indigo' };
  if (action.startsWith('offline_coaching'))
    return { icon: Briefcase, tone: 'indigo' };
  if (
    action === 'user_set_role' ||
    action === 'user_set_banned'
  )
    return { icon: ShieldCheck, tone: 'rose' };
  if (action.startsWith('ironfx') || action === 'welcome_bonus_update')
    return { icon: SettingsIcon, tone: 'indigo' };
  return { icon: Shield, tone: 'slate' };
}

const TONE_BG: Record<
  ReturnType<typeof getActionVisual>['tone'],
  string
> = {
  indigo:
    'bg-indigo-500/15 border-indigo-500/30 text-indigo-300 light:text-indigo-700',
  emerald:
    'bg-emerald-500/15 border-emerald-500/30 text-emerald-300 light:text-emerald-700',
  amber:
    'bg-amber-400/15 border-amber-400/30 text-amber-300 light:text-amber-700',
  rose: 'bg-rose-500/15 border-rose-500/30 text-rose-300 light:text-rose-700',
  pink: 'bg-pink-500/15 border-pink-500/30 text-pink-300 light:text-pink-700',
  sky: 'bg-sky-500/15 border-sky-500/30 text-sky-300 light:text-sky-700',
  gold: 'bg-amber-500/15 border-amber-500/30 text-amber-200 light:text-amber-800',
  slate:
    'bg-[var(--color-surface-tint-strong)] border-[var(--color-border)] text-[var(--color-text-dim)]',
};

const AVATAR_TONES = [
  'bg-indigo-500 light:bg-indigo-500',
  'bg-pink-500 light:bg-pink-500',
  'bg-emerald-500 light:bg-emerald-500',
  'bg-amber-500 light:bg-amber-500',
  'bg-sky-500 light:bg-sky-500',
  'bg-rose-500 light:bg-rose-500',
];

/** Hash stable d'un string vers une couleur (pour les avatars admins). */
function avatarTone(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return AVATAR_TONES[Math.abs(h) % AVATAR_TONES.length]!;
}

export function AuditTable({ rows }: { rows: AuditLogRow[] }) {
  const [diffRow, setDiffRow] = useState<AuditLogRow | null>(null);

  if (rows.length === 0) {
    return (
      <div className="glass rounded-[var(--radius-lg)] p-10 text-center">
        <p className="text-sm text-[var(--color-text-dim)]">
          Aucune action enregistrée pour ces filtres.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="glass rounded-[var(--radius-lg)] overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Action</TableHead>
              <TableHead>Cible</TableHead>
              <TableHead>Admin</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Détails</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <Row key={row.id} row={row} onOpenDiff={() => setDiffRow(row)} />
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog
        open={!!diffRow}
        onOpenChange={(o) => !o && setDiffRow(null)}
      >
        {diffRow && <DiffDialog row={diffRow} />}
      </Dialog>
    </>
  );
}

function Row({
  row,
  onOpenDiff,
}: {
  row: AuditLogRow;
  onOpenDiff: () => void;
}) {
  const visual = getActionVisual(row.action);
  const Icon = visual.icon;
  const hasDiff = !!row.before || !!row.after;

  const adminLabel =
    row.adminName ??
    (row.adminTelegramUsername ? `@${row.adminTelegramUsername}` : 'admin');
  const initial = adminLabel.charAt(0).toUpperCase();
  const avatarColor = avatarTone(row.adminId ?? adminLabel);

  return (
    <TableRow
      onClick={() => hasDiff && onOpenDiff()}
      className={hasDiff ? 'cursor-pointer' : ''}
    >
      <TableCell>
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            className={cn(
              'inline-flex h-7 w-7 items-center justify-center rounded-md border flex-shrink-0',
              TONE_BG[visual.tone]
            )}
          >
            <Icon className="h-3.5 w-3.5" />
          </span>
          <code className="text-[11px] font-mono bg-[var(--color-surface-tint)] border border-[var(--color-border)] px-1.5 py-0.5 rounded">
            {row.action}
          </code>
        </div>
      </TableCell>
      <TableCell className="text-xs text-[var(--color-text-dim)]">
        {row.targetType ? (
          <>
            sur{' '}
            <span className="font-mono text-[var(--color-text)]">
              {row.targetType}
              {row.targetId ? `#${row.targetId.slice(0, 8)}` : ''}
            </span>
          </>
        ) : (
          <span className="text-[var(--color-text-faint)]">—</span>
        )}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2.5">
          <span
            className={cn(
              'inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold text-white flex-shrink-0',
              avatarColor
            )}
          >
            {initial}
          </span>
          <div className="min-w-0">
            <div className="text-xs font-medium truncate">{adminLabel}</div>
            {row.adminEmail && (
              <div className="text-[10px] text-[var(--color-text-faint)] truncate">
                {row.adminEmail}
              </div>
            )}
          </div>
        </div>
      </TableCell>
      <TableCell className="text-xs text-[var(--color-text-dim)] tabular-nums whitespace-nowrap">
        {formatDateTime(row.createdAt)}
      </TableCell>
      <TableCell className="text-right">
        <div className="inline-flex items-center gap-2">
          {hasDiff ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenDiff();
              }}
              className="text-xs text-[var(--color-accent-hover)] hover:underline inline-flex items-center gap-1"
            >
              Voir le diff
              <ExternalLink className="h-3 w-3" />
            </button>
          ) : (
            <span className="text-xs text-[var(--color-text-faint)]">—</span>
          )}
          <ChevronRight className="h-3.5 w-3.5 text-[var(--color-text-faint)]" />
        </div>
      </TableCell>
    </TableRow>
  );
}

function DiffDialog({ row }: { row: AuditLogRow }) {
  return (
    <DialogContent className="max-w-3xl">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 flex-wrap">
          <code className="text-xs font-mono bg-[var(--color-surface-tint)] px-2 py-0.5 rounded">
            {row.action}
          </code>
          {row.targetType && (
            <Badge variant="secondary" className="text-[10px]">
              {row.targetType}
              {row.targetId ? `#${row.targetId.slice(0, 8)}` : ''}
            </Badge>
          )}
        </DialogTitle>
        <DialogDescription>
          Par{' '}
          <strong className="text-[var(--color-text)]">
            {row.adminName ?? row.adminTelegramUsername ?? 'admin'}
          </strong>{' '}
          · {formatDateTime(row.createdAt)}
        </DialogDescription>
      </DialogHeader>

      <div className="grid sm:grid-cols-2 gap-3">
        {row.before && (
          <div>
            <div className="text-[10px] uppercase tracking-wider text-rose-300 light:text-rose-700 mb-1.5">
              Avant
            </div>
            <pre className="font-mono text-[11px] bg-rose-500/5 border border-rose-500/20 p-3 rounded-[var(--radius-md)] overflow-auto max-h-96">
              {JSON.stringify(row.before, null, 2)}
            </pre>
          </div>
        )}
        {row.after && (
          <div>
            <div className="text-[10px] uppercase tracking-wider text-emerald-300 light:text-emerald-700 mb-1.5">
              Après
            </div>
            <pre className="font-mono text-[11px] bg-emerald-500/5 border border-emerald-500/20 p-3 rounded-[var(--radius-md)] overflow-auto max-h-96">
              {JSON.stringify(row.after, null, 2)}
            </pre>
          </div>
        )}
        {!row.before && !row.after && (
          <div className="col-span-2 text-xs text-[var(--color-text-dim)] py-6 text-center">
            Cette action n&apos;a pas de payload before/after.
          </div>
        )}
      </div>
    </DialogContent>
  );
}

function formatDateTime(d: Date): string {
  return d.toLocaleString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
