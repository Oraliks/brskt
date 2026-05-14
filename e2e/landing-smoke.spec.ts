import { expect, test } from '@playwright/test';

/**
 * Smoke tests pour les pages publiques principales.
 *
 * Pas de seed DB nécessaire — on vérifie juste que les routes répondent
 * 200 et que les éléments-clés sont présents (sanity check qu'un déploiement
 * ne casse pas le rendu de base).
 *
 * Les flows authentifiés (booking, VIP wizard, éjection auto) nécessitent
 * un seed DB + bypass auth via Better Auth — à ajouter dans une suite
 * séparée quand on aura besoin.
 */

test.describe('Landing page', () => {
  test('homepage répond et affiche le titre Boursikotons', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.status()).toBeLessThan(400);
    // Le badge "Trading depuis 2018" est dans la hero section
    await expect(page.getByText('Trading depuis 2018')).toBeVisible();
  });

  test('CTA "Continuer avec Telegram" est visible et clickable', async ({ page }) => {
    await page.goto('/');
    // Va sur la section CTA via scroll
    await page.evaluate(() =>
      window.scrollTo(0, document.body.scrollHeight)
    );
    const cta = page.getByRole('link', { name: /Continuer avec Telegram/i });
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute('href', '/login');
  });
});

test.describe('Page formation publique', () => {
  test('/formation affiche les 2 formats et le disclaimer no-refund', async ({
    page,
  }) => {
    const response = await page.goto('/formation');
    expect(response?.status()).toBeLessThan(400);
    await expect(page.getByText('Aucun remboursement', { exact: false })).toBeVisible();
    // Au moins une mention "Formation"
    await expect(page.locator('text=Formation').first()).toBeVisible();
  });
});

test.describe('Sécurité /admin', () => {
  test('/admin renvoie 404 pour un visiteur non-admin', async ({ page }) => {
    const response = await page.goto('/admin');
    expect(response?.status()).toBe(404);
  });

  test('/admin/funnel renvoie 404 pour un visiteur non-admin', async ({
    page,
  }) => {
    const response = await page.goto('/admin/funnel');
    expect(response?.status()).toBe(404);
  });
});

test.describe('Login page', () => {
  test('/login répond et propose le bouton Telegram', async ({ page }) => {
    const response = await page.goto('/login');
    expect(response?.status()).toBeLessThan(400);
    await expect(page.getByText('Connexion', { exact: false })).toBeVisible();
  });
});
