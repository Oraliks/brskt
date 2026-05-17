'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, RefreshCw, Send, UserX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/use-toast';
import {
  ejectPaidVipAccessAction,
  resendPaidVipInviteAction,
} from '@/lib/actions/vip';
import { cn, formatPrice } from '@/lib/utils';

interface Row {
  access: {
    id: string;
    status: 'pending_payment' | 'paid' | 'active' | 'ejected';
    firstName: string;
    lastName: string;
    amountEur: string;
    telegramInviteLink: string | null;
    paidAt: Date | null;
    activatedAt: Date | null;
    ejectionReason: string | null;
    resendCount: number;
    lastResendAt: Date | null;
    createdAt: Date;
  };
  user: {
    id: string;
    name: string;
    firstName: string | null;
    username: string | null;
    telegramId: number | null;
    photoUrl: string | null;
    email: string | null;
  };
  payment: {
    id: string;
    amountEur: string;
    method: string;
    provider: string;
    status: string;
  } | null;
}

const STATUS_CONFIG: Record<
  Row['access']['status'],
  { label: string; variant: 'default' | 'success' | 'warning' | 'danger' | 'outline' }
> = {
  pending_payment: { label: 'Paiement en cours', variant: 'warning' },
  paid: { label: 'Payé · invite en attente', variant: 'outline' },
  active: { label: 'Actif', variant: 'success' },
  ejected: { label: 'Éjecté', variant: 'danger' },
};

export function VipPaidAccessTable({ rows }: { rows: Row[] }) {
  if (rows.length === 0) {
    return (
      <div className="glass rounded-[var(--radius-md)] p-8 text-center text-sm text-[var(--color-text-dim)]">
        Aucun accès payant pour le moment.
      </div>
    );
  }

  return (
    <div className="glass rounded-[var(--radius-md)] overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-[var(--color-surface-tint)]">
          <tr className="text-left text-[10px] uppercase tracking-wider text-[var(--color-text-faint)]">
            <th className="px-3 py-2">User</th>
            <th className="px-3 py-2">Nom légal</th>
            <th className="px-3 py-2">Statut</th>
            <th className="px-3 py-2 text-right">Montant</th>
            <th className="px-3 py-2">Paiement</th>
            <th className="px-3 py-2 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <PaidAccessRow key={r.access.id} row={r} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PaidAccessRow({ row }: { row: Row }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const conf = STATUS_CONFIG[row.access.status];

  function onResend() {
    if (!confirm("Renvoyer un nouveau lien d'invitation à l'user ?")) return;
    start(async () => {
      const res = await resendPaidVipInviteAction(row.access.id);
      if (!res.success) {
        toast({
          title: 'Échec',
          description: res.error,
          variant: 'destructive',
        });
        return;
      }
      toast({
        title: res.data.inviteSent
          ? 'Invitation renvoyée'
          : 'Lien régénéré (DM échoué — bot peut être bloqué)',
      });
      router.refresh();
    });
  }

  function onEject() {
    const reason = prompt(
      "Raison de l'éjection (visible côté user) ?",
      'Comportement non conforme'
    );
    if (!reason?.trim()) return;
    if (!confirm("Confirmer l'éjection (ban + unban Telegram) ?")) return;
    start(async () => {
      const res = await ejectPaidVipAccessAction(row.access.id, reason);
      if (!res.success) {
        toast({
          title: 'Échec',
          description: res.error,
          variant: 'destructive',
        });
        return;
      }
      toast({ title: 'User éjecté du VIP' });
      router.refresh();
    });
  }

  const canResend =
    row.access.status === 'paid' || row.access.status === 'active';
  const canEject = row.access.status === 'active';

  return (
    <tr className="border-t border-[var(--color-border)]">
      <td className="px-3 py-3">
        <div className="flex items-center gap-2">
          {row.user.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={row.user.photoUrl}
              alt=""
              className="h-7 w-7 rounded-full"
            />
          ) : (
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-rose-500 text-xs text-white">
              {row.user.name.charAt(0).toUpperCase()}
            </span>
          )}
          <div className="min-w-0">
            <div className="text-sm truncate">
              {row.user.firstName ?? row.user.name}
              {row.user.username && (
                <span className="text-[var(--color-text-faint)] text-xs ml-1.5">
                  @{row.user.username}
                </span>
              )}
            </div>
            <div className="text-[10px] text-[var(--color-text-faint)] font-mono">
              {row.user.email ?? `tg:${row.user.telegramId ?? '?'}`}
            </div>
          </div>
        </div>
      </td>
      <td className="px-3 py-3 text-sm">
        {row.access.firstName} {row.access.lastName}
      </td>
      <td className="px-3 py-3">
        <Badge variant={conf.variant} className="text-[10px]">
          {conf.label}
        </Badge>
        {row.access.status === 'ejected' && row.access.ejectionReason && (
          <div className="mt-1 text-[10px] text-rose-300 italic">
            {row.access.ejectionReason}
          </div>
        )}
      </td>
      <td className="px-3 py-3 text-right font-mono text-sm">
        {formatPrice(Number(row.access.amountEur))}
      </td>
      <td className="px-3 py-3 text-xs text-[var(--color-text-dim)]">
        {row.payment ? (
          <>
            <div className="capitalize">{row.payment.method}</div>
            <div className="text-[10px] text-[var(--color-text-faint)]">
              {row.payment.provider} ·{' '}
              <span
                className={cn(
                  row.payment.status === 'completed'
                    ? 'text-emerald-300'
                    : row.payment.status === 'failed'
                    ? 'text-rose-300'
                    : 'text-amber-300'
                )}
              >
                {row.payment.status}
              </span>
            </div>
            {row.access.paidAt && (
              <div className="text-[10px] text-[var(--color-text-faint)] mt-0.5">
                {new Date(row.access.paidAt).toLocaleDateString('fr-FR')}
              </div>
            )}
          </>
        ) : (
          <span className="text-[var(--color-text-faint)]">—</span>
        )}
      </td>
      <td className="px-3 py-3 text-right">
        <div className="inline-flex items-center gap-2">
          {canResend && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onResend}
              disabled={pending}
              title={
                row.access.resendCount > 0
                  ? `${row.access.resendCount} renvoi(s)`
                  : 'Renvoyer le lien'
              }
            >
              {pending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              Renvoyer
            </Button>
          )}
          {canEject && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onEject}
              disabled={pending}
              className="text-rose-300 hover:bg-rose-500/10"
            >
              <UserX className="h-3.5 w-3.5" />
              Éjecter
            </Button>
          )}
          {row.access.status === 'pending_payment' && (
            <span className="inline-flex items-center gap-1 text-[10px] text-[var(--color-text-faint)]">
              <Send className="h-3 w-3" />
              en attente paiement
            </span>
          )}
        </div>
      </td>
    </tr>
  );
}
