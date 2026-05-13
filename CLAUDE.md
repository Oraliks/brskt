# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Project Overview

Plateforme de réservation pour :
1. **Formations trading** (distance 1500€ / présentiel 3500€) avec paiement multi-méthode
2. **Funnel VIP Telegram** : inscription via lien d'affiliation IronFX → validation dépôt → accès groupe VIP Telegram

Le business model exige que chaque membre VIP génère au moins $1 de commission CPA avant tout retrait. Si retrait avant qualification → éjection automatique du groupe.

## Tech Stack

- **Framework** : Next.js 16 (App Router, Server Actions, PPR activé)
- **Language** : TypeScript strict mode
- **DB** : Supabase (Postgres) + Drizzle ORM
- **Auth** : Better Auth + plugin Telegram Login Widget
- **Styling** : Tailwind CSS v4 + shadcn/ui
- **Animations** : Motion (ex Framer Motion) + GSAP pour timelines complexes
- **Emails** : Resend + React Email
- **Telegram Bot** : grammY (TypeScript)
- **Payments** :
  - Paddle Billing (CB/Visa, Merchant of Record pour Dubai)
  - PayPal Checkout API
  - NOWPayments (crypto : USDT TRC20, USDC, BTC, ETH)
- **Analytics** : PostHog (funnel tracking)
- **Monitoring** : Sentry
- **Hosting** : Vercel

## Project Structure

```
/app
  /(public)              # Routes publiques
    /                    # Landing animée
    /formation           # Détail formations
    /formation/reserver  # Sélection dates
    /vip                 # Funnel VIP wizard
  /(auth)
    /login               # Telegram Login Widget
    /onboarding          # Saisie email post-login
  /(app)                 # Routes authentifiées
    /dashboard
    /dashboard/ejected
    /formation/checkout/[bookingId]
  /(admin)               # Routes admin (role check middleware)
    /admin
    /admin/bookings
    /admin/vip
    /admin/users
    /admin/settings      # Toggle mode IronFX API/manual
  /api
    /webhooks
      /paddle
      /paypal
      /nowpayments
      /telegram          # Bot webhook
      /ironfx            # Postback URL (mode API)
    /cron
      /check-vip-status  # CRON quotidien

/lib
  /auth                  # Better Auth config + Telegram plugin
  /db                    # Drizzle schema + queries
  /payments              # Abstraction PaymentProvider
    /paddle.ts
    /paypal.ts
    /nowpayments.ts
    /index.ts
  /ironfx                # Adapter pattern API/manual
    /api-adapter.ts
    /manual-adapter.ts
    /index.ts
  /telegram              # Bot grammY + helpers
  /email                 # Templates React Email
  /analytics             # PostHog wrapper

/components
  /ui                    # shadcn components
  /landing               # Composants landing animée
  /vip                   # Wizard steps
  /admin                 # Composants back-office

/drizzle                 # Migrations
```

## Database Schema (key tables)

