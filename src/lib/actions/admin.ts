'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { db } from '@/lib/db';
import {
  bookings,
  manualIronfxStatus,
  vipApplications,
} from '@/lib/db/schema';
import { requireAdmin } from '@/lib/auth/server';
import {
  adminBookingActionSchema,
  ironfxModeSchema,
  manualIronfxUpdateSchema,
} from '@/lib/validations';
import { setIronFXMode } from '@/lib/ironfx';
import { ejectFromTelegram } from '@/lib/telegram/helpers';
import { sendEmail } from '@/lib/email';
import BookingConfirmedEmail from '@root/emails/booking-confirmed';
import VipSignupValidatedEmail from '@root/emails/vip-signup-validated';
import VipDepositValidatedEmail from '@root/emails/vip-deposit-validated';
import type { ActionResult } from './bookings';

// ============================================================
// BOOKINGS
// ============================================================

export async function adminBookingAction(
  input: unknown
): Promise<ActionResult> {
  await requireAdmin();
  const parsed = adminBookingActionSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: 'Données invalides',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const data = parsed.data;

  const booking = await db.query.bookings.findFirst({
    where: eq(bookings.id, data.bookingId),
    with: { user: true, formation: true },
  });

  if (!booking) {
    return { success: false, error: 'Réservation introuvable' };
  }

  if (data.action === 'confirm') {
    await db
      .update(bookings)
      .set({
        confirmedDate: data.confirmedDate,
        status: 'confirmed',
        updatedAt: new Date(),
      })
      .where(eq(bookings.id, data.bookingId));

    after(async () => {
      if (booking.user.email) {
        await sendEmail({
          to: booking.user.email,
          subject: `Confirmé — ${booking.formation.title}`,
          react: BookingConfirmedEmail({
            firstName:
              booking.user.telegramFirstName ?? booking.user.name ?? '',
            formationTitle: booking.formation.title,
            isOnsite: booking.formation.mode === 'onsite',
            confirmedDate: data.confirmedDate,
            bookingId: booking.id,
          }),
        });
      }
    });
  } else if (data.action === 'propose_alternative') {
    await db
      .update(bookings)
      .set({
        adminProposedDate: data.proposedDate,
        adminNotes: data.notes ?? null,
        status: 'date_proposed',
        updatedAt: new Date(),
      })
      .where(eq(bookings.id, data.bookingId));
  } else if (data.action === 'refuse') {
    await db
      .update(bookings)
      .set({
        status: 'cancelled',
        adminNotes: data.notes ?? null,
        updatedAt: new Date(),
      })
      .where(eq(bookings.id, data.bookingId));
  }

  revalidatePath('/admin/bookings');
  revalidatePath('/dashboard');
  return { success: true, data: undefined };
}

// ============================================================
// VIP
// ============================================================

export async function adminValidateSignupAction(
  applicationId: string
): Promise<ActionResult> {
  await requireAdmin();

  const app = await db.query.vipApplications.findFirst({
    where: eq(vipApplications.id, applicationId),
    with: { user: true },
  });
  if (!app) return { success: false, error: 'Application introuvable' };

  await db
    .update(vipApplications)
    .set({ step: 'signup_validated', updatedAt: new Date() })
    .where(eq(vipApplications.id, applicationId));

  after(async () => {
    if (app.user.email) {
      await sendEmail({
        to: app.user.email,
        subject: 'Inscription broker validée — étape suivante',
        react: VipSignupValidatedEmail({
          firstName: app.user.telegramFirstName ?? app.user.name ?? '',
        }),
      });
    }
  });

  revalidatePath('/admin/vip');
  revalidatePath('/vip');
  return { success: true, data: undefined };
}

export async function adminValidateDepositAction(
  applicationId: string
): Promise<ActionResult> {
  await requireAdmin();

  const app = await db.query.vipApplications.findFirst({
    where: eq(vipApplications.id, applicationId),
    with: { user: true },
  });
  if (!app) return { success: false, error: 'Application introuvable' };

  await db
    .update(vipApplications)
    .set({ step: 'deposit_validated', updatedAt: new Date() })
    .where(eq(vipApplications.id, applicationId));

  after(async () => {
    if (app.user.email) {
      await sendEmail({
        to: app.user.email,
        subject: 'Dépôt validé — récupère ton lien Telegram VIP',
        react: VipDepositValidatedEmail({
          firstName: app.user.telegramFirstName ?? app.user.name ?? '',
        }),
      });
    }
  });

  revalidatePath('/admin/vip');
  revalidatePath('/vip');
  return { success: true, data: undefined };
}

export async function adminEjectAction(
  userId: string,
  reason: string
): Promise<ActionResult> {
  await requireAdmin();
  const res = await ejectFromTelegram(userId, reason);
  if (!res.success) {
    return { success: false, error: res.error ?? 'Éjection échouée' };
  }
  revalidatePath('/admin/vip');
  revalidatePath('/vip');
  revalidatePath('/dashboard');
  return { success: true, data: undefined };
}

export async function adminUpdateManualIronfxAction(
  input: unknown
): Promise<ActionResult> {
  const session = await requireAdmin();
  const parsed = manualIronfxUpdateSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: 'Données invalides',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const {
    accountId,
    userId,
    signupDetected,
    depositTotal,
    cpaQualified,
    accountClosed,
    hasWithdrawn,
    notes,
  } = parsed.data;

  await db
    .insert(manualIronfxStatus)
    .values({
      accountId,
      userId,
      signupDetected: signupDetected ?? false,
      depositTotal: depositTotal !== undefined ? String(depositTotal) : '0',
      cpaQualified: cpaQualified ?? false,
      accountClosed: accountClosed ?? false,
      hasWithdrawn: hasWithdrawn ?? false,
      notes: notes ?? null,
      updatedBy: session.user.id,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: manualIronfxStatus.accountId,
      set: {
        signupDetected,
        depositTotal:
          depositTotal !== undefined ? String(depositTotal) : undefined,
        cpaQualified,
        accountClosed,
        hasWithdrawn,
        notes,
        updatedBy: session.user.id,
        updatedAt: new Date(),
      },
    });

  revalidatePath('/admin/vip');
  return { success: true, data: undefined };
}

// ============================================================
// SETTINGS
// ============================================================

export async function adminSetIronfxModeAction(
  input: unknown
): Promise<ActionResult> {
  const session = await requireAdmin();
  const parsed = ironfxModeSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: 'Mode invalide' };
  }

  await setIronFXMode(parsed.data.mode, session.user.id);
  revalidatePath('/admin/settings');
  return { success: true, data: undefined };
}
