import { z } from 'zod';

// ============================================================
// BOOKING
// ============================================================

export const bookingFormSchema = z
  .object({
    formationId: z.string().uuid(),
    preferredDates: z
      .array(
        z.object({
          start: z.string().refine((d) => !isNaN(Date.parse(d)), 'Date invalide'),
          end: z.string().refine((d) => !isNaN(Date.parse(d)), 'Date invalide'),
        })
      )
      .max(3, 'Maximum 3 créneaux'),
    preferredAsap: z.boolean().default(false),
    paymentMethod: z.enum(['card', 'paypal', 'crypto']),
    /**
     * Plan de paiement :
     *  - `full` : 1 fois (défaut)
     *  - `installments_3x` : 3 mensualités égales sans frais
     */
    paymentPlan: z.enum(['full', 'installments_3x']).default('full'),
    /** Code promo optionnel — validé côté server avant création du booking. */
    promoCode: z.string().max(40).optional(),
  })
  .refine((data) => data.preferredDates.length > 0 || data.preferredAsap, {
    message: 'Choisis au moins un créneau ou coche "Dès que possible"',
    path: ['preferredDates'],
  });

export type BookingFormInput = z.infer<typeof bookingFormSchema>;

export const respondProposedDateSchema = z.object({
  bookingId: z.string().uuid(),
  action: z.enum(['accept', 'reject']),
  reason: z.string().optional(),
});

// ============================================================
// ADMIN BOOKING ACTIONS
// ============================================================

export const adminBookingActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('confirm'),
    bookingId: z.string().uuid(),
    confirmedDate: z.string(),
    /**
     * Permet de confirmer même si la date a déjà atteint la capacité max
     * de la formation (vérifié côté serveur). L'UI affiche un dialog de
     * confirmation avant de renvoyer avec ce flag à true.
     */
    overrideCapacity: z.boolean().optional(),
  }),
  z.object({
    action: z.literal('propose_alternative'),
    bookingId: z.string().uuid(),
    proposedDate: z.string(),
    notes: z.string().optional(),
    overrideCapacity: z.boolean().optional(),
  }),
  z.object({
    action: z.literal('refuse'),
    bookingId: z.string().uuid(),
    notes: z.string().optional(),
  }),
  // Annule un booking quel que soit son status (sauf completed).
  // Pour les cancellations exceptionnelles : client change d'avis post-paiement,
  // remboursement à organiser séparément.
  z.object({
    action: z.literal('force_cancel'),
    bookingId: z.string().uuid(),
    notes: z.string().min(3, 'Raison requise pour audit'),
  }),
  // Met à jour uniquement les notes admin (sans changer le status).
  z.object({
    action: z.literal('update_notes'),
    bookingId: z.string().uuid(),
    notes: z.string().max(2000),
  }),
  // Skip le paiement online et passe directement à pending_admin.
  // Utilisé quand le client a payé hors-site (cash, virement, autre).
  // Note obligatoire avec méthode + référence pour l'audit.
  z.object({
    action: z.literal('mark_paid'),
    bookingId: z.string().uuid(),
    notes: z
      .string()
      .min(3, 'Note requise : méthode de paiement + référence'),
  }),
  // Marque la formation comme terminée (post-session). Déclenche le NPS auto
  // si l'automation est activée. Status confirmed/paid → completed.
  z.object({
    action: z.literal('mark_completed'),
    bookingId: z.string().uuid(),
  }),
]);

// ============================================================
// ADMIN EMAIL BROADCAST
// ============================================================

/**
 * Envoie d'un email à un segment d'utilisateurs. Audience limitée aux
 * opt-in (briefing ou events) ou aux users onboardés (tous ceux qui ont
 * un email vérifié). Pas d'envoi aux non-onboardés (pas d'email).
 *
 * Le body est en HTML simple (pas de Markdown ni templating avancé).
 */
export const adminBroadcastSchema = z.object({
  subject: z
    .string()
    .min(3, 'Sujet trop court (3 caractères min)')
    .max(200, 'Sujet trop long (200 caractères max)'),
  bodyHtml: z
    .string()
    .min(20, 'Contenu trop court')
    .max(20_000, 'Contenu trop long (20 000 caractères max)'),
  audience: z.enum(['briefing', 'events', 'all_onboarded']),
  /**
   * Mode test : si true, n'envoie qu'à l'admin courant (preview).
   * Si false, envoie réellement à toute l'audience.
   */
  testOnly: z.boolean().default(false),
});

