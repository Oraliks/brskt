import crypto from 'node:crypto';
import type {
  CreatePaymentInput,
  ParsedWebhookEvent,
  PaymentProvider,
  PaymentSession,
  PaymentStatusType,
} from './types';

const NOWPAYMENTS_API = 'https://api.nowpayments.io/v1';

interface NowPaymentsInvoice {
  id: string;
  order_id: string;
  invoice_url: string;
  price_amount: number;
  price_currency: string;
  pay_currency: string | null;
  created_at: string;
  expiration_estimate_date?: string;
}

interface NowPaymentsIPN {
  payment_id: string;
  payment_status: string;
  pay_address: string;
  price_amount: number;
  price_currency: string;
  pay_amount: number;
  pay_currency: string;
  order_id: string;
  order_description?: string;
  ipn_callback_url?: string;
  purchase_id?: string;
  amount_received?: number;
  payout_extra_id?: string | null;
}

export class NowPaymentsProvider implements PaymentProvider {
  readonly name = 'nowpayments';
  readonly method = 'crypto' as const;

  private apiKey: string;
  private ipnSecret: string;

  constructor() {
    this.apiKey = process.env.NOWPAYMENTS_API_KEY ?? '';
    this.ipnSecret = process.env.NOWPAYMENTS_IPN_SECRET ?? '';

    if (!this.apiKey || !this.ipnSecret) {
      throw new Error('NOWPAYMENTS_API_KEY / NOWPAYMENTS_IPN_SECRET missing');
    }
  }

  async createSession(input: CreatePaymentInput): Promise<PaymentSession> {
    // On crée une "invoice" : NOWPayments hébergera la page de paiement
    // L'utilisateur choisit sa crypto sur leur UI
    const res = await fetch(`${NOWPAYMENTS_API}/invoice`, {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        price_amount: input.amount,
        price_currency: input.currency.toLowerCase(),
        order_id: input.bookingId,
        order_description: `Boursikotons — Booking ${input.bookingId}`,
        ipn_callback_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/nowpayments`,
        success_url: input.returnUrl,
        cancel_url: input.cancelUrl,
        is_fee_paid_by_user: false,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`NOWPayments invoice failed: ${err}`);
    }

    const invoice = (await res.json()) as NowPaymentsInvoice;

    return {
      sessionId: invoice.id,
      redirectUrl: invoice.invoice_url,
      expiresAt: invoice.expiration_estimate_date
        ? new Date(invoice.expiration_estimate_date)
        : new Date(Date.now() + 60 * 60 * 1000),
    };
  }

  async verifyWebhookSignature(
    headers: Record<string, string>,
    rawBody: string
  ): Promise<boolean> {
    const signature = headers['x-nowpayments-sig'];
    if (!signature) return false;

    // NOWPayments signe avec HMAC-SHA512 sur le body trié alphabétiquement
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      return false;
    }

    const sorted = this.sortObjectKeys(parsed);
    const sortedStr = JSON.stringify(sorted);

    const hmac = crypto.createHmac('sha512', this.ipnSecret);
    hmac.update(sortedStr);
    const computed = hmac.digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(computed),
      Buffer.from(signature)
    );
  }

  async parseWebhookEvent(rawBody: string): Promise<ParsedWebhookEvent> {
    const event = JSON.parse(rawBody) as NowPaymentsIPN;

    let status: PaymentStatusType = 'pending';
    switch (event.payment_status) {
      case 'finished':
      case 'confirmed':
        status = 'completed';
        break;
      case 'failed':
      case 'expired':
        status = 'failed';
        break;
      case 'refunded':
        status = 'refunded';
        break;
      default:
        // 'waiting', 'confirming', 'sending', 'partially_paid'
        status = 'pending';
    }

    return {
      // Pour l'idempotence on combine payment_id + status car NOWPayments
      // envoie plusieurs IPNs pour le même paiement (waiting → confirming → finished)
      providerEventId: `${event.payment_id}_${event.payment_status}`,
      providerSessionId: event.order_id,
      providerPaymentId: String(event.payment_id),
      status,
      amount: event.price_amount,
      currency: event.price_currency.toUpperCase(),
      metadata: {
        payCurrency: event.pay_currency,
        payAmount: event.pay_amount,
        payAddress: event.pay_address,
      },
    };
  }

  private sortObjectKeys(obj: unknown): unknown {
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map((v) => this.sortObjectKeys(v));

    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(obj).sort()) {
      sorted[key] = this.sortObjectKeys((obj as Record<string, unknown>)[key]);
    }
    return sorted;
  }
}
