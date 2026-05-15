/**
 * Générateur de briefing matinal auto-composé.
 *
 * Sources (tout gratuit) :
 *  - Prix overnight : Yahoo Finance via fetchMarketQuotes (déjà branché)
 *  - Events macro du jour : table economic_events (syncée par
 *    /api/cron/sync-economic-events depuis ForexFactory)
 *
 * Renvoie une string HTML (parse_mode = HTML côté bot). Le placeholder
 * {firstName} reste, le caller substitue.
 *
 * Best-effort : si une source échoue, on skip son bloc plutôt que tout crasher.
 */

import { and, gte, lte } from 'drizzle-orm';
import { db } from '@/lib/db';
import { economicEvents } from '@/lib/db/schema';
import { fetchMarketQuotes } from '@/lib/market-quotes';

const HIGHLIGHT_SYMBOLS = ['EUR/USD', 'BTC', 'GOLD', 'S&P500'] as const;

/**
 * Construit le contenu HTML du briefing du jour. Le caller fait le sub
 * de {firstName} et l'envoie aux opt-in.
 */
export async function generateAutoBriefing(): Promise<string> {
  const parts: string[] = ['☀️ <b>Bonjour {firstName}</b>'];

  // Bloc 1 : prix overnight
  try {
    const quotes = await fetchMarketQuotes();
    const highlighted = quotes.filter((q) =>
      HIGHLIGHT_SYMBOLS.includes(q.symbol as (typeof HIGHLIGHT_SYMBOLS)[number])
    );
    if (highlighted.length > 0) {
      const lines = highlighted.map((q) => {
        const arrow = q.up === true ? '▲' : q.up === false ? '▼' : '·';
        return `  ${q.symbol.padEnd(8)} <b>${q.price}</b>  ${arrow} ${q.deltaPct ?? '—'}`;
      });
      parts.push(`\n📊 <b>Marchés overnight</b>\n${lines.join('\n')}`);
    }
  } catch (err) {
    console.warn('[briefing-generator] market quotes failed', err);
  }

  // Bloc 2 : events macro du jour (00h-23h59 UTC)
  try {
    const now = new Date();
    const startOfDay = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    );
    const endOfDay = new Date(startOfDay.getTime() + 24 * 3600 * 1000);

    const events = await db.query.economicEvents.findMany({
      where: and(
        gte(economicEvents.eventAt, startOfDay),
        lte(economicEvents.eventAt, endOfDay)
      ),
      orderBy: (e, { asc }) => [asc(e.eventAt)],
      limit: 10,
    });

    const filtered = events.filter(
      (e) => e.impact === 'high' || e.impact === 'medium'
    );

    if (filtered.length > 0) {
      const lines = filtered.map((e) => {
        const time = e.eventAt.toLocaleTimeString('fr-FR', {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'Europe/Paris',
        });
        const emoji =
          e.impact === 'high' ? '🔴' : e.impact === 'medium' ? '🟠' : '🟡';
        return (
          `  ${emoji} <b>${time}</b> · ${escapeHtml(e.name)}` +
          (e.currency ? ` (${e.currency})` : '') +
          (e.notes ? `\n     <i>${escapeHtml(e.notes)}</i>` : '')
        );
      });
      parts.push(
        `\n📅 <b>Agenda macro</b> <i>(heure de Paris)</i>\n${lines.join('\n')}`
      );
    } else {
      parts.push(`\n📅 <b>Agenda macro</b>\n  Rien de high-impact aujourd'hui.`);
    }
  } catch (err) {
    console.warn('[briefing-generator] economic events failed', err);
  }

  parts.push(
    `\n<i>Pour te désinscrire : /unsubscribe briefing</i>`
  );

  return parts.join('\n');
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