/**
 * Schema pour les actions admin en masse sur plusieurs bookings simultanément.
 * Limité aux actions qui ne nécessitent pas de paramètre par-booking (donc
 * pas de confirm ou propose qui demandent une date différente par résa).
 */
export const adminBulkBookingsActionSchema = z.object({
  action: z.enum(['force_cancel', 'mark_completed']),
  bookingIds: z
    .array(z.string().uuid())
    .min(1, 'Sélectionne au moins une réservation')
    .max(100, 'Maximum 100 réservations à la fois'),
  /** Raison/note — obligatoire pour force_cancel, ignorée pour mark_completed. */
  notes: z.string().optional(),
});

export type AdminBookingActionInput = z.infer<typeof adminBookingActionSchema>;

// ============================================================
// VIP
// ============================================================

export const vipBrokerAccountSchema = z.object({
  brokerAccountId: z
    .string()
    .min(3, 'Numéro de compte trop court')
    .max(50, 'Numéro de compte trop long')
    .regex(/^[A-Za-z0-9_-]+$/, 'Format invalide'),
});

export const vipDepositSchema = z.object({
  amount: z
    .number()
    .min(250, 'Le dépôt minimum est de 250€')
    .max(1_000_000, 'Montant invalide'),
  currency: z.enum(['EUR', 'USD']).default('EUR'),
});

/**
 * Override admin manuel d'une application VIP — permet de skip une étape,
 * forcer un statut, reset le funnel, etc. À utiliser uniquement pour
 * debug ou cas exceptionnels.
 */
export const welcomeBonusSchema = z.object({
  enabled: z.boolean(),
  title: z.string().min(3, 'Titre trop court').max(80, 'Titre trop long'),
  description: z
    .string()
    .min(10, 'Description trop courte')
    .max(400, 'Description trop longue'),
  fineprint: z.string().max(200, 'Trop long').optional(),
});

/**
 * Update partiel des toggles features bot. Toutes les clés sont optionnelles,
 * on merge avec l'état actuel côté server.
 */
export const botFeaturesSchema = z
  .object({
    quiz: z.boolean().optional(),
    economicAlerts: z.boolean().optional(),
    priceAlerts: z.boolean().optional(),
    referral: z.boolean().optional(),
    inline: z.boolean().optional(),
    calculators: z.boolean().optional(),
    streak: z.boolean().optional(),
    qualify: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: 'Au moins un champ doit être fourni',
  });

export const adminVipOverrideSchema = z.object({
  applicationId: z.string().uuid(),
  action: z.enum([
    'set_step',         // Force une étape spécifique
    'reset_funnel',     // Reset à 'link_generated'
    'clear_warning',    // Clear ejectionWarnedAt
    'force_qualified',  // cpaQualified = true (sans passer par le %)
    'unqualify',        // cpaQualified = false (annule force_qualified)
  ]),
  // Pour set_step uniquement : la cible
  targetStep: z
    .enum([
      'link_generated',
      'clicked',
      'signup_pending',
      'signup_validated',
      'deposit_pending',
      'deposit_validated',
      'telegram_invited',
      'in_group',
      'ejected',
    ])
    .optional(),
  // Note obligatoire pour traçabilité dans l'audit log
  reason: z.string().min(3, 'Donne une raison pour le log audit').max(500),
});

// ============================================================
// ONBOARDING
// ============================================================

export const onboardingSchema = z.object({
  email: z.string().email('Email invalide'),
  firstName: z.string().min(1, 'Prénom requis').max(50),
});

// ============================================================
// PAYMENT
// ============================================================

export const createPaymentSchema = z.object({
  bookingId: z.string().uuid(),
  method: z.enum(['card', 'paypal', 'crypto']),
});

// ============================================================
// ADMIN SETTINGS
// ============================================================

export const ironfxModeSchema = z.object({
  mode: z.enum(['api', 'manual']),
});

export const manualIronfxUpdateSchema = z.object({
  accountId: z.string(),
  userId: z.string().uuid(),
  signupDetected: z.boolean().optional(),
  depositTotal: z.number().min(0).optional(),
  cpaQualified: z.boolean().optional(),
  tradingProgressPct: z.number().int().min(0).max(100).optional(),
  accountClosed: z.boolean().optional(),
  hasWithdrawn: z.boolean().optional(),
  notes: z.string().optional(),
});

export const adminProgressUpdateSchema = z.object({
  accountId: z.string(),
  userId: z.string().uuid(),
  tradingProgressPct: z.number().int().min(0).max(100),
});

