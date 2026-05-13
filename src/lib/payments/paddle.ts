import { Environment, Paddle } from '@paddle/paddle-node-sdk';
import type {
  CreatePaymentInput,
  ParsedWebhookEvent,
  PaymentProvider,
  PaymentSession,
  PaymentStatusType,
} from './types';

export class PaddleProvider implements PaymentProvider {
  readonly name = 'paddle';
  readonly method = 'card' as const;

  private client: Paddle;

  constructor() {
    const apiKey = process.env.PADDLE_API_KEY;
    if (!apiKey) throw new Error('PADDLE_API_KEY missing');

    this.client = new Paddle(apiKey, {
      environment:
        process.env.PADDLE_ENV === 'production'
          ? Environment.production
          : Environment.sandbox,
    });
  }

  async createSession(input: CreatePaymentInput): Promise<PaymentSession> {
    // Avec Paddle Billing on crée une transaction puis on retourne l'ID
    // Le client utilise Paddle.js pour ouvrir l'overlay checkout
    const formationMode = input.metadata.formationMode as
      | 'remote'
      | 'onsite'
      | undefined;
    const productId =
      formationMode === 'onsite'
        ? process.env.PADDLE_PRODUCT_ID_ONSITE!
        : process.env.PADDLE_PRODUCT_ID_REMOTE!;

    const transaction = await this.client.transactions.create({
      items: [{ priceId: productId, quantity: 1 }],
      customData: {
        userId: input.userId,
        bookingId: input.bookingId,
        ...input.metadata,
      },
      checkout: {
        url: input.returnUrl,
      },
    });

    return {
      sessionId: transaction.id,
      redirectUrl: transaction.checkout?.url ?? input.returnUrl,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    };
  }

  async verifyWebhookSignature(
    headers: Record<string, string>,
    rawBody: string
  ): Promise<boolean> {
    const signature = headers['paddle-signature'];
    const secret = process.env.PADDLE_WEBHOOK_SECRET;

    if (!signature || !secret) return false;

    try {
      // Paddle SDK fournit la vérification
      this.client.webhooks.unmarshal(rawBody, secret, signature);
      return true;
    } catch {
      return false;
    }
  }

  async parseWebhookEvent(rawBody: string): Promise<ParsedWebhookEvent> {
    const event = JSON.parse(rawBody);

    const transactionData = event.data;

    let status: PaymentStatusType = 'pending';
    switch (event.event_type) {
      case 'transaction.completed':
      case 'transaction.paid':
        status = 'completed';
        break;
      case 'transaction.canceled':
        status = 'failed';
        break;
      case 'transaction.payment_failed':
        status = 'failed';
        break;
      default:
        status = 'pending';
    }

    return {
      providerEventId: event.event_id ?? event.notification_id ?? transactionData.id,
      providerSessionId: transactionData.id,
      providerPaymentId: transactionData.id,
      status,
      amount: Number(transactionData.details?.totals?.total ?? 0) / 100,
      currency: transactionData.currency_code ?? 'EUR',
      metadata: transactionData.custom_data,
    };
  }
}
