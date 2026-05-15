'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  BadgeCheck,
  Check,
  CheckCircle2,
  CreditCard,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Plus,
  Sparkles,
  Wifi,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';
import {
  adminBookingAction,
  adminCreateOfflineCoachingAction,
} from '@/lib/actions/admin';
import { formatDate, formatPrice } from '@/lib/utils';
import type {
  CalendarBooking,
  CalendarOfflineCoaching,
} from './booking-calendar';

interface Props {
  /** Plage à afficher (from = to pour un jour, from = lundi, to = dimanche pour semaine). */
  range: { from: string; to: string } | null;
  bookings: CalendarBooking[];
  offlineCoachings: CalendarOfflineCoaching[];
  onClose: () => void;
}

/**
 * Modale "agenda" pour un jour (ou une plage de jours, ex. semaine).
 * Affiche tous les bookings online + coachings offline qui ont une date
 * confirmée/proposée/scheduled dans la plage. Actions inline (confirmer,
 * proposer, marquer payé, marquer terminée) directement disponibles.
 * Quick add coaching offline avec la date pré-remplie en bas.
 */
export function DayDetailDialog({
  range,
  bookings,
  offlineCoachings,
  onClose,
}: Props) {
  const open = range !== null;
  if (!range) {
    return (
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <></>
      </Dialog>
    );
  }

  const isRange = range.from !== range.to;
  const title = isRange
    ? `Sessions du ${formatDate(range.from)} au ${formatDate(range.to)}`
    : `Sessions du ${formatDate(range.from)}`;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Toutes les sessions site + coachings offline sur cette période.
          </DialogDescription>
        </DialogHeader>

        <DayContent
          range={range}
          bookings={bookings}
          offlineCoachings={offlineCoachings}
          onClose={onClose}
        />
      </DialogContent>
    </Dialog>
  );
}

