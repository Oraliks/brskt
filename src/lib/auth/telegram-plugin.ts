import crypto from 'node:crypto';
import { z } from 'zod';

const telegramAuthSchema = z.object({
  id: z.number(),
  first_name: z.string(),
  last_name: z.string().optional(),
  username: z.string().optional(),
  photo_url: z.string().url().optional(),
  auth_date: z.number(),
  hash: z.string(),
});

export type TelegramAuthData = z.infer<typeof telegramAuthSchema>;

export { telegramAuthSchema };

/**
 * Vérifie la signature du payload du Telegram Login Widget.
 *
 * Algo (cf. https://core.telegram.org/widgets/login#checking-authorization) :
 *   data_check_string = clés triées alphabétiquement, "key=value" joint par \n
 *   secret_key        = SHA256(bot_token)
 *   hash attendu      = HMAC-SHA256(data_check_string, secret_key)
 *
 * IMPORTANT : le widget Telegram ne fournit JAMAIS le numéro de téléphone.
 * On collecte l'email à l'onboarding.
 */
export function verifyTelegramHash(
  data: TelegramAuthData,
  botToken: string
): boolean {
  const { hash, ...fields } = data;

  const dataCheckString = Object.keys(fields)
    .sort()
    .map((k) => `${k}=${(fields as Record<string, unknown>)[k]}`)
    .join('\n');

  const secretKey = crypto.createHash('sha256').update(botToken).digest();
  const computed = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(computed, 'hex'),
      Buffer.from(hash, 'hex')
    );
  } catch {
    return false;
  }
}
