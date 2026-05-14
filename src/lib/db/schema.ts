import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  bigint,
  boolean,
  jsonb,
  pgEnum,
  numeric,
  index,
  uniqueIndex,
  date,
  primaryKey,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ============================================================
// ENUMS
// ============================================================

export const userRoleEnum = pgEnum('user_role', ['user', 'admin']);

export const formationModeEnum = pgEnum('formation_mode', ['remote', 'onsite']);

export const bookingStatusEnum = pgEnum('booking_status', [
  'pending_admin',      // En attente validation date par admin
  'date_proposed',      // Admin a proposé une autre date
  'confirmed',          // Date confirmée, en attente paiement
  'pending_payment',    // Paiement en cours
  'paid',               // Payé
  'completed',          // Formation terminée
  'cancelled',          // Annulé
]);

export const paymentMethodEnum = pgEnum('payment_method', [
  'card',
  'paypal',
  'crypto',
]);

export const paymentStatusEnum = pgEnum('payment_status', [
  'pending',
  'completed',
  'failed',
  'refunded',
]);

/**
 * Étapes du funnel VIP.
 *
 * Actives (transitions automatiques / Server Actions) :
 *   link_generated → signup_validated → deposit_pending → deposit_validated
 *   → telegram_invited → in_group → (optionnel) ejected
 *
 * Réservées (pas de code qui les émet aujourd'hui, gardées pour évolutions
 * futures — ex. tracking postback "clic affilié" ou "compte créé pas validé") :
 *   - 'clicked'         : user a cliqué sur le lien affilié mais pas encore créé de compte
 *   - 'signup_pending'  : compte créé chez IronFX mais en attente de validation KYC
 *
 * Si tu retires une valeur de l'enum, n'oublie pas la migration Drizzle et
 * vérifie qu'aucun row n'utilise la valeur (sinon ALTER TYPE échouera).
 */
export const vipStepEnum = pgEnum('vip_step', [
  'link_generated',
  'clicked',
  'signup_pending',
  'signup_validated',
  'deposit_pending',
  'deposit_validated',
  'telegram_invited',
  'in_group',
  'ejected',
]);

// ============================================================
// BETTER AUTH TABLES (générées par Better Auth — schéma standard)
// ============================================================

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    email: text('email'),  // Nullable au début, rempli à l'onboarding
    emailVerified: boolean('email_verified').notNull().default(false),
    image: text('image'),
    role: userRoleEnum('role').notNull().default('user'),

    // Telegram fields
    telegramId: bigint('telegram_id', { mode: 'number' }).unique(),
    telegramUsername: text('telegram_username'),
    telegramFirstName: text('telegram_first_name'),
    telegramPhotoUrl: text('telegram_photo_url'),

    // Onboarding
    onboardingCompletedAt: timestamp('onboarding_completed_at'),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    telegramIdIdx: index('users_telegram_id_idx').on(t.telegramId),
    emailIdx: index('users_email_idx').on(t.email),
  })
);

export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const accounts = pgTable('accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  providerId: text('provider_id').notNull(),
  accountId: text('account_id').notNull(),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ============================================================
// FORMATIONS
// ============================================================

export const formations = pgTable('formations', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  slug: text('slug').notNull().unique(),
  mode: formationModeEnum('mode').notNull(),
  description: text('description'),
  priceEur: numeric('price_eur', { precision: 10, scale: 2 }).notNull(),
  durationDays: integer('duration_days').notNull().default(5),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ============================================================
// BOOKINGS
// ============================================================

export const bookings = pgTable(
  'bookings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    formationId: uuid('formation_id')
      .notNull()
      .references(() => formations.id),

    // L'utilisateur propose jusqu'à 3 créneaux
    preferredDates: jsonb('preferred_dates').$type<
      Array<{ start: string; end: string }>
    >(),
    preferredAsap: boolean('preferred_asap').notNull().default(false),

    // L'admin valide / propose autre
    confirmedDate: date('confirmed_date'),
    adminProposedDate: date('admin_proposed_date'),
    adminNotes: text('admin_notes'),

    status: bookingStatusEnum('status').notNull().default('pending_admin'),

    paymentId: uuid('payment_id'),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    userIdIdx: index('bookings_user_id_idx').on(t.userId),
    statusIdx: index('bookings_status_idx').on(t.status),
  })
);

