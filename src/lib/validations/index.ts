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
