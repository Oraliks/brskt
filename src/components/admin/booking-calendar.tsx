'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import type { EventClickArg, EventDropArg } from '@fullcalendar/core';
import Link from 'next/link';
import { ArrowUpRight, Check, Clock, Loader2, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/use-toast';
import { adminBookingAction } from '@/lib/actions/admin';
import { formatDate, formatPrice } from '@/lib/utils';

/**
 * Calendrier admin des réservations.
 *
 * Vue mois. Chaque booking est affiché aux dates pertinentes :
 *  - Si `confirmedDate` ou `adminProposedDate` set → 1 event à cette date.
 *  - Sinon (status pending_admin) → 1 event "fantôme" à chaque créneau préféré
 *    proposé par l'utilisateur (preferredDates[]).
 *
 * Interactions :
 *  - Click sur un event → dialog détails + raccourcis (lien fiche, confirmer
 *    une date proposée, refuser).
 *  - Drag d'un event vers un autre jour → propose cette date comme alternative.
 *    Demande confirmation + raison optionnelle.
 */

export interface CalendarBooking {
  id: string;
  userName: string;
  userEmail: string | null;
  userTelegramUsername: string | null;
  formationTitle: string;
  formationMode: 'remote' | 'onsite';
  formationPriceEur: number;
  status:
    | 'pending_admin'
    | 'date_proposed'
    | 'confirmed'
    | 'pending_payment'
    | 'paid'
    | 'completed'
    | 'cancelled';
  preferredDates: Array<{ start: string; end: string }> | null;
  preferredAsap: boolean;
  confirmedDate: string | null;
  adminProposedDate: string | null;
  adminNotes: string | null;
  installmentsPaid: number;
  installmentTotal: number;
}

interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end?: string;
  backgroundColor: string;
  borderColor: string;
  textColor: string;
  /** Si true, ce n'est pas la "vraie" date du booking — c'est une suggestion
   *  user qu'on visualise. Pas drag-droppable. */
  isGhost: boolean;
  /** Booking original pour les actions */
  bookingId: string;
}

