import { handlePaymentWebhook } from '@/lib/payments/handle-webhook';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  return handlePaymentWebhook('paypal', request);
}
