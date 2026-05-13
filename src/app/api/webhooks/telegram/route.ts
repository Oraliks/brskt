import { webhookCallback } from 'grammy';
import { getBot } from '@/lib/telegram/bot';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Handler = (req: Request) => Promise<Response>;
let handler: Handler | null = null;

function getHandler(): Handler {
  if (handler) return handler;
  handler = webhookCallback(getBot(), 'std/http', {
    secretToken: process.env.TELEGRAM_WEBHOOK_SECRET,
  }) as Handler;
  return handler;
}

export async function POST(request: Request) {
  return getHandler()(request);
}
