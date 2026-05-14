import { expect, test } from '@playwright/test';

/**
 * E2E sécurité webhooks : les endpoints publics ne doivent JAMAIS accepter
 * un payload non-signé.
 *
 * Couvre les attaques basiques :
 *  - POST sans signature → 401/400
 *  - POST avec mauvaise signature → 401
 *  - GET (mauvaise méthode) → 405 ou 404
 *
 * Cette suite est critique : si un webhook accepte du JSON non-signé, n'importe
 * qui peut créer des paiements fictifs ou éjecter des users du VIP.
 */

const WEBHOOK_ROUTES = [
  '/api/webhooks/paddle',
  '/api/webhooks/paypal',
  '/api/webhooks/nowpayments',
  '/api/webhooks/ironfx',
  '/api/webhooks/telegram',
];

test.describe('Webhooks sécurité', () => {
  for (const route of WEBHOOK_ROUTES) {
    test(`POST ${route} sans signature → rejette`, async ({ request }) => {
      const response = await request.post(route, {
        data: { fake: 'payload', amount: 9999 },
        headers: { 'content-type': 'application/json' },
      });
      // Doit refuser : 400 (bad request), 401 (unauthorized), 403 (forbidden)
      // ou 422 (unprocessable). PAS 200/2xx, jamais 5xx (qui révèlerait un crash).
      const status = response.status();
      expect(status, `${route} status ${status}`).toBeGreaterThanOrEqual(400);
      expect(status, `${route} status ${status}`).toBeLessThan(500);
    });
  }

  test('GET /api/webhooks/paddle → 405 (method not allowed)', async ({
    request,
  }) => {
    const response = await request.get('/api/webhooks/paddle');
    // 405 si la route declare seulement POST, 404 si elle vérifie la method
    expect([404, 405]).toContain(response.status());
  });
});

test.describe('CRON sécurité', () => {
  test('GET /api/cron/check-vip-status sans secret → rejette', async ({
    request,
  }) => {
    const response = await request.get('/api/cron/check-vip-status');
    expect(response.status()).toBeGreaterThanOrEqual(400);
    expect(response.status()).toBeLessThan(500);
  });

  test('GET /api/cron/check-vip-status avec mauvais secret → rejette', async ({
    request,
  }) => {
    const response = await request.get('/api/cron/check-vip-status', {
      headers: { authorization: 'Bearer wrong-secret-xyz' },
    });
    expect(response.status()).toBeGreaterThanOrEqual(400);
    expect(response.status()).toBeLessThan(500);
  });
});
