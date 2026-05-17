'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Coins, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';
import { adminSetVipPaidAccessConfigAction } from '@/lib/actions/admin';
import type { VipPaidAccessConfig } from '@/lib/settings/vip-paid-access';

interface Props {
  initial: VipPaidAccessConfig;
}

export function VipPaidAccessConfigForm({ initial }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [enabled, setEnabled] = useState(initial.enabled);
  const [priceEur, setPriceEur] = useState(String(initial.priceEur));

  function submit() {
    start(async () => {
      const parsed = Number(priceEur);
      const result = await adminSetVipPaidAccessConfigAction({
        enabled,
        priceEur: Number.isFinite(parsed) ? Math.floor(parsed) : initial.priceEur,
      });
      if (result.success) {
        toast({
          title: enabled
            ? `✓ Accès direct activé · ${parsed}€`
            : '✓ Accès direct désactivé',
        });
        router.refresh();
      } else {
        toast({
          title: 'Erreur',
          description: result.error,
          variant: 'destructive',
        });
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Toggle */}
      <div className="flex items-center justify-between rounded-[var(--radius-md)] bg-[var(--color-surface-tint)] border border-[var(--color-border)] p-4">
        <div className="flex items-center gap-3">
          <Coins
            className={
              enabled
                ? 'h-5 w-5 text-amber-400 light:text-amber-700'
                : 'h-5 w-5 text-[var(--color-text-faint)]'
            }
          />
          <div>
            <div className="text-sm font-medium">
              {enabled
                ? 'Accès direct activé'
                : 'Accès direct désactivé'}
            </div>
            <div className="text-xs text-[var(--color-text-faint)]">
              {enabled
                ? 'Visible sur /vip — les users peuvent payer directement.'
                : 'Masqué sur /vip — seul le funnel affilié reste accessible.'}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setEnabled((v) => !v)}
          aria-label={
            enabled ? 'Désactiver accès direct' : 'Activer accès direct'
          }
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            enabled
              ? 'bg-emerald-500'
              : 'bg-[var(--color-surface-tint-strong)]'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
              enabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {/* Prix */}
      <div>
        <Label htmlFor="vip-price">Prix de l&apos;accès (EUR)</Label>
        <div className="relative mt-1">
          <Input
            id="vip-price"
            type="number"
            min={10}
            max={10000}
            step={1}
            value={priceEur}
            onChange={(e) => setPriceEur(e.target.value)}
            className="pr-8"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[var(--color-text-faint)]">
            €
          </span>
        </div>
        <p className="mt-1 text-xs text-[var(--color-text-faint)]">
          S&apos;applique aux nouveaux checkouts uniquement. Les paiements
          en cours gardent leur montant figé. Min 10€, max 10 000€.
        </p>
      </div>

      <Button onClick={submit} disabled={pending} className="w-full sm:w-auto">
        {pending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Enregistrement…
          </>
        ) : (
          'Enregistrer'
        )}
      </Button>
    </div>
  );
}
