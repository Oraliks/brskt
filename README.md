# Boursikotons

Plateforme de réservation formations trading + funnel VIP Telegram.

## Stack

Next.js 16 · React 19 · TypeScript strict · Supabase + Drizzle · Auth Telegram custom (HMAC) · Paddle / PayPal / NOWPayments · grammY · Tailwind v4 · Motion · Resend · Vercel.

## Démarrage local

```bash
# 1. Installer les deps
pnpm install

# 2. Configurer les variables d'env
cp .env.example .env.local
# → remplir DATABASE_URL, TELEGRAM_BOT_TOKEN, TELEGRAM_BOT_USERNAME, etc.

# 3. Push le schéma vers Supabase
pnpm db:push

# 4. Seed les 2 formations + mode IronFX manuel
pnpm seed

# 5. Lancer en dev
pnpm dev

# 6. Te promouvoir admin (après ta 1re connexion Telegram)
pnpm promote-admin <ton-email>
# ou
pnpm promote-admin <ton-telegram-id>

# 7. (Après déploiement HTTPS) configurer le webhook Telegram
pnpm telegram:setup
```

## Déploiement Vercel

1. Push le repo sur GitHub
2. Sur [vercel.com/new](https://vercel.com/new), importer le repo
3. Renseigner les variables d'environnement (voir `.env.example`)
4. Deploy

Le `vercel.json` configure automatiquement :
- Le CRON quotidien `/api/cron/check-vip-status` (06:00 UTC)
- Le timeout étendu pour les webhooks (30s) et le CRON (60s)

Après le 1er déploiement, exécute `pnpm telegram:setup` localement (avec `NEXT_PUBLIC_APP_URL` pointant vers ton URL Vercel) pour configurer le webhook Telegram.

## Structure

```
src/
  app/
    (public)/
      page.tsx              # Landing 4 sections snap-scroll
      (chrome)/             # Pages avec Navbar+Footer classiques
        formation/
        vip/
    (auth)/                 # /login (Telegram widget), /onboarding
    (app)/                  # /dashboard, /checkout/[id], /dashboard/ejected
    (admin)/                # Back-office (role check via proxy.ts)
    api/
      auth/telegram/        # POST — Telegram Login Widget callback
      webhooks/
        paddle, paypal, nowpayments, telegram, ironfx
      cron/
        check-vip-status    # CRON quotidien
  lib/
    auth/                   # Auth Telegram (HMAC) + helpers serveur
    db/                     # Drizzle schema + client (lazy init)
    payments/               # PaymentProvider abstraction (Paddle/PayPal/Crypto)
    ironfx/                 # IronFX dual-mode (API / manual)
    telegram/               # Bot grammY + helpers invite/eject
    email/                  # Wrapper Resend
    actions/                # Server Actions (bookings, vip, payments, admin, auth)
    validations/            # Zod schemas
  components/
    ui/                     # Primitives shadcn-like
    landing/                # Landing snap-scroll + 4 sections
    shared/                 # Navbar, Footer, BackgroundFX, Logo, Section
    formation/              # BookingForm, CheckoutForm
    vip/                    # VipLanding, VipWizard
    auth/                   # TelegramLoginButton, OnboardingForm
    admin/                  # AdminSidebar, BookingsTable, VipTable, IronFxModeForm
  proxy.ts                  # Auth gate sur /dashboard, /checkout, /admin
emails/                     # Templates React Email
scripts/                    # seed, promote-admin, setup-telegram-webhook
```

## Architecture clé

### Auth Telegram custom
Le widget Telegram redirige le `user` payload (signé HMAC-SHA256) vers
`/api/auth/telegram`. On vérifie la signature, on trouve / crée l'utilisateur,
on crée une session, on pose le cookie `better-auth.session_token`.
Aucune dépendance runtime à Better Auth, mais on garde les noms de tables
compatibles si on veut migrer plus tard.

### IronFX dual-mode
L'intégration broker a deux modes, switchables depuis `/admin/settings` :
- **API mode** : appels REST + postback S2S → `/api/webhooks/ironfx`
- **Manual mode** : les admins mettent à jour `manual_ironfx_status` à la main

Toujours utiliser `getIronFXAdapter()` — jamais d'instanciation directe.

### Payment Provider abstraction
3 providers implémentent `PaymentProvider` :
- `PaddleProvider` (carte, Merchant of Record)
- `PayPalProvider` (Orders API v2)
- `NowPaymentsProvider` (crypto, HMAC SHA512 sur body trié)

Routing `card | paypal | crypto` → `getPaymentProvider(method)`.
Webhook unifié + idempotent dans `handlePaymentWebhook`.

### Auto-éjection VIP
CRON quotidien à 06:00 UTC :
1. Pour chaque user `in_group`, lit `adapter.getClientStatus()`
2. Si `hasWithdrawn && !cpaQualified` OU `accountClosed` → kick auto
3. Kick = `banChatMember` puis `unbanChatMember` (Telegram pattern)
4. Email + redirect vers `/dashboard/ejected` avec la raison

## Commandes

```bash
pnpm dev              # Dev server (Turbo)
pnpm build            # Build prod (vérifié OK)
pnpm typecheck        # tsc --noEmit
pnpm db:generate      # Génère les migrations Drizzle
pnpm db:push          # Push direct (dev)
pnpm db:studio        # Drizzle Studio
pnpm seed             # Seed formations + IronFX mode
pnpm promote-admin    # Promote un user en admin
pnpm telegram:setup   # Set le webhook Telegram (après HTTPS)
pnpm test             # Vitest
pnpm test:e2e         # Playwright
```

## Variables d'environnement

Voir [`.env.example`](./.env.example) pour la liste complète. **Minimum requis** :

```
DATABASE_URL                  # Supabase Postgres
TELEGRAM_BOT_TOKEN            # @BotFather
TELEGRAM_BOT_USERNAME         # Sans le @, ex: BoursikotonsBot
VIP_GROUP_CHAT_ID             # -100xxxxxxxxxx
TELEGRAM_WEBHOOK_SECRET       # openssl rand -base64 32
CRON_SECRET                   # openssl rand -base64 32
NEXT_PUBLIC_APP_URL           # URL du site (https en prod)
RESEND_API_KEY                # Pour les emails
```

Les autres (Paddle, PayPal, NOWPayments, IronFX, PostHog, Sentry) peuvent être
ajoutés progressivement — l'app fonctionne en mode manuel sans IronFX, et les
providers de paiement sont initialisés à la demande.
