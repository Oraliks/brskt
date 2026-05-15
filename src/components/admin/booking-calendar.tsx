'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import type {
  EventClickArg,
  EventDropArg,
  EventMountArg,
} from '@fullcalendar/core';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowUpRight,
  Check,
  Clock,
  Loader2,
  X,
} from 'lucide-react';
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
import { IcalSubscribeButton } from './ical-subscribe-button';

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
  formationId: string;
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
  /** ISO string — sert au filtre "pending_payment ancien" (>3j). */
  createdAt: string;
}

export interface FormationCapacity {
  id: string;
  title: string;
  dailyCapacity: number;
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
  /** ID du booking ou du coaching offline pour les actions */
  bookingId: string;
  /** 'online' = booking via le site / 'offline' = coaching manuel admin. */
  kind?: 'online' | 'offline';
  /** Tooltip riche affiché au hover (texte multi-ligne séparé par \n). */
  tooltip?: string;
  /** Class CSS ajoutée à l'event quand sa date est saturée (capacité atteinte). */
  isOverbooked?: boolean;
}

export interface CalendarOfflineCoaching {
  id: string;
  fullName: string;
  mode: string;
  scheduledDate: string;
  totalAmountEur: number;
  paidAmountEur: number;
  status: 'active' | 'completed' | 'cancelled';
  email: string | null;
  phone: string | null;
  notes: string | null;
}

interface Props {
  bookings: CalendarBooking[];
  offlineCoachings?: CalendarOfflineCoaching[];
  formationCapacities?: FormationCapacity[];
  /** Token iCal de l'admin — null si pas encore généré. */
  icalToken?: string | null;
}

type SourceFilter = 'all' | 'online' | 'offline';
type ModeFilter = 'all' | 'remote' | 'onsite';

const PENDING_PAYMENT_STALE_DAYS = 3;

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