export const dailyBriefingSchema = z.object({
  enabled: z.boolean(),
  template: z.string().min(20, 'Template trop court').max(4000, 'Template trop long'),
});

/**
 * Override manuel du compteur de membres du canal. Utilisé quand le bot
 * ne peut pas être ajouté au canal (canal privé > 200 membres, restriction
 * Telegram).
 */
export const communityCountOverrideSchema = z.object({
  enabled: z.boolean(),
  value: z.number().int().min(0).max(10_000_000),
});

/**
 * Patch partiel des automatisations CRON — toutes les sections sont optionnelles.
 * Validation minimale, le form admin contraint déjà les ranges.
 */
export const automationsPatchSchema = z
  .object({
    paymentReminder: z
      .object({
        enabled: z.boolean().optional(),
        firstNudgeHours: z.number().int().min(1).max(720).optional(),
        secondNudgeHours: z.number().int().min(1).max(720).optional(),
        autoCancelDays: z.number().int().min(1).max(90).optional(),
        template1: z.string().min(20).max(2000).optional(),
        template2: z.string().min(20).max(2000).optional(),
        templateCancel: z.string().min(20).max(2000).optional(),
      })
      .optional(),
    vipDropoff: z
      .object({
        enabled: z.boolean().optional(),
        firstNudgeDays: z.number().int().min(1).max(90).optional(),
        secondNudgeDays: z.number().int().min(1).max(180).optional(),
        template1: z.string().min(20).max(2000).optional(),
        template2: z.string().min(20).max(2000).optional(),
      })
      .optional(),
    testimonialRequest: z
      .object({
        enabled: z.boolean().optional(),
        delayDays: z.number().int().min(1).max(180).optional(),
        template: z.string().min(20).max(2000).optional(),
      })
      .optional(),
    weeklyAdminStats: z
      .object({
        enabled: z.boolean().optional(),
        dayOfWeek: z.number().int().min(0).max(6).optional(),
        hourUtc: z.number().int().min(0).max(23).optional(),
      })
      .optional(),
    formationReminders: z
      .object({
        enabled: z.boolean().optional(),
        daysBefore: z.array(z.number().int().min(0).max(60)).max(5).optional(),
        template: z.string().min(20).max(2000).optional(),
      })
      .optional(),
    npsRequest: z
      .object({
        enabled: z.boolean().optional(),
        delayDays: z.number().int().min(1).max(180).optional(),
        question: z.string().min(20).max(2000).optional(),
      })
      .optional(),
    briefingMode: z.enum(['auto', 'manual']).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: 'Au moins une section requise',
  });

// ============================================================
// ADMIN USERS
// ============================================================

export const adminSetUserRoleSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(['user', 'admin']),
});

export const adminSetUserBannedSchema = z.object({
  userId: z.string().uuid(),
  banned: z.boolean(),
  reason: z.string().max(500).optional(),
});

// ============================================================
// ADMIN FORMATIONS (édition prix, titre, etc.)
// ============================================================

/**
 * Schema de création d'une formation. Slug obligatoire, lowercase + tirets
 * uniquement (URL-safe). Mode immuable une fois créé pour éviter de casser
 * les bookings existants.
 */
export const adminCreateFormationSchema = z.object({
  title: z.string().min(3, 'Titre trop court').max(120),
  slug: z
    .string()
    .min(2, 'Slug trop court')
    .max(80)
    .regex(
      /^[a-z0-9-]+$/,
      'Slug : minuscules, chiffres et tirets uniquement (ex: trading-distance)'
    ),
  mode: z.enum(['remote', 'onsite']),
  description: z.string().max(2000).optional(),
  priceEur: z.number().min(0).max(1_000_000),
  durationDays: z.number().int().min(1).max(60).default(5),
  dailyCapacity: z.number().int().min(1).max(50).default(3),
  active: z.boolean().default(true),
});

export const adminUpdateFormationSchema = z.object({
  formationId: z.string().uuid(),
  title: z.string().min(3, 'Titre trop court').max(120).optional(),
  description: z.string().max(2000).optional(),
  priceEur: z.number().min(0).max(1_000_000).optional(),
  durationDays: z.number().int().min(1).max(60).optional(),
  dailyCapacity: z
    .number()
    .int()
    .min(1, 'Minimum 1 personne par jour')
    .max(50, 'Maximum 50 personnes par jour')
    .optional(),
  active: z.boolean().optional(),
});

