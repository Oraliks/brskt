'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Database, Hand, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { adminSetIronfxModeAction } from '@/lib/actions/admin';
import type { IronFXMode } from '@/lib/ironfx';
import { cn } from '@/lib/utils';

interface Props {
  currentMode: IronFXMode;
}

const options: Array<{
  id: IronFXMode;
  title: string;
  description: string;
  icon: React.ElementType;
}> = [
  {
    id: 'manual',
    title: 'Manuel',
    description:
      'Les admins mettent à jour à la main les statuts IronFX dans /admin/vip. Aucune dépendance externe.',
    icon: Hand,
  },
  {
    id: 'api',
    title: 'API IronFX',
    description:
      'Récupération automatique via API + postbacks S2S vers /api/webhooks/ironfx. Nécessite IRONFX_API_KEY + URL.',
    icon: Database,
  },
];

export function IronFxModeForm({ currentMode }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<IronFXMode>(currentMode);
  const [pending, start] = useTransition();

  function save() {
    if (selected === currentMode) return;
    start(async () => {
      const result = await adminSetIronfxModeAction({ mode: selected });
      if (result.success) {
        toast({ title: `✓ Mode IronFX → ${selected}` });
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
      <div className="grid sm:grid-cols-2 gap-3">
        {options.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => setSelected(opt.id)}
            className={cn(
              'glass rounded-[var(--radius-md)] p-4 text-left transition-all',
              selected === opt.id
                ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/5'
                : 'hover:border-white/14'
            )}
          >
            <div className="flex items-start gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-white/5 border border-[var(--color-border)] flex-shrink-0">
                <opt.icon className="h-4 w-4" />
              </span>
              <div>
                <div className="font-medium text-sm">{opt.title}</div>
                <div className="text-xs text-[var(--color-text-dim)] mt-1 leading-relaxed">
                  {opt.description}
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>

      <Button
        onClick={save}
        disabled={pending || selected === currentMode}
      >
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        {selected === currentMode ? 'Aucun changement' : `Activer "${selected}"`}
      </Button>
    </div>
  );
}
