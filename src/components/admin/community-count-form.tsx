'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';
import { adminSetCommunityCountAction } from '@/lib/actions/admin';
import { cn } from '@/lib/utils';

interface Props {
  initial: {
    enabled: boolean;
    value: number;
  };
}

export function CommunityCountForm({ initial }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [enabled, setEnabled] = useState(initial.enabled);
  const [value, setValue] = useState(String(initial.value));

  function submit() {
    const num = Number(value);
    if (!Number.isFinite(num) || num < 0) {
      toast({
        title: 'Valeur invalide',
        description: 'Le compteur doit être un nombre positif.',
        variant: 'destructive',
      });
      return;
    }
    start(async () => {
      const result = await adminSetCommunityCountAction({
        enabled,
        value: Math.floor(num),
      });
      if (result.success) {
        toast({
          title: enabled
            ? `✓ Compteur fixé à ${num.toLocaleString('fr-FR')}`
            : '✓ Override désactivé (retour API Telegram)',
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
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-[var(--radius-md)] bg-[var(--color-surface-tint)] border border-[var(--color-border)] p-3">
        <div className="flex items-center gap-3">
          <Users
            className={cn(
              'h-4 w-4',
              enabled
                ? 'text-emerald-400 light:text-emerald-600'
                : 'text-[var(--color-text-faint)]'
            )}
          />
          <div>
            <div className="text-sm font-medium">
              {enabled ? 'Compteur manuel actif' : 'API Telegram (auto)'}
            </div>
            <div className="text-xs text-[var(--color-text-dim)]">
              {enabled
                ? 'La valeur ci-dessous remplace l\'API Telegram.'
                : "Affiche le count du canal via le bot. Nécessite que le bot soit membre/admin du canal."}
            </div>
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={() => setEnabled((v) => !v)}
          className={cn(
            'relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0',
            enabled
              ? 'bg-emerald-500'
              : 'bg-[var(--color-surface-tint-strong)]'
          )}
        >
          <span
            className={cn(
              'inline-block h-4 w-4 rounded-full bg-white transition-transform',
              enabled ? 'translate-x-6' : 'translate-x-1'
            )}
          />
        </button>
      </div>

      <div>
        <Label htmlFor="cc-value">Nombre de membres affiché</Label>
        <Input
          id="cc-value"
          type="number"
          min={0}
          step={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Ex: 3042"
          disabled={!enabled}
          className="mt-1.5 tabular-nums"
        />
        <p className="mt-1.5 text-[11px] text-[var(--color-text-faint)]">
          Pratique pour les canaux privés &gt;200 membres où Telegram ne permet
          pas d&apos;ajouter le bot comme admin. À mettre à jour manuellement
          au fil du temps.
        </p>
      </div>

      <Button onClick={submit} disabled={pending}>
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        Enregistrer
      </Button>
    </div>
  );
}
