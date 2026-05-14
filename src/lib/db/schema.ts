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
import { relations, sql } from 'drizzle-orm';

// ============================================================
// ENUMS
// ============================================================

export const userRoleEnum = pgEnum('user_role', ['user', 'admin']);

/**
 * Note : Le tracking d'interaction bot (streak quotidien, dernière
 * interaction, etc.) est stocké sur la table `users` (colonnes
 * bot_streak_count + bot_last_interaction_at, voir plus bas).
 */

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
 * Plan de paiement pour une réservation de formation.
 * - `full` : paiement en 1 fois (cas par défaut)
 * - `installments_3x` : paiement en 3 mensualités égales sans frais
 *
 * Règles métier (cf. disclaimers UI) :
 *  - Aucun remboursement une fois le 1er paiement effectué
 *  - La formation n'a lieu QUE lorsque la totalité (installments_paid =
 *    installment_total) a été reçue
 */
export const paymentPlanEnum = pgEnum('payment_plan', [
  'full',
  'installments_3x',
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

    // Bot engagement : streak quotidien (incrémente si interaction dans
    // les 24-48h depuis la dernière, sinon reset à 1).
    botStreakCount: integer('bot_streak_count').notNull().default(0),
    botLastInteractionAt: timestamp('bot_last_interaction_at'),

    // Parrainage : code unique généré au /invite, et qui a parrainé ce user
    // (référence vers users.id du parrain).
    referralCode: text('referral_code').unique(),
    referredBy: uuid('referred_by'),

    // Opt-in pour les notifications bot quotidiennes (true par défaut).
    botSubscribedBriefing: boolean('bot_subscribed_briefing')
      .notNull()
      .default(true),
    botSubscribedEvents: boolean('bot_subscribed_events')
      .notNull()
      .default(true),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    telegramIdIdx: index('users_telegram_id_idx').on(t.telegramId),
    emailIdx: index('users_email_idx').on(t.email),
    referralCodeIdx: index('users_referral_code_idx').on(t.referralCode),
    referredByIdx: index('users_referred_by_idx').on(t.referredBy),
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
// FORMATION WAITLIST
// ============================================================

/**
 * Liste d'attente pour les formations présentielles (places limitées).
 * Un user peut s'inscrire sans avoir de compte (email suffit) — quand un
 * nouveau créneau s'ouvre, l'admin notifie tous les inscrits par email.
 *
 * Indices : un user (par email) ne peut être qu'une seule fois sur la
 * waitlist d'un mode donné.
 */
export const formationWaitlist = pgTable(
  'formation_waitlist',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // Mode visé. On garde la flexibilité au cas où la formation distance
    // serait aussi limitée un jour.
    mode: formationModeEnum('mode').notNull(),
    email: text('email').notNull(),
    firstName: text('first_name'),
    telegramId: bigint('telegram_id', { mode: 'number' }),
    // Notes facultatives (motif d'inscription, contraintes calendrier, etc.)
    notes: text('notes'),
    // Une fois l'user contacté pour un nouveau créneau, on garde la ligne
    // mais on marque notified_at — sert d'historique et d'idempotence.
    notifiedAt: timestamp('notified_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    modeEmailIdx: uniqueIndex('formation_waitlist_mode_email_idx').on(
      t.mode,
      t.email
    ),
    createdAtIdx: index('formation_waitlist_created_at_idx').on(t.createdAt),
  })
);

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

    // Plan de paiement (1 fois ou 3 fois sans frais)
    paymentPlan: paymentPlanEnum('payment_plan').notNull().default('full'),
    // Nombre d'échéances total (1 pour 'full', 3 pour 'installments_3x')
    installmentTotal: integer('installment_total').notNull().default(1),
    // Nombre d'échéances déjà payées (incrémenté par les webhooks)
    installmentsPaid: integer('installments_paid').notNull().default(0),

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
    // Pre-éjection warning : set quand le CRON détecte une situation à
    // risque (retrait sans qualif, compte clôturé). Le user a alors une
    // fenêtre d'~24h pour régulariser avant que le CRON suivant éjecte.
    // Reset à null si la situation se résout.
    ejectionWarnedAt: timestamp('ejection_warned_at'),

    // Timestamp d'entrée dans l'étape courante (mis à jour à chaque
    // transition). Permet de calculer le time-in-step et déclencher
    // des alertes admin sur les users bloqués trop longtemps.
    currentStepEnteredAt: timestamp('current_step_entered_at')
      .notNull()
      .defaultNow(),

    // Réponses aux questions de qualification (posées par le bot via /qualify).
    // JSONB pour rester flexible si on change les questions. Optionnel —
    // un user qui n'a jamais répondu aura null. Permet à l'admin de mieux
    // segmenter et personnaliser le suivi.
    qualificationAnswers: jsonb('qualification_answers').$type<{
      experience?: 'none' | 'beginner' | 'intermediate' | 'advanced';
      goal?: 'income' | 'learn' | 'long_term' | 'curiosity';
      timeAvailable?: 'few_hours' | 'evenings' | 'full_time';
      askedAt?: string;
    }>(),

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
// ADMIN AUDIT LOG — trace des actions admin sensibles
// ============================================================

/**
 * Log des actions admin pour traçabilité.
 *
 * Pattern : à chaque action admin sensible (changement progress, éjection,
 * confirmation booking, toggle mode IronFX...) on insert un row.
 *
 * Colonnes JSONB `before` et `after` : permettent de reconstruire le diff
 * exact. Pour les actions sans diff (ex. "envoyer email"), `after` contient
 * un payload descriptif.
 */
