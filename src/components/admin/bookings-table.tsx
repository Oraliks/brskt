'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Ban,
  BadgeCheck,
  Check,
  CheckCircle2,
  Clock,
  CreditCard,
  Loader2,
  MoreHorizontal,
  Pencil,
  X,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from '@/components/ui/use-toast';
import {
  adminBookingAction,
  adminBulkBookingsAction,
} from '@/lib/actions/admin';
import { formatDate, formatPrice } from '@/lib/utils';
import type { Booking, Formation, User } from '@/lib/db/schema';
import type { AdminBookingActionInput } from '@/lib/validations';

type Row = Booking & { formation: Formation; user: User };

interface Props {
  bookings: Row[];
}

const STATUS_VARIANT: Record<Booking['status'], 'default' | 'success' | 'warning' | 'danger' | 'secondary'> = {
  pending_admin: 'warning',
  date_proposed: 'warning',
  confirmed: 'default',
  pending_payment: 'warning',
  paid: 'success',
  completed: 'secondary',
  cancelled: 'danger',
};

type DialogState =
  | null
  | { type: 'confirm'; row: Row }
  | { type: 'propose'; row: Row }
  | { type: 'refuse'; row: Row }
  | { type: 'force_cancel'; row: Row }
  | { type: 'update_notes'; row: Row }
  | { type: 'mark_paid'; row: Row }
  | { type: 'mark_completed'; row: Row };

