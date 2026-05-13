'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Loader2, UserX, Wallet } from 'lucide-react';
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
  adminValidateDepositAction,
  adminValidateSignupAction,
} from '@/lib/actions/admin';
import type { VipApplication, User } from '@/lib/db/schema';
import { formatDate } from '@/lib/utils';

type Row = VipApplication & { user: User };

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
}

export function VipTable({ applications }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [ejectTarget, setEjectTarget] = useState<Row | null>(null);

  function quickAction(label: string, fn: () => Promise<{ success: boolean; error?: string }>) {
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
            <TableHead>MAJ</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {applications.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-sm text-[var(--color-text-dim)] py-10">
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
              <TableCell className="text-xs text-[var(--color-text-dim)]">
                {formatDate(a.updatedAt)}
              </TableCell>
              <TableCell className="text-right">
                <div className="inline-flex gap-1">
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
                  {a.step === 'in_group' && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEjectTarget(a)}
                      className="text-rose-300"
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
    </div>
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
            placeholder="Ex: retrait avant qualification CPA"
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