export function BookingCalendar({
  bookings,
  offlineCoachings = [],
  formationCapacities = [],
  icalToken = null,
}: Props) {
  const router = useRouter();
  const calendarRef = useRef<FullCalendar | null>(null);
  const [pending, start] = useTransition();
  const [detailDialog, setDetailDialog] = useState<CalendarBooking | null>(
    null
  );
  const [offlineDetail, setOfflineDetail] =
    useState<CalendarOfflineCoaching | null>(null);
  const [dropDialog, setDropDialog] = useState<{
    booking: CalendarBooking;
    newDate: string;
    revert: () => void;
  } | null>(null);
  const [dropNotes, setDropNotes] = useState('');
  /**
   * Dialog "Capacité dépassée — forcer ?" : surgit quand une action est
   * refusée par le serveur avec code='capacity_exceeded'. On y stocke la
   * callback à rappeler avec overrideCapacity=true si l'admin confirme.
   */
  const [capacityDialog, setCapacityDialog] = useState<{
    current: number;
    capacity: number;
    date: string;
    onConfirm: () => void;
  } | null>(null);

  // Filtres
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [modeFilter, setModeFilter] = useState<ModeFilter>('all');
  const [actionRequiredOnly, setActionRequiredOnly] = useState(false);

  /**
   * Map { `${formationId}|${date}` → count } : combien de bookings non-annulés
   * occupent déjà cette date pour cette formation (confirmed + proposed).
   * Sert à afficher "2/3" dans les titres + le badge "saturé" sur events.
   */
  const dailyLoadMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const b of bookings) {
      if (b.status === 'cancelled') continue;
      const date = b.confirmedDate ?? b.adminProposedDate;
      if (!date) continue;
      const key = `${b.formationId}|${date}`;
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [bookings]);

  const capacityByFormation = useMemo(() => {
    const map = new Map<string, number>();
    for (const f of formationCapacities) {
      map.set(f.id, f.dailyCapacity);
    }
    return map;
  }, [formationCapacities]);

  const actionRequiredCount = useMemo(
    () => bookings.filter((b) => isActionRequired(b)).length,
    [bookings]
  );

  const events: CalendarEvent[] = useMemo(() => {
    const ctx = { dailyLoadMap, capacityByFormation };
    const onlineEvents = bookings.flatMap((b) => {
      if (modeFilter !== 'all' && b.formationMode !== modeFilter) return [];
      if (actionRequiredOnly && !isActionRequired(b)) return [];
      return buildEventsForBooking(b, ctx);
    });
    // Le filtre "Action requise" est spécifique aux bookings online — on
    // masque l'offline quand il est actif (l'offline n'a pas de pending_admin).
    const offlineEvents =
      sourceFilter === 'online' || actionRequiredOnly
        ? []
        : offlineCoachings.flatMap((c) => {
            if (modeFilter !== 'all' && c.mode !== modeFilter) return [];
            return buildEventsForOffline(c);
          });
    const filtered =
      sourceFilter === 'offline' ? offlineEvents : [...onlineEvents, ...offlineEvents];
    return filtered;
  }, [
    bookings,
    offlineCoachings,
    sourceFilter,
    modeFilter,
    actionRequiredOnly,
    dailyLoadMap,
    capacityByFormation,
  ]);

  function onEventClick(arg: EventClickArg) {
    const isOffline = arg.event.extendedProps.kind === 'offline';
    const id = arg.event.extendedProps.bookingId as string;
    if (isOffline) {
      const c = offlineCoachings.find((o) => o.id === id);
      if (c) setOfflineDetail(c);
      return;
    }
    const booking = bookings.find((b) => b.id === id);
    if (booking) setDetailDialog(booking);
  }

  function onEventDrop(arg: EventDropArg) {
    const isOffline = arg.event.extendedProps.kind === 'offline';
    if (isOffline) {
      // Offline coachings : drag = reschedule. On affichera plus tard un
      // dialog dédié — pour l'instant on revert (changement via /admin/coachings).
      toast({
        title: 'Reprogrammation offline',
        description:
          "Modifie la date depuis /admin/coachings (Édition). Drag pas encore actif pour l'offline.",
      });
      arg.revert();
      return;
    }
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

  function confirmProposeDate(overrideCapacity = false) {
    if (!dropDialog) return;
    const { booking, newDate, revert } = dropDialog;
    start(async () => {
      const result = await adminBookingAction({
        action: 'propose_alternative',
        bookingId: booking.id,
        proposedDate: newDate,
        notes: dropNotes.trim() || undefined,
        overrideCapacity,
      });
      if (result.success) {
        toast({
          title: `✓ Date proposée pour ${booking.userName}`,
          description: formatDate(newDate),
        });
        setDropDialog(null);
        setDropNotes('');
        setCapacityDialog(null);
        router.refresh();
      } else if (result.code === 'capacity_exceeded') {
        const meta = result.meta as { current: number; capacity: number };
        setCapacityDialog({
          current: meta.current,
          capacity: meta.capacity,
          date: newDate,
          onConfirm: () => confirmProposeDate(true),
        });
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

  function confirmThisDate(
    booking: CalendarBooking,
    date: string,
    overrideCapacity = false
  ) {
    start(async () => {
      const result = await adminBookingAction({
        action: 'confirm',
        bookingId: booking.id,
        confirmedDate: date,
        overrideCapacity,
      });
      if (result.success) {
        toast({ title: `✓ Confirmé ${booking.userName}` });
        setDetailDialog(null);
        setCapacityDialog(null);
        router.refresh();
      } else if (result.code === 'capacity_exceeded') {
        const meta = result.meta as { current: number; capacity: number };
        setCapacityDialog({
          current: meta.current,
          capacity: meta.capacity,
          date,
          onConfirm: () => confirmThisDate(booking, date, true),
        });
      } else {
        toast({
          title: 'Erreur',
          description: result.error,
          variant: 'destructive',
        });
      }
    });
  }

  /**
   * Hook FullCalendar : appelé après le mount de chaque event dans le DOM.
   * On y attache le tooltip natif HTML (title=) — léger, accessible, pas
   * de lib à installer. Pour un tooltip riche (carte au survol) on
   * basculerait sur Radix Tooltip plus tard.
   */
  function onEventDidMount(arg: EventMountArg) {
    const tooltip = arg.event.extendedProps.tooltip as string | undefined;
    if (tooltip) {
      arg.el.setAttribute('title', tooltip);
    }
    const overbooked = arg.event.extendedProps.isOverbooked as
      | boolean
      | undefined;
    if (overbooked) {
      arg.el.style.boxShadow = 'inset 0 0 0 2px rgb(239, 68, 68)';
      arg.el.style.position = 'relative';
    }
  }

  return (
    <>
      <div className="glass rounded-[var(--radius-lg)] p-3 md:p-4">
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <Filters
            sourceFilter={sourceFilter}
            setSourceFilter={setSourceFilter}
            modeFilter={modeFilter}
            setModeFilter={setModeFilter}
            actionRequiredOnly={actionRequiredOnly}
            setActionRequiredOnly={setActionRequiredOnly}
            counts={{
              online: bookings.length,
              offline: offlineCoachings.length,
              actionRequired: actionRequiredCount,
            }}
          />
          <div className="flex-1" />
          <Legend />
          <IcalSubscribeButton token={icalToken} />
        </div>
        <FullCalendar
          ref={calendarRef as React.MutableRefObject<FullCalendar | null>}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          firstDay={1}
          locale="fr"
          height="auto"
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek',
          }}
          buttonText={{
            today: "Aujourd'hui",
            month: 'Mois',
            week: 'Semaine',
          }}
          events={events}
          editable
          eventDurationEditable={false}
          eventStartEditable
          droppable={false}
          eventClick={onEventClick}
          eventDrop={onEventDrop}
          eventDidMount={onEventDidMount}
          dayMaxEvents={3}
          displayEventTime={false}
          eventDisplay="block"
          allDaySlot
        />
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
      {/* Dialog détail offline coaching */}
      <Dialog
        open={!!offlineDetail}
        onOpenChange={(o) => !o && setOfflineDetail(null)}
      >
        {offlineDetail && (
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 flex-wrap">
                📋 {offlineDetail.fullName}
                <Badge variant="secondary">Offline</Badge>
              </DialogTitle>
              <DialogDescription>
                Coaching importé hors-site · {offlineDetail.mode}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              {(offlineDetail.email || offlineDetail.phone) && (
                <DetailRow
                  label="Contact"
                  value={
                    <>
                      {offlineDetail.email}
                      {offlineDetail.email && offlineDetail.phone && ' · '}
                      {offlineDetail.phone}
                    </>
                  }
                />
              )}
              <DetailRow
                label="Date"
                value={<strong>{formatDate(offlineDetail.scheduledDate)}</strong>}
              />
              <DetailRow
                label="Total / Payé"
                value={
                  <>
                    {offlineDetail.paidAmountEur.toLocaleString('fr-FR')} /{' '}
                    {offlineDetail.totalAmountEur.toLocaleString('fr-FR')}€
                  </>
                }
              />
              <DetailRow
                label="Reste dû"
                value={
                  <span
                    className={
                      offlineDetail.totalAmountEur -
                        offlineDetail.paidAmountEur >
                      0
                        ? 'text-amber-300 light:text-amber-700 font-semibold'
                        : 'text-emerald-300 light:text-emerald-700 font-semibold'
                    }
                  >
                    {Math.max(
                      0,
                      offlineDetail.totalAmountEur -
                        offlineDetail.paidAmountEur
                    ).toLocaleString('fr-FR')}
                    €
                  </span>
                }
              />
              {offlineDetail.notes && (
                <DetailRow
                  label="Notes"
                  value={
                    <span className="italic text-[var(--color-text-dim)]">
                      «{offlineDetail.notes}»
                    </span>
                  }
                />
              )}
            </div>
            <DialogFooter>
              <Button variant="ghost" asChild>
                <Link href="/admin/coachings">
                  <ArrowUpRight className="h-4 w-4" />
                  Éditer dans /admin/coachings
                </Link>
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

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
              <Button onClick={() => confirmProposeDate(false)} disabled={pending}>
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

      {/* Dialog "Capacité dépassée — forcer ?" */}
      <Dialog
        open={!!capacityDialog}
        onOpenChange={(o) => !o && setCapacityDialog(null)}
      >
        {capacityDialog && (
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-amber-400" />
                Jour saturé
              </DialogTitle>
              <DialogDescription>
                Le {formatDate(capacityDialog.date)} a déjà{' '}
                <strong>
                  {capacityDialog.current}/{capacityDialog.capacity}
                </strong>{' '}
                participant(s) sur cette formation.
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-[var(--radius-md)] bg-amber-500/10 border border-amber-500/25 p-3 text-xs text-amber-200 light:text-amber-700">
              Tu peux forcer l&apos;ajout d&apos;un participant supplémentaire
              si tu as la capacité d&apos;encadrer. Sinon, choisis une autre
              date ou augmente la capacité par défaut dans /admin/formations.
            </div>
            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => setCapacityDialog(null)}
                disabled={pending}
              >
                Annuler
              </Button>
              <Button
                onClick={capacityDialog.onConfirm}
                disabled={pending}
                className="bg-amber-500/20 border border-amber-500/40 text-amber-100 hover:bg-amber-500/30"
              >
                {pending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                Forcer quand même
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}

interface BuildContext {
  dailyLoadMap: Map<string, number>;
  capacityByFormation: Map<string, number>;
}

/**
 * Génère 1 ou plusieurs events pour un booking selon son état :
 * - confirmed/paid/completed → 1 event sur confirmedDate
 * - date_proposed → 1 event sur adminProposedDate (jaune)
 * - pending_admin sans dates → aucun event (skip ASAP)
 * - pending_admin avec preferredDates → 1 event ghost par créneau
 */
function buildEventsForBooking(
  b: CalendarBooking,
  ctx: BuildContext
): CalendarEvent[] {
  if (b.status === 'cancelled') return [];

  const modeLabel = b.formationMode === 'onsite' ? 'Dubaï' : 'Distance';
  const baseTitle = `${b.userName} · ${modeLabel}`;

  function capacityInfo(date: string): {
    label: string;
    overbooked: boolean;
    current: number;
    capacity: number | null;
  } {
    const capacity = ctx.capacityByFormation.get(b.formationId) ?? null;
    const current = ctx.dailyLoadMap.get(`${b.formationId}|${date}`) ?? 0;
    return {
      label: capacity !== null ? ` (${current}/${capacity})` : '',
      overbooked: capacity !== null && current > capacity,
      current,
      capacity,
    };
  }

  function tooltipFor(date: string, tag: string): string {
    const cap = capacityInfo(date);
    const lines = [
      `${b.userName}${b.userEmail ? ` · ${b.userEmail}` : ''}`,
      `${b.formationTitle} (${modeLabel})`,
      `Statut : ${STATUS_LABEL[b.status]}${tag ? ` — ${tag}` : ''}`,
    ];
    if (cap.capacity !== null) {
      lines.push(
        `Capacité : ${cap.current}/${cap.capacity}${
          cap.overbooked ? ' ⚠️ saturé' : ''
        }`
      );
    }
    if (b.installmentTotal > 1) {
      lines.push(
        `Paiement : ${b.installmentsPaid}/${b.installmentTotal} échéance(s)`
      );
    }
    return lines.join('\n');
  }

  if (b.confirmedDate) {
    const cap = capacityInfo(b.confirmedDate);
    return [
      {
        id: `${b.id}-confirmed`,
        bookingId: b.id,
        title: `${baseTitle}${cap.label}`,
        start: b.confirmedDate,
        backgroundColor: colorFor(b.status).bg,
        borderColor: colorFor(b.status).border,
        textColor: colorFor(b.status).text,
        isGhost: false,
        tooltip: tooltipFor(b.confirmedDate, ''),
        isOverbooked: cap.overbooked,
      },
    ];
  }

  if (b.adminProposedDate) {
    const cap = capacityInfo(b.adminProposedDate);
    return [
      {
        id: `${b.id}-proposed`,
        bookingId: b.id,
        title: `${baseTitle} (proposé)${cap.label}`,
        start: b.adminProposedDate,
        backgroundColor: colorFor('date_proposed').bg,
        borderColor: colorFor('date_proposed').border,
        textColor: colorFor('date_proposed').text,
        isGhost: false,
        tooltip: tooltipFor(b.adminProposedDate, 'proposé'),
        isOverbooked: cap.overbooked,
      },
    ];
  }

  if (b.status === 'pending_admin' && b.preferredDates) {
    return b.preferredDates.slice(0, 3).map((d, i) => ({
      id: `${b.id}-pref-${i}`,
      bookingId: b.id,
      title: `${baseTitle} ?`,
      start: d.start,
      backgroundColor: colorFor('pending_admin').bg,
      borderColor: colorFor('pending_admin').border,
      textColor: colorFor('pending_admin').text,
      isGhost: true,
      tooltip: tooltipFor(d.start, `créneau ${i + 1}/3 user`),
    }));
  }

  return [];
}

/**
 * Détermine si un booking nécessite une action admin maintenant :
 *  - pending_admin : créneaux user à valider
 *  - pending_payment trop ancien (>3j) : user qui n'a pas payé
 */
function isActionRequired(b: CalendarBooking): boolean {
  if (b.status === 'pending_admin') return true;
  if (b.status === 'pending_payment') {
    const ageDays =
      (Date.now() - new Date(b.createdAt).getTime()) / (24 * 60 * 60 * 1000);
    return ageDays > PENDING_PAYMENT_STALE_DAYS;
  }
  return false;
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
  const items: Array<{
    color: { bg: string; border: string; text: string };
    label: string;
  }> = [
    { color: colorFor('pending_admin'), label: 'Créneaux user' },
    { color: colorFor('date_proposed'), label: 'Date proposée' },
    { color: colorFor('confirmed'), label: 'Confirmé' },
    { color: OFFLINE_COLOR, label: 'Coaching offline' },
  ];
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 items-center text-[10px] text-[var(--color-text-dim)]">
      {items.map((i, idx) => (
        <span key={idx} className="inline-flex items-center gap-1">
          <span
            className="inline-block h-2.5 w-2.5 rounded-sm border"
            style={{
              backgroundColor: i.color.bg,
              borderColor: i.color.border,
            }}
          />
          {i.label}
        </span>
      ))}
    </div>
  );
}

const OFFLINE_COLOR = {
  bg: 'rgba(168, 85, 247, 0.20)',
  border: 'rgb(168, 85, 247)',
  text: 'rgb(216, 180, 254)',
};

function buildEventsForOffline(c: CalendarOfflineCoaching): CalendarEvent[] {
  if (c.status === 'cancelled') return [];
  const remaining = Math.max(0, c.totalAmountEur - c.paidAmountEur);
  const tooltip = [
    `${c.fullName} (offline)`,
    c.email ? c.email : null,
    c.phone ? c.phone : null,
    `Mode : ${c.mode}`,
    `Payé ${c.paidAmountEur.toLocaleString('fr-FR')}€ / Total ${c.totalAmountEur.toLocaleString('fr-FR')}€`,
    remaining > 0
      ? `⚠️ Reste dû : ${remaining.toLocaleString('fr-FR')}€`
      : '✓ Soldé',
  ]
    .filter(Boolean)
    .join('\n');
  return [
    {
      id: `offline-${c.id}`,
      bookingId: c.id,
      title: `📋 ${c.fullName} · ${c.mode}`,
      start: c.scheduledDate,
      backgroundColor: OFFLINE_COLOR.bg,
      borderColor: OFFLINE_COLOR.border,
      textColor: OFFLINE_COLOR.text,
      isGhost: false,
      kind: 'offline',
      tooltip,
    },
  ];
}

function Filters({
  sourceFilter,
  setSourceFilter,
  modeFilter,
  setModeFilter,
  actionRequiredOnly,
  setActionRequiredOnly,
  counts,
}: {
  sourceFilter: SourceFilter;
  setSourceFilter: (v: SourceFilter) => void;
  modeFilter: ModeFilter;
  setModeFilter: (v: ModeFilter) => void;
  actionRequiredOnly: boolean;
  setActionRequiredOnly: (v: boolean) => void;
  counts: { online: number; offline: number; actionRequired: number };
}) {
  return (
    <div className="flex flex-wrap gap-2 items-center">
      <button
        type="button"
        onClick={() => setActionRequiredOnly(!actionRequiredOnly)}
        className={
          actionRequiredOnly
            ? 'inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium bg-amber-500/20 text-amber-200 light:text-amber-800 border border-amber-500/40'
            : 'inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] bg-transparent text-[var(--color-text-dim)] border border-[var(--color-border)] hover:bg-[var(--color-surface-tint)]'
        }
      >
        <AlertCircle className="h-3 w-3" />
        Action requise {counts.actionRequired}
      </button>
      <span className="text-[var(--color-text-faint)] mx-1">·</span>
      <FilterChip
        active={sourceFilter === 'all'}
        onClick={() => setSourceFilter('all')}
      >
        Tout {counts.online + counts.offline}
      </FilterChip>
      <FilterChip
        active={sourceFilter === 'online'}
        onClick={() => setSourceFilter('online')}
      >
        Site {counts.online}
      </FilterChip>
      <FilterChip
        active={sourceFilter === 'offline'}
        onClick={() => setSourceFilter('offline')}
      >
        Offline {counts.offline}
      </FilterChip>
      <span className="text-[var(--color-text-faint)] mx-1">·</span>
      <FilterChip
        active={modeFilter === 'all'}
        onClick={() => setModeFilter('all')}
      >
        Tous formats
      </FilterChip>
      <FilterChip
        active={modeFilter === 'remote'}
        onClick={() => setModeFilter('remote')}
      >
        Distance
      </FilterChip>
      <FilterChip
        active={modeFilter === 'onsite'}
        onClick={() => setModeFilter('onsite')}
      >
        Dubaï
      </FilterChip>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? 'inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-medium bg-white/10 text-[var(--color-text)] border border-[var(--color-border-strong)]'
          : 'inline-flex items-center px-2.5 py-1 rounded-md text-[11px] bg-transparent text-[var(--color-text-dim)] border border-[var(--color-border)] hover:bg-[var(--color-surface-tint)]'
      }
    >
      {children}
    </button>
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
