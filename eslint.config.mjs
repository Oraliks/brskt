/**
 * ESLint 9 flat config — flat-config natif (sans FlatCompat).
 *
 * Stack :
 *  - typescript-eslint (typescript-eslint v8 flat config)
 *  - @next/eslint-plugin-next (règles Next.js)
 *
 * Pour Next 16 / TS strict :
 *  - no-explicit-any à 'warn' (pas error) — pour pas bloquer la CI sur du
 *    legacy. Visible en review.
 *  - no-unused-vars : autorise les args qui commencent par `_`
 *  - Ignore : build output, node_modules, drizzle migrations
 */

import nextPlugin from '@next/eslint-plugin-next';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  // Ignore patterns en premier (s'applique au scan)
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'drizzle/**',
      'public/**',
      'next-env.d.ts',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      'next.config.*',
      'postcss.config.*',
      'tailwind.config.*',
      'drizzle.config.*',
      'instrumentation.*',
      '*.d.ts',
    ],
  },

  // Base TypeScript (sans type-checking — trop lourd pour CI en dev)
  ...tseslint.configs.recommended,

  // Plugin Next.js
  {
    plugins: {
      '@next/next': nextPlugin,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
    },
  },

  // Overrides projet
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      // Les Server Components / Server Actions sont async sans toujours
      // avoir un await visible — autoriser
      '@typescript-eslint/require-await': 'off',
    },
  }
);
