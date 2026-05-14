import { describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import { verifyTelegramHash, type TelegramAuthData } from './telegram-plugin';

/**
 * Tests de la signature Telegram Login Widget.
 *
 * Ces tests sont CRITIQUES : si la verif passe avec un mauvais hash, n'importe
 * quel attaquant peut se faire passer pour n'importe quel user Telegram.
 *
 * On construit un payload valide en suivant exactement l'algo de Telegram, puis
 * on vérifie qu'on accepte le payload conforme et qu'on rejette toutes les
 * variations malicieuses.
 */

const BOT_TOKEN = '123456:test-bot-token';

function signPayload(
  data: Omit<TelegramAuthData, 'hash'>,
  botToken: string
): string {
  const dataCheckString = Object.keys(data)
    .sort()
    .map((k) => `${k}=${(data as Record<string, unknown>)[k]}`)
    .join('\n');
  const secretKey = crypto.createHash('sha256').update(botToken).digest();
  return crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');
}

describe('verifyTelegramHash', () => {
  const basePayload: Omit<TelegramAuthData, 'hash'> = {
    id: 123456789,
    first_name: 'Test',
    username: 'testuser',
    auth_date: Math.floor(Date.now() / 1000),
  };

  it('accepts a correctly signed payload', () => {
    const hash = signPayload(basePayload, BOT_TOKEN);
    const data: TelegramAuthData = { ...basePayload, hash };
    expect(verifyTelegramHash(data, BOT_TOKEN)).toBe(true);
  });

  it('rejects a payload signed with a different bot token', () => {
    const hash = signPayload(basePayload, 'different-token');
    const data: TelegramAuthData = { ...basePayload, hash };
    expect(verifyTelegramHash(data, BOT_TOKEN)).toBe(false);
  });

  it('rejects a tampered telegram id', () => {
    const hash = signPayload(basePayload, BOT_TOKEN);
    const data: TelegramAuthData = { ...basePayload, id: 999, hash };
    expect(verifyTelegramHash(data, BOT_TOKEN)).toBe(false);
  });

  it('rejects a tampered username', () => {
    const hash = signPayload(basePayload, BOT_TOKEN);
    const data: TelegramAuthData = {
      ...basePayload,
      username: 'attacker',
      hash,
    };
    expect(verifyTelegramHash(data, BOT_TOKEN)).toBe(false);
  });

  it('rejects an empty hash', () => {
    const data: TelegramAuthData = { ...basePayload, hash: '' };
    expect(verifyTelegramHash(data, BOT_TOKEN)).toBe(false);
  });

  it('rejects a non-hex hash', () => {
    const data: TelegramAuthData = {
      ...basePayload,
      hash: 'not-hex-at-all-zzz',
    };
    expect(verifyTelegramHash(data, BOT_TOKEN)).toBe(false);
  });

  it('rejects a hash of wrong length', () => {
    const data: TelegramAuthData = { ...basePayload, hash: 'abc123' };
    expect(verifyTelegramHash(data, BOT_TOKEN)).toBe(false);
  });

  it('handles optional fields correctly', () => {
    const fullPayload = {
      id: 42,
      first_name: 'John',
      last_name: 'Doe',
      username: 'jdoe',
      photo_url: 'https://t.me/pic.jpg',
      auth_date: 1700000000,
    };
    const hash = signPayload(fullPayload, BOT_TOKEN);
    const data: TelegramAuthData = { ...fullPayload, hash };
    expect(verifyTelegramHash(data, BOT_TOKEN)).toBe(true);
  });

  it('uses timing-safe comparison (no early return on prefix match)', () => {
    // On ne peut pas vraiment tester le timing en unit test, mais on vérifie
    // au moins qu'un hash avec le bon préfixe et le mauvais suffixe est rejeté
    const correctHash = signPayload(basePayload, BOT_TOKEN);
    const tamperedHash = correctHash.slice(0, 60) + 'ffffff';
    const data: TelegramAuthData = { ...basePayload, hash: tamperedHash };
    expect(verifyTelegramHash(data, BOT_TOKEN)).toBe(false);
  });
});
