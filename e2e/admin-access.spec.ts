import { expect, test } from '@playwright/test';

/**
 * E2E sécurité admin : toutes les routes /admin/* DOIVENT renvoyer 404 pour
 * un visiteur non-authentifié (security through obscurity — CLAUDE.md doc
 * `requireAdmin` retourne notFound() volontairement).
 *
 * Si un attaquant accède à une route admin et obtient 200 (ou même 401/403),
 * c'est un leak d'info. Le seul code acceptable est 404.
 */

const ADMIN_ROUTES = [
  '/admin',
  '/admin/bookings',
  '/admin/vip',
  '/admin/users',
  '/admin/funnel',
  '/admin/audit',
  '/admin/bot',
  '/admin/diagnostics',
  '/admin/settings',
];

test.describe('Sécurité routes admin', () => {
  for (const route of ADMIN_ROUTES) {
    test(`${route} → 404 pour non-auth`, async ({ page }) => {
      const response = await page.goto(route, { waitUntil: 'domcontentloaded' });
      expect(response?.status()).toBe(404);
    });
  }
});
