import type { ReactElement } from 'react';
import { sendEmail } from '@/lib/email';
import { sendDirectMessage } from '@/lib/telegram/helpers';

interface NotifyInput {
  /** Email — envoi best-effort, log en cas d'erreur */
  email?: {
    subject: string;
    react: ReactElement;
  };
  /** Message Telegram privé envoyé au user via le bot
   *  (le user doit avoir fait /start au bot pour recevoir le message) */
  telegram?: string;
}

interface NotifyTarget {
  email?: string | null;
  telegramId?: number | null;
}

/**
 * Notifie un user via email + Telegram en parallèle.
 * Chaque canal est best-effort : si l'un échoue (ex: user n'a pas démarré
 * le bot), l'autre reste tenté. Aucun throw côté caller.
 *
 * Le canal Telegram silence les utilisateurs qui n'ont jamais interagi
 * avec le bot — c'est OK, l'email sert de fallback.
 */
export async function notifyUser(
  target: NotifyTarget,
  input: NotifyInput
): Promise<{ emailSent: boolean; telegramSent: boolean }> {
  const tasks: Array<Promise<{ kind: 'email' | 'telegram'; ok: boolean }>> = [];

  if (input.email && target.email) {
    tasks.push(
      sendEmail({
        to: target.email,
        subject: input.email.subject,
        react: input.email.react,
      }).then((r) => ({ kind: 'email' as const, ok: r.success }))
    );
  }

  if (input.telegram && target.telegramId) {
    tasks.push(
      sendDirectMessage(Number(target.telegramId), input.telegram).then((ok) => ({
        kind: 'telegram' as const,
        ok,
      }))
    );
  }

  const results = await Promise.allSettled(tasks);
  let emailSent = false;
  let telegramSent = false;

  for (const r of results) {
    if (r.status === 'fulfilled') {
      if (r.value.kind === 'email') emailSent = r.value.ok;
      else if (r.value.kind === 'telegram') telegramSent = r.value.ok;
    }
  }

  return { emailSent, telegramSent };
}