export const adminAuditLogs = pgTable(
  'admin_audit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    adminId: uuid('admin_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    action: text('action').notNull(), // ex. 'booking_confirm', 'vip_eject', 'progress_set', 'ironfx_mode'
    targetType: text('target_type'), // 'booking' | 'vip_application' | 'user' | 'settings' | null
    targetId: text('target_id'), // UUID ou key selon le targetType (null si N/A)
    before: jsonb('before').$type<Record<string, unknown>>(),
    after: jsonb('after').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    adminIdIdx: index('audit_log_admin_id_idx').on(t.adminId),
    actionIdx: index('audit_log_action_idx').on(t.action),
    targetIdx: index('audit_log_target_idx').on(t.targetType, t.targetId),
    createdAtIdx: index('audit_log_created_at_idx').on(t.createdAt),
  })
);

// ============================================================
// USER BANS — historique de modération
// ============================================================

/**
 * Historique des bans utilisateurs. Un user a au plus UN ban actif à la fois
 * (revokedAt IS NULL). Le `getActiveBan(userId)` lit cette table — pas besoin
 * de toucher la table users.
 *
 * Conception en log/event-sourcing :
 *  - Un ban inscrit un row avec revokedAt = NULL
 *  - Un unban set revokedAt = NOW() — on garde l'historique
 *  - Re-ban = nouveau row
 *
 * Index unique partiel sur (userId) WHERE revokedAt IS NULL pour empêcher
 * deux bans actifs concurrents.
 */
export const userBans = pgTable(
  'user_bans',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    bannedBy: uuid('banned_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    reason: text('reason'),
    revokedAt: timestamp('revoked_at'),
    revokedBy: uuid('revoked_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    userIdIdx: index('user_bans_user_id_idx').on(t.userId),
    activeIdx: uniqueIndex('user_bans_active_unique_idx')
      .on(t.userId)
      .where(sql`revoked_at IS NULL`),
  })
);

// ============================================================
// ECONOMIC EVENTS — calendrier macro pour les alertes bot
// ============================================================

export const economicEventImpactEnum = pgEnum('economic_event_impact', [
  'low',
  'medium',
  'high',
]);

/**
 * Événements économiques (NFP, CPI, FOMC, etc.). Admin remplit manuellement
 * pour MVP (à terme : sync depuis ForexFactory ou TradingEconomics).
 *
 * Le CRON `check-economic-alerts` toutes les 30 min vérifie si un event
 * commence dans 30-60 min → DM aux subscribers.
 */
export const economicEvents = pgTable(
  'economic_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(), // ex. "US CPI YoY"
    currency: text('currency'), // ex. "USD", "EUR" (devise impactée)
    impact: economicEventImpactEnum('impact').notNull().default('medium'),
    eventAt: timestamp('event_at', { withTimezone: true }).notNull(),
    notes: text('notes'),
    notifiedAt: timestamp('notified_at'), // null = pas encore notifié
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    eventAtIdx: index('economic_events_event_at_idx').on(t.eventAt),
    notifiedIdx: index('economic_events_notified_idx').on(t.notifiedAt),
  })
);

// ============================================================
// PRICE ALERTS — alertes de prix configurées par les users via le bot
// ============================================================

export const priceAlertDirectionEnum = pgEnum('price_alert_direction', [
  'above',
  'below',
]);

export const priceAlertSourceEnum = pgEnum('price_alert_source', [
  'fx',
  'crypto',
]);

export const priceAlerts = pgTable(
  'price_alerts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    symbol: text('symbol').notNull(),
    source: priceAlertSourceEnum('source').notNull(),
    threshold: numeric('threshold', { precision: 20, scale: 8 }).notNull(),
    direction: priceAlertDirectionEnum('direction').notNull(),
    triggeredAt: timestamp('triggered_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    userIdIdx: index('price_alerts_user_id_idx').on(t.userId),
    symbolIdx: index('price_alerts_symbol_idx').on(t.symbol, t.source),
    triggeredIdx: index('price_alerts_triggered_idx').on(t.triggeredAt),
  })
);

// ============================================================
// QUIZ — questions quotidiennes & réponses utilisateurs
// ============================================================

export const quizDifficultyEnum = pgEnum('quiz_difficulty', [
  'easy',
  'medium',
  'hard',
]);

export const quizQuestions = pgTable(
  'quiz_questions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    question: text('question').notNull(),
    choices: jsonb('choices').$type<string[]>().notNull(),
    correctIndex: integer('correct_index').notNull(),
    explanation: text('explanation'),
    difficulty: quizDifficultyEnum('difficulty').notNull().default('medium'),
    category: text('category'),
    sentAt: timestamp('sent_at'),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    sentAtIdx: index('quiz_questions_sent_at_idx').on(t.sentAt),
    activeIdx: index('quiz_questions_active_idx').on(t.active),
  })
);

export const quizResponses = pgTable(
  'quiz_responses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    questionId: uuid('question_id')
      .notNull()
      .references(() => quizQuestions.id, { onDelete: 'cascade' }),
    chosenIndex: integer('chosen_index').notNull(),
    correct: boolean('correct').notNull(),
    answeredAt: timestamp('answered_at').notNull().defaultNow(),
  },
  (t) => ({
    userIdIdx: index('quiz_responses_user_id_idx').on(t.userId),
    uniqResponse: uniqueIndex('quiz_responses_uniq_idx').on(
      t.userId,
      t.questionId
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
export type AdminAuditLog = typeof adminAuditLogs.$inferSelect;
