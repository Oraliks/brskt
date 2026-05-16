/**
 * Helpers de génération CSV pour les exports admin.
 *
 * Pas de lib externe : RFC 4180 simple, suffisant pour Excel/Sheets/Numbers.
 *  - Séparateur : virgule (compatible Sheets / Excel international)
 *  - Champs avec virgule / guillemets / newlines → entourés de guillemets
 *  - Guillemets internes doublés (`"` → `""`)
 *  - BOM UTF-8 ajouté en tête pour qu'Excel Windows ouvre en UTF-8 sans
 *    casser les accents.
 *
 * Pour CSV avec point-virgule (Excel FR par défaut), passe `separator: ';'`
 * en options. Sheets et Excel modernes détectent automatiquement.
 */

export interface CsvColumn<T> {
  /** Header de la colonne dans le CSV. */
  header: string;
  /** Fonction qui extrait la valeur de la row. */
  value: (row: T) => string | number | null | undefined | boolean | Date;
}

export interface CsvOptions {
  /** Séparateur de champ. Défaut : ','. */
  separator?: ',' | ';';
  /** Ajouter un BOM UTF-8 en début pour compat Excel Windows. Défaut : true. */
  bom?: boolean;
}

/**
 * Convertit un array de rows en string CSV selon les colonnes définies.
 */
export function toCsv<T>(
  rows: T[],
  columns: CsvColumn<T>[],
  options: CsvOptions = {}
): string {
  const sep = options.separator ?? ',';
  const bom = options.bom ?? true;

  const headerLine = columns.map((c) => escape(c.header, sep)).join(sep);
  const dataLines = rows.map((row) =>
    columns.map((c) => escape(formatValue(c.value(row)), sep)).join(sep)
  );

  const csv = [headerLine, ...dataLines].join('\r\n');
  return bom ? '﻿' + csv : csv;
}

function formatValue(
  v: string | number | null | undefined | boolean | Date
): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

function escape(value: string, sep: string): string {
  // Si le champ contient le séparateur, des guillemets, ou un newline,
  // on l'entoure de guillemets et on échappe les guillemets internes.
  const needsQuoting =
    value.includes(sep) ||
    value.includes('"') ||
    value.includes('\n') ||
    value.includes('\r');
  if (!needsQuoting) return value;
  return `"${value.replace(/"/g, '""')}"`;
}

/**
 * Headers HTTP pour servir un CSV en download avec un nom de fichier.
 * Inclut une date YYYY-MM-DD dans le nom pour différencier les exports.
 */
export function csvResponseHeaders(filename: string): HeadersInit {
  const date = new Date().toISOString().slice(0, 10);
  const safeName = filename.replace(/[^a-z0-9-]/gi, '-');
  return {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="${safeName}-${date}.csv"`,
    'Cache-Control': 'no-store',
  };
}