function DayContent({
  range,
  bookings,
  offlineCoachings,
  onClose,
}: {
  range: { from: string; to: string };
  bookings: CalendarBooking[];
  offlineCoachings: CalendarOfflineCoaching[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  /**
   * Filtre les bookings dont la date pertinente (confirmedDate >
   * adminProposedDate > première preferredDate) tombe dans la plage.
   * On exclut les annulés.
   */
  const bookingsInRange = useMemo(() => {
    return bookings.filter((b) => {
      if (b.status === 'cancelled') return false;
      const date =
        b.confirmedDate ??
        b.adminProposedDate ??
        b.preferredDates?.[0]?.start ??
        null;
      if (!date) return false;
      return date >= range.from && date <= range.to;
    });
  }, [bookings, range]);

  const offlineInRange = useMemo(() => {
    return offlineCoachings.filter((c) => {
      if (c.status === 'cancelled') return false;
      return c.scheduledDate >= range.from && c.scheduledDate <= range.to;
    });
  }, [offlineCoachings, range]);

  const totalRevenue = useMemo(() => {
    const onlineSum = bookingsInRange.reduce(
      (acc, b) => acc + (b.formationPriceEur || 0),
      0
    );
    const offlineSum = offlineInRange.reduce(
      (acc, c) => acc + (c.totalAmountEur || 0),
      0
    );
    return onlineSum + offlineSum;
  }, [bookingsInRange, offlineInRange]);

  const onsiteCount = useMemo(() => {
    return (
      bookingsInRange.filter((b) => b.formationMode === 'onsite').length +
      offlineInRange.filter((c) => c.mode === 'onsite').length
    );
  }, [bookingsInRange, offlineInRange]);

  const remoteCount =
    bookingsInRange.length + offlineInRange.length - onsiteCount;

  const todayIso = new Date().toISOString().slice(0, 10);

  function callAdminAction(
    payload: Parameters<typeof adminBookingAction>[0],
    successMsg: string
  ) {
    start(async () => {
      const result = await adminBookingAction(payload);
      if (result.success) {
        toast({ title: successMsg });
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

  const isEmpty = bookingsInRange.length === 0 && offlineInRange.length === 0;

  return (
    <div className="space-y-4">
      {/* Stats compactes */}
      <div className="grid grid-cols-3 gap-2">
        <Stat
          label="Sessions"
          value={bookingsInRange.length + offlineInRange.length}
        />
        <Stat
          label="Présentiel / Distance"
          value={`${onsiteCount} / ${remoteCount}`}
        />
        <Stat
          label="Revenus"
          value={`${totalRevenue.toLocaleString('fr-FR')}€`}
          tone="success"
        />
      </div>

      {/* Sessions */}
      {isEmpty ? (
        <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] p-6 text-center text-sm text-[var(--color-text-dim)]">
          Aucune session sur cette période.
        </div>
      ) : (
        <div className="space-y-2">
          {bookingsInRange.map((b) => (
            <BookingRow
              key={b.id}
              booking={b}
              todayIso={todayIso}
              pending={pending}
              onAction={callAdminAction}
            />
          ))}
          {offlineInRange.map((c) => (
            <OfflineRow key={c.id} coaching={c} />
          ))}
        </div>
      )}

      {/* Quick add coaching */}
      <QuickAddCoaching
        defaultDate={range.from}
        onCreated={() => {
          onClose();
          router.refresh();
        }}
      />
    </div>
  );
}

function Stat({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string | number;
  tone?: 'default' | 'success';
}) {
  return (
    <div className="rounded-[var(--radius-md)] bg-[var(--color-surface-tint)] border border-[var(--color-border)] px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-dim)]">
        {label}
      </div>
      <div
        className={`mt-0.5 text-lg font-semibold tabular-nums ${
          tone === 'success'
            ? 'text-emerald-300 light:text-emerald-700'
            : ''
        }`}
      >
        {value}
      </div>
    </div>
  );
}

const STATUS_LABEL: Record<CalendarBooking['status'], string> = {
  pending_admin: 'En attente',
  date_proposed: 'Date proposée',
  confirmed: 'Confirmé',
  pending_payment: 'Paiement en attente',
  paid: 'Payé',
  completed: 'Terminée',
  cancelled: 'Annulé',
};
const STATUS_VARIANT: Record<
  CalendarBooking['status'],
  'default' | 'success' | 'warning' | 'danger' | 'secondary'
> = {
  pending_admin: 'warning',
  date_proposed: 'warning',
  confirmed: 'default',
  pending_payment: 'warning',
  paid: 'success',
  completed: 'secondary',
  cancelled: 'danger',
};

function BookingRow({
  booking,
  todayIso,
  pending,
  onAction,
}: {
  booking: CalendarBooking;
  todayIso: string;
  pending: boolean;
  onAction: (
    payload: Parameters<typeof adminBookingAction>[0],
    successMsg: string
  ) => void;
}) {
  const ModeIcon = booking.formationMode === 'onsite' ? MapPin : Wifi;
  const date = booking.confirmedDate ?? booking.adminProposedDate;
  const isPast = date !== null && date < todayIso;

  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-tint)] p-3">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <Badge variant={STATUS_VARIANT[booking.status]} className="text-[10px]">
              {STATUS_LABEL[booking.status]}
            </Badge>
            <span className="text-[10px] text-[var(--color-text-faint)] font-mono">
              #{booking.id.slice(0, 8)}
            </span>
          </div>
          <div className="text-sm font-medium truncate">{booking.userName}</div>
          <div className="text-xs text-[var(--color-text-dim)] flex items-center gap-1.5 flex-wrap mt-0.5">
            <ModeIcon className="h-3 w-3" />
            {booking.formationTitle} ·{' '}
            <span className="font-mono">
              {formatPrice(booking.formationPriceEur)}
            </span>
          </div>
          {booking.userEmail && (
            <a
              href={`mailto:${booking.userEmail}`}
              className="text-[10px] text-[var(--color-accent-hover)] hover:underline inline-flex items-center gap-1 mt-0.5"
            >
              <Mail className="h-3 w-3" />
              {booking.userEmail}
            </a>
          )}
        </div>
      </div>

      {/* Actions inline contextuelles */}
      <div className="flex flex-wrap gap-1.5">
        {booking.status === 'pending_admin' && date && (
          <>
            <Button
              size="sm"
              variant="secondary"
              className="h-7 text-[11px] gap-1"
              disabled={pending}
              onClick={() =>
                onAction(
                  {
                    action: 'confirm',
                    bookingId: booking.id,
                    confirmedDate: date,
                  },
                  '✓ Confirmé'
                )
              }
            >
              {pending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Check className="h-3 w-3" />
              )}
              Confirmer
            </Button>
          </>
        )}
        {booking.status === 'pending_payment' && (
          <Button
            size="sm"
            variant="secondary"
            className="h-7 text-[11px] gap-1"
            disabled={pending}
            onClick={() => {
              const notes = window.prompt(
                'Note pour la traçabilité (méthode + référence, ex: "virement réf XYZ 14/05") :'
              );
              if (notes && notes.trim().length >= 3) {
                onAction(
                  {
                    action: 'mark_paid',
                    bookingId: booking.id,
                    notes,
                  },
                  '✓ Marqué payé'
                );
              } else if (notes !== null) {
                toast({
                  title: 'Note trop courte',
                  description: 'Au moins 3 caractères.',
                  variant: 'destructive',
                });
              }
            }}
          >
            <BadgeCheck className="h-3 w-3" />
            Marquer payé
          </Button>
        )}
        {(booking.status === 'confirmed' || booking.status === 'paid') &&
          isPast && (
            <Button
              size="sm"
              variant="secondary"
              className="h-7 text-[11px] gap-1"
              disabled={pending}
              onClick={() =>
                onAction(
                  {
                    action: 'mark_completed',
                    bookingId: booking.id,
                  },
                  '✓ Terminée'
                )
              }
            >
              <CheckCircle2 className="h-3 w-3" />
              Marquer terminée
            </Button>
          )}
        {booking.installmentTotal > 1 && (
          <Badge variant="secondary" className="text-[10px]">
            <CreditCard className="h-3 w-3 mr-0.5" />
            {booking.installmentsPaid}/{booking.installmentTotal}
          </Badge>
        )}
      </div>
    </div>
  );
}

function OfflineRow({ coaching }: { coaching: CalendarOfflineCoaching }) {
  const remaining = Math.max(
    0,
    coaching.totalAmountEur - coaching.paidAmountEur
  );
  return (
    <div className="rounded-[var(--radius-md)] border border-purple-500/30 bg-purple-500/5 p-3">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-1">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <Badge variant="secondary" className="text-[10px]">
              <Sparkles className="h-3 w-3 mr-0.5" />
              Offline
            </Badge>
            <span className="text-[10px] text-[var(--color-text-faint)]">
              {coaching.mode}
            </span>
          </div>
          <div className="text-sm font-medium truncate">{coaching.fullName}</div>
          {(coaching.email || coaching.phone) && (
            <div className="text-[10px] text-[var(--color-text-dim)] flex items-center gap-2 mt-0.5">
              {coaching.email && (
                <span className="inline-flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  {coaching.email}
                </span>
              )}
              {coaching.phone && (
                <span className="inline-flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  {coaching.phone}
                </span>
              )}
            </div>
          )}
        </div>
        <div className="text-right text-xs">
          <div className="font-mono tabular-nums">
            {coaching.paidAmountEur.toLocaleString('fr-FR')} /{' '}
            {coaching.totalAmountEur.toLocaleString('fr-FR')}€
          </div>
          {remaining > 0 && (
            <div className="text-amber-300 light:text-amber-700 text-[10px] mt-0.5">
              Reste : {remaining.toLocaleString('fr-FR')}€
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function QuickAddCoaching({
  defaultDate,
  onCreated,
}: {
  defaultDate: string;
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [pending, start] = useTransition();

  function create() {
    const total = Number(amount);
    if (!name.trim() || name.trim().length < 2) {
      toast({ title: 'Nom requis', variant: 'destructive' });
      return;
    }
    if (!Number.isFinite(total) || total < 0) {
      toast({ title: 'Montant invalide', variant: 'destructive' });
      return;
    }
    start(async () => {
      const result = await adminCreateOfflineCoachingAction({
        fullName: name.trim(),
        totalAmountEur: total,
        scheduledDate: defaultDate,
        mode: 'remote',
        paidAmountEur: 0,
      });
      if (result.success) {
        toast({ title: '✓ Coaching ajouté' });
        setName('');
        setAmount('');
        setOpen(false);
        onCreated();
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
    <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] p-3 mt-2">
      {!open ? (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setOpen(true)}
          className="w-full gap-1.5"
        >
          <Plus className="h-3.5 w-3.5" />
          Ajouter un coaching ce jour
        </Button>
      ) : (
        <div className="space-y-2">
          <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-dim)]">
            Nouveau coaching · {formatDate(defaultDate)}
          </div>
          <div className="grid sm:grid-cols-[1fr_120px] gap-2">
            <div>
              <Label htmlFor="quick-name" className="text-[10px]">
                Nom complet
              </Label>
              <Input
                id="quick-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jean Dupont"
                className="mt-0.5 h-9"
              />
            </div>
            <div>
              <Label htmlFor="quick-amount" className="text-[10px]">
                Total dû (€)
              </Label>
              <Input
                id="quick-amount"
                type="number"
                min={0}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="1500"
                className="mt-0.5 h-9 tabular-nums"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 pt-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setOpen(false);
                setName('');
                setAmount('');
              }}
              disabled={pending}
            >
              Annuler
            </Button>
            <Button size="sm" onClick={create} disabled={pending}>
              {pending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Plus className="h-3 w-3" />
              )}
              Créer le coaching
            </Button>
          </DialogFooter>
          <p className="text-[10px] text-[var(--color-text-faint)] leading-snug">
            Pour ajouter contact + notes + mode présentiel, va sur{' '}
            <em>/admin/coachings</em> après création.
          </p>
        </div>
      )}
    </div>
  );
}

