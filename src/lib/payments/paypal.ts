import type {
  CreatePaymentInput,
  ParsedWebhookEvent,
  PaymentProvider,
  PaymentSession,
  PaymentStatusType,
} from './types';

/**
 * PayPal v2 Orders API.
 * On utilise fetch directement plutôt que le SDK officiel,
 * car celui-ci est legacy (checkout-server-sdk).
 */
export class PayPalProvider implements PaymentProvider {
  readonly name = 'paypal';
  readonly method = 'paypal' as const;

  private baseUrl: string;
  private clientId: string;
  private clientSecret: string;
  private webhookId: string;

  constructor() {
    this.clientId = process.env.PAYPAL_CLIENT_ID ?? '';
    this.clientSecret = process.env.PAYPAL_CLIENT_SECRET ?? '';
    this.webhookId = process.env.PAYPAL_WEBHOOK_ID ?? '';
    this.baseUrl =
      process.env.PAYPAL_ENV === 'live'
        ? 'https://api-m.paypal.com'
        : 'https://api-m.sandbox.paypal.com';

    if (!this.clientId || !this.clientSecret) {
      throw new Error('PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET missing');
    }
  }

  private async getAccessToken(): Promise<string> {
    const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString(
      'base64'
    );
    const res = await fetch(`${this.baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    if (!res.ok) {
      throw new Error(`PayPal auth failed: ${res.status}`);
    }

    const data = (await res.json()) as { access_token: string };
    return data.access_token;
  }

  async createSession(input: CreatePaymentInput): Promise<PaymentSession> {
    const token = await this.getAccessToken();

    const res = await fetch(`${this.baseUrl}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [
          {
            reference_id: input.bookingId,
            amount: {
              currency_code: input.currency,
              value: input.amount.toFixed(2),
            },
            custom_id: input.bookingId,
          },
        ],
        application_context: {
          return_url: input.returnUrl,
          cancel_url: input.cancelUrl,
          brand_name: 'Boursikotons',
          user_action: 'PAY_NOW',
          shipping_preference: 'NO_SHIPPING',
        },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`PayPal order create failed: ${err}`);
    }

    const data = (await res.json()) as {
      id: string;
      links: Array<{ rel: string; href: string }>;
    };

    const approveLink = data.links.find((l) => l.rel === 'approve');
    if (!approveLink) throw new Error('No approve link in PayPal response');

    return {
      sessionId: data.id,
      redirectUrl: approveLink.href,
      expiresAt: new Date(Date.now() + 3 * 60 * 60 * 1000), // 3h
    };
  }

  async verifyWebhookSignature(
    headers: Record<string, string>,
    rawBody: string
  ): Promise<boolean> {
    const token = await this.getAccessToken();

    const verifyRes = await fetch(
      `${this.baseUrl}/v1/notifications/verify-webhook-signature`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          auth_algo: headers['paypal-auth-algo'],
          cert_url: headers['paypal-cert-url'],
          transmission_id: headers['paypal-transmission-id'],
          transmission_sig: headers['paypal-transmission-sig'],
          transmission_time: headers['paypal-transmission-time'],
          webhook_id: this.webhookId,
          webhook_event: JSON.parse(rawBody),
        }),
      }
    );

    if (!verifyRes.ok) return false;
    const data = (await verifyRes.json()) as { verification_status: string };
    return data.verification_status === 'SUCCESS';
  }

  async parseWebhookEvent(rawBody: string): Promise<ParsedWebhookEvent> {
    const event = JSON.parse(rawBody);
    const resource = event.resource;

    let status: PaymentStatusType = 'pending';
    switch (event.event_type) {
      case 'PAYMENT.CAPTURE.COMPLETED':
      case 'CHECKOUT.ORDER.COMPLETED':
        status = 'completed';
        break;
      case 'PAYMENT.CAPTURE.DENIED':
      case 'PAYMENT.CAPTURE.DECLINED':
      case 'CHECKOUT.ORDER.VOIDED':
        status = 'failed';
        break;
      case 'PAYMENT.CAPTURE.REFUNDED':
        status = 'refunded';
        break;
    }

    const amount = resource.amount?.value ?? resource.gross_amount?.value ?? 0;
    const currency =
      resource.amount?.currency_code ?? resource.gross_amount?.currency_code ?? 'EUR';

    return {
      providerEventId: event.id,
      providerSessionId: resource.supplementary_data?.related_ids?.order_id ?? resource.id,
      providerPaymentId: resource.id,
      status,
      amount: Number(amount),
      currency,
      metadata: { customId: resource.custom_id },
    };
  }
}
