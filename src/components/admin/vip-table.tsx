'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Loader2, TrendingUp, UserX, Wallet } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from '@/components/ui/use-toast';
import {
  adminEjectAction,
  adminSetTradingProgressAction,
  adminValidateDepositAction,
  adminValidateSignupAction,
} from '@/lib/actions/admin';
import type {
  ManualIronfxStatus,
  User,
  VipApplication,
} from '@/lib/db/schema';
import type { IronFXMode } from '@/lib/ironfx';
import { cn, formatDate } from '@/lib/utils';

type Row = VipApplication & {
  user: User;
  ironfxStatus: ManualIronfxStatus | null;
};

const STEP_VARIANT: Record<
  VipApplication['step'],
  'default' | 'success' | 'warning' | 'danger' | 'secondary'
> = {
  link_generated: 'secondary',
  clicked: 'secondary',
  signup_pending: 'warning',
  signup_validated: 'default',
  deposit_pending: 'warning',
  deposit_validated: 'default',
  telegram_invited: 'default',
  in_group: 'success',
  ejected: 'danger',
};

interface Props {
  applications: Row[];
  ironfxMode: IronFXMode;
}

export function VipTable({ applications, ironfxMode }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [ejectTarget, setEjectTarget] = useState<Row | null>(null);
  const [progressTarget, setProgressTarget] = useState<Row | null>(null);

  function quickAction(
    label: string,
    fn: () => Promise<{ success: boolean; error?: string }>
  ) {
    start(async () => {
      const result = await fn();
      if (result.success) {
        toast({ title: `✓ ${label}` });
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
    <div className="glass rounded-[var(--radius-lg)] overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>User</TableHead>
            <TableHead>Compte broker</TableHead>
            <TableHead>Dépôt</TableHead>
            <TableHead>Étape</TableHead>
            <TableHead>Progression</TableHead>
            <TableHead>MAJ</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {applications.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={7}
                className="text-center text-sm text-[var(--color-text-dim)] py-10"
              >
                Aucune application VIP.
              </TableCell>
            </TableRow>
          )}
          {applications.map((a) => (
            <TableRow key={a.id}>
              <TableCell>
                <div className="text-sm font-medium">{a.user.name}</div>
                <div className="text-xs text-[var(--color-text-dim)]">
                  {a.user.email ?? <span className="italic">pas d'email</span>}
                </div>
                <div className="text-[10px] font-mono text-[var(--color-text-faint)]">
                  ref: {a.affiliateRef}
                </div>
              </TableCell>
              <TableCell>
                {a.brokerAccountId ? (
                  <span className="font-mono text-xs">{a.brokerAccountId}</span>
                ) : (
                  <span className="text-xs text-[var(--color-text-faint)]">—</span>
                )}
              </TableCell>
              <TableCell>
                {a.depositAmount ? (
                  <span className="font-mono text-xs">
                    {Number(a.depositAmount).toLocaleString('fr-FR')}{' '}
                    {a.depositCurrency ?? 'EUR'}
                  </span>
                ) : (
                  <span className="text-xs text-[var(--color-text-faint)]">—</span>
                )}
              </TableCell>
              <TableCell>
                <Badge variant={STEP_VARIANT[a.step]}>
                  {a.step.replace('_', ' ')}
                </Badge>
              </TableCell>
              <TableCell>
                <ProgressCell row={a} ironfxMode={ironfxMode} />
              </TableCell>
              <TableCell className="text-xs text-[var(--color-text-dim)]">
                {formatDate(a.updatedAt)}
              </TableCell>
              <TableCell className="text-right">
                <div className="inline-flex flex-wrap gap-1 justify-end">
                  {a.step === 'signup_pending' && (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={pending}
                      onClick={() =>
                        quickAction('Inscription validée', () =>
                          adminValidateSignupAction(a.id)
                        )
                      }
                    >
                      <Check className="h-3 w-3" />
                      Valider signup
                    </Button>
                  )}
                  {a.step === 'deposit_pending' && (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={pending}
                      onClick={() =>
                        quickAction('Dépôt validé', () =>
                          adminValidateDepositAction(a.id)
                        )
                      }
                    >
                      <Wallet className="h-3 w-3" />
                      Valider dépôt
                    </Button>
                  )}
                  {a.step === 'in_group' &&
                    ironfxMode === 'manual' &&
                    a.brokerAccountId && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setProgressTarget(a)}
                      >
                        <TrendingUp className="h-3 w-3" />
                        Progression
                      </Button>
                    )}
                  {a.step === 'in_group' && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEjectTarget(a)}
                      className="text-rose-300 hover:bg-rose-500/10"
                    >
                      <UserX className="h-3 w-3" />
                      Éjecter
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {ejectTarget && (
        <EjectDialog
          row={ejectTarget}
          onClose={() => setEjectTarget(null)}
          onDone={() => router.refresh()}
        />
      )}

      {progressTarget && (
        <ProgressDialog
          row={progressTarget}
          onClose={() => setProgressTarget(null)}
          onDone={() => router.refresh()}
        />
      )}
    </div>
  );
}

function ProgressCell({
  row,
  ironfxMode,
}: {
  row: Row;
  ironfxMode: IronFXMode;
}) {
  if (row.step !== 'in_group') {
    return <span className="text-xs text-[var(--color-text-faint)]">—</span>;
  }
  const pct = row.ironfxStatus?.tradingProgressPct ?? 0;
  return (
    <div className="space-y-1 max-w-[140px]">
      <div className="flex items-baseline justify-between text-xs">
        <span className="font-mono tabular-nums text-white font-medium">
          {pct}%
        </span>
        {pct >= 100 && (
          <span className="text-[10px] text-emerald-300">qualifié</span>
        )}
      </div>
      <div className="h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
        <div
          className={cn(
            'h-full transition-all rounded-full',
            pct >= 100
              ? 'bg-emerald-400'
              : 'bg-gradient-to-r from-[var(--color-accent)] to-pink-500'
          )}
          style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
        />
      </div>
      {ironfxMode === 'manual' && (
        <div className="text-[10px] text-[var(--color-text-faint)]">manuel</div>
      )}
    </div>
  );
}

function ProgressDialog({
  row,
  onClose,
  onDone,
}: {
  row: Row;
  onClose: () => void;
  onDone: () => void;
}) {
  const [value, setValue] = useState(row.ironfxStatus?.tradingProgressPct ?? 0);
  const [pending, start] = useTransition();

  useEffect(() => {
    setValue(row.ironfxStatus?.tradingProgressPct ?? 0);
  }, [row]);

  function submit() {
    if (!row.brokerAccountId) {
      toast({
        title: 'Pas de compte broker',
        description: 'L\'user n\'a pas encore déclaré son ID broker.',
        variant: 'destructive',
      });
      return;
    }
    start(async () => {
      const result = await adminSetTradingProgressAction({
        accountId: row.brokerAccountId!,
        userId: row.userId,
        tradingProgressPct: value,
      });
      if (result.success) {
        toast({
          title:
            value >= 100
              ? `✓ ${row.user.name} qualifié à 100% — notif envoyée`
              : `✓ Progression : ${value}%`,
        });
        onClose();
        onDone();
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
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Progression de trading — {row.user.name}</DialogTitle>
          <DialogDescription>
            Ajuste le pourcentage de progression. À 100%, le user devient
            qualifié et est protégé du kick automatique.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div>
            <div className="flex items-baseline justify-between mb-2">
              <Label htmlFor="progress">Pourcentage</Label>
              <span className="font-mono text-2xl font-medium">{value}%</span>
            </div>
            <input
              id="progress"
              type="range"
              min={0}
              max={100}
              step={1}
              value={value}
              onChange={(e) => setValue(Number(e.target.value))}
              className="w-full accent-[var(--color-accent)]"
            />
            <div className="mt-2 h-2 w-full rounded-full bg-white/5 overflow-hidden">
              <div
                className={cn(
                  'h-full transition-all rounded-full',
                  value >= 100
                    ? 'bg-emerald-400'
                    : 'bg-gradient-to-r from-[var(--color-accent)] to-pink-500'
                )}
                style={{ width: `${value}%` }}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="progress-input">Ou entre une valeur précise</Label>
            <Input
              id="progress-input"
              type="number"
              min={0}
              max={100}
              value={value}
              onChange={(e) =>
                setValue(Math.max(0, Math.min(100, Number(e.target.value))))
              }
              className="mt-2"
            />
          </div>

          {value >= 100 && (
            <div className="rounded-md bg-emerald-500/10 border border-emerald-500/25 px-3 py-2 text-xs text-emerald-200">
              ✓ À 100%, on flag le user comme qualifié et on lui envoie
              automatiquement un message de félicitations.
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EjectDialog({
  row,
  onClose,
  onDone,
}: {
  row: Row;
  onClose: () => void;
  onDone: () => void;
}) {
  const [reason, setReason] = useState('');
  const [pending, start] = useTransition();

  function submit() {
    if (!reason.trim()) {
      toast({ title: 'Indique une raison', variant: 'destructive' });
      return;
    }
    start(async () => {
      const result = await adminEjectAction(row.userId, reason);
      if (result.success) {
        toast({ title: '✓ Utilisateur éjecté' });
        onClose();
        onDone();
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
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Éjecter {row.user.name}</DialogTitle>
          <DialogDescription>
            L'utilisateur sera kické du groupe Telegram VIP. La raison sera
            visible sur son dashboard.
          </DialogDescription>
        </DialogHeader>
        <div>
          <Label htmlFor="reason">Raison</Label>
          <Textarea
            id="reason"
            className="mt-2"
            rows={4}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ex: retrait avant qualification"
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="destructive" onClick={submit} disabled={pending}>
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            Éjecter
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