export function BookingsTable({ bookings }: Props) {
  const [dialog, setDialog] = useState<DialogState>(null);
  /** Set des bookings sélectionnés pour les actions en masse. */
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  /** Dialog des actions bulk (force_cancel / mark_completed). */
  const [bulkDialog, setBulkDialog] = useState<
    null | 'cancel' | 'complete'
  >(null);

  const allSelected =
    bookings.length > 0 && selectedIds.size === bookings.length;
  const partialSelected =
    selectedIds.size > 0 && selectedIds.size < bookings.length;

  function toggleAll() {
    if (selectedIds.size > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(bookings.map((b) => b.id)));
    }
  }

  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="glass rounded-[var(--radius-lg)] overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <input
                type="checkbox"
                checked={allSelected}
                ref={(el) => {
                  if (el) el.indeterminate = partialSelected;
                }}
                onChange={toggleAll}
                aria-label="Tout sélectionner"
                className="h-4 w-4 rounded border-[var(--color-border)] bg-[var(--color-surface-tint)] accent-[var(--color-accent)] cursor-pointer"
              />
            </TableHead>
            <TableHead>User</TableHead>
            <TableHead>Formation</TableHead>
            <TableHead>Créneaux proposés</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead>Date confirmée</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {bookings.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-sm text-[var(--color-text-dim)] py-10">
                Aucune réservation.
              </TableCell>
            </TableRow>
          )}
          {bookings.map((b) => (
            <TableRow key={b.id} id={b.id}>
              <TableCell>
                <input
                  type="checkbox"
                  checked={selectedIds.has(b.id)}
                  onChange={() => toggleOne(b.id)}
                  aria-label={`Sélectionner ${b.user.name}`}
                  className="h-4 w-4 rounded border-[var(--color-border)] bg-[var(--color-surface-tint)] accent-[var(--color-accent)] cursor-pointer"
                />
              </TableCell>
              <TableCell>
                <div className="text-sm font-medium">{b.user.name}</div>
                <div className="text-xs text-[var(--color-text-dim)]">
                  {b.user.email ?? <span className="italic">pas d'email</span>}
                </div>
              </TableCell>
              <TableCell>
                <div className="text-sm">{b.formation.title}</div>
                <div className="text-xs text-[var(--color-text-faint)]">
                  {formatPrice(Number(b.formation.priceEur))}
                </div>
              </TableCell>
              <TableCell>
                {b.preferredAsap ? (
                  <Badge variant="secondary">ASAP</Badge>
                ) : b.preferredDates && b.preferredDates.length ? (
                  <div className="space-y-0.5 text-xs">
                    {b.preferredDates.slice(0, 3).map((d, i) => (
                      <div key={i} className="font-mono">
                        {d.start} → {d.end}
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="text-xs text-[var(--color-text-faint)]">—</span>
                )}
              </TableCell>
              <TableCell>
                <div className="flex flex-col gap-1.5">
                  <Badge variant={STATUS_VARIANT[b.status]}>
                    {b.status.replace('_', ' ')}
                  </Badge>
                  {b.status === 'cancelled' && b.paymentId && (
                    <Badge variant="warning" className="text-[10px]">
                      💰 remboursement à faire
                    </Badge>
                  )}
                  {b.adminNotes && (
                    <details className="text-xs text-[var(--color-text-dim)] max-w-[240px]">
                      <summary className="cursor-pointer hover:text-[var(--color-text)] underline-offset-2 hover:underline">
                        Voir la note
                      </summary>
                      <p className="mt-1.5 italic text-[var(--color-text)] leading-snug">
                        « {b.adminNotes} »
                      </p>
                    </details>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-sm">
                {b.confirmedDate
                  ? formatDate(b.confirmedDate)
                  : b.adminProposedDate
                  ? `Proposé · ${formatDate(b.adminProposedDate)}`
                  : '—'}
              </TableCell>
              <TableCell className="text-right">
                <div className="inline-flex items-center gap-1.5 justify-end">
                  {b.status === 'pending_payment' && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setDialog({ type: 'mark_paid', row: b })}
                    >
                      <BadgeCheck className="h-3 w-3" />
                      Marquer payé
                    </Button>
                  )}
                  {(b.status === 'pending_admin' ||
                    b.status === 'date_proposed') && (
                    <>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setDialog({ type: 'confirm', row: b })}
                      >
                        <Check className="h-3 w-3" />
                        Confirmer
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setDialog({ type: 'propose', row: b })}
                      >
                        <Clock className="h-3 w-3" />
                        Proposer
                      </Button>
                    </>
                  )}
                  {(b.status === 'confirmed' || b.status === 'paid') && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        setDialog({ type: 'mark_completed', row: b })
                      }
                    >
                      <CheckCircle2 className="h-3 w-3" />
                      Marquer terminée
                    </Button>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="icon" variant="ghost" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuLabel className="text-xs">
                        #{b.id.slice(0, 8)} · {b.user.name}
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => setDialog({ type: 'update_notes', row: b })}
                      >
                        <Pencil className="h-4 w-4" />
                        Modifier la note admin
                      </DropdownMenuItem>
                      {b.status === 'pending_payment' && (
                        <DropdownMenuItem
                          onClick={() =>
                            setDialog({ type: 'mark_paid', row: b })
                          }
                        >
                          <CreditCard className="h-4 w-4" />
                          Marquer comme payé (hors-site)
                        </DropdownMenuItem>
                      )}
                      {(b.status === 'pending_admin' ||
                        b.status === 'date_proposed') && (
                        <DropdownMenuItem
                          onClick={() => setDialog({ type: 'refuse', row: b })}
                          className="text-rose-300 light:text-rose-700"
                        >
                          <X className="h-4 w-4" />
                          Refuser (avant paiement)
                        </DropdownMenuItem>
                      )}
                      {b.status !== 'cancelled' && b.status !== 'completed' && (
                        <DropdownMenuItem
                          onClick={() =>
                            setDialog({ type: 'force_cancel', row: b })
                          }
                          className="text-rose-300 light:text-rose-700"
                        >
                          <Ban className="h-4 w-4" />
                          Annuler (force)
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {dialog && (
        <ActionDialog
          dialog={dialog}
          onClose={() => setDialog(null)}
        />
      )}

      {/* Barre flottante actions en masse — apparait quand selection > 0.
          Sticky en bas du viewport pour rester accessible pendant le scroll. */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 glass rounded-full border border-[var(--color-border-strong)] shadow-2xl px-4 py-2 flex items-center gap-3 backdrop-blur-md">
          <span className="text-sm font-medium tabular-nums">
            {selectedIds.size} sélectionnée
            {selectedIds.size > 1 ? 's' : ''}
          </span>
          <span className="h-4 w-px bg-[var(--color-border)]" />
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setBulkDialog('complete')}
            className="h-8 gap-1.5"
          >
            <Check className="h-3.5 w-3.5" />
            Marquer terminées
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => setBulkDialog('cancel')}
            className="h-8 gap-1.5"
          >
            <Ban className="h-3.5 w-3.5" />
            Annuler
          </Button>
          <button
            type="button"
            onClick={() => setSelectedIds(new Set())}
            className="text-xs text-[var(--color-text-dim)] hover:text-[var(--color-text)] ml-1"
            aria-label="Tout désélectionner"
          >
            ✕
          </button>
        </div>
      )}

      {bulkDialog && (
        <BulkActionDialog
          type={bulkDialog}
          bookingIds={[...selectedIds]}
          onClose={() => setBulkDialog(null)}
          onSuccess={() => {
            setBulkDialog(null);
            setSelectedIds(new Set());
          }}
        />
      )}
    </div>
  );
}

function BulkActionDialog({
  type,
  bookingIds,
  onClose,
  onSuccess,
}: {
  type: 'cancel' | 'complete';
  bookingIds: string[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [notes, setNotes] = useState('');

  const isComplete = type === 'complete';
  const title = isComplete
    ? `Marquer ${bookingIds.length} réservation${
        bookingIds.length > 1 ? 's' : ''
      } comme terminée${bookingIds.length > 1 ? 's' : ''}`
    : `Annuler ${bookingIds.length} réservation${
        bookingIds.length > 1 ? 's' : ''
      } en masse`;

  function submit() {
    if (!isComplete && notes.trim().length < 3) {
      toast({
        title: 'Raison requise',
        description: '3 caractères minimum.',
        variant: 'destructive',
      });
      return;
    }
    start(async () => {
      const result = await adminBulkBookingsAction({
        action: isComplete ? 'mark_completed' : 'force_cancel',
        bookingIds,
        notes: isComplete ? undefined : notes,
      });
      if (result.success) {
        const { succeeded, failed, errors } = result.data;
        toast({
          title: `✓ ${succeeded} traitée${succeeded > 1 ? 's' : ''}`,
          description:
            failed > 0
              ? `${failed} échec${failed > 1 ? 's' : ''} : ${errors[0] ?? '?'}`
              : undefined,
          variant: failed > 0 ? 'destructive' : 'default',
        });
        router.refresh();
        onSuccess();
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
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {isComplete
              ? 'Seules les réservations confirmées ou payées seront marquées. Les autres seront ignorées.'
              : 'Toutes les réservations sélectionnées passent en annulé. Si des paiements existent, le remboursement est à organiser séparément.'}
          </DialogDescription>
        </DialogHeader>

        {!isComplete && (
          <div className="space-y-3">
            <div className="rounded-[var(--radius-md)] bg-rose-500/10 border border-rose-500/30 p-3 text-xs text-rose-200 light:text-rose-700">
              ⚠ Action irréversible appliquée à {bookingIds.length} résa
              {bookingIds.length > 1 ? 's' : ''}.
            </div>
            <div>
              <Label htmlFor="bulk-notes">
                Raison <span className="text-rose-400">*</span>
                <span className="text-[var(--color-text-faint)] text-xs ml-2">
                  · visible dans l&apos;audit log
                </span>
              </Label>
              <Textarea
                id="bulk-notes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mt-2"
                placeholder="Ex : nettoyage des résas de test du mois de mars"
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Annuler
          </Button>
          <Button
            onClick={submit}
            disabled={pending}
            variant={isComplete ? 'default' : 'destructive'}
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            {isComplete ? 'Marquer terminées' : 'Annuler en masse'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface ActionDialogProps {
  dialog: Exclude<DialogState, null>;
  onClose: () => void;
}

function ActionDialog({ dialog, onClose }: ActionDialogProps) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [date, setDate] = useState('');
  const [notes, setNotes] = useState(
    dialog.type === 'update_notes' ? dialog.row.adminNotes ?? '' : ''
  );

  const titles: Record<Exclude<DialogState, null>['type'], string> = {
    confirm: 'Confirmer cette date',
    propose: 'Proposer une autre date',
    refuse: 'Refuser cette réservation',
    force_cancel: 'Annuler la réservation (force)',
    update_notes: 'Modifier la note admin',
    mark_paid: 'Marquer comme payé (hors-site)',
    mark_completed: 'Marquer la formation comme terminée',
  };

  function submit() {
    start(async () => {
      let payload: AdminBookingActionInput;
      if (dialog.type === 'confirm') {
        if (!date) {
          toast({ title: 'Choisis une date', variant: 'destructive' });
          return;
        }
        payload = {
          action: 'confirm',
          bookingId: dialog.row.id,
          confirmedDate: date,
        };
      } else if (dialog.type === 'propose') {
        if (!date) {
          toast({ title: 'Choisis une date', variant: 'destructive' });
          return;
        }
        payload = {
          action: 'propose_alternative',
          bookingId: dialog.row.id,
          proposedDate: date,
          notes,
        };
      } else if (dialog.type === 'refuse') {
        if (!notes.trim()) {
          toast({
            title: 'Note obligatoire pour refuser',
            description: 'Explique pourquoi.',
            variant: 'destructive',
          });
          return;
        }
        payload = { action: 'refuse', bookingId: dialog.row.id, notes };
      } else if (dialog.type === 'force_cancel') {
        if (notes.trim().length < 3) {
          toast({
            title: 'Raison requise',
            description: 'Donne une raison (visible dans l\'audit log).',
            variant: 'destructive',
          });
          return;
        }
        payload = {
          action: 'force_cancel',
          bookingId: dialog.row.id,
          notes,
        };
      } else if (dialog.type === 'mark_paid') {
        if (notes.trim().length < 3) {
          toast({
            title: 'Note requise',
            description: 'Précise la méthode de paiement + référence.',
            variant: 'destructive',
          });
          return;
        }
        payload = {
          action: 'mark_paid',
          bookingId: dialog.row.id,
          notes,
        };
      } else if (dialog.type === 'mark_completed') {
        payload = {
          action: 'mark_completed',
          bookingId: dialog.row.id,
        };
      } else {
        payload = {
          action: 'update_notes',
          bookingId: dialog.row.id,
          notes,
        };
      }

      const result = await adminBookingAction(payload);
      if (result.success) {
        toast({ title: '✓ Mise à jour effectuée' });
        onClose();
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

  const needsDate = dialog.type === 'confirm' || dialog.type === 'propose';
  const needsNotes =
    dialog.type === 'propose' ||
    dialog.type === 'refuse' ||
    dialog.type === 'force_cancel' ||
    dialog.type === 'update_notes' ||
    dialog.type === 'mark_paid';

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{titles[dialog.type]}</DialogTitle>
          <DialogDescription>
            Booking #{dialog.row.id.slice(0, 8)} · {dialog.row.user.name} ·{' '}
            {dialog.row.formation.title}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {dialog.type === 'force_cancel' && (
            <div className="rounded-[var(--radius-md)] bg-rose-500/10 border border-rose-500/30 p-3 text-xs text-rose-200">
              ⚠ Cette action force l&apos;annulation quel que soit le statut
              actuel ({dialog.row.status}). Le user est notifié sur Telegram.
              Si des paiements existent, le remboursement est à organiser
              séparément.
            </div>
          )}

          {dialog.type === 'mark_paid' && (
            <div className="rounded-[var(--radius-md)] bg-emerald-500/10 border border-emerald-500/30 p-3 text-xs text-emerald-200 light:text-emerald-800">
              💰 Confirme que le client a payé hors-site (cash, virement,
              etc.). La résa passera à <code>pending_admin</code> pour validation
              de date. Le user est notifié sur Telegram.
            </div>
          )}

          {dialog.type === 'mark_completed' && (
            <div className="rounded-[var(--radius-md)] bg-indigo-500/10 border border-indigo-500/30 p-3 text-xs text-indigo-200 light:text-indigo-800">
              ✓ Marque la formation comme terminée. Si l&apos;automation NPS
              est activée, le client recevra automatiquement une demande de
              feedback après {dialog.row.formation.title}.
            </div>
          )}

          {needsDate && (
            <div>
              <Label htmlFor="date">Date de début</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-2"
              />
            </div>
          )}

          {needsNotes && (
            <div>
              <Label htmlFor="notes">
                {dialog.type === 'update_notes' ? 'Note admin' : 'Raison'}
                {(dialog.type === 'refuse' || dialog.type === 'force_cancel') && (
                  <span className="text-rose-300 ml-1">*</span>
                )}
                {dialog.type === 'update_notes' && (
                  <span className="text-[var(--color-text-faint)] text-xs ml-2">
                    · visible par l&apos;utilisateur sur son dashboard
                  </span>
                )}
              </Label>
              <Textarea
                id="notes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mt-2"
                placeholder={
                  dialog.type === 'refuse'
                    ? 'Ex: créneau trop court, je n\'ai pas de date qui matche.'
                    : dialog.type === 'force_cancel'
                    ? 'Ex: demande de remboursement par le client suite à changement de plan.'
                    : dialog.type === 'propose'
                    ? "Ex: j'ai proposé la semaine d'après car celle-ci est déjà complète."
                    : 'Note interne ou message au user.'
                }
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button
            onClick={submit}
            disabled={pending}
            variant={
              dialog.type === 'force_cancel' || dialog.type === 'refuse'
                ? 'destructive'
                : 'default'
            }
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            Valider
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
