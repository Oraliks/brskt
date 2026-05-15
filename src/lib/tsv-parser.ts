/**
 * Parser TSV minimaliste — détecte le séparateur (tab par défaut, fallback
 * virgule) + parse la 1re ligne comme header.
 *
 * Cas d'usage : import de tableaux Excel via paste dans un textarea.
 * Excel copie en TSV (tab-separated) par défaut. CSV (virgule) marche
 * aussi en fallback.
 *
 * Renvoie : { headers: string[], rows: Record<string, string>[] }
 * Best-effort : ligne vide skip, champs trimmés, quotes simples gérées.
 */

export interface ParsedTable {
  headers: string[];
  rows: Record<string, string>[];
}

export function parseTsv(input: string): ParsedTable {
  const text = input.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (!text) return { headers: [], rows: [] };

  // Détection du séparateur — tab > virgule > point-virgule
  const firstLine = text.split('\n')[0] ?? '';
  const sep =
    firstLine.includes('\t')
      ? '\t'
      : firstLine.includes(';')
      ? ';'
      : ',';

  const lines = text.split('\n').filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };

  const headers = splitLine(lines[0]!, sep).map((h) => h.trim().toLowerCase());
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = splitLine(lines[i]!, sep);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = (cells[idx] ?? '').trim();
    });
    // Skip si toute la ligne est vide
    if (Object.values(row).every((v) => v === '')) continue;
    rows.push(row);
  }

  return { headers, rows };
}

/**
 * Split simple d'une ligne en cellules. Gère les quotes basiques (Excel
 * peut quoter les cellules contenant le séparateur).
 */
function splitLine(line: string, sep: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') {
      // double quote escape "" → "
      if (inQuote && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuote = !inQuote;
      }
      continue;
    }
    if (ch === sep && !inQuote) {
      cells.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  cells.push(current);
  return cells;
}

/**
 * Parse une valeur "montant" pouvant venir d'Excel : '1 500,00', '1500€',
 * '1.500,00', '1500.00', '1500'. Renvoie un nombre ou null si invalide.
 */
export function parseAmount(raw: string): number | null {
  if (!raw) return null;
  // Strip euro, espaces, chars non numériques sauf , et . et -
  const cleaned = raw
    .replace(/[€$\s]/g, '')
    .replace(/[^0-9,.\-]/g, '');
  if (!cleaned) return null;

  // Détecte le format : si , et . tous les deux, le dernier est le séparateur décimal
  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');

  let normalized: string;
  if (lastComma > lastDot) {
    // Format FR : 1.500,00 → 1500.00
    normalized = cleaned.replace(/\./g, '').replace(',', '.');
  } else {
    // Format US : 1,500.00 → 1500.00
    normalized = cleaned.replace(/,/g, '');
  }
  const num = Number(normalized);
  return Number.isFinite(num) ? num : null;
}

/**
 * Mapping flexible des en-têtes utilisateur vers nos champs canoniques.
 * Accepte plusieurs variantes (FR/EN, avec accents) pour les colonnes
 * communes d'un Excel client.
 */
export const HEADER_ALIASES: Record<string, string[]> = {
  fullName: ['nom', 'name', 'full name', 'fullname', 'prenom nom', 'client'],
  email: ['email', 'mail', 'e-mail', 'courriel'],
  phone: ['telephone', 'téléphone', 'phone', 'tel', 'mobile', 'gsm'],
  mode: ['mode', 'format', 'type', 'formation'],
  totalAmountEur: [
    'total',
    'prix',
    'montant',
    'total eur',
    'total €',
    'prix total',
    'amount',
    'tarif',
  ],
  paidAmountEur: [
    'paye',
    'payé',
    'paid',
    'acompte',
    'verse',
    'versé',
    'deja paye',
    'déjà payé',
    'payed',
  ],
  scheduledDate: ['date', 'date prevue', 'scheduled', 'jour'],
  notes: ['notes', 'note', 'commentaire', 'comment', 'remarque'],
};

/**
 * Trouve le champ canonique correspondant à un header utilisateur.
 * Renvoie null si aucune correspondance.
 */
export function matchHeader(header: string): string | null {
  const h = header.trim().toLowerCase();
  for (const [canonical, aliases] of Object.entries(HEADER_ALIASES)) {
    if (aliases.some((a) => a.toLowerCase() === h)) return canonical;
  }
  return null;
}
