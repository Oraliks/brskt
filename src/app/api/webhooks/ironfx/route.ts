import crypto from 'node:crypto';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { manualIronfxStatus, vipApplications } from '@/lib/db/schema';
import {
  isEventProcessed,
  markEventError,
  markEventProcessed,
  recordEvent,
} from '@/lib/payments/webhook-utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Postback URL pour IronAffiliates.
 *
 * Le schéma EXACT dépend de ce que ton account manager IronFX configure.
 * Patterns courants (S2S tracking) :
 *   - Query params : ?event_type=signup&account_id=12345&ref=abc&sig=...
 *   - JSON POST avec signature en header
 *
 * On supporte les deux ici. Le payload est validé avec Zod avant traitement.
 */

const KNOWN_EVENT_TYPES = [
  'signup',
  'deposit',
  'cpa_qualified',
  'withdrawal',
  'account_closed',
] as const;

const postbackSchema = z.object({
  event_type: z.enum(KNOWN_EVENT_TYPES),
  account_id: z.string().min(1),
  // L'event_id permet une idempotence parfaite. Si absent, on tombera sur un
  // hash du payload — moins robuste mais utilisable pour le mode legacy.
  event_id: z.string().optional(),
  timestamp: z.string().optional(),
  // Référence affiliée — accepte plusieurs nommages selon la config IronFX.
  ref: z.string().optional(),
  affiliate_ref: z.string().optional(),
  sub_id: z.string().optional(),
  subid: z.string().optional(),
  sub1: z.string().optional(),
  // Champs spécifiques à certains events
  amount: z.string().optional(),
  currency: z.string().optional(),
  // Signature — peut venir du body ou des headers, donc optionnelle ici
  sig: z.string().optional(),
});

type IronfxPayload = z.infer<typeof postbackSchema>;

export async function POST(request: Request) {
  return handleIronfxPostback(request);
}

export async function GET(request: Request) {
  return handleIronfxPostback(request);
}

async function handleIronfxPostback(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const secret = process.env.IRONFX_POSTBACK_SECRET;

  if (!secret) {
    return Response.json(
      { error: 'IRONFX_POSTBACK_SECRET not configured' },
      { status: 500 }
    );
  }

  // 1) Récupérer payload (query params en GET, body en POST)
  let rawPayload: Record<string, string>;
  let rawBody = '';

  if (request.method === 'GET') {
    rawPayload = Object.fromEntries(url.searchParams.entries());
  } else {
    rawBody = await request.text();
    try {
      rawPayload = JSON.parse(rawBody);
    } catch {
      rawPayload = Object.fromEntries(new URLSearchParams(rawBody).entries());
    }
  }

  // 2) Validation Zod du payload
  const parsed = postbackSchema.safeParse(rawPayload);
  if (!parsed.success) {
    console.warn('[IronFX] invalid payload', parsed.error.flatten());
    return Response.json({ error: 'invalid_payload' }, { status: 400 });
  }
  const payload = parsed.data;

  // 3) Vérifier la signature
  const providedSig =
    payload.sig ?? request.headers.get('x-ironfx-signature');
  if (!providedSig) {
    return Response.json({ error: 'missing_signature' }, { status: 401 });
  }

  const valid = verifyPostbackSignature(rawPayload, providedSig, secret);
  if (!valid) {
    console.warn('[IronFX] invalid postback signature');
    return Response.json({ error: 'invalid_signature' }, { status: 401 });
  }

  // 4) Idempotence — préférer event_id quand fourni, sinon hash du payload
  //    (incluant timestamp si présent). Plus stable que l'ancien fallback
  //    qui utilisait Date.now() (= collision possible entre 2 postbacks
  //    rapprochés avec le même payload sans event_id ni timestamp).
  const eventId =
    payload.event_id ??
    hashFallbackEventId(payload);

  if (await isEventProcessed('ironfx', eventId)) {
    return Response.json({ ok: true, duplicated: true });
  }

  const eventDbId = await recordEvent('ironfx', eventId, payload);

  // 5) Traitement
  try {
    await processIronfxEvent(payload);
    await markEventProcessed(eventDbId);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error('[IronFX] processing error', err);
    await markEventError(eventDbId, errMsg);
    return Response.json({ error: 'processing_failed' }, { status: 500 });
  }

  return Response.json({ ok: true });
}

/**
 * Construit un event_id stable à partir du payload quand IronFX n'en
 * fournit pas. On hash event_type + account_id + timestamp + amount —
 * suffit pour distinguer 99% des doublons légitimes.
 */
function hashFallbackEventId(payload: IronfxPayload): string {
  const parts = [
    payload.event_type,
    payload.account_id,
    payload.timestamp ?? '',
    payload.amount ?? '',
  ];
  return (
    'fb_' +
    crypto.createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 24)
  );
}

function verifyPostbackSignature(
  payload: Record<string, string>,
  providedSig: string,
  secret: string
): boolean {
  // Format présumé : HMAC-SHA256 sur la liste des params triés (sans 'sig')
  const { sig: _sig, ...fields } = payload;
  void _sig;
  const dataString = Object.keys(fields)
    .sort()
    .map((k) => `${k}=${fields[k]}`)
    .join('&');

  const computed = crypto
    .createHmac('sha256', secret)
    .update(dataString)
    .digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(computed, 'hex'),
      Buffer.from(providedSig, 'hex')
    );
  } catch {
    return false;
  }
}

async function processIronfxEvent(payload: IronfxPayload) {
  const eventType = payload.event_type;
  const accountId = payload.account_id;
  // IronAffiliates renvoie le sub_id qu'on a passé dans le lien.
  // On accepte plusieurs noms possibles selon la config du tracking.
  const ref =
    payload.ref ??
    payload.affiliate_ref ??
    payload.sub_id ??
    payload.subid ??
    payload.sub1;

  // Trouver l'application VIP correspondante via le ref
  let application = ref
    ? await db.query.vipApplications.findFirst({
        where: eq(vipApplications.affiliateRef, ref),
      })
    : null;

  // Sinon via le brokerAccountId si déjà lié
  if (!application) {
    application = await db.query.vipApplications.findFirst({
      where: eq(vipApplications.brokerAccountId, accountId),
    });
  }

  if (!application) {
    console.warn(
      `[IronFX] No matching VIP application for ref=${ref}, account=${accountId}`
    );
    return;
  }

  switch (eventType) {
    case 'signup':
      await db
        .update(vipApplications)
        .set({
          brokerAccountId: accountId,
          step: 'signup_validated',
          updatedAt: new Date(),
        })
        .where(eq(vipApplications.id, application.id));
      break;

    case 'deposit':
      await db
        .update(vipApplications)
        .set({
          depositAmount: payload.amount ?? '0',
          depositCurrency: payload.currency ?? 'EUR',
          step: 'deposit_validated',
          updatedAt: new Date(),
        })
        .where(eq(vipApplications.id, application.id));
      break;

    case 'cpa_qualified':
      await db
        .update(vipApplications)
        .set({
          cpaQualified: true,
          cpaQualifiedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(vipApplications.id, application.id));
      break;

    case 'withdrawal':
      // Important : si retrait avant qualification CPA, le CRON déclenchera l'éjection
      await db
        .update(manualIronfxStatus)
        .set({
          hasWithdrawn: true,
          updatedAt: new Date(),
        })
        .where(eq(manualIronfxStatus.accountId, accountId));
      break;

    case 'account_closed':
      await db
        .update(manualIronfxStatus)
        .set({
          accountClosed: true,
          updatedAt: new Date(),
        })
        .where(eq(manualIronfxStatus.accountId, accountId));
      break;
  }
}
