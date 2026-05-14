/**
 * Fetch + parse du calendrier économique ForexFactory (XML public, gratuit,
 * pas d'API key requise).
 *
 * Source : https://nfs.faireconomy.media/ff_calendar_thisweek.xml
 *  - Format : XML simple, ~150 events / semaine
 *  - Mis à jour quotidiennement par ForexFactory
 *  - Fuseau horaire : US Eastern (EST / EDT selon DST)
 *
 * Note : ForexFactory peut changer son URL ou son format sans préavis. Si ça
 * casse, fallback : recommander à l'admin de coller manuellement les events
 * dans `economic_events` via Drizzle Studio.
 */

const FOREX_FACTORY_URL =
  'https://nfs.faireconomy.media/ff_calendar_thisweek.xml';

export interface RawEvent {
  /** Titre brut, ex. "Non-Farm Employment Change" */
  title: string;
  /** Devise affectée, ex. "USD" */
  currency: string;
  /** Date+heure UTC. null si event "All Day" ou "Tentative". */
  eventAtUtc: Date | null;
  /** Impact normalisé. */
  impact: 'low' | 'medium' | 'high';
  /** Notes : forecast vs previous, ex. "Forecast: 200K · Previous: 180K". */
  notes: string | null;
}

/**
 * Fetch le XML et renvoie les events parsés. Throw en cas d'erreur réseau —
 * caller gère.
 */
export async function fetchForexFactoryWeekly(): Promise<RawEvent[]> {
  const res = await fetch(FOREX_FACTORY_URL, {
    cache: 'no-store',
    headers: {
      // ForexFactory bloque les user-agents par défaut "node-fetch"
      'user-agent':
        'Mozilla/5.0 (compatible; Boursikotons-Calendar/1.0; +https://boursikotons.com)',
      accept: 'application/xml,text/xml',
    },
  });
  if (!res.ok) {
    throw new Error(`ForexFactory ${res.status}`);
  }
  const xml = await res.text();
  return parseForexFactoryXml(xml);
}

/**
 * Parser XML très simple — pas de dep externe, juste de la regex sur les
 * blocs `<event>...</event>`. Suffisant car le format est stable et plat.
 */
export function parseForexFactoryXml(xml: string): RawEvent[] {
  const events: RawEvent[] = [];
  const eventBlocks = xml.match(/<event>([\s\S]*?)<\/event>/g) ?? [];

  for (const block of eventBlocks) {
    const title = matchTag(block, 'title');
    const country = matchTag(block, 'country');
    const date = matchTag(block, 'date');
    const time = matchTag(block, 'time');
    const impactRaw = matchTag(block, 'impact');
    const forecast = matchTag(block, 'forecast');
    const previous = matchTag(block, 'previous');

    if (!title || !country || !date) continue;

    const impact: RawEvent['impact'] =
      impactRaw?.toLowerCase() === 'high'
        ? 'high'
        : impactRaw?.toLowerCase() === 'medium'
        ? 'medium'
        : 'low';

    const eventAtUtc = parseForexDateTime(date, time);

    const notesParts: string[] = [];
    if (forecast) notesParts.push(`Prévu: ${forecast}`);
    if (previous) notesParts.push(`Précédent: ${previous}`);
    const notes = notesParts.length > 0 ? notesParts.join(' · ') : null;

    events.push({
      title,
      currency: country.toUpperCase(),
      eventAtUtc,
      impact,
      notes,
    });
  }

  return events;
}

function matchTag(block: string, tag: string): string | null {
  // ForexFactory utilise CDATA dans certains champs
  const re = new RegExp(
    `<${tag}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`,
    'i'
  );
  const m = block.match(re);
  if (!m || !m[1]) return null;
  const v = m[1].trim();
  return v.length > 0 ? v : null;
}

/**
 * ForexFactory date format : "11-15-2024" (MM-DD-YYYY)
 * Time format : "1:30pm" | "8:30am" | "All Day" | "Tentative" | ""
 *
 * Renvoie un Date UTC. null si "All Day" ou "Tentative".
 *
 * Le timezone source est US Eastern (EST = UTC-5, EDT = UTC-4). On calcule
 * l'offset DST à la main pour éviter une dep date-fns-tz.
 */
export function parseForexDateTime(
  dateStr: string,
  timeStr: string | null
): Date | null {
  if (!timeStr || /all\s*day|tentative|holiday/i.test(timeStr)) {
    return null;
  }
  const m = timeStr.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i);
  if (!m || !m[1] || !m[2] || !m[3]) return null;

  const [mo, d, y] = dateStr.split('-').map(Number);
  if (!mo || !d || !y) return null;

  let hour = Number(m[1]);
  const minute = Number(m[2]);
  const ampm = m[3].toLowerCase();
  if (ampm === 'pm' && hour !== 12) hour += 12;
  if (ampm === 'am' && hour === 12) hour = 0;

  const offsetHours = isUsEasternDst(y, mo, d) ? 4 : 5;
  // Date construit en UTC puis on ajoute l'offset Eastern pour arriver à l'UTC réel
  return new Date(Date.UTC(y, mo - 1, d, hour + offsetHours, minute));
}

/**
 * US DST : 2nd dimanche de mars → 1er dimanche de novembre (à 2 AM ET).
 * On approxime sur la journée — pas critique pour des notifs à 30 min.
 */
export function isUsEasternDst(year: number, month: number, day: number): boolean {
  if (month < 3 || month > 11) return false;
  if (month > 3 && month < 11) return true;

  if (month === 3) {
    // DST commence le 2e dimanche de mars
    const firstDayDow = new Date(Date.UTC(year, 2, 1)).getUTCDay();
    const secondSunday = 1 + ((7 - firstDayDow) % 7) + 7;
    return day >= secondSunday;
  }
  if (month === 11) {
    // DST se termine le 1er dimanche de novembre
    const firstDayDow = new Date(Date.UTC(year, 10, 1)).getUTCDay();
    const firstSunday = 1 + ((7 - firstDayDow) % 7);
    return day < firstSunday;
  }
  return false;
}
