'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Ban,
  Check,
  Clock,
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
import { adminBookingAction } from '@/lib/actions/admin';
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
  | { type: 'update_notes'; row: Row };

export function BookingsTable({ bookings }: Props) {
  const [dialog, setDialog] = useState<DialogState>(null);

  return (
    <div className="glass rounded-[var(--radius-lg)] overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
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
              <TableCell colSpan={6} className="text-center text-sm text-[var(--color-text-dim)] py-10">
                Aucune réservation.
              </TableCell>
            </TableRow>
          )}
          {bookings.map((b) => (
            <TableRow key={b.id} id={b.id}>
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
    </div>
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
    dialog.type === 'update_notes';

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
