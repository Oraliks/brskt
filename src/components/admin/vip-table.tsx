'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Check,
  Loader2,
  MoreVertical,
  TrendingUp,
  UserX,
  Wallet,
  Wrench,
} from 'lucide-react';
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
  adminVipOverrideAction,
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
  const [overrideTarget, setOverrideTarget] = useState<Row | null>(null);

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
                      className="text-rose-400 light:text-rose-600 hover:bg-rose-500/10"
                    >
                      <UserX className="h-3 w-3" />
                      Éjecter
                    </Button>
                  )}
                  {/* Overrides admin manuels — toujours disponibles */}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setOverrideTarget(a)}
                    title="Actions avancées (skip étape, reset, etc.)"
                    className="text-[var(--color-text-dim)]"
                  >
                    <MoreVertical className="h-3 w-3" />
                  </Button>
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

      {overrideTarget && (
        <OverrideDialog
          row={overrideTarget}
          onClose={() => setOverrideTarget(null)}
          onDone={() => router.refresh()}
        />
      )}
    </div>
  );
}

// ============================================================
// Override Dialog — actions admin manuelles (skip étape, reset, etc.)
// ============================================================

type OverrideAction =
  | 'set_step'
  | 'reset_funnel'
  | 'clear_warning'
  | 'force_qualified'
  | 'unqualify';

const STEP_OPTIONS = [
  { value: 'link_generated', label: '1. Lien généré' },
  { value: 'clicked', label: '2. Lien cliqué' },
  { value: 'signup_pending', label: '3. Inscription en attente' },
  { value: 'signup_validated', label: '4. Inscription validée' },
  { value: 'deposit_pending', label: '5. Dépôt en attente' },
  { value: 'deposit_validated', label: '6. Dépôt validé' },
  { value: 'telegram_invited', label: '7. Telegram invité' },
  { value: 'in_group', label: '8. Dans le groupe' },
  { value: 'ejected', label: '9. Éjecté' },
] as const;

function OverrideDialog({
  row,
  onClose,
  onDone,
}: {
  row: Row;
  onClose: () => void;
  onDone: () => void;
}) {
  const [action, setAction] = useState<OverrideAction>('set_step');
  const [targetStep, setTargetStep] = useState<string>(row.step);
  const [reason, setReason] = useState('');
  const [pending, start] = useTransition();

  function submit() {
    if (reason.trim().length < 3) {
      toast({
        title: 'Raison obligatoire',
        description: 'Indique pourquoi tu fais cette override (audit log).',
        variant: 'destructive',
      });
      return;
    }
    start(async () => {
      const result = await adminVipOverrideAction({
        applicationId: row.id,
        action,
        targetStep: action === 'set_step' ? targetStep : undefined,
        reason,
      });
      if (result.success) {
        toast({ title: '✓ Override appliqué' });
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

  const isDestructive =
    action === 'reset_funnel' || action === 'unqualify' || action === 'set_step';

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Actions avancées — {row.user.name}</DialogTitle>
          <DialogDescription>
            Override manuel d&apos;une application VIP. À utiliser pour
            debugger ou rattraper un cas exceptionnel. Tout est loggé dans
            l&apos;audit.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-sm">Action</Label>
            <div className="mt-2 grid gap-2">
              <OverrideOption
                checked={action === 'set_step'}
                onSelect={() => setAction('set_step')}
                title="Forcer une étape"
                description="Skip ou rollback vers une étape précise du funnel."
              />
              <OverrideOption
                checked={action === 'clear_warning'}
                onSelect={() => setAction('clear_warning')}
                title="Clear le warning pré-éjection"
                description="Si un warning J-1 a été envoyé par erreur."
                disabled={!row.ejectionWarnedAt}
              />
              <OverrideOption
                checked={action === 'force_qualified'}
                onSelect={() => setAction('force_qualified')}
                title="Forcer cpaQualified = true"
                description="Place protégée de l'éjection auto sans passer par le %."
                disabled={row.cpaQualified}
              />
              <OverrideOption
                checked={action === 'unqualify'}
                onSelect={() => setAction('unqualify')}
                title="Annuler la qualification"
                description="cpaQualified = false (rare, ex. fraude détectée)."
                disabled={!row.cpaQualified}
              />
              <OverrideOption
                checked={action === 'reset_funnel'}
                onSelect={() => setAction('reset_funnel')}
                title="Reset complet du funnel"
                description="Reset l'application à 'link_generated'. Efface broker ID, dépôt, qualif. Le user repart de zéro."
              />
            </div>
          </div>

          {action === 'set_step' && (
            <div>
              <Label htmlFor="target-step" className="text-sm">
                Étape cible
              </Label>
              <select
                id="target-step"
                value={targetStep}
                onChange={(e) => setTargetStep(e.target.value)}
                className="mt-2 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-tint)] px-3 py-2 text-sm"
              >
                {STEP_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                    {opt.value === row.step ? ' (actuel)' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <Label htmlFor="reason" className="text-sm">
              Raison <span className="text-rose-400">*</span>
            </Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Ex: bug API IronFX a sauté l'étape signup, on rattrape manuellement"
              className="mt-2"
            />
            <p className="text-xs text-[var(--color-text-faint)] mt-1">
              Inclus dans l&apos;audit log — visible par tous les admins.
            </p>
          </div>

          {isDestructive && (
            <div className="rounded-[var(--radius-md)] bg-amber-500/10 border border-amber-500/30 p-3 text-xs">
              ⚠ Cette action modifie directement le statut du user et peut
              casser des invariants si mal utilisée.
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            Appliquer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function OverrideOption({
  checked,
  onSelect,
  title,
  description,
  disabled,
}: {
  checked: boolean;
  onSelect: () => void;
  title: string;
  description: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className={cn(
        'w-full text-left rounded-[var(--radius-md)] border p-3 transition-colors',
        checked
          ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/5'
          : 'border-[var(--color-border)] hover:border-[var(--color-border-strong)]',
        disabled && 'opacity-40 cursor-not-allowed'
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            'mt-0.5 h-4 w-4 rounded-full border-2 flex items-center justify-center flex-shrink-0',
            checked
              ? 'border-[var(--color-accent)] bg-[var(--color-accent)]'
              : 'border-[var(--color-border-strong)]'
          )}
        >
          {checked && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
        </span>
        <div>
          <div className="text-sm font-medium inline-flex items-center gap-1.5">
            <Wrench className="h-3 w-3 opacity-60" />
            {title}
          </div>
          <div className="text-xs text-[var(--color-text-dim)] mt-0.5">
            {description}
          </div>
        </div>
      </div>
    </button>
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
        <span className="font-mono tabular-nums text-[var(--color-text)] font-medium">
          {pct}%
        </span>
        {pct >= 100 && (
          <span className="text-[10px] text-emerald-300">qualifié</span>
        )}
      </div>
      <div className="h-1.5 w-full rounded-full bg-[var(--color-surface-tint)] overflow-hidden">
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
            <div className="mt-2 h-2 w-full rounded-full bg-[var(--color-surface-tint)] overflow-hidden">
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
