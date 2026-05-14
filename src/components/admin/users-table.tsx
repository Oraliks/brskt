'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Ban,
  CheckCircle2,
  Loader2,
  MoreHorizontal,
  Search,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from '@/components/ui/use-toast';
import { adminSetUserBannedAction } from '@/lib/actions/admin';
import { formatDate } from '@/lib/utils';

export interface AdminUserRow {
  id: string;
  name: string;
  email: string | null;
  role: 'user' | 'admin';
  telegramId: number | null;
  telegramUsername: string | null;
  telegramPhotoUrl: string | null;
  onboardingCompletedAt: Date | null;
  bannedAt: Date | null;
  bannedReason: string | null;
  createdAt: Date;
}

type Filter = 'all' | 'admins' | 'pending' | 'banned';

interface Props {
  users: AdminUserRow[];
  currentAdminId: string;
}

export function UsersTable({ users, currentAdminId }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [banDialog, setBanDialog] = useState<AdminUserRow | null>(null);
  const [banReason, setBanReason] = useState('');
  const [pending, start] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((u) => {
      if (filter === 'admins' && u.role !== 'admin') return false;
      if (filter === 'pending' && u.onboardingCompletedAt) return false;
      if (filter === 'banned' && !u.bannedAt) return false;
      if (!q) return true;
      return (
        u.name.toLowerCase().includes(q) ||
        (u.email ?? '').toLowerCase().includes(q) ||
        (u.telegramUsername ?? '').toLowerCase().includes(q) ||
        String(u.telegramId ?? '').includes(q)
      );
    });
  }, [users, query, filter]);

  function ban() {
    if (!banDialog) return;
    const target = banDialog;
    start(async () => {
      const result = await adminSetUserBannedAction({
        userId: target.id,
        banned: true,
        reason: banReason.trim() || undefined,
      });
      if (result.success) {
        toast({ title: `✓ ${target.name} banni` });
        setBanDialog(null);
        setBanReason('');
        router.refresh();
      } else {
        toast({
          title: 'Erreur',
          description: result.error,
          variant: 'destructive',
        });
      }
    });
  }

  function unban(user: AdminUserRow) {
    start(async () => {
      const result = await adminSetUserBannedAction({
        userId: user.id,
        banned: false,
      });
      if (result.success) {
        toast({ title: `✓ ${user.name} ré-autorisé` });
        router.refresh();
      } else {
        toast({
          title: 'Erreur',
          description: result.error,
          variant: 'destructive',
        });
      }
    });
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-text-faint)] pointer-events-none" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher (nom, email, @telegram, ID)…"
            className="pl-9 h-9"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 inline-flex items-center justify-center rounded text-[var(--color-text-faint)] hover:bg-[var(--color-surface-tint)]"
              aria-label="Effacer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <FilterChip value="all" current={filter} setFilter={setFilter} count={users.length}>
          Tous
        </FilterChip>
        <FilterChip
          value="admins"
          current={filter}
          setFilter={setFilter}
          count={users.filter((u) => u.role === 'admin').length}
        >
          Admins
        </FilterChip>
        <FilterChip
          value="pending"
          current={filter}
          setFilter={setFilter}
          count={users.filter((u) => !u.onboardingCompletedAt).length}
        >
          Onboarding
        </FilterChip>
        <FilterChip
          value="banned"
          current={filter}
          setFilter={setFilter}
          count={users.filter((u) => u.bannedAt).length}
        >
          Bannis
        </FilterChip>
      </div>

      <div className="glass rounded-[var(--radius-lg)] overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Utilisateur</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Rôle</TableHead>
              <TableHead>État</TableHead>
              <TableHead>Inscrit</TableHead>
              <TableHead className="w-12 text-right">⋯</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-sm text-[var(--color-text-dim)]">
                  Aucun utilisateur ne correspond
                </TableCell>
              </TableRow>
            )}
            {filtered.map((u) => {
              const isSelf = u.id === currentAdminId;
              return (
                <TableRow key={u.id} className={u.bannedAt ? 'opacity-60' : undefined}>
                  <TableCell className="py-2.5">
                    <div className="flex items-center gap-2.5">
                      {u.telegramPhotoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={u.telegramPhotoUrl}
                          alt=""
                          className="h-7 w-7 rounded-full flex-shrink-0"
                        />
                      ) : (
                        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-pink-500 text-xs font-medium text-white flex-shrink-0">
                          {u.name.charAt(0).toUpperCase()}
                        </span>
                      )}
                      <div className="min-w-0">
                        <div className="text-sm font-medium leading-tight truncate">
                          {u.name}
                          {isSelf && (
                            <span className="ml-1.5 text-[10px] uppercase tracking-wider text-[var(--color-text-faint)]">
                              (toi)
                            </span>
                          )}
                        </div>
                        {u.telegramUsername && (
                          <div className="text-[11px] font-mono text-[var(--color-text-dim)] truncate">
                            @{u.telegramUsername}
                          </div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="py-2.5 text-xs">
                    {u.email ? (
                      <span className="truncate block max-w-[200px]">{u.email}</span>
                    ) : (
                      <span className="italic text-[var(--color-text-faint)]">en attente</span>
                    )}
                    {u.telegramId && (
                      <span className="font-mono text-[10px] text-[var(--color-text-faint)]">
                        TG: {u.telegramId}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="py-2.5">
                    <Badge variant={u.role === 'admin' ? 'gold' : 'secondary'}>
                      {u.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-2.5">
                    {u.bannedAt ? (
                      <Badge variant="danger">Banni</Badge>
                    ) : u.onboardingCompletedAt ? (
                      <Badge variant="success">Complet</Badge>
                    ) : (
                      <Badge variant="warning">Onboarding</Badge>
                    )}
                  </TableCell>
                  <TableCell className="py-2.5 text-xs text-[var(--color-text-dim)]">
                    {formatDate(u.createdAt)}
                  </TableCell>
                  <TableCell className="py-2.5 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          disabled={pending}
                        >
                          {pending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <MoreHorizontal className="h-4 w-4" />
                          )}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuLabel className="text-xs">
                          {u.name}
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {u.bannedAt ? (
                          <DropdownMenuItem onClick={() => unban(u)}>
                            <CheckCircle2 className="h-4 w-4" />
                            Lever le ban
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem
                            disabled={isSelf || u.role === 'admin'}
                            onClick={() => {
                              setBanDialog(u);
                              setBanReason('');
                            }}
                            className="text-rose-300 light:text-rose-700"
                          >
                            <Ban className="h-4 w-4" />
                            Bannir
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="mt-2 text-xs text-[var(--color-text-faint)]">
        {filtered.length} / {users.length} affichés
      </div>

      <Dialog open={!!banDialog} onOpenChange={(o) => !o && setBanDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bannir {banDialog?.name} ?</DialogTitle>
            <DialogDescription>
              L&apos;utilisateur ne pourra plus se connecter ni interagir avec le bot.
              Cette action est réversible.
            </DialogDescription>
          </DialogHeader>
          <div>
            <label className="text-xs font-medium text-[var(--color-text-dim)]">
              Raison (optionnel, visible dans l&apos;audit log)
            </label>
            <Textarea
              value={banReason}
              onChange={(e) => setBanReason(e.target.value)}
              placeholder="Ex: spam, fake account, abus du système de parrainage…"
              rows={3}
              className="mt-1"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setBanDialog(null)}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={ban} disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirmer le ban
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function FilterChip({
  value,
  current,
  setFilter,
  count,
  children,
}: {
  value: Filter;
  current: Filter;
  setFilter: (v: Filter) => void;
  count: number;
  children: React.ReactNode;
}) {
  const active = value === current;
  return (
    <button
      type="button"
      onClick={() => setFilter(value)}
      className={
        active
          ? 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-white/10 text-[var(--color-text)] border border-[var(--color-border-strong)]'
          : 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-transparent text-[var(--color-text-dim)] border border-[var(--color-border)] hover:bg-[var(--color-surface-tint)]'
      }
    >
      {children}
      <span className="text-[10px] text-[var(--color-text-faint)] tabular-nums">
        {count}
      </span>
    </button>
  );
}
