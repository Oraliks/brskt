import { and, eq, isNotNull, ne } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  bookings,
  offlineCoachings,
  users,
  type Booking,
  type OfflineCoaching,
} from '@/lib/db/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Feed iCal RFC 5545 — abonnable depuis Apple Calendar, Google Calendar,
 * Outlook. URL : `https://<host>/api/calendar/feed/<token>/calendar.ics`
 * (ou `webcal://...` pour l'auto-add iOS).
 *
 * Sécurité : le token UUID stocké sur `users.ical_token` identifie le
 * propriétaire. Si l'user est admin → feed contient toutes les sessions
 * (bookings online + coachings offline). Sinon : ses propres bookings
 * uniquement (TODO — pas exposé publiquement pour l'instant).
 *
 * Format : 1 VEVENT par session avec confirmedDate / adminProposedDate /
 * coaching scheduledDate. Les bookings sans date (pending_admin avec juste
 * des preferredDates) ne sont pas inclus — ils n'ont pas de date "ferme"
 * que Calendar puisse fixer.
 *
 * iOS rafraichit le feed automatiquement (intervalle configurable dans
 * Réglages → Calendrier → Comptes → Calendriers iCloud → Actualiser).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  if (!isUuid(token)) {
    return new Response('not_found', { status: 404 });
  }

  const user = await db.query.users.findFirst({
    where: eq(users.icalToken, token),
    columns: { id: true, role: true, email: true, name: true },
  });

  if (!user) {
    // On répond 404 plutôt que 401 pour ne pas leaker l'existence d'un token.
    return new Response('not_found', { status: 404 });
  }

  let events: VEvent[];
  if (user.role === 'admin') {
    events = await buildAdminEvents();
  } else {
    // Feed user (futur) — pas activé pour l'instant. On répond avec un
    // calendrier vide pour ne pas casser l'abonnement éventuel.
    events = [];
  }

  const body = renderIcs({
    name:
      user.role === 'admin'
        ? 'Boursikotons — Sessions'
        : `Boursikotons — ${user.name}`,
    description:
      user.role === 'admin'
        ? 'Toutes les sessions (formations site + coachings offline)'
        : 'Mes sessions Boursikotons',
    events,
  });

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="boursikotons.ics"',
      // Pas de cache agressif : on veut que les clients refetch souvent
      'Cache-Control': 'public, max-age=300, must-revalidate',
    },
  });
}

async function buildAdminEvents(): Promise<VEvent[]> {
  // Bookings online avec une date ferme (confirmée ou proposée)
  const onlineRows = await db.query.bookings.findMany({
    where: and(
      ne(bookings.status, 'cancelled'),
      // Drizzle ne supporte pas un OR avec query helpers facilement —
      // on récupère tous les non-cancelled puis on filtre côté JS.
      // Le volume est faible (≤500), ça reste OK.
    ),
    with: {
      user: { columns: { name: true, email: true } },
      formation: { columns: { title: true, mode: true, durationDays: true } },
    },
    limit: 1000,
  });

  const onlineEvents: VEvent[] = [];
  for (const b of onlineRows) {
    const date = b.confirmedDate ?? b.adminProposedDate;
    if (!date) continue;
    onlineEvents.push(buildOnlineEvent(b, date));
  }

  // Coachings offline avec scheduledDate
  const offlineRows = await db.query.offlineCoachings.findMany({
    where: and(
      ne(offlineCoachings.status, 'cancelled'),
      isNotNull(offlineCoachings.scheduledDate)
    ),
    limit: 1000,
  });

  const offlineEvents = offlineRows
    .filter((c) => c.scheduledDate)
    .map(buildOfflineEvent);

  return [...onlineEvents, ...offlineEvents];
}

type BookingWithRelations = Booking & {
  user: { name: string; email: string | null };
  formation: { title: string; mode: 'remote' | 'onsite'; durationDays: number };
};

function buildOnlineEvent(b: BookingWithRelations, date: string): VEvent {
  const start = date;
  const end = addDays(date, Math.max(1, b.formation.durationDays));
  const modeLabel = b.formation.mode === 'onsite' ? 'Présentiel Dubaï' : 'Distance';
  const statusLabel =
    b.confirmedDate ? '✅ Confirmé' : '⏳ Date proposée (en attente user)';
  return {
    uid: `booking-${b.id}@boursikotons`,
    summary: `${b.user.name} · ${modeLabel}`,
    description: `${b.formation.title}\n${statusLabel}\nUser : ${b.user.name}${b.user.email ? ` (${b.user.email})` : ''}`,
    dtStart: start,
    dtEnd: end,
    location: b.formation.mode === 'onsite' ? 'Dubaï' : 'Distance (Telegram)',
    allDay: true,
  };
}

