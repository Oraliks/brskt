/**
 * Script à lancer après chaque déploiement pour configurer le webhook Telegram.
 *
 * Usage:
 *   tsx scripts/setup-telegram-webhook.ts
 */

import 'dotenv/config';
import { Bot } from 'grammy';

async function main() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;

  if (!token) throw new Error('TELEGRAM_BOT_TOKEN missing');
  if (!appUrl) throw new Error('NEXT_PUBLIC_APP_URL missing');
  if (!secret) throw new Error('TELEGRAM_WEBHOOK_SECRET missing');

  if (!appUrl.startsWith('https://')) {
    throw new Error('Telegram webhook requires HTTPS');
  }

  const bot = new Bot(token);

  const webhookUrl = `${appUrl}/api/webhooks/telegram`;

  console.log(`Setting webhook to ${webhookUrl}...`);

  await bot.api.setWebhook(webhookUrl, {
    secret_token: secret,
    allowed_updates: ['message', 'chat_member', 'callback_query'],
    drop_pending_updates: false,
  });

  const info = await bot.api.getWebhookInfo();
  console.log('✓ Webhook set successfully');
  console.log(JSON.stringify(info, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
