'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Gift, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';
import { adminSetWelcomeBonusAction } from '@/lib/actions/admin';
import type { WelcomeBonus } from '@/lib/settings/welcome-bonus';

interface Props {
  initial: WelcomeBonus;
}

export function WelcomeBonusForm({ initial }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [enabled, setEnabled] = useState(initial.enabled);
  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description);
  const [fineprint, setFineprint] = useState(initial.fineprint ?? '');

  function submit() {
    start(async () => {
      const result = await adminSetWelcomeBonusAction({
        enabled,
        title,
        description,
        fineprint: fineprint.trim() || undefined,
      });
      if (result.success) {
        toast({
          title: enabled
            ? '✓ Welcome bonus activé'
            : '✓ Welcome bonus désactivé',
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
      <div className="flex items-center justify-between rounded-[var(--radius-md)] bg-[var(--color-surface-tint)] border border-[var(--color-border)] p-4">
        <div className="flex items-center gap-3">
          <Gift
            className={
              enabled
                ? 'h-5 w-5 text-emerald-400 light:text-emerald-600'
                : 'h-5 w-5 text-[var(--color-text-faint)]'
            }
          />
          <div>
            <div className="text-sm font-medium">
              {enabled ? 'Activé' : 'Désactivé'}
            </div>
            <div className="text-xs text-[var(--color-text-dim)]">
              {enabled
                ? "L'offre est visible sur /vip"
                : "Aucune offre affichée côté user"}
            </div>
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={() => setEnabled((v) => !v)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            enabled
              ? 'bg-emerald-500'
              : 'bg-[var(--color-surface-tint-strong)]'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
              enabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      <div className="space-y-3">
        <div>
          <Label htmlFor="bonus-title">Titre</Label>
          <Input
            id="bonus-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex: +20% sur ton premier dépôt"
            disabled={!enabled}
            className="mt-1.5"
          />
        </div>
        <div>
          <Label htmlFor="bonus-desc">Description</Label>
          <Textarea
            id="bonus-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ex: IronFX te crédite 20% supplémentaires sur ton compte..."
            rows={3}
            disabled={!enabled}
            className="mt-1.5"
          />
        </div>
        <div>
          <Label htmlFor="bonus-fineprint">
            Conditions{' '}
            <span className="text-[var(--color-text-faint)]">(optionnel)</span>
          </Label>
          <Input
            id="bonus-fineprint"
            value={fineprint}
            onChange={(e) => setFineprint(e.target.value)}
            placeholder="Ex: Valable jusqu'au 31/12, plafond 1000€"
            disabled={!enabled}
            className="mt-1.5"
          />
        </div>
      </div>

      <Button onClick={submit} disabled={pending} className="w-full sm:w-auto">
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        Enregistrer
      </Button>
    </div>
  );
}