// ============================================================
// PAYMENTS
// ============================================================

export const payments = pgTable(
  'payments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    bookingId: uuid('booking_id').references(() => bookings.id),

    amountEur: numeric('amount_eur', { precision: 10, scale: 2 }).notNull(),
    method: paymentMethodEnum('method').notNull(),
    provider: text('provider').notNull(), // 'paddle' | 'paypal' | 'nowpayments'

    providerSessionId: text('provider_session_id'),
    providerPaymentId: text('provider_payment_id'),

    status: paymentStatusEnum('status').notNull().default('pending'),

    metadata: jsonb('metadata').$type<Record<string, unknown>>(),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    completedAt: timestamp('completed_at'),
  },
  (t) => ({
    providerSessionIdx: index('payments_provider_session_idx').on(
      t.providerSessionId
    ),
    statusIdx: index('payments_status_idx').on(t.status),
  })
);

// ============================================================
// VIP APPLICATIONS
// ============================================================

export const vipApplications = pgTable(
  'vip_applications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    // Lien d'affiliation tracké unique
    affiliateLink: text('affiliate_link').notNull().unique(),
    affiliateRef: text('affiliate_ref').notNull().unique(), // ID court utilisé dans l'URL

    // Compte broker IronFX
    brokerAccountId: text('broker_account_id'),

    // Progression
    step: vipStepEnum('step').notNull().default('link_generated'),

    // Dépôt
    depositAmount: numeric('deposit_amount', { precision: 10, scale: 2 }),
    depositCurrency: text('deposit_currency').default('EUR'),

    // Telegram
    telegramInviteLink: text('telegram_invite_link'),
    telegramInviteUsed: boolean('telegram_invite_used').default(false),

    // Qualification CPA (objectif business : $1 de commission générée)
    cpaQualified: boolean('cpa_qualified').notNull().default(false),
    cpaQualifiedAt: timestamp('cpa_qualified_at'),

    // Éjection
    ejectionReason: text('ejection_reason'),
    ejectedAt: timestamp('ejected_at'),

    // Relances email automatiques (CRON quotidien vip-reminders)
    // reminderCount monte de 0 → 2 max (J+2 puis J+7 après dernière activité)
    reminderCount: integer('reminder_count').notNull().default(0),
    reminderSentAt: timestamp('reminder_sent_at'),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    userIdIdx: uniqueIndex('vip_apps_user_id_idx').on(t.userId),
    stepIdx: index('vip_apps_step_idx').on(t.step),
    brokerIdIdx: index('vip_apps_broker_id_idx').on(t.brokerAccountId),
  })
);

// ============================================================
// FUNNEL EVENTS (tracking drop-off)
// ============================================================

export const funnelEvents = pgTable(
  'funnel_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    sessionId: text('session_id').notNull(),
    eventName: text('event_name').notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    eventNameIdx: index('funnel_events_name_idx').on(t.eventName),
    userIdIdx: index('funnel_events_user_id_idx').on(t.userId),
    createdAtIdx: index('funnel_events_created_at_idx').on(t.createdAt),
  })
);

// ============================================================
// APP SETTINGS (feature flags, dont mode IronFX)
// ============================================================

