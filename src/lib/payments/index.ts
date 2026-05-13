import { NowPaymentsProvider } from './nowpayments';
import { PaddleProvider } from './paddle';
import { PayPalProvider } from './paypal';
import type { PaymentMethodType, PaymentProvider } from './types';

// Lazy init pour éviter de crash si une variable d'env manque
// au moment de l'import (utile pour les tests / build)
let cache: Partial<Record<PaymentMethodType, PaymentProvider>> = {};

export function getPaymentProvider(
  method: PaymentMethodType
): PaymentProvider {
  if (cache[method]) return cache[method]!;

  switch (method) {
    case 'card':
      cache.card = new PaddleProvider();
      return cache.card;
    case 'paypal':
      cache.paypal = new PayPalProvider();
      return cache.paypal;
    case 'crypto':
      cache.crypto = new NowPaymentsProvider();
      return cache.crypto;
    default:
      throw new Error(`Unknown payment method: ${method satisfies never}`);
  }
}

export function getProviderByName(name: string): PaymentProvider | null {
  switch (name) {
    case 'paddle':
      return getPaymentProvider('card');
    case 'paypal':
      return getPaymentProvider('paypal');
    case 'nowpayments':
      return getPaymentProvider('crypto');
    default:
      return null;
  }
}

export * from './types';
