import { describe, expect, it } from 'vitest';
import { matchHeader, parseAmount, parseTsv } from './tsv-parser';

describe('parseTsv', () => {
  it('parses simple TSV with header', () => {
    const input = 'Nom\tEmail\tMontant\nJean\tj@x.com\t1500\nMarie\tm@x.com\t3500';
    const { headers, rows } = parseTsv(input);
    expect(headers).toEqual(['nom', 'email', 'montant']);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ nom: 'Jean', email: 'j@x.com', montant: '1500' });
    expect(rows[1]?.nom).toBe('Marie');
  });

  it('falls back to CSV (comma) when no tabs', () => {
    const input = 'Nom,Email\nJean,j@x.com';
    const { headers, rows } = parseTsv(input);
    expect(headers).toEqual(['nom', 'email']);
    expect(rows[0]?.email).toBe('j@x.com');
  });

  it('handles semicolon separator (French Excel)', () => {
    const input = 'Nom;Montant\nJean;1500';
    const { headers, rows } = parseTsv(input);
    expect(headers).toEqual(['nom', 'montant']);
    expect(rows[0]?.montant).toBe('1500');
  });

  it('handles quoted cells with separator inside', () => {
    const input = 'Nom\tNotes\nJean\t"Coucou, ça va ?"\nMarie\tNormal';
    const { rows } = parseTsv(input);
    expect(rows[0]?.notes).toBe('Coucou, ça va ?');
    expect(rows[1]?.notes).toBe('Normal');
  });

  it('skips empty lines', () => {
    const input = 'Nom\nJean\n\n\nMarie\n';
    const { rows } = parseTsv(input);
    expect(rows).toHaveLength(2);
  });

  it('handles \\r\\n (Windows) line endings', () => {
    const input = 'Nom\tMontant\r\nJean\t1500\r\n';
    const { rows } = parseTsv(input);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.montant).toBe('1500');
  });

  it('returns empty for empty input', () => {
    expect(parseTsv('')).toEqual({ headers: [], rows: [] });
    expect(parseTsv('   \n  \n')).toEqual({ headers: [], rows: [] });
  });
});

describe('parseAmount', () => {
  it('parses simple integers', () => {
    expect(parseAmount('1500')).toBe(1500);
    expect(parseAmount('0')).toBe(0);
  });

  it('parses decimal US format', () => {
    expect(parseAmount('1500.50')).toBe(1500.5);
    expect(parseAmount('1,500.00')).toBe(1500);
  });

  it('parses decimal FR format', () => {
    expect(parseAmount('1500,50')).toBe(1500.5);
    expect(parseAmount('1.500,00')).toBe(1500);
    expect(parseAmount('3.500,75')).toBe(3500.75);
  });

  it('strips euro symbol and spaces', () => {
    expect(parseAmount('1 500 €')).toBe(1500);
    expect(parseAmount('1500€')).toBe(1500);
    expect(parseAmount('€1500')).toBe(1500);
  });

  it('returns null for invalid input', () => {
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('abc')).toBeNull();
    expect(parseAmount('€')).toBeNull();
  });

  it('handles negative amounts (refunds, etc.)', () => {
    expect(parseAmount('-100')).toBe(-100);
  });
});

describe('matchHeader', () => {
  it('matches canonical aliases (FR/EN, case insensitive)', () => {
    expect(matchHeader('Nom')).toBe('fullName');
    expect(matchHeader('FULL NAME')).toBe('fullName');
    expect(matchHeader('client')).toBe('fullName');
    expect(matchHeader('Email')).toBe('email');
    expect(matchHeader('Téléphone')).toBe('phone');
    expect(matchHeader('Mode')).toBe('mode');
    expect(matchHeader('Total')).toBe('totalAmountEur');
    expect(matchHeader('Prix')).toBe('totalAmountEur');
    expect(matchHeader('Acompte')).toBe('paidAmountEur');
    expect(matchHeader('Payé')).toBe('paidAmountEur');
    expect(matchHeader('Date')).toBe('scheduledDate');
    expect(matchHeader('Notes')).toBe('notes');
  });

  it('returns null for unknown headers', () => {
    expect(matchHeader('zorglub')).toBeNull();
    expect(matchHeader('')).toBeNull();
  });
});
