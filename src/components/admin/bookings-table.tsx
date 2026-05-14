'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Clock, Loader2, MessageSquare, X } from 'lucide-react';
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

export function BookingsTable({ bookings }: Props) {
  const [dialog, setDialog] = useState<
    | null
    | { type: 'confirm'; row: Row }
    | { type: 'propose'; row: Row }
    | { type: 'refuse'; row: Row }
  >(null);

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
                      <summary className="cursor-pointer hover:text-white underline-offset-2 hover:underline">
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
                {(b.status === 'pending_admin' || b.status === 'date_proposed') && (
                  <div className="inline-flex flex-wrap gap-1.5 justify-end">
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
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setDialog({ type: 'refuse', row: b })}
                      className="text-rose-300 hover:text-rose-200 hover:bg-rose-500/10"
                    >
                      <X className="h-3 w-3" />
                      Refuser
                    </Button>
                  </div>
                )}
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
  dialog:
    | { type: 'confirm'; row: Row }
    | { type: 'propose'; row: Row }
    | { type: 'refuse'; row: Row };
  onClose: () => void;
}

function ActionDialog({ dialog, onClose }: ActionDialogProps) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [date, setDate] = useState('');
  const [notes, setNotes] = useState('');

  const titles = {
    confirm: 'Confirmer cette date',
    propose: 'Proposer une autre date',
    refuse: 'Refuser cette réservation',
  } as const;

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
      } else {
        if (!notes.trim()) {
          toast({
            title: 'Note obligatoire pour refuser',
            description: 'Explique pourquoi pour le user et pour ta propre référence.',
            variant: 'destructive',
          });
          return;
        }
        payload = { action: 'refuse', bookingId: dialog.row.id, notes };
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
          {(dialog.type === 'confirm' || dialog.type === 'propose') && (
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

          {(dialog.type === 'propose' || dialog.type === 'refuse') && (
            <div>
              <Label htmlFor="notes">
                Note{' '}
                {dialog.type === 'refuse' ? (
                  <span className="text-rose-300">*</span>
                ) : (
                  <span className="text-[var(--color-text-faint)]">
                    (optionnel)
                  </span>
                )}
                <span className="text-[var(--color-text-faint)] text-xs ml-2">
                  · sera visible par l'utilisateur sur son dashboard
                </span>
              </Label>
              <Textarea
                id="notes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mt-2"
                required={dialog.type === 'refuse'}
                placeholder={
                  dialog.type === 'refuse'
                    ? "Ex: créneau trop court, je n'ai pas d'autre date qui matche. Contacte-moi en privé sur Telegram pour qu'on trouve."
                    : "Ex: j'ai proposé la semaine d'après car celle-ci est déjà complète."
                }
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            Valider
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
