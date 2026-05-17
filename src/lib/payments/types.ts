export type PaymentMethodType = 'card' | 'paypal' | 'crypto';

export type PaymentStatusType = 'pending' | 'completed' | 'failed' | 'refunded';

export interface PaymentSession {
  sessionId: string;
  /** URL de redirection (carte, PayPal) */
  redirectUrl?: string;
  /** Adresse crypto (NOWPayments) */
  cryptoAddress?: string;
  /** QR code URL pour crypto */
  qrCodeUrl?: string;
  /** Devise crypto reçue (BTC, USDT, etc.) */
  cryptoCurrency?: string;
  /** Montant à envoyer en crypto */
  cryptoAmount?: number;
  expiresAt: Date;
}

export interface CreatePaymentInput {
  userId: string;
  /** ID du booking si paiement de formation. Absent pour les paiements
   *  hors-formation (ex: accès VIP payant direct). */
  bookingId?: string;
  amount: number; // EUR
  currency: 'EUR';
  metadata: Record<string, unknown>;
  /** URL de retour après paiement (carte, PayPal) */
  returnUrl: string;
  cancelUrl: string;
}

export interface ParsedWebhookEvent {
  /** ID unique de l'event chez le provider (pour idempotence) */
  providerEventId: string;
  /** ID de la session/payment créée précédemment */
  providerSessionId: string;
  /** ID du paiement final */
  providerPaymentId?: string;
  status: PaymentStatusType;
  amount: number;
  currency: string;
  /** Métadonnées qu'on a envoyées lors de la création */
  metadata?: Record<string, unknown>;
}

export interface PaymentProvider {
  readonly name: string;
  readonly method: PaymentMethodType;

  createSession(input: CreatePaymentInput): Promise<PaymentSession>;

  /**
   * Vérifie la signature du webhook.
   * @param headers Headers de la requête entrante
   * @param rawBody Le body brut (string) — IMPORTANT: pas le JSON parsé
   */
  verifyWebhookSignature(
    headers: Record<string, string>,
    rawBody: string
  ): Promise<boolean>;

  parseWebhookEvent(rawBody: string): Promise<ParsedWebhookEvent>;
}
