'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { db } from '@/lib/db';
import { adminNotifications, bookings, formations } from '@/lib/db/schema';
import { requireOnboarded } from '@/lib/auth/server';
import { ADMIN_EMAIL, sendEmail } from '@/lib/email';
import BookingReceivedEmail from '@root/emails/booking-received';
import AdminNotificationEmail from '@root/emails/admin-notification';
import {
  bookingFormSchema,
  type BookingFormInput,
} from '@/lib/validations';

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

export async function createBookingAction(
  input: BookingFormInput
): Promise<ActionResult<{ bookingId: string }>> {
  const session = await requireOnboarded();

  const parsed = bookingFormSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: 'Données invalides',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const formation = await db.query.formations.findFirst({
    where: eq(formations.id, parsed.data.formationId),
  });

  if (!formation || !formation.active) {
    return { success: false, error: 'Formation introuvable' };
  }

  const [booking] = await db
    .insert(bookings)
    .values({
      userId: session.user.id,
      formationId: formation.id,
      preferredDates: parsed.data.preferredDates,
      preferredAsap: parsed.data.preferredAsap,
      status: 'pending_admin',
    })
    .returning();

  if (!booking) {
    return { success: false, error: 'Erreur lors de la création' };
  }

  after(async () => {
    // Notif DB
    await db.insert(adminNotifications).values({
      type: 'new_booking',
      payload: {
        bookingId: booking.id,
        userId: session.user.id,
        formationId: formation.id,
      },
    });

    // Email user
    if (session.user.email) {
      await sendEmail({
        to: session.user.email,
        subject: `On a reçu ta demande — ${formation.title}`,
        react: BookingReceivedEmail({
          firstName:
            session.user.telegramFirstName ?? session.user.name ?? '',
          formationTitle: formation.title,
          bookingId: booking.id,
        }),
      });
    }

    // Email admin
    await sendEmail({
      to: ADMIN_EMAIL,
      subject: `[Boursikotons] Nouvelle réservation — ${formation.title}`,
      react: AdminNotificationEmail({
        type: 'new_booking',
        summary: `${session.user.name} vient de réserver "${formation.title}". À valider dans /admin/bookings.`,
        link: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/admin/bookings#${booking.id}`,
      }),
    });
  });

  revalidatePath('/dashboard');

  return { success: true, data: { bookingId: booking.id } };
}
