'use client';

import { useState, useTransition } from 'react';
import { Bitcoin, CreditCard, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { createPaymentAction } from '@/lib/actions/payments';
import type { PaymentMethodType } from '@/lib/payments/types';
import { cn, formatPrice } from '@/lib/utils';

interface CheckoutFormProps {
  bookingId: string;
  amount: number;
}

const methods: Array<{
  id: PaymentMethodType;
  label: string;
  sub: string;
  icon: React.ElementType;
}> = [
  {
    id: 'card',
    label: 'Carte bancaire',
    sub: 'Paiement sécurisé via Paddle',
    icon: CreditCard,
  },
  {
    id: 'paypal',
    label: 'PayPal',
    sub: 'Compte PayPal ou carte via PayPal',
    icon: PayPalIcon,
  },
  {
    id: 'crypto',
    label: 'Crypto',
    sub: 'USDT, USDC, BTC, ETH via NOWPayments',
    icon: Bitcoin,
  },
];

export function CheckoutForm({ bookingId, amount }: CheckoutFormProps) {
  const [pending, start] = useTransition();
  const [selected, setSelected] = useState<PaymentMethodType>('card');

  function handlePay() {
    start(async () => {
      const result = await createPaymentAction({
        bookingId,
        method: selected,
      });
      if (result.success) {
        window.location.href = result.data.redirectUrl;
      } else {
        toast({
          title: 'Paiement impossible',
          description: result.error,
          variant: 'destructive',
        });
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <label className="text-sm font-medium block">Mode de paiement</label>
        {methods.map((m) => (
          <button
            key={m.id}
            onClick={() => setSelected(m.id)}
            type="button"
            className={cn(
              'w-full glass rounded-[var(--radius-md)] p-4 flex items-center gap-4 text-left transition-all',
              selected === m.id
                ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/5'
                : 'hover:border-white/14'
            )}
          >
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-white/5 border border-[var(--color-border)] flex-shrink-0">
              <m.icon className="h-4 w-4" />
            </span>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm">{m.label}</div>
              <div className="text-xs text-[var(--color-text-dim)] mt-0.5">
                {m.sub}
              </div>
            </div>
            <span
              className={cn(
                'h-4 w-4 rounded-full border-2 flex items-center justify-center',
                selected === m.id
                  ? 'border-[var(--color-accent)] bg-[var(--color-accent)]'
                  : 'border-[var(--color-border-strong)]'
              )}
            >
              {selected === m.id && (
                <span className="h-1.5 w-1.5 rounded-full bg-white" />
              )}
            </span>
          </button>
        ))}
      </div>

      <Button
        size="lg"
        variant="glow"
        className="w-full"
        onClick={handlePay}
        disabled={pending}
      >
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        {pending ? 'Initialisation…' : `Payer ${formatPrice(amount)}`}
      </Button>

      <p className="text-xs text-[var(--color-text-faint)] text-center">
        Tu seras redirigé vers la plateforme de paiement. La réservation reste
        active tant que le paiement n'est pas confirmé.
      </p>
    </div>
  );
}

function PayPalIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797h-2.19c-.524 0-.968.382-1.05.9l-1.12 7.106zm14.146-14.42a3.35 3.35 0 0 0-.607-.541c-.013.076-.026.175-.041.254-.93 4.778-4.005 7.201-9.138 7.201h-2.19a.563.563 0 0 0-.556.479l-1.187 7.527h-.506l-.24 1.516a.56.56 0 0 0 .554.647h3.882c.46 0 .85-.334.922-.788.06-.26.766-4.854.85-5.337a.932.932 0 0 1 .923-.788h.58c3.76 0 6.705-1.528 7.565-5.946.36-1.847.174-3.388-.811-4.224z" />
    </svg>
  );
}