// ============================================================
// ADMIN PROMO CODES
// ============================================================

export const adminCreatePromoSchema = z
  .object({
    code: z
      .string()
      .min(3, 'Code trop court (3 chars min)')
      .max(40, 'Code trop long')
      .regex(/^[A-Z0-9_-]+$/, 'Lettres maj, chiffres, - et _ uniquement'),
    discountType: z.enum(['percent', 'fixed']),
    discountValue: z.number().min(0).max(100_000),
    validFrom: z.string().optional(),
    validUntil: z.string().optional(),
    maxUses: z.number().int().min(1).max(100_000).optional(),
    applicableMode: z.enum(['remote', 'onsite']).optional(),
    active: z.boolean().default(true),
    notes: z.string().max(500).optional(),
  })
  .refine((v) => v.discountType !== 'percent' || v.discountValue <= 100, {
    message: 'Pour un % le discount doit être <= 100',
    path: ['discountValue'],
  });

export const adminUpdatePromoSchema = z.object({
  promoId: z.string().uuid(),
  active: z.boolean().optional(),
  discountValue: z.number().min(0).max(100_000).optional(),
  validUntil: z.string().optional().nullable(),
  maxUses: z.number().int().min(1).max(100_000).optional().nullable(),
  notes: z.string().max(500).optional(),
});

export const adminDeletePromoSchema = z.object({
  promoId: z.string().uuid(),
});

// ============================================================
// OFFLINE COACHINGS (clients hors-site historiques)
// ============================================================

export const offlineCoachingItemSchema = z.object({
  fullName: z.string().min(2, 'Nom requis').max(120),
  email: z
    .string()
    .email('Email invalide')
    .optional()
    .or(z.literal(''))
    .transform((v) => (v ? v : undefined)),
  phone: z.string().max(40).optional(),
  mode: z.string().max(40).default('remote'),
  totalAmountEur: z.number().min(0).max(1_000_000),
  paidAmountEur: z.number().min(0).max(1_000_000).default(0),
  scheduledDate: z.string().optional().nullable(),
  notes: z.string().max(2000).optional(),
});

export const adminCreateOfflineCoachingSchema = offlineCoachingItemSchema;

export const adminBulkImportOfflineCoachingSchema = z.object({
  items: z
    .array(offlineCoachingItemSchema)
    .min(1, 'Au moins une ligne requise')
    .max(500, 'Max 500 lignes par import'),
});

export const adminUpdateOfflineCoachingSchema = z.object({
  coachingId: z.string().uuid(),
  fullName: z.string().min(2).max(120).optional(),
  email: z.string().optional(),
  phone: z.string().max(40).optional(),
  mode: z.string().max(40).optional(),
  totalAmountEur: z.number().min(0).max(1_000_000).optional(),
  paidAmountEur: z.number().min(0).max(1_000_000).optional(),
  scheduledDate: z.string().optional().nullable(),
  notes: z.string().max(2000).optional(),
  status: z.enum(['active', 'completed', 'cancelled']).optional(),
});

export const adminDeleteOfflineCoachingSchema = z.object({
  coachingId: z.string().uuid(),
});

// ============================================================
// TESTIMONIALS
// ============================================================

export const adminModerateTestimonialSchema = z.object({
  testimonialId: z.string().uuid(),
  action: z.enum(['publish', 'reject']),
  notes: z.string().max(500).optional(),
});

// ============================================================
// WAITLIST
// ============================================================

export const formationWaitlistSchema = z.object({
  mode: z.enum(['remote', 'onsite']),
  email: z.string().email('Email invalide'),
  firstName: z.string().min(1, 'Prénom requis').max(50).optional(),
  notes: z.string().max(500).optional(),
});

// ============================================================
// VIP PAID ACCESS
// ============================================================

export const vipPaidAccessSchema = z.object({
  firstName: z
    .string()
    .min(2, "Prénom requis (2 caractères minimum)")
    .max(50, "Prénom trop long")
    .regex(/^[\p{L}\p{M}'\-\s]+$/u, "Caractères invalides dans le prénom"),
  lastName: z
    .string()
    .min(2, "Nom requis (2 caractères minimum)")
    .max(50, "Nom trop long")
    .regex(/^[\p{L}\p{M}'\-\s]+$/u, "Caractères invalides dans le nom"),
  paymentMethod: z.enum(["card", "paypal", "crypto"]),
});

export type VipPaidAccessInput = z.infer<typeof vipPaidAccessSchema>;

