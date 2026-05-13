import crypto from 'node:crypto';
import { eq } from 'drizzle-orm';
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
 * On supporte les deux ici, à adapter selon la doc qu'on te donnera.
 */
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
  let payload: Record<string, string>;
  let rawBody = '';

  if (request.method === 'GET') {
    payload = Object.fromEntries(url.searchParams.entries());
  } else {
    rawBody = await request.text();
    try {
      payload = JSON.parse(rawBody);
    } catch {
      // Try urlencoded
      payload = Object.fromEntries(new URLSearchParams(rawBody).entries());
    }
  }

  // 2) Vérifier la signature
  const providedSig = payload.sig ?? request.headers.get('x-ironfx-signature');
  if (!providedSig) {
    return Response.json({ error: 'missing_signature' }, { status: 401 });
  }

  const valid = verifyPostbackSignature(payload, providedSig, secret);
  if (!valid) {
    console.warn('[IronFX] invalid postback signature');
    return Response.json({ error: 'invalid_signature' }, { status: 401 });
  }

  // 3) Idempotence
  const eventId =
    payload.event_id ??
    `${payload.event_type}_${payload.account_id}_${payload.timestamp ?? Date.now()}`;

  if (await isEventProcessed('ironfx', eventId)) {
    return Response.json({ ok: true, duplicated: true });
  }

  const eventDbId = await recordEvent('ironfx', eventId, payload);

  // 4) Traitement
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

function verifyPostbackSignature(
  payload: Record<string, string>,
  providedSig: string,
  secret: string
): boolean {
  // Format présumé : HMAC-SHA256 sur la liste des params triés (sans 'sig')
  const { sig, ...fields } = payload;
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

async function processIronfxEvent(payload: Record<string, string>) {
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

  if (!accountId) {
    throw new Error('Missing account_id in postback');
  }

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
    console.warn(`[IronFX] No matching VIP application for ref=${ref}, account=${accountId}`);
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

    default:
      console.warn(`[IronFX] Unknown event_type: ${eventType}`);
  }
}