export const appSettings = pgTable('app_settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull().$type<Record<string, unknown>>(),
  updatedBy: uuid('updated_by').references(() => users.id),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ============================================================
// MANUAL IRONFX STATUS (mode manuel)
// ============================================================

export const manualIronfxStatus = pgTable(
  'manual_ironfx_status',
  {
    accountId: text('account_id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    signupDetected: boolean('signup_detected').notNull().default(false),
    depositTotal: numeric('deposit_total', { precision: 10, scale: 2 })
      .notNull()
      .default('0'),
    depositCurrency: text('deposit_currency').default('EUR'),
    cpaQualified: boolean('cpa_qualified').notNull().default(false),
    /** Progression de l'user de 0 à 100. Auto-set cpaQualified=true à 100.
     *  Affiché côté user comme "X% de trading depuis ton arrivée". */
    tradingProgressPct: integer('trading_progress_pct').notNull().default(0),
    accountClosed: boolean('account_closed').notNull().default(false),
    hasWithdrawn: boolean('has_withdrawn').notNull().default(false),
    notes: text('notes'),
    updatedBy: uuid('updated_by').references(() => users.id),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    userIdIdx: index('manual_ironfx_user_id_idx').on(t.userId),
  })
);

// ============================================================
// WEBHOOK EVENTS (idempotence)
// ============================================================

export const webhookEvents = pgTable(
  'webhook_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    provider: text('provider').notNull(), // 'paddle' | 'paypal' | 'nowpayments' | 'ironfx' | 'telegram'
    providerEventId: text('provider_event_id').notNull(),
    payload: jsonb('payload').notNull(),
    processedAt: timestamp('processed_at'),
    error: text('error'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    uniqueEvent: uniqueIndex('webhook_events_unique_idx').on(
      t.provider,
      t.providerEventId
    ),
  })
);

// ============================================================
// RATE LIMITING (sliding window per key, stocké en Postgres)
// ============================================================

/**
 * Compteur de rate limit par clé arbitraire.
 *
 * Clé typique :
 *  - `auth_tg:ip:<ip>`        — POST /api/auth/telegram
 *  - `booking:user:<uuid>`    — Server Action createBooking
 *  - `vip:user:<uuid>`        — Server Action submitVipApplication
 *  - `vip:ip:<ip>`            — anonymous wizard fingerprint
 *
 * Algorithme : sliding window simple — si `windowStartedAt` est plus vieux
 * que `windowSec`, on reset count à 1 et redémarre la fenêtre, sinon on
 * incrémente. L'upsert est atomique en SQL (INSERT ... ON CONFLICT).
 *
 * Cleanup : le CRON quotidien existant pourra supprimer les entrées où
 * `windowStartedAt < NOW() - 1 day` pour éviter la croissance infinie.
 */
export const rateLimits = pgTable(
  'rate_limits',
  {
    key: text('key').primaryKey(),
    count: integer('count').notNull().default(0),
    windowStartedAt: timestamp('window_started_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    windowStartedAtIdx: index('rate_limits_window_idx').on(t.windowStartedAt),
  })
);

// ============================================================
// ADMIN NOTIFICATIONS
// ============================================================

export const adminNotifications = pgTable(
  'admin_notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    type: text('type').notNull(), // 'new_booking' | 'new_vip_application' | 'payment_failed' | etc.
    payload: jsonb('payload').notNull(),
    read: boolean('read').notNull().default(false),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    readIdx: index('admin_notif_read_idx').on(t.read),
    createdAtIdx: index('admin_notif_created_at_idx').on(t.createdAt),
  })
);

// ============================================================
// RELATIONS
// ============================================================

export const usersRelations = relations(users, ({ many, one }) => ({
  bookings: many(bookings),
  payments: many(payments),
  vipApplication: one(vipApplications),
  sessions: many(sessions),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const bookingsRelations = relations(bookings, ({ one }) => ({
  user: one(users, { fields: [bookings.userId], references: [users.id] }),
  formation: one(formations, {
    fields: [bookings.formationId],
    references: [formations.id],
  }),
  payment: one(payments, {
    fields: [bookings.paymentId],
    references: [payments.id],
  }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  user: one(users, { fields: [payments.userId], references: [users.id] }),
  booking: one(bookings, {
    fields: [payments.bookingId],
    references: [bookings.id],
  }),
}));

export const vipApplicationsRelations = relations(
  vipApplications,
  ({ one }) => ({
    user: one(users, {
      fields: [vipApplications.userId],
      references: [users.id],
    }),
  })
);

// ============================================================
// TYPES
// ============================================================

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Formation = typeof formations.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type VipApplication = typeof vipApplications.$inferSelect;
export type AppSetting = typeof appSettings.$inferSelect;
export type ManualIronfxStatus = typeof manualIronfxStatus.$inferSelect;
