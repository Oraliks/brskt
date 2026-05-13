'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { requireAuth } from '@/lib/auth/server';
import { onboardingSchema } from '@/lib/validations';
import type { ActionResult } from './bookings';

export async function completeOnboardingAction(
  input: unknown
): Promise<ActionResult> {
  const session = await requireAuth();
  const parsed = onboardingSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: 'Données invalides',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  // Vérifier que l'email n'est pas déjà pris par un autre compte
  const existing = await db.query.users.findFirst({
    where: eq(users.email, parsed.data.email),
  });

  if (existing && existing.id !== session.user.id) {
    return {
      success: false,
      error: 'Cet email est déjà associé à un autre compte',
    };
  }

  await db
    .update(users)
    .set({
      email: parsed.data.email,
      name: parsed.data.firstName,
      telegramFirstName: parsed.data.firstName,
      onboardingCompletedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(users.id, session.user.id));

  revalidatePath('/dashboard');
  revalidatePath('/vip');

  return { success: true, data: undefined };
}
