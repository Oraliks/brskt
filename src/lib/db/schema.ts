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

    /**
     * Token unique pour s'abonner au feed iCal personnel via Apple Calendar /
     * Google Calendar / Outlook. Nullable : généré à la demande, révocable.
     * Pour l'admin, ce feed contient toutes les sessions du système. Pour
     * les users non-admin, il pourra contenir leurs propres bookings (TODO
     * — pas utilisé pour l'instant côté user).
     */
    icalToken: uuid('ical_token').unique(),

    // L'état XP & jeux est dans la table `user_xp_states` (1-1) pour
    // que les requêtes sur `users` ne dépendent pas de la migration des
    // jeux. Voir `userXpStates` plus bas.

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
  /**
   * Nombre max de participants pour cette formation, pour une même date
   * donnée. La "session" est implicite : tout booking dont confirmedDate
   * tombe sur ce jour compte pour la capacité.
   * Default 3 — modifiable par l'admin (1 à 50).
   */
  dailyCapacity: integer('daily_capacity').notNull().default(3),
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
// BOOKING AUTOMATION STATE — séparé de bookings pour ne pas casser
// les queries existantes si la migration n'est pas appliquée.
// ============================================================

/**
 * État des automatisations par booking (relances paiement, reminders
 * formation, NPS). Table séparée volontaire : ajouter ces colonnes à
 * `bookings` casserait toutes les queries Drizzle existantes tant que
 * la migration ne serait pas push (cf. incident avec users.banned_at).
 *
 * 1 row par booking, créé paresseusement par les CRONs au 1er besoin.
 */
