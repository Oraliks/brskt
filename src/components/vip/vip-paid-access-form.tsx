'use client';

import { useState, useTransition } from 'react';
import { Bitcoin, CreditCard, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { createPaidVipAccessAction } from '@/lib/actions/vip';
import { cn } from '@/lib/utils';
import type { PaymentMethodType } from '@/lib/payments/types';

const methods: Array<{
  id: PaymentMethodType;
  label: string;
  sub: string;
  icon: React.ElementType;
}> = [
  {
    id: 'card',
    label: 'Carte bancaire',
    sub: 'Paddle (Visa, Mastercard, Amex)',
    icon: CreditCard,
  },
  {
    id: 'paypal',
    label: 'PayPal',
    sub: 'Compte PayPal ou CB via PayPal',
    icon: PayPalIcon,
  },
  {
    id: 'crypto',
    label: 'Crypto',
    sub: 'USDT, USDC, BTC, ETH (NOWPayments)',
    icon: Bitcoin,
  },
];

interface Props {
  /** Pré-remplissage du prénom depuis Telegram si dispo. */
  defaultFirstName: string;
  /** Si true, l'user a déjà une row pending → on lui dit. */
  existingPending: boolean;
}

/**
 * Formulaire de checkout pour l'accès VIP payant.
 * Pas de validation custom côté client — on laisse Zod gérer côté serveur.
 */
export function VipPaidAccessForm({
  defaultFirstName,
  existingPending,
}: Props) {
  const [firstName, setFirstName] = useState(defaultFirstName);
  const [lastName, setLastName] = useState('');
  const [method, setMethod] = useState<PaymentMethodType>('card');
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    start(async () => {
      const res = await createPaidVipAccessAction({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        paymentMethod: method,
      });
      if (!res.success) {
        if (res.fieldErrors) setErrors(res.fieldErrors);
        toast({
          title: 'Impossible de continuer',
          description: res.error,
          variant: 'destructive',
        });
        return;
      }
      // Redirection vers le provider (Paddle/PayPal/NOWPayments)
      window.location.href = res.data.redirectUrl;
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="glass rounded-[var(--radius-lg)] p-6 space-y-5"
    >
      {existingPending && (
        <div className="rounded-md bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-amber-200 inline-flex items-center gap-2">
          <RefreshCw className="h-3.5 w-3.5" />
          Une tentative de paiement est déjà en cours — soumettre relance
          une nouvelle session.
        </div>
      )}

      {/* Identité */}
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label
            htmlFor="firstName"
            className="block text-sm font-medium mb-1"
          >
            Prénom
          </label>
          <input
            id="firstName"
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
            minLength={2}
            maxLength={50}
            placeholder="Jean"
            className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface-tint)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent-hover)]"
          />
          {errors.firstName?.[0] && (
            <p className="mt-1 text-xs text-rose-300">{errors.firstName[0]}</p>
          )}
        </div>
        <div>
          <label htmlFor="lastName" className="block text-sm font-medium mb-1">
            Nom
          </label>
          <input
            id="lastName"
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
            minLength={2}
            maxLength={50}
            placeholder="Dupont"
            className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface-tint)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent-hover)]"
          />
          {errors.lastName?.[0] && (
            <p className="mt-1 text-xs text-rose-300">{errors.lastName[0]}</p>
          )}
        </div>
      </div>

      {/* Méthode de paiement */}
      <div>
        <label className="block text-sm font-medium mb-2">
          Méthode de paiement
        </label>
        <div className="grid gap-2 sm:grid-cols-3">
          {methods.map((m) => {
            const isActive = method === m.id;
            const Icon = m.icon;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setMethod(m.id)}
                className={cn(
                  'flex flex-col items-start gap-1 rounded-md border p-3 text-left transition-colors',
                  isActive
                    ? 'border-[var(--color-accent-hover)] bg-[var(--color-accent)]/10'
                    : 'border-[var(--color-border)] hover:bg-[var(--color-surface-tint)]'
                )}
              >
                <Icon className="h-4 w-4 text-[var(--color-accent-hover)]" />
                <span className="text-sm font-medium">{m.label}</span>
                <span className="text-[10px] text-[var(--color-text-faint)]">
                  {m.sub}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <Button
        type="submit"
        size="lg"
        disabled={pending}
        className="w-full gap-2"
      >
        {pending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Redirection vers le paiement…
          </>
        ) : (
          'Payer et rejoindre le VIP'
        )}
      </Button>

      <p className="text-[10px] text-[var(--color-text-faint)] text-center">
        Tu seras redirigé vers la page de paiement sécurisée du provider.
        Une fois validé, le bot t&apos;envoie ton lien d&apos;invitation
        Telegram automatiquement.
      </p>
    </form>
  );
}

function PayPalIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797h-2.19c-.524 0-.968.382-1.05.9l-1.12 7.106zm14.146-14.42a3.35 3.35 0 0 0-.607-.541c-.013.076-.026.175-.041.254-.93 4.778-4.005 7.201-9.138 7.201h-2.19a.563.563 0 0 0-.556.479l-1.187 7.527h-.506l-.24 1.516a.56.56 0 0 0 .554.647h3.882c.46 0 .85-.334.922-.788.06-.26 1.187-7.524 1.21-7.667a.926.926 0 0 1 .922-.788h.58c3.76 0 6.705-1.528 7.565-5.946.36-1.847.174-3.388-.777-4.471z" />
    </svg>
  );
}