interface Props {
  bookings: CalendarBooking[];
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
  'default' | 'success' | 'warning' | 'danger' | 'secondary' | 'gold'
> = {
  pending_admin: 'warning',
  date_proposed: 'warning',
  confirmed: 'default',
  pending_payment: 'warning',
  paid: 'success',
  completed: 'secondary',
  cancelled: 'danger',
};

export function BookingCalendar({ bookings }: Props) {
  const router = useRouter();
  const calendarRef = useRef<FullCalendar | null>(null);
  const [pending, start] = useTransition();
  const [detailDialog, setDetailDialog] = useState<CalendarBooking | null>(
    null
  );
  const [dropDialog, setDropDialog] = useState<{
    booking: CalendarBooking;
    newDate: string;
    revert: () => void;
  } | null>(null);
  const [dropNotes, setDropNotes] = useState('');

  const events: CalendarEvent[] = bookings.flatMap((b) =>
    buildEventsForBooking(b)
  );

  function onEventClick(arg: EventClickArg) {
    const id = arg.event.extendedProps.bookingId as string;
    const booking = bookings.find((b) => b.id === id);
    if (booking) setDetailDialog(booking);
  }

  function onEventDrop(arg: EventDropArg) {
    const id = arg.event.extendedProps.bookingId as string;
    const booking = bookings.find((b) => b.id === id);
    if (!booking || !arg.event.start) {
      arg.revert();
      return;
    }
    // Cancel & completed ne sont pas modifiables
    if (booking.status === 'cancelled' || booking.status === 'completed') {
      toast({
        title: 'Non modifiable',
        description: `Status ${booking.status}`,
        variant: 'destructive',
      });
      arg.revert();
      return;
    }
    const newDate = arg.event.start.toISOString().slice(0, 10);
    setDropDialog({ booking, newDate, revert: arg.revert });
    setDropNotes('');
  }

  function confirmProposeDate() {
    if (!dropDialog) return;
    const { booking, newDate, revert } = dropDialog;
    start(async () => {
      const result = await adminBookingAction({
        action: 'propose_alternative',
        bookingId: booking.id,
        proposedDate: newDate,
        notes: dropNotes.trim() || undefined,
      });
      if (result.success) {
        toast({
          title: `✓ Date proposée pour ${booking.userName}`,
          description: formatDate(newDate),
        });
        setDropDialog(null);
        setDropNotes('');
        router.refresh();
      } else {
        toast({
          title: 'Erreur',
          description: result.error,
          variant: 'destructive',
        });
        revert();
      }
    });
  }

  function cancelDrop() {
    if (!dropDialog) return;
    dropDialog.revert();
    setDropDialog(null);
    setDropNotes('');
  }

  function confirmThisDate(booking: CalendarBooking, date: string) {
    start(async () => {
      const result = await adminBookingAction({
        action: 'confirm',
        bookingId: booking.id,
        confirmedDate: date,
      });
      if (result.success) {
        toast({ title: `✓ Confirmé ${booking.userName}` });
        setDetailDialog(null);
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
      <div className="glass rounded-[var(--radius-lg)] p-3 md:p-4">
        <Legend />
        <div className="mt-3">
          <FullCalendar
            ref={calendarRef as React.MutableRefObject<FullCalendar | null>}
            plugins={[dayGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            firstDay={1}
            locale="fr"
            height="auto"
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: '',
            }}
            buttonText={{
              today: "Aujourd'hui",
              month: 'Mois',
            }}
            events={events}
            editable
            eventDurationEditable={false}
            eventStartEditable
            droppable={false}
            eventClick={onEventClick}
            eventDrop={onEventDrop}
            dayMaxEvents={3}
            displayEventTime={false}
            eventDisplay="block"
          />
        </div>
      </div>

      {/* Dialog détails event */}
      <Dialog
        open={!!detailDialog}
        onOpenChange={(o) => !o && setDetailDialog(null)}
      >
        {detailDialog && (
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 flex-wrap">
                {detailDialog.userName}
                <Badge variant={STATUS_VARIANT[detailDialog.status]}>
                  {STATUS_LABEL[detailDialog.status]}
                </Badge>
              </DialogTitle>
              <DialogDescription>
                {detailDialog.formationTitle} ·{' '}
                {formatPrice(detailDialog.formationPriceEur)}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 text-sm">
              <DetailRow
                label="Contact"
                value={
                  <>
                    {detailDialog.userEmail ?? <em>pas d&apos;email</em>}
                    {detailDialog.userTelegramUsername && (
                      <>
                        {' '}
                        ·{' '}
                        <a
                          href={`https://t.me/${detailDialog.userTelegramUsername}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[var(--color-accent-hover)] hover:underline"
                        >
                          @{detailDialog.userTelegramUsername}
                        </a>
                      </>
                    )}
                  </>
                }
              />
              <DetailRow
                label="Format"
                value={
                  detailDialog.formationMode === 'onsite'
                    ? 'Présentiel Dubaï'
                    : 'Distance'
                }
              />
              {detailDialog.confirmedDate && (
                <DetailRow
                  label="Date confirmée"
                  value={
                    <strong>{formatDate(detailDialog.confirmedDate)}</strong>
                  }
                />
              )}
              {detailDialog.adminProposedDate && (
                <DetailRow
                  label="Date proposée"
                  value={formatDate(detailDialog.adminProposedDate)}
                />
              )}
              {!detailDialog.confirmedDate &&
                !detailDialog.adminProposedDate &&
                (detailDialog.preferredAsap ||
                  (detailDialog.preferredDates &&
                    detailDialog.preferredDates.length > 0)) && (
                  <DetailRow
                    label="Créneaux proposés par l'user"
                    value={
                      detailDialog.preferredAsap ? (
                        <span>ASAP</span>
                      ) : (
                        <ul className="space-y-1">
                          {detailDialog.preferredDates?.map((d, i) => (
                            <li
                              key={i}
                              className="font-mono text-xs flex items-center justify-between gap-2"
                            >
                              <span>
                                {d.start} → {d.end}
                              </span>
                              {detailDialog.status === 'pending_admin' && (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() =>
                                    confirmThisDate(detailDialog, d.start)
                                  }
                                  disabled={pending}
                                >
                                  <Check className="h-3 w-3" />
                                  Confirmer
                                </Button>
                              )}
                            </li>
                          ))}
                        </ul>
                      )
                    }
                  />
                )}
              <DetailRow
                label="Paiements"
                value={
                  <>
                    {detailDialog.installmentsPaid} /{' '}
                    {detailDialog.installmentTotal} échéance(s)
                  </>
                }
              />
              {detailDialog.adminNotes && (
                <DetailRow
                  label="Note admin"
                  value={
                    <span className="italic text-[var(--color-text-dim)]">
                      «{detailDialog.adminNotes}»
                    </span>
                  }
                />
              )}

              <div className="rounded-[var(--radius-md)] bg-[var(--color-surface-tint)] border border-[var(--color-border)] p-2.5 text-xs text-[var(--color-text-dim)]">
                💡 Pour proposer une autre date, drag l&apos;event sur le jour
                voulu. Pour refuser ou force-cancel, va sur la fiche complète.
              </div>
            </div>

            <DialogFooter>
              <Button variant="ghost" asChild>
                <Link href={`/admin/bookings#${detailDialog.id}`}>
                  <ArrowUpRight className="h-4 w-4" />
                  Fiche complète
                </Link>
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      {/* Dialog drop (proposer une nouvelle date) */}
      <Dialog open={!!dropDialog} onOpenChange={(o) => !o && cancelDrop()}>
        {dropDialog && (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                Proposer le {formatDate(dropDialog.newDate)} ?
              </DialogTitle>
              <DialogDescription>
                {dropDialog.booking.userName} ·{' '}
                {dropDialog.booking.formationTitle}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <div className="rounded-[var(--radius-md)] bg-amber-500/10 border border-amber-500/25 p-3 text-xs text-amber-200 light:text-amber-700">
                Le user recevra un email + DM Telegram avec cette date à
                accepter/refuser. Il pourra encore te demander un autre
                créneau si besoin.
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--color-text-dim)]">
                  Note pour le user (optionnel)
                </label>
                <Textarea
                  rows={2}
                  value={dropNotes}
                  onChange={(e) => setDropNotes(e.target.value)}
                  placeholder="Ex : la date initiale était trop proche, j'ai décalé d'une semaine."
                  className="mt-1.5"
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={cancelDrop}>
                <X className="h-4 w-4" />
                Annuler
              </Button>
              <Button onClick={confirmProposeDate} disabled={pending}>
                {pending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Clock className="h-4 w-4" />
                )}
                Proposer cette date
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}

/**
 * Génère 1 ou plusieurs events pour un booking selon son état :
 * - confirmed/paid/completed → 1 event sur confirmedDate
 * - date_proposed → 1 event sur adminProposedDate (jaune)
 * - pending_admin sans dates → aucun event (skip ASAP)
 * - pending_admin avec preferredDates → 1 event ghost par créneau
 */
function buildEventsForBooking(b: CalendarBooking): CalendarEvent[] {
  // Cancelled / completed → ne pas afficher sur le calendrier (clutter)
  if (b.status === 'cancelled') return [];

  const title = `${b.userName} · ${
    b.formationMode === 'onsite' ? 'Dubaï' : 'Distance'
  }`;

  if (b.confirmedDate) {
    return [
      {
        id: `${b.id}-confirmed`,
        bookingId: b.id,
        title,
        start: b.confirmedDate,
        backgroundColor: colorFor(b.status).bg,
        borderColor: colorFor(b.status).border,
        textColor: colorFor(b.status).text,
        isGhost: false,
      },
    ];
  }

  if (b.adminProposedDate) {
    return [
      {
        id: `${b.id}-proposed`,
        bookingId: b.id,
        title: `${title} (proposé)`,
        start: b.adminProposedDate,
        backgroundColor: colorFor('date_proposed').bg,
        borderColor: colorFor('date_proposed').border,
        textColor: colorFor('date_proposed').text,
        isGhost: false,
      },
    ];
  }

  // pending_admin : on visualise les créneaux préférés en "ghost"
  if (b.status === 'pending_admin' && b.preferredDates) {
    return b.preferredDates.slice(0, 3).map((d, i) => ({
      id: `${b.id}-pref-${i}`,
      bookingId: b.id,
      title: `${title} ?`,
      start: d.start,
      backgroundColor: colorFor('pending_admin').bg,
      borderColor: colorFor('pending_admin').border,
      textColor: colorFor('pending_admin').text,
      isGhost: true,
    }));
  }

  return [];
}

function colorFor(status: CalendarBooking['status']): {
  bg: string;
  border: string;
  text: string;
} {
  switch (status) {
    case 'confirmed':
    case 'paid':
      return {
        bg: 'rgba(16, 185, 129, 0.20)',
        border: 'rgb(16, 185, 129)',
        text: 'rgb(167, 243, 208)',
      };
    case 'date_proposed':
      return {
        bg: 'rgba(245, 158, 11, 0.20)',
        border: 'rgb(245, 158, 11)',
        text: 'rgb(252, 211, 77)',
      };
    case 'pending_admin':
      return {
        bg: 'rgba(99, 102, 241, 0.15)',
        border: 'rgb(99, 102, 241)',
        text: 'rgb(165, 180, 252)',
      };
    case 'completed':
      return {
        bg: 'rgba(100, 116, 139, 0.15)',
        border: 'rgb(100, 116, 139)',
        text: 'rgb(148, 163, 184)',
      };
    default:
      return {
        bg: 'rgba(255, 255, 255, 0.08)',
        border: 'rgb(148, 163, 184)',
        text: 'rgb(226, 232, 240)',
      };
  }
}

function Legend() {
  const items: Array<{ status: CalendarBooking['status']; label: string }> = [
    { status: 'pending_admin', label: 'En attente (créneaux user)' },
    { status: 'date_proposed', label: 'Date proposée' },
    { status: 'confirmed', label: 'Confirmé / Payé' },
    { status: 'completed', label: 'Terminée' },
  ];
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 items-center text-[11px] text-[var(--color-text-dim)]">
      <span>Légende :</span>
      {items.map((i) => {
        const c = colorFor(i.status);
        return (
          <span key={i.status} className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm border"
              style={{ backgroundColor: c.bg, borderColor: c.border }}
            />
            {i.label}
          </span>
        );
      })}
    </div>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-3 items-baseline">
      <div className="text-xs uppercase tracking-wider text-[var(--color-text-dim)]">
        {label}
      </div>
      <div>{value}</div>
    </div>
  );
}