export const bookingAutomationState = pgTable(
  'booking_automation_state',
  {
    bookingId: uuid('booking_id')
      .primaryKey()
      .references(() => bookings.id, { onDelete: 'cascade' }),

    // Relances paiement (CRON payment-reminders)
    // 0 = jamais relancé · 1 = 1er DM envoyé · 2 = 2e DM envoyé · 3 = auto-cancelled
    paymentNudgeCount: integer('payment_nudge_count').notNull().default(0),
    paymentNudgeAt: timestamp('payment_nudge_at'),

    // Reminders pré-formation : bitmask
    // 1<<0 = J-7 envoyé · 1<<1 = J-1 envoyé · 1<<2 = J-3 envoyé (futur)
    formationRemindersSent: integer('formation_reminders_sent').notNull().default(0),

    // NPS post-formation : 0-10 via inline keyboard du bot
    npsAskedAt: timestamp('nps_asked_at'),
    npsScore: integer('nps_score'),
    npsAt: timestamp('nps_at'),

    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    paymentNudgeIdx: index('booking_auto_payment_nudge_idx').on(
      t.paymentNudgeCount
    ),
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
// VIP PAID ACCESSES — accès direct payant 250€ (sans funnel broker)
// ============================================================

/**
 * Statut d'un accès VIP payant. Lifecycle :
 *   pending_payment → paid → active → ejected
 *
 *  - `pending_payment` : row créée, paiement en cours côté provider
 *  - `paid` : webhook a confirmé le paiement, bot va envoyer l'invite
 *  - `active` : bot a DM le lien d'invitation, user a accès au groupe
 *  - `ejected` : éjecté manuellement par admin (rare, comportement abusif)
 *
 * Pas d'état `refunded` : remboursement non prévu (accès à vie).
 */
export const vipPaidAccessStatusEnum = pgEnum('vip_paid_access_status', [
  'pending_payment',
  'paid',
  'active',
  'ejected',
]);

/**
 * Accès VIP payant à vie. Alternative au funnel affilié IronFX pour les
 * users qui ont déjà leur broker et préfèrent payer 250€ direct.
 *
 * Pas lié à `vip_applications` (différent lifecycle, pas de qualification
 * CPA, pas d'éjection automatique sur retrait). Stockage à part = logique
 * séparée + queries plus simples.
 *
 * Le `firstName` + `lastName` servent de référence pour la communication
 * du paiement (les comptes Telegram changent, le nom légal pas).
 *
 * Prix lu depuis `app_settings.vip_paid_access_price_eur` (modifiable
 * sans redeploy via l'admin), fallback 250€.
 */
export const vipPaidAccesses = pgTable(
  'vip_paid_accesses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    /** Montant payé en EUR, figé au moment de la création (snapshot). */
    amountEur: numeric('amount_eur', { precision: 10, scale: 2 }).notNull(),
    paymentId: uuid('payment_id').references(() => payments.id),
    status: vipPaidAccessStatusEnum('status')
      .notNull()
      .default('pending_payment'),
    /** Lien d'invitation unique généré par le bot (member_limit=1). */
    telegramInviteLink: text('telegram_invite_link'),
    paidAt: timestamp('paid_at'),
    activatedAt: timestamp('activated_at'),
    ejectionReason: text('ejection_reason'),
    ejectedAt: timestamp('ejected_at'),
    /** Nombre de renvois manuels du lien par l'admin (CRUD audit). */
    resendCount: integer('resend_count').notNull().default(0),
    lastResendAt: timestamp('last_resend_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index('vip_paid_accesses_user_idx').on(t.userId),
    statusIdx: index('vip_paid_accesses_status_idx').on(t.status),
    paymentIdx: index('vip_paid_accesses_payment_idx').on(t.paymentId),
    // Un user ne peut avoir qu'UN seul accès payant non éjecté à la fois
    activeUniq: uniqueIndex('vip_paid_accesses_active_uniq')
      .on(t.userId)
      .where(sql`status <> 'ejected'`),
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
// TESTIMONIALS — soumis via bot, validés par admin
// ============================================================

export const testimonialStatusEnum = pgEnum('testimonial_status', [
  'pending',
  'published',
  'rejected',
]);

/**
 * Témoignages clients. Soumis via la commande /temoignage du bot Telegram.
 *
 * Flow :
 *  1. User envoie `/temoignage <texte>` ou clique "Laisser un avis" depuis
 *     /dashboard (deeplink bot)
 *  2. Bot insère un row avec status='pending'
 *  3. Admin reçoit notif dans `/admin/testimonials`
 *  4. Admin publie ou rejette
 *  5. Le rendu sur /temoignages affiche uniquement les `published`
 *
 * On garde le rejet pour ne pas que l'user re-soumette en boucle un témoignage
 * déjà refusé (l'UI bot peut détecter et lui dire qu'il a déjà soumis).
 */
export const testimonials = pgTable(
  'testimonials',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    body: text('body').notNull(),
    rating: integer('rating'), // 1-5, optionnel
    tag: text('tag'), // 'formation' | 'vip' — futur tagging admin
    status: testimonialStatusEnum('status').notNull().default('pending'),
    moderatedBy: uuid('moderated_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    moderatedAt: timestamp('moderated_at'),
    moderationNotes: text('moderation_notes'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    statusIdx: index('testimonials_status_idx').on(t.status),
    userIdIdx: index('testimonials_user_id_idx').on(t.userId),
    createdAtIdx: index('testimonials_created_at_idx').on(t.createdAt),
  })
);

// ============================================================
// OFFLINE COACHINGS — clients hors-site, importés depuis Excel
// ============================================================

export const offlineCoachingStatusEnum = pgEnum('offline_coaching_status', [
  'active',
  'completed',
  'cancelled',
]);

/**
 * Clients coachés hors plateforme. Pas de FK vers users — volontaire.
 * Si le client crée plus tard un compte, l'admin peut le lier via
 * `linkedUserId` (optionnel) pour fusionner historiques.
 */
export const offlineCoachings = pgTable(
  'offline_coachings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    fullName: text('full_name').notNull(),
    email: text('email'),
    phone: text('phone'),
    /** 'remote' | 'onsite' | 'custom' (libre). */
    mode: text('mode').notNull().default('remote'),
    totalAmountEur: numeric('total_amount_eur', {
      precision: 10,
      scale: 2,
    }).notNull(),
    paidAmountEur: numeric('paid_amount_eur', {
      precision: 10,
      scale: 2,
    })
      .notNull()
      .default('0'),
    scheduledDate: date('scheduled_date'),
    notes: text('notes'),
    status: offlineCoachingStatusEnum('status').notNull().default('active'),
    linkedUserId: uuid('linked_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    statusIdx: index('offline_coachings_status_idx').on(t.status),
    scheduledIdx: index('offline_coachings_scheduled_idx').on(t.scheduledDate),
  })
);

// ============================================================
// PROMO CODES — réductions applicables au checkout
// ============================================================

export const promoDiscountTypeEnum = pgEnum('promo_discount_type', [
  'percent',
  'fixed',
]);

/**
 * Périmètre d'application d'un code promo :
 *  - `site` : utilisable au checkout formation uniquement
 *  - `game` : pool tirable par la roue de la fortune uniquement
 *  - `both` : utilisable au checkout ET pioché par la roue
 *
 * La roue ne peut tirer que des codes scope IN ('game', 'both') actifs.
 * Si la roue gagne un segment promo et que le pool est vide, l'user
 * reçoit un fallback XP équivalent (cf. lib/games/wheel.ts).
 */
export const promoScopeEnum = pgEnum('promo_scope', ['site', 'game', 'both']);

/**
 * Codes promo applicables sur le checkout d'une formation.
 *
 * 2 modes :
 *  - `percent` : discountValue est un % (ex. 10 = -10%)
 *  - `fixed` : discountValue est un montant en euros (ex. 200 = -200€)
 *
 * Restrictions optionnelles : validFrom/validUntil, maxUses, applicableMode.
 */
export const promoCodes = pgTable(
  'promo_codes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: text('code').notNull().unique(),
    discountType: promoDiscountTypeEnum('discount_type').notNull(),
    discountValue: numeric('discount_value', {
      precision: 10,
      scale: 2,
    }).notNull(),
    validFrom: timestamp('valid_from'),
    validUntil: timestamp('valid_until'),
    maxUses: integer('max_uses'),
    usedCount: integer('used_count').notNull().default(0),
    applicableMode: formationModeEnum('applicable_mode'),
    active: boolean('active').notNull().default(true),
    notes: text('notes'),
    /** Périmètre : site / game / both. Default site (rétro-compat). */
    scope: promoScopeEnum('scope').notNull().default('site'),
    createdBy: uuid('created_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    codeIdx: index('promo_codes_code_idx').on(t.code),
    scopeIdx: index('promo_codes_scope_idx').on(t.scope, t.active),
  })
);

/**
 * Lien booking ↔ promo code utilisé (1 booking peut avoir 1 code max).
 * Snapshot du discount appliqué pour audit/réconciliation (le taux du
 * code peut changer après, on garde la valeur historique).
 */
export const bookingPromoCodes = pgTable('booking_promo_codes', {
  bookingId: uuid('booking_id')
    .primaryKey()
    .references(() => bookings.id, { onDelete: 'cascade' }),
  promoCodeId: uuid('promo_code_id')
    .notNull()
    .references(() => promoCodes.id, { onDelete: 'restrict' }),
  appliedDiscountEur: numeric('applied_discount_eur', {
    precision: 10,
    scale: 2,
  }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

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
// GAMES — pronostic chandelier journalier, roue, XP events
// ============================================================

/**
 * État XP & jeux par user. 1 row / user, créé paresseusement au 1er
 * gain d'XP. Séparé de la table `users` pour que les requêtes sur
 * `users` (auth, dashboard, etc.) ne dépendent pas de l'application
 * de la migration des jeux : si la migration n'est pas appliquée, la
 * table `users` reste fonctionnelle, seules les pages /jeux échouent.
 */
export const userXpStates = pgTable(
  'user_xp_states',
  {
    userId: uuid('user_id')
      .primaryKey()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** XP cumulé. Jamais décrémenté en usage normal, sert au niveau & leaderboard. */
    xpTotal: integer('xp_total').notNull().default(0),
    /** Jours consécutifs avec au moins un pronostic. Reset à 1 si gap. */
    predictionStreakCount: integer('prediction_streak_count').notNull().default(0),
    /** Record perso (jamais reset). */
    predictionStreakLongest: integer('prediction_streak_longest')
      .notNull()
      .default(0),
    /** Date Paris du dernier pronostic (utilisé pour décider streak). */
    predictionLastDate: date('prediction_last_date'),
    /** Timestamp du dernier spin de la roue. Cooldown 7 jours côté serveur. */
    lastWheelSpunAt: timestamp('last_wheel_spun_at'),

    // ===== Mini-jeu de clic — améliorations permanentes achetables =====
    /** Combo +20% : étend la fenêtre temps entre 2 taps de 20%. */
    tapUpgradeCombo: boolean('tap_upgrade_combo').notNull().default(false),
    /** Drain -20% : la barre de combo descend 20% moins vite. */
    tapUpgradeDrain: boolean('tap_upgrade_drain').notNull().default(false),
    /** XP +15% : multiplicateur final sur l'XP gagné en jeu de clic. */
    tapUpgradeXp: boolean('tap_upgrade_xp').notNull().default(false),
    /** Date Paris du dernier défi quotidien validé (anti double-claim). */
    tapChallengeDoneDate: date('tap_challenge_done_date'),

    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    xpIdx: index('user_xp_states_xp_idx').on(t.xpTotal),
  })
);

/**
 * Marchés disponibles pour le mini-jeu de pronostic chandelier journalier.
 * Choisis avec l'utilisateur : indices US (Nasdaq, Dow Jones), métal (Gold),
 * énergie (WTI), indice européen (GER40/DAX). Symboles Yahoo correspondants
 * dans `lib/games/markets.ts`.
 */
export const predictionMarketEnum = pgEnum('prediction_market', [
  'nasdaq',
  'dowjones',
  'gold',
  'wti',
  'ger40',
]);

export const predictionDirectionEnum = pgEnum('prediction_direction', [
  'up',
  'down',
]);

/**
 * Raisons d'attribution d'XP. Enum strict pour pouvoir filtrer les
 * leaderboard temporels (semaine/mois) sans confusion.
 */
export const xpEventReasonEnum = pgEnum('xp_event_reason', [
  'prediction_made',
  'prediction_correct',
  'prediction_streak',
  'wheel_spin',
  'admin_adjustment',
  /** L'user est devenu membre VIP (funnel affilié → in_group OU paid → active). */
  'vip_joined',
  /** L'user a sécurisé son VIP (CPA qualifié — funnel affilié uniquement). */
  'vip_secured',
  /** L'user a terminé sa formation à distance. */
  'formation_remote_completed',
  /** L'user a terminé sa formation en présentiel Dubaï. */
  'formation_onsite_completed',
]);

/**
 * Types de récompense de la roue. `nothing` est réservé : la roue garantit
 * toujours quelque chose (XP minimum) pour ne pas frustrer les users.
 */
export const wheelRewardTypeEnum = pgEnum('wheel_reward_type', [
  'xp',
  'promo',
]);

/**
 * Pronostics journaliers des users sur les 5 marchés. Pour chaque marché et
 * chaque jour, un user peut faire 1 pronostic (clé unique).
 *
 * Workflow :
 *  1. Vers 00:00 Paris, le cron `resolve-predictions` ouvre la journée :
 *     pour chaque marché on stocke le prix de référence (close de la veille)
 *     dans `game_market_candles`.
 *  2. Pendant la journée (00:00 → 21:00 Paris), les users prédisent
 *     up/down. Insert avec `openPrice = candle.openPrice` figé.
 *  3. Après 23:00 Paris (cron de résolution), pour chaque marché le close
 *     du jour est récupéré, `closePrice` rempli, `correct` calculé, XP
 *     attribué (cf. `lib/games/xp.ts`).
 */
export const gamePredictions = pgTable(
  'game_predictions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    market: predictionMarketEnum('market').notNull(),
    /** Date Paris time du pronostic (= du chandelier visé). */
    predictionDate: date('prediction_date').notNull(),
    direction: predictionDirectionEnum('direction').notNull(),
    /** Prix de référence (= close de la veille) figé au moment du pronostic. */
    openPrice: numeric('open_price', { precision: 20, scale: 8 }),
    /** Close du jour, rempli au cron de résolution. */
    closePrice: numeric('close_price', { precision: 20, scale: 8 }),
    resolved: boolean('resolved').notNull().default(false),
    correct: boolean('correct'),
    xpAwarded: integer('xp_awarded').notNull().default(0),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    resolvedAt: timestamp('resolved_at'),
  },
  (t) => ({
    userIdx: index('game_predictions_user_idx').on(t.userId),
    dateIdx: index('game_predictions_date_idx').on(t.predictionDate),
    uniqIdx: uniqueIndex('game_predictions_uniq_idx').on(
      t.userId,
      t.market,
      t.predictionDate
    ),
    unresolvedIdx: index('game_predictions_unresolved_idx').on(
      t.predictionDate,
      t.resolved
    ),
  })
);

/**
 * Cache des chandeliers journaliers par marché. Une row par (marché, date).
 *
 * Pourquoi une table dédiée : on veut figer le prix de référence pour
 * TOUTES les prédictions du jour (équité entre users qui prédisent à
 * 9h et à 18h), et éviter de re-fetcher Yahoo Finance pour chaque user.
 *
 * Le cron de résolution remplit `closePrice` une fois par jour.
 */
export const gameMarketCandles = pgTable(
  'game_market_candles',
  {
    market: predictionMarketEnum('market').notNull(),
    candleDate: date('candle_date').notNull(),
    /** Prix de référence = close du jour précédent. */
    openPrice: numeric('open_price', { precision: 20, scale: 8 }).notNull(),
    closePrice: numeric('close_price', { precision: 20, scale: 8 }),
    fetchedAt: timestamp('fetched_at').notNull().defaultNow(),
    resolvedAt: timestamp('resolved_at'),
  },
  (t) => ({
    pk: uniqueIndex('game_market_candles_pk').on(t.market, t.candleDate),
  })
);

/**
 * Log des attributions d'XP (audit + leaderboard fenêtré).
 *
 * Permet de calculer le top de la semaine / du mois sans toucher le total.
 * `metadata` libre pour stocker contextual info (market, milestone, etc.).
 */
export const xpEvents = pgTable(
  'xp_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    amount: integer('amount').notNull(),
    reason: xpEventReasonEnum('reason').notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index('xp_events_user_idx').on(t.userId),
    createdIdx: index('xp_events_created_at_idx').on(t.createdAt),
    userCreatedIdx: index('xp_events_user_created_idx').on(
      t.userId,
      t.createdAt
    ),
  })
);

/**
 * Mini-jeu de clic combo. Une row par "run".
 *
 * Mécanique côté client : on tape sur un bouton, chaque clic enchaîné
 * dans la fenêtre temps fait monter le combo. Si on attend trop, combo
 * cassé → le run est soumis avec les stats finales.
 *
 *  - `taps` : total de clics dans le run
 *  - `maxLevel` : niveau max atteint (1-5 selon paliers 10/25/50/100/200)
 *  - `durationMs` : durée totale du run (1er tap → dernier tap)
 *  - `xpAwarded` : XP attribué (avec cap + bonus paliers)
 *
 * Anti-cheat : server vérifie ratio taps/duration plausible (max ~20/s).
 * Limite : 3 runs / jour / user.
 */
export const gameTapRuns = pgTable(
  'game_tap_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    taps: integer('taps').notNull(),
    maxLevel: integer('max_level').notNull(),
    durationMs: integer('duration_ms').notNull(),
    xpAwarded: integer('xp_awarded').notNull().default(0),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index('game_tap_runs_user_idx').on(t.userId, t.createdAt),
  })
);

/**
 * Spins de la roue de la fortune. Une row par spin.
 *
 *  - `rewardType` = 'xp' → `rewardValue` est un montant ("100"), XP déjà
 *    ajouté à users.xpTotal au moment du spin
 *  - `rewardType` = 'promo' → `rewardValue` est le code généré (unique,
 *    1 utilisation, lié au user via promo_codes.notes)
 *
 * `rewardLabel` est la version humaine affichée ("+100 XP", "Code -5%").
 */
export const gameWheelSpins = pgTable(
  'game_wheel_spins',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    rewardType: wheelRewardTypeEnum('reward_type').notNull(),
    rewardValue: text('reward_value'),
    rewardLabel: text('reward_label').notNull(),
    redeemed: boolean('redeemed').notNull().default(false),
    redeemedAt: timestamp('redeemed_at'),
    spunAt: timestamp('spun_at').notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index('game_wheel_spins_user_idx').on(t.userId, t.spunAt),
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
export type OfflineCoaching = typeof offlineCoachings.$inferSelect;
