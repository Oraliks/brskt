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
  }),
  z.object({
    action: z.literal('propose_alternative'),
    bookingId: z.string().uuid(),
    proposedDate: z.string(),
    notes: z.string().optional(),
  }),
  z.object({
    action: z.literal('refuse'),
    bookingId: z.string().uuid(),
    notes: z.string().optional(),
  }),
]);

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
// WAITLIST
// ============================================================

export const formationWaitlistSchema = z.object({
  mode: z.enum(['remote', 'onsite']),
  email: z.string().email('Email invalide'),
  firstName: z.string().min(1, 'Prénom requis').max(50).optional(),
  notes: z.string().max(500).optional(),
});