- `users` : Telegram ID, username, email (rempli à l'onboarding), role
- `formations` : title, mode ('remote'|'onsite'), price_eur, active
- `bookings` : preferred_dates[], preferred_asap, confirmed_date, status, admin_proposed_date
- `payments` : amount, method, provider, status, provider_session_id
- `vip_applications` : step (enum 9 steps), broker_account_id, deposit_amount, cpa_qualified, telegram_invite_link, ejection_reason
- `funnel_events` : event_name, user_id, session_id, metadata (tracking drop-off)
- `app_settings` : key/value pour feature flags (notamment `ironfx_mode`)
- `manual_ironfx_status` : maj manuelle par admin quand mode = 'manual'
- `webhook_events` : idempotence des webhooks payments

## Architecture Principles

### Payment Provider Abstraction
Tous les providers implémentent `PaymentProvider` interface. Ajouter un provider = créer une classe + ajouter à `providers` map. Ne jamais coder en dur Paddle/PayPal/NOWPayments dans le UI.

### IronFX Dual-Mode
L'intégration IronFX a deux modes via `IronFXAdapter` interface :
- `api` : appels REST + postback URL `/api/webhooks/ironfx`
- `manual` : admin met à jour `manual_ironfx_status` table

Le mode est lu depuis `app_settings.ironfx_mode`. Toujours passer par `getIronFXAdapter()`, jamais d'appel direct aux adapters.

### Webhook Idempotency
Tous les webhooks (Paddle, PayPal, NOWPayments, IronFX) vérifient `webhook_events` table avant de traiter pour éviter les doubles traitements.

### Telegram Auth Constraints
Le Telegram Login Widget ne fournit PAS le numéro de téléphone. Seulement : id, first_name, username (optional), photo_url, auth_date, hash. L'email est demandé en onboarding séparé, jamais via Telegram.

### VIP Ejection Logic
CRON quotidien (`/api/cron/check-vip-status`) :
1. Pour chaque user `in_group`, call `adapter.getClientStatus()`
2. Si `hasWithdrawn && !cpaQualified` → éjection
3. Si `accountClosed` → éjection
4. Éjection = `bot.banChatMember()` puis `unbanChatMember()` (kick), update DB, email Resend, redirige vers `/dashboard/ejected`

## Commands

```bash
pnpm dev              # Dev server (port 3000)
pnpm build            # Build prod
pnpm lint             # ESLint
pnpm typecheck        # tsc --noEmit
pnpm db:generate      # Drizzle migrations
pnpm db:push          # Push schema to Supabase
pnpm db:studio        # Drizzle Studio
pnpm test             # Vitest unit tests
pnpm test:e2e         # Playwright E2E
```

## Environment Variables

```
# Database
DATABASE_URL=
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Auth
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=
TELEGRAM_BOT_TOKEN=          # Pour Login Widget + Bot
TELEGRAM_BOT_USERNAME=

# Telegram VIP
VIP_GROUP_CHAT_ID=
TELEGRAM_WEBHOOK_SECRET=

# Payments
PADDLE_API_KEY=
PADDLE_WEBHOOK_SECRET=
PADDLE_PRODUCT_ID_REMOTE=
PADDLE_PRODUCT_ID_ONSITE=

PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
PAYPAL_WEBHOOK_ID=

NOWPAYMENTS_API_KEY=
NOWPAYMENTS_IPN_SECRET=

# IronFX (quand dispo)
IRONFX_API_URL=
IRONFX_API_KEY=
IRONFX_POSTBACK_SECRET=

# Email
RESEND_API_KEY=
RESEND_FROM_EMAIL=

# Analytics
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=

# Monitoring
SENTRY_DSN=
NEXT_PUBLIC_SENTRY_DSN=

# Cron security
CRON_SECRET=
```

## Coding Conventions

- Server Actions pour mutations, jamais d'API routes pour les forms internes
- Validation : Zod schemas dans `/lib/validations`
- Erreurs : utiliser `Result<T, E>` pattern, jamais `throw` dans la logique métier
- Composants : Server Components par défaut, `'use client'` uniquement si nécessaire
- Pas de `any` en TS. Si vraiment besoin, `unknown` + type guard
- Imports : alias `@/` pour `/src` ou root
- Commits : Conventional Commits (feat:, fix:, chore:, etc.)

## Important Business Rules

1. **Formation présentiel** : toujours afficher "Billet d'avion A/R non inclus" dans le checkout et le mail de confirmation
2. **Dépôt VIP minimum** : 250€. Pas de max techniquement, mais afficher avertissement "Pour les débutants, ne pas dépasser 1500€" sur la page de saisie
3. **Dates formation** : user propose jusqu'à 3 créneaux + checkbox ASAP. Admin peut confirmer un créneau, proposer une autre date, ou refuser (auquel cas contact privé Telegram)
4. **Éjection VIP** : raison toujours visible sur `/dashboard/ejected` du user concerné, avec conditions pour réintégrer
5. **Aucune mention juridique/conseil financier** sur le site. Le business est basé à Dubai, ne pas ajouter de disclaimers EU-style sans demande explicite

## Testing Priorities

E2E à implémenter en premier :
1. Flow complet réservation formation distance + paiement Paddle
2. Flow complet réservation formation présentiel + paiement crypto NOWPayments
3. Flow complet VIP : login Telegram → onboarding → lien affilié → soumission compte broker → validation dépôt (mode manuel) → réception lien Telegram
4. Éjection automatique d'un user qui retire avant qualification

## Notes spécifiques Next.js 16

- App Router uniquement, jamais Pages Router
- Server Actions activées par défaut, utiliser `'use server'` directive
- PPR (Partial Prerendering) activé dans `next.config.ts`
- React 19 Compiler activé (pas besoin de `useMemo`/`useCallback` manuellement)
- `after()` API pour tasks post-response (logging, analytics)

## Known Gotchas

- Webhooks Vercel : timeout 10s sur Hobby, 60s sur Pro. Crypto confirmations peuvent prendre plus, donc accuser réception ASAP puis traiter en background avec `after()`
- Telegram Bot webhook : doit être en HTTPS, set via `bot.api.setWebhook()` au déploiement
- Better Auth Telegram plugin : vérifier signature côté serveur, ne JAMAIS faire confiance au client
- NOWPayments IPN : signature en HMAC SHA512 sur le body sorted alphabétiquement
- PostHog côté serveur : utiliser `posthog-node`, pas `posthog-js`
