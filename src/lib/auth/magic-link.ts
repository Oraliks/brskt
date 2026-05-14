import crypto from 'node:crypto';

/**
 * Magic link login via bot DM — fallback quand le Telegram Login Widget
 * ne fonctionne pas (BotFather domain pas configuré, popup bloquée, etc.).
 *
 * Flow :
 *  1. User envoie `/login` au bot dans Telegram
 *  2. Bot génère un token HMAC-signé (pas de DB — stateless)
 *  3. Bot DM un lien `/login/magic?token=...` au user
 *  4. User clique → /login/magic vérifie + crée la session
 *
 * Le token contient : { tgId, iat (issued-at), exp (expiry) } encodé en
 * base64url + signature HMAC-SHA256 du payload avec MAGIC_LINK_SECRET.
 *
 * Validité : 10 min. Un user qui tarde devra redemander `/login`.
 */

const TOKEN_TTL_SECONDS = 10 * 60;

interface TokenPayload {
  tgId: number;
  iat: number;
  exp: number;
}

function getSecret(): string {
  const s = process.env.MAGIC_LINK_SECRET ?? process.env.BETTER_AUTH_SECRET;
  if (!s) {
    throw new Error(
      'MAGIC_LINK_SECRET or BETTER_AUTH_SECRET must be set for magic link login'
    );
  }
  return s;
}

function b64urlEncode(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function b64urlDecode(input: string): Buffer {
  const pad = input.length % 4 === 0 ? '' : '='.repeat(4 - (input.length % 4));
  return Buffer.from(
    input.replace(/-/g, '+').replace(/_/g, '/') + pad,
    'base64'
  );
}

/**
 * Génère un token magic-link signé pour `tgId`.
 * Le token est `<payload-b64url>.<sig-b64url>`, à mettre dans `?token=...`.
 */
export function signMagicToken(tgId: number): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: TokenPayload = {
    tgId,
    iat: now,
    exp: now + TOKEN_TTL_SECONDS,
  };
  const payloadB64 = b64urlEncode(JSON.stringify(payload));
  const sig = crypto
    .createHmac('sha256', getSecret())
    .update(payloadB64)
    .digest();
  const sigB64 = b64urlEncode(sig);
  return `${payloadB64}.${sigB64}`;
}

export type MagicVerifyResult =
  | { valid: true; tgId: number }
  | { valid: false; reason: 'malformed' | 'invalid_signature' | 'expired' };

/**
 * Vérifie un token magic-link. Renvoie l'`tgId` si valide.
 */
export function verifyMagicToken(token: string): MagicVerifyResult {
  const parts = token.split('.');
  if (parts.length !== 2) return { valid: false, reason: 'malformed' };
  const [payloadB64, sigB64] = parts as [string, string];

  // Vérifie la signature
  const expectedSig = crypto
    .createHmac('sha256', getSecret())
    .update(payloadB64)
    .digest();
  const providedSig = b64urlDecode(sigB64);
  let sigOk = false;
  try {
    sigOk =
      providedSig.length === expectedSig.length &&
      crypto.timingSafeEqual(providedSig, expectedSig);
  } catch {
    sigOk = false;
  }
  if (!sigOk) return { valid: false, reason: 'invalid_signature' };

  // Parse + vérifie expiry
  let payload: TokenPayload;
  try {
    payload = JSON.parse(b64urlDecode(payloadB64).toString()) as TokenPayload;
  } catch {
    return { valid: false, reason: 'malformed' };
  }
  if (
    typeof payload.tgId !== 'number' ||
    typeof payload.exp !== 'number' ||
    payload.exp < Math.floor(Date.now() / 1000)
  ) {
    return { valid: false, reason: 'expired' };
  }

  return { valid: true, tgId: payload.tgId };
}
