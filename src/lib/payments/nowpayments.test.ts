import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import crypto from 'node:crypto';

/**
 * Tests de la vérification HMAC-SHA512 des IPN NOWPayments.
 *
 * Le risque ici est élevé : un faux IPN accepté = paiement crypto fictif marqué
 * "completed" = formation/VIP attribuée gratuitement. CRITIQUE.
 */

const IPN_SECRET = 'test-ipn-secret-do-not-use-in-prod';

beforeEach(() => {
  process.env.NOWPAYMENTS_API_KEY = 'fake-api-key';
  process.env.NOWPAYMENTS_IPN_SECRET = IPN_SECRET;
});

afterEach(() => {
  delete process.env.NOWPAYMENTS_API_KEY;
  delete process.env.NOWPAYMENTS_IPN_SECRET;
});

function sortObjectKeys(obj: unknown): unknown {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map((v) => sortObjectKeys(v));
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(obj).sort()) {
    sorted[key] = sortObjectKeys((obj as Record<string, unknown>)[key]);
  }
  return sorted;
}

function signIpn(payload: Record<string, unknown>, secret: string): string {
  const sorted = JSON.stringify(sortObjectKeys(payload));
  return crypto.createHmac('sha512', secret).update(sorted).digest('hex');
}

const validPayload = {
  payment_id: 'pay_123',
  payment_status: 'finished',
  pay_address: 'TBxxxYZ',
  price_amount: 1500,
  price_currency: 'EUR',
  pay_amount: 1500,
  pay_currency: 'USDT',
  order_id: 'booking_abc',
};

describe('NowPaymentsProvider.verifyWebhookSignature', () => {
  it('accepts a correctly signed IPN', async () => {
    const { NowPaymentsProvider } = await import('./nowpayments');
    const provider = new NowPaymentsProvider();
    const body = JSON.stringify(validPayload);
    const sig = signIpn(validPayload, IPN_SECRET);

    const ok = await provider.verifyWebhookSignature(
      { 'x-nowpayments-sig': sig },
      body
    );
    expect(ok).toBe(true);
  });

  it('accepts even if body keys are in different order (sort normalization)', async () => {
    const { NowPaymentsProvider } = await import('./nowpayments');
    const provider = new NowPaymentsProvider();
    // L'attaquant ne peut pas profiter du tri — on tri toujours côté server
    const reordered = {
      pay_currency: 'USDT',
      payment_id: 'pay_123',
      order_id: 'booking_abc',
      payment_status: 'finished',
      pay_address: 'TBxxxYZ',
      price_amount: 1500,
      pay_amount: 1500,
      price_currency: 'EUR',
    };
    const body = JSON.stringify(reordered);
    const sig = signIpn(reordered, IPN_SECRET);

    const ok = await provider.verifyWebhookSignature(
      { 'x-nowpayments-sig': sig },
      body
    );
    expect(ok).toBe(true);
  });

  it('rejects when signature header is missing', async () => {
    const { NowPaymentsProvider } = await import('./nowpayments');
    const provider = new NowPaymentsProvider();
    const ok = await provider.verifyWebhookSignature({}, JSON.stringify(validPayload));
    expect(ok).toBe(false);
  });

  it('rejects a wrong signature', async () => {
    const { NowPaymentsProvider } = await import('./nowpayments');
    const provider = new NowPaymentsProvider();
    const body = JSON.stringify(validPayload);
    const wrongSig = crypto.randomBytes(64).toString('hex');

    const ok = await provider.verifyWebhookSignature(
      { 'x-nowpayments-sig': wrongSig },
      body
    );
    expect(ok).toBe(false);
  });

  it('rejects a signature from a different secret', async () => {
    const { NowPaymentsProvider } = await import('./nowpayments');
    const provider = new NowPaymentsProvider();
    const body = JSON.stringify(validPayload);
    const sig = signIpn(validPayload, 'different-secret');

    const ok = await provider.verifyWebhookSignature(
      { 'x-nowpayments-sig': sig },
      body
    );
    expect(ok).toBe(false);
  });

  it('rejects a tampered amount (forged payload, original signature)', async () => {
    const { NowPaymentsProvider } = await import('./nowpayments');
    const provider = new NowPaymentsProvider();
    const sig = signIpn(validPayload, IPN_SECRET);
    const tampered = { ...validPayload, price_amount: 1 };

    const ok = await provider.verifyWebhookSignature(
      { 'x-nowpayments-sig': sig },
      JSON.stringify(tampered)
    );
    expect(ok).toBe(false);
  });

  it('rejects malformed JSON body', async () => {
    const { NowPaymentsProvider } = await import('./nowpayments');
    const provider = new NowPaymentsProvider();
    const sig = signIpn(validPayload, IPN_SECRET);

    const ok = await provider.verifyWebhookSignature(
      { 'x-nowpayments-sig': sig },
      '{not-valid-json'
    );
    expect(ok).toBe(false);
  });
});
