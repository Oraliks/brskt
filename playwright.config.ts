import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config minimaliste.
 *
 * Le serveur dev est lancé via `webServer` — pas besoin de l'avoir up
 * manuellement. Les tests live dans /e2e.
 *
 * Pour ajouter plus de tests :
 *   - Pages publiques : pas de seed DB nécessaire (smoke tests)
 *   - Pages auth/dashboard : seed un user de test + bypass auth via cookie
 *     (Better Auth peut signer un token côté script de seed)
 *
 * Run :
 *   pnpm test:e2e           — tous les tests, mode headless
 *   pnpm test:e2e --ui      — UI mode (recommandé pour debug)
 *   pnpm test:e2e --headed  — voir le browser
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'list',

  timeout: 30_000,
  expect: { timeout: 5_000 },

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Lance pnpm dev avant les tests (en local). En CI on skip — l'app
  // doit déjà tourner via build + start.
  webServer: process.env.CI
    ? undefined
    : {
        command: 'pnpm dev',
        url: 'http://localhost:3000',
        reuseExistingServer: true,
        timeout: 120_000,
        stdout: 'ignore',
        stderr: 'pipe',
      },
});
