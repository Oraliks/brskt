import { Resend } from 'resend';

let cached: Resend | null = null;

export function getResend(): Resend {
  if (cached) return cached;
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY missing');
  cached = new Resend(key);
  return cached;
}

export const FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL ?? 'noreply@boursikotons.com';
export const ADMIN_EMAIL =
  process.env.ADMIN_NOTIFICATION_EMAIL ?? 'admin@boursikotons.com';

interface SendEmailInput {
  to: string | string[];
  subject: string;
  react: React.ReactElement;
}

/**
 * Wrapper sûr autour de Resend : log l'erreur mais ne throw pas
 * (les emails sont best-effort dans les flows critiques).
 */
export async function sendEmail({
  to,
  subject,
  react,
}: SendEmailInput): Promise<{ success: boolean; error?: string }> {
  try {
    const resend = getResend();
    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      react,
    });
    if (result.error) {
      console.error('[email] send error', result.error);
      return { success: false, error: result.error.message };
    }
    return { success: true };
  } catch (err) {
    console.error('[email] exception', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
