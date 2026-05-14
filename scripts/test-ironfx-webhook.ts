/**
 * Script de test du webhook IronFX (/api/webhooks/ironfx).
 *
 * Construit un payload signé exactement comme le ferait IronAffiliates,
 * puis le POST sur l'URL cible (dev local par défaut). Permet de tester
 * le flow signup → deposit → cpa_qualified → withdrawal sans attendre
 * un vrai postback du broker.
 *
 * Usage :
 *   pnpm tsx scripts/test-ironfx-webhook.ts signup --account 12345 --ref abc123
 *   pnpm tsx scripts/test-ironfx-webhook.ts deposit --account 12345 --amount 500
 *   pnpm tsx scripts/test-ironfx-webhook.ts cpa_qualified --account 12345
 *   pnpm tsx scripts/test-ironfx-webhook.ts withdrawal --account 12345
 *
 * Optionnel :
 *   --url <url>     URL du endpoint (défaut: http://localhost:3000/api/webhooks/ironfx)
 *   --secret <key>  Secret HMAC (défaut: lit IRONFX_POSTBACK_SECRET de .env.local)
 *   --method <get|post>  Méthode HTTP (défaut: post)
 *
 * Requiert IRONFX_POSTBACK_SECRET dans .env.local côté serveur.
 */

import crypto from 'node:crypto';
import { config } from 'dotenv';

config({ path: '.env.local' });

const EVENT_TYPES = [
  'signup',
  'deposit',
  'cpa_qualified',
  'withdrawal',
  'account_closed',
] as const;

type EventType = (typeof EVENT_TYPES)[number];

interface Args {
  eventType: EventType;
  account: string;
  ref?: string;
  amount?: string;
  currency?: string;
  url: string;
  secret: string;
  method: 'get' | 'post';
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  if (argv.length === 0) {
    console.error('Usage: pnpm tsx scripts/test-ironfx-webhook.ts <event_type> [--account ID] [--ref REF] ...');
    console.error('Event types:', EVENT_TYPES.join(', '));
    process.exit(1);
  }

  const eventType = argv[0] as EventType;
  if (!EVENT_TYPES.includes(eventType)) {
    console.error(`Unknown event type: ${eventType}`);
    process.exit(1);
  }

  const get = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };

  return {
    eventType,
    account: get('--account') ?? '12345',
    ref: get('--ref'),
    amount: get('--amount'),
    currency: get('--currency') ?? 'EUR',
    url:
      get('--url') ??
      'http://localhost:3000/api/webhooks/ironfx',
    secret:
      get('--secret') ??
      process.env.IRONFX_POSTBACK_SECRET ??
      '',
    method: (get('--method') as 'get' | 'post') ?? 'post',
  };
}

function buildPayload(args: Args): Record<string, string> {
  const payload: Record<string, string> = {
    event_type: args.eventType,
    account_id: args.account,
    event_id: `test_${args.eventType}_${Date.now()}`,
    timestamp: String(Math.floor(Date.now() / 1000)),
  };
  if (args.ref) payload.ref = args.ref;
  if (args.amount) payload.amount = args.amount;
  if (args.currency) payload.currency = args.currency;
  return payload;
}

function signPayload(
  payload: Record<string, string>,
  secret: string
): string {
  const dataString = Object.keys(payload)
    .sort()
    .map((k) => `${k}=${payload[k]}`)
    .join('&');
  return crypto.createHmac('sha256', secret).update(dataString).digest('hex');
}

async function main() {
  const args = parseArgs();

  if (!args.secret) {
    console.error('❌ IRONFX_POSTBACK_SECRET not found in .env.local and --secret not provided');
    process.exit(1);
  }

  const payload = buildPayload(args);
  const sig = signPayload(payload, args.secret);
  payload.sig = sig;

  console.log('📤 Sending IronFX test postback');
  console.log('   URL:', args.url);
  console.log('   Method:', args.method.toUpperCase());
  console.log('   Payload:', payload);

  let response: Response;
  if (args.method === 'get') {
    const params = new URLSearchParams(payload).toString();
    response = await fetch(`${args.url}?${params}`);
  } else {
    response = await fetch(args.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }

  const text = await response.text();
  console.log(`\n📥 ${response.status} ${response.statusText}`);
  try {
    console.log('   Body:', JSON.parse(text));
  } catch {
    console.log('   Body:', text);
  }

  if (!response.ok) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('💥 Test failed:', err);
  process.exit(1);
});