function buildOfflineEvent(c: OfflineCoaching): VEvent {
  const remaining = Math.max(
    0,
    Number(c.totalAmountEur) - Number(c.paidAmountEur)
  );
  return {
    uid: `offline-${c.id}@boursikotons`,
    summary: `📋 ${c.fullName} · ${c.mode}`,
    description: [
      `Coaching offline (hors-site)`,
      c.email ? `Email : ${c.email}` : null,
      c.phone ? `Tél : ${c.phone}` : null,
      `Total : ${Number(c.totalAmountEur).toLocaleString('fr-FR')}€`,
      `Payé : ${Number(c.paidAmountEur).toLocaleString('fr-FR')}€`,
      remaining > 0 ? `⚠️ Reste dû : ${remaining.toLocaleString('fr-FR')}€` : '✓ Soldé',
      c.notes ? `\nNotes : ${c.notes}` : null,
    ]
      .filter(Boolean)
      .join('\n'),
    dtStart: c.scheduledDate ?? '',
    dtEnd: addDays(c.scheduledDate ?? '', 1),
    allDay: true,
  };
}

// ============================================================
// iCal rendering (RFC 5545)
// ============================================================

interface VEvent {
  uid: string;
  summary: string;
  description?: string;
  /** Format YYYY-MM-DD pour all-day, ou ISO complet sinon. */
  dtStart: string;
  dtEnd?: string;
  location?: string;
  allDay: boolean;
}

/**
 * Renvoie une string iCal complète. RFC 5545 :
 *   - CRLF line endings obligatoires
 *   - Lines > 75 octets foldées avec un espace en début de ligne suivante
 *   - Échappement \, ; ;  \\ et newlines
 *   - PRODID obligatoire
 */
function renderIcs(opts: {
  name: string;
  description: string;
  events: VEvent[];
}): string {
  const lines: string[] = [];
  lines.push('BEGIN:VCALENDAR');
  lines.push('VERSION:2.0');
  lines.push('PRODID:-//Boursikotons//Calendar Feed//FR');
  lines.push('CALSCALE:GREGORIAN');
  lines.push('METHOD:PUBLISH');
  lines.push(`X-WR-CALNAME:${escapeIcs(opts.name)}`);
  lines.push(`X-WR-CALDESC:${escapeIcs(opts.description)}`);
  lines.push('X-WR-TIMEZONE:Europe/Paris');
  lines.push('REFRESH-INTERVAL;VALUE=DURATION:PT1H');
  lines.push('X-PUBLISHED-TTL:PT1H');

  const now = formatIcsTimestamp(new Date());
  for (const ev of opts.events) {
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${ev.uid}`);
    lines.push(`DTSTAMP:${now}`);
    if (ev.allDay) {
      lines.push(`DTSTART;VALUE=DATE:${ev.dtStart.replace(/-/g, '')}`);
      if (ev.dtEnd) {
        lines.push(`DTEND;VALUE=DATE:${ev.dtEnd.replace(/-/g, '')}`);
      }
    } else {
      lines.push(`DTSTART:${formatIcsTimestamp(new Date(ev.dtStart))}`);
      if (ev.dtEnd) {
        lines.push(`DTEND:${formatIcsTimestamp(new Date(ev.dtEnd))}`);
      }
    }
    lines.push(`SUMMARY:${escapeIcs(ev.summary)}`);
    if (ev.description) {
      lines.push(`DESCRIPTION:${escapeIcs(ev.description)}`);
    }
    if (ev.location) {
      lines.push(`LOCATION:${escapeIcs(ev.location)}`);
    }
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');

  // Folding : chaque ligne > 75 octets doit être splitée avec un espace
  // de continuation. On le fait par caractère mais c'est suffisant pour
  // de l'ASCII + UTF-8 simple. Pour des descriptions très longues avec
  // beaucoup d'emojis, il faudrait compter en bytes.
  return lines.map(foldLine).join('\r\n') + '\r\n';
}

function escapeIcs(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

function foldLine(line: string): string {
  if (line.length <= 75) return line;
  const chunks: string[] = [];
  let i = 0;
  chunks.push(line.slice(i, i + 75));
  i += 75;
  while (i < line.length) {
    chunks.push(' ' + line.slice(i, i + 74));
    i += 74;
  }
  return chunks.join('\r\n');
}

function formatIcsTimestamp(d: Date): string {
  // YYYYMMDDTHHmmssZ
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    d.getUTCFullYear() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    'T' +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    'Z'
  );
}

function addDays(date: string, days: number): string {
  if (!date) return date;
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    s
  );
}
