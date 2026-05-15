'use client';

import { useEffect, useState, useTransition } from 'react';
import {
  Bitcoin,
  CreditCard,
  Loader2,
  MapPin,
  Plus,
  Trash2,
  Wifi,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';
import { createBookingAction } from '@/lib/actions/bookings';
import { PaymentDisclaimer } from '@/components/formation/payment-disclaimer';
import { PromoCodeField } from '@/components/formation/promo-code-field';
import { formatPrice, cn } from '@/lib/utils';
import type { Formation } from '@/lib/db/schema';
import type { PaymentMethodType } from '@/lib/payments/types';

type PaymentPlan = 'full' | 'installments_3x';

interface BookingFormProps {
  formations: Formation[];
  defaultMode?: string;
  /** Slot statique rendu juste après l'étape 2 (créneaux). Toujours un
   *  ReactNode sérialisable (pas une fonction) pour éviter les soucis de
   *  cross-boundary Server→Client. */
  slotAfterDates?: React.ReactNode;
  /** Callback notifié quand la formation sélectionnée change. Permet à un
   *  wrapper client de partager ce state avec d'autres composants (ex.
   *  waitlist qui doit connaître le mode). */
  onModeChange?: (mode: 'remote' | 'onsite' | null) => void;
}

type Slot = { start: string; end: string };

const PAYMENT_METHODS: Array<{
  id: PaymentMethodType;
  label: string;
  sub: string;
  icon: React.ElementType;
}> = [
  { id: 'card', label: 'Carte bancaire', sub: 'Visa, Mastercard via Paddle', icon: CreditCard },
  { id: 'paypal', label: 'PayPal', sub: 'Compte PayPal ou carte', icon: PayPalIcon },
  { id: 'crypto', label: 'Crypto', sub: 'USDT, USDC, BTC, ETH', icon: Bitcoin },
];

export function BookingForm({
  formations,
  defaultMode,
  slotAfterDates,
  onModeChange,
}: BookingFormProps) {
  const [isPending, startTransition] = useTransition();

  const initialFormation =
    formations.find(
      (f) =>
        (defaultMode === 'remote' && f.mode === 'remote') ||
        (defaultMode === 'onsite' && f.mode === 'onsite') ||
        defaultMode === f.slug
    ) ?? formations[0];

  const [formationId, setFormationId] = useState<string | undefined>(
    initialFormation?.id
  );
  const [slots, setSlots] = useState<Slot[]>([{ start: '', end: '' }]);
  const [asap, setAsap] = useState(false);
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>('card');
  const [paymentPlan, setPaymentPlan] = useState<PaymentPlan>('full');
  const [promoCode, setPromoCode] = useState('');

  const selected = formations.find((f) => f.id === formationId);
  const fullPrice = selected ? Number(selected.priceEur) : 0;

  // Notifie le parent (Client wrapper) du mode courant pour qu'il puisse
  // brancher d'autres composants dépendants (ex. waitlist).
  useEffect(() => {
    if (!onModeChange) return;
    const m =
      selected?.mode === 'remote' || selected?.mode === 'onsite'
        ? selected.mode
        : null;
    onModeChange(m);
  }, [selected?.mode, onModeChange]);
  const installments = paymentPlan === 'installments_3x' ? 3 : 1;
  const firstAmount =
    installments === 1
      ? fullPrice
      : Math.round((fullPrice / installments) * 100) / 100;

  function addSlot() {
    if (slots.length >= 3) return;
    setSlots((s) => [...s, { start: '', end: '' }]);
  }

  function removeSlot(idx: number) {
    setSlots((s) => s.filter((_, i) => i !== idx));
  }

  function updateSlot(idx: number, field: 'start' | 'end', value: string) {
    setSlots((s) =>
      s.map((slot, i) => (i === idx ? { ...slot, [field]: value } : slot))
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formationId) {
      toast({ title: 'Choisis une formation', variant: 'destructive' });
      return;
    }

    const validSlots = slots.filter((s) => s.start && s.end);

    if (validSlots.length === 0 && !asap) {
      toast({
        title: 'Propose au moins un créneau',
        description: 'Ou coche "Dès que possible".',
        variant: 'destructive',
      });
      return;
    }

    startTransition(async () => {
      const result = await createBookingAction({
        formationId,
        preferredDates: validSlots,
        preferredAsap: asap,
        paymentMethod,
        paymentPlan,
        promoCode: promoCode.trim() || undefined,
      });

      if (result.success) {
        toast({
          title: 'Redirection vers le paiement…',
        });
        window.location.href = result.data.redirectUrl;
      } else {
        toast({
          title: 'Erreur',
          description: result.error,
          variant: 'destructive',
        });
      }
    });
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* 1. Choix formation */}
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium mb-3 block">
          1. Format
        </legend>
        <div className="grid sm:grid-cols-2 gap-3">
          {formations.map((f) => (
            <label
              key={f.id}
              className={cn(
                'glass rounded-[var(--radius-lg)] p-5 cursor-pointer transition-all hover:border-[var(--color-border-strong)]',
                formationId === f.id &&
                  'border-[var(--color-accent)] bg-[var(--color-accent)]/5'
              )}
            >
              <input
                type="radio"
                name="formation"
                value={f.id}
                checked={formationId === f.id}
                onChange={() => setFormationId(f.id)}
                className="sr-only"
              />
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Badge variant={f.mode === 'onsite' ? 'gold' : 'default'}>
                    {f.mode === 'onsite' ? (
                      <MapPin className="h-3 w-3 mr-1" />
                    ) : (
                      <Wifi className="h-3 w-3 mr-1" />
                    )}
                    {f.mode === 'onsite' ? 'Dubaï' : 'Distance'}
                  </Badge>
                  <h3 className="mt-3 font-semibold text-sm">{f.title}</h3>
                </div>
                <div className="text-right">
                  <div className="font-serif text-2xl text-gradient">
                    {formatPrice(Number(f.priceEur))}
                  </div>
                </div>
              </div>
            </label>
          ))}
        </div>
      </fieldset>

      {/* 2. Créneaux préférés */}
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium mb-1 block">
          2. Tes créneaux préférés
        </legend>
        <p className="text-xs text-[var(--color-text-dim)] mb-4">
          Propose jusqu'à 3 plages de dates. On validera l'une d'elles ou on
          te proposera une alternative — que tu pourras accepter ou refuser.
        </p>

        <div className="space-y-3">
          {slots.map((slot, idx) => (
            <div
              key={idx}
              className="glass rounded-[var(--radius-md)] p-4 grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3 items-end"
            >
              <div className="space-y-1.5">
                <Label htmlFor={`start-${idx}`} className="text-xs">Début</Label>
                <Input
                  id={`start-${idx}`}
                  type="date"
                  min={today}
                  value={slot.start}
                  onChange={(e) => updateSlot(idx, 'start', e.target.value)}
                  disabled={asap}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`end-${idx}`} className="text-xs">Fin</Label>
                <Input
                  id={`end-${idx}`}
                  type="date"
                  min={slot.start || today}
                  value={slot.end}
                  onChange={(e) => updateSlot(idx, 'end', e.target.value)}
                  disabled={asap}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeSlot(idx)}
                disabled={slots.length === 1 || asap}
                className="text-[var(--color-text-dim)]"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}

          {slots.length < 3 && !asap && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={addSlot}
              className="text-[var(--color-text-dim)]"
            >
              <Plus className="h-4 w-4" />
              Ajouter un créneau
            </Button>
          )}
        </div>

        <div className="pt-3 border-t border-[var(--color-border)]">
          <Checkbox
            label={
              <span>
                <strong>Dès que possible</strong> · ouvert à toute date proposée
                par l'équipe
              </span>
            }
            checked={asap}
            onChange={(e) => setAsap(e.target.checked)}
          />
        </div>
      </fieldset>

      {slotAfterDates}

      {/* 3. Notes */}
      <div className="space-y-2">
        <Label htmlFor="notes" className="text-sm font-medium">
          3. Note pour l'équipe <span className="text-[var(--color-text-faint)]">(optionnel)</span>
        </Label>
        <Textarea
          id="notes"
          rows={3}
          placeholder="Niveau actuel, attentes, contraintes…"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      {/* 4. Mode de paiement */}
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium mb-1 block">
          4. Mode de paiement
        </legend>
        <p className="text-xs text-[var(--color-text-dim)] mb-4">
          Tu paies maintenant pour bloquer ta place. La date sera ensuite
          validée par l'équipe sous 24h. Si aucune date ne convient à l'équipe
          ET que tu refuses la contre-proposition, on annule la réservation
          (cas exceptionnel — voir conditions ci-dessous).
        </p>
        <div className="grid gap-2">
          {PAYMENT_METHODS.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setPaymentMethod(m.id)}
              className={cn(
                'w-full glass rounded-[var(--radius-md)] p-3 flex items-center gap-3 text-left transition-all',
                paymentMethod === m.id
                  ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/5'
                  : 'hover:border-[var(--color-border-strong)]'
              )}
            >
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-[var(--color-surface-tint)] border border-[var(--color-border)] flex-shrink-0">
                <m.icon className="h-4 w-4" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">{m.label}</div>
                <div className="text-xs text-[var(--color-text-dim)] mt-0.5">{m.sub}</div>
              </div>
              <span
                className={cn(
                  'h-4 w-4 rounded-full border-2 flex items-center justify-center flex-shrink-0',
                  paymentMethod === m.id
                    ? 'border-[var(--color-accent)] bg-[var(--color-accent)]'
                    : 'border-[var(--color-border-strong)]'
                )}
              >
                {paymentMethod === m.id && (
                  <span className="h-1.5 w-1.5 rounded-full bg-white" />
                )}
              </span>
            </button>
          ))}
        </div>
      </fieldset>

      {/* 5. Plan de paiement (1× ou 3×) */}
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium mb-1 block">
          5. Plan de paiement
        </legend>
        <p className="text-xs text-[var(--color-text-dim)] mb-4">
          Le paiement en 3 fois sans frais est notre flexibilité. La formation
          n'aura lieu qu'<strong>après réception de la totalité du paiement</strong>.
        </p>
        <div className="grid sm:grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setPaymentPlan('full')}
            className={cn(
              'glass rounded-[var(--radius-md)] p-4 text-left transition-all',
              paymentPlan === 'full'
                ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/5'
                : 'hover:border-[var(--color-border-strong)]'
            )}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium">Paiement en 1 fois</span>
              <span
                className={cn(
                  'h-4 w-4 rounded-full border-2 flex items-center justify-center',
                  paymentPlan === 'full'
                    ? 'border-[var(--color-accent)] bg-[var(--color-accent)]'
                    : 'border-[var(--color-border-strong)]'
                )}
              >
                {paymentPlan === 'full' && (
                  <span className="h-1.5 w-1.5 rounded-full bg-white" />
                )}
              </span>
            </div>
            <div className="text-xs text-[var(--color-text-dim)]">
              {selected ? formatPrice(fullPrice) : '—'} maintenant
            </div>
          </button>
          <button
            type="button"
            onClick={() => setPaymentPlan('installments_3x')}
            className={cn(
              'glass rounded-[var(--radius-md)] p-4 text-left transition-all',
              paymentPlan === 'installments_3x'
                ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/5'
                : 'hover:border-[var(--color-border-strong)]'
            )}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium">
                3 fois sans frais
                <Badge variant="success" className="ml-2 align-middle">
                  Flexible
                </Badge>
              </span>
              <span
                className={cn(
                  'h-4 w-4 rounded-full border-2 flex items-center justify-center',
                  paymentPlan === 'installments_3x'
                    ? 'border-[var(--color-accent)] bg-[var(--color-accent)]'
                    : 'border-[var(--color-border-strong)]'
                )}
              >
                {paymentPlan === 'installments_3x' && (
                  <span className="h-1.5 w-1.5 rounded-full bg-white" />
                )}
              </span>
            </div>
            <div className="text-xs text-[var(--color-text-dim)]">
              3 × {selected ? formatPrice(firstAmount) : '—'} · formation après
              la 3<sup>e</sup>
            </div>
          </button>
        </div>
      </fieldset>

      {/* Code promo (collapsible) */}
      {selected && (
        <PromoCodeField value={promoCode} onChange={setPromoCode} />
      )}

      {/* Disclaimer no-refund + conditions */}
      <PaymentDisclaimer variant="full" tone="amber" />

      {/* Récap */}
      {selected && (
        <div className="glass-strong rounded-[var(--radius-lg)] p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="text-xs text-[var(--color-text-dim)] uppercase tracking-wider">
              {paymentPlan === 'installments_3x'
                ? '1ʳᵉ échéance (sur 3) à payer maintenant'
                : 'À payer maintenant'}
            </div>
            <div className="font-serif text-3xl text-gradient mt-1">
              {formatPrice(firstAmount)}
            </div>
            {paymentPlan === 'installments_3x' && (
              <p className="text-xs text-[var(--color-text-dim)] mt-1">
                Échéances 2 et 3 réglables depuis ton dashboard. Total :{' '}
                <strong className="text-[var(--color-text)]">{formatPrice(fullPrice)}</strong>.
              </p>
            )}
          </div>
          <Button type="submit" size="lg" disabled={isPending}>
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {isPending
              ? 'Préparation…'
              : paymentPlan === 'installments_3x'
              ? 'Payer 1ʳᵉ échéance'
              : 'Payer et réserver'}
          </Button>
        </div>
      )}
    </form>
  );
}

function PayPalIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797h-2.19c-.524 0-.968.382-1.05.9l-1.12 7.106z" />
    </svg>
  );
}
