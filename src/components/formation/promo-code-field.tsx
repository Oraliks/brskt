'use client';

import { useState, useTransition } from 'react';
import { Check, Loader2, Tag, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';
import { validatePromoForBookingAction } from '@/lib/actions/promos';

/**
 * Champ "Code promo" du BookingForm.
 *
 * Particularité : on n'a pas encore le booking au moment du fill du form,
 * donc on ne peut pas valider via `validatePromoForBookingAction` (qui
 * exige un bookingId). On valide en local côté UI (uppercase + non-vide)
 * et on délègue la vraie validation au server au submit du booking.
 *
 * UX : champ collapsible. Replié par défaut, déployé si l'user clique
 * "J'ai un code promo".
 */

interface Props {
  /** Code courant (controlled). */
  value: string;
  /** Setter — passe la valeur au parent BookingForm. */
  onChange: (code: string) => void;
  /** ID du booking si on est en post-création (page checkout) — permet
   *  la validation server immédiate avec preview du discount. */
  bookingIdForValidation?: string;
  /** Callback optionnel quand la validation server confirme un code. */
  onValidated?: (info: {
    code: string;
    discountEur: number;
    totalAfterEur: number;
  }) => void;
}

export function PromoCodeField({
  value,
  onChange,
  bookingIdForValidation,
  onValidated,
}: Props) {
  const [open, setOpen] = useState(!!value);
  const [pending, start] = useTransition();
  const [validated, setValidated] = useState<{
    code: string;
    discountEur: number;
    totalAfterEur: number;
  } | null>(null);

  function reset() {
    onChange('');
    setValidated(null);
  }

  function tryValidate() {
    if (!value.trim() || !bookingIdForValidation) return;
    start(async () => {
      const result = await validatePromoForBookingAction({
        bookingId: bookingIdForValidation,
        code: value.trim(),
      });
      if (result.success) {
        setValidated(result.data);
        onValidated?.(result.data);
        toast({
          title: `✓ Code ${result.data.code} appliqué`,
          description: `-${result.data.discountEur}€`,
        });
      } else {
        setValidated(null);
        toast({
          title: 'Code refusé',
          description: result.error,
          variant: 'destructive',
        });
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-xs text-[var(--color-text-dim)] hover:text-[var(--color-text)] transition-colors underline underline-offset-2"
      >
        <Tag className="h-3 w-3" />
        J&apos;ai un code promo
      </button>
    );
  }

  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-tint)] p-3 space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor="promo" className="text-xs">
          <Tag className="inline-block h-3 w-3 mr-1" />
          Code promo
        </Label>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            reset();
          }}
          className="text-[10px] text-[var(--color-text-faint)] hover:text-[var(--color-text-dim)]"
        >
          masquer
        </button>
      </div>
      <div className="flex gap-2">
        <Input
          id="promo"
          value={value}
          onChange={(e) => {
            onChange(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''));
            setValidated(null);
          }}
          placeholder="EX: WELCOME10"
          maxLength={40}
          className="font-mono uppercase flex-1"
        />
        {bookingIdForValidation && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={tryValidate}
            disabled={pending || !value.trim()}
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            Vérifier
          </Button>
        )}
      </div>
      {validated && (
        <div className="rounded-[var(--radius-sm)] bg-emerald-500/10 border border-emerald-500/30 px-3 py-2 text-xs flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-emerald-200 light:text-emerald-700">
            <Check className="h-3 w-3" />
            <strong>{validated.code}</strong> appliqué
          </span>
          <span className="font-mono tabular-nums">
            <span className="text-[var(--color-text-dim)]">-</span>
            {validated.discountEur}€
            <button
              type="button"
              onClick={reset}
              className="ml-2 text-[var(--color-text-faint)] hover:text-rose-400"
              aria-label="Retirer le code"
            >
              <X className="h-3 w-3 inline" />
            </button>
          </span>
        </div>
      )}
      {!bookingIdForValidation && !validated && (
        <p className="text-[10px] text-[var(--color-text-faint)]">
          Le code sera vérifié et appliqué automatiquement au moment de
          finaliser la réservation.
        </p>
      )}
    </div>
  );
}
