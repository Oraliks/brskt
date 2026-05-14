'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';
import { adminSetDailyBriefingAction } from '@/lib/actions/admin';
import { cn } from '@/lib/utils';

interface Props {
  initial: {
    enabled: boolean;
    template: string;
  };
}

export function DailyBriefingForm({ initial }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [enabled, setEnabled] = useState(initial.enabled);
  const [template, setTemplate] = useState(initial.template);

  function submit() {
    start(async () => {
      const result = await adminSetDailyBriefingAction({ enabled, template });
      if (result.success) {
        toast({
          title: enabled ? '✓ Briefing activé' : '✓ Briefing désactivé',
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
          <MessageSquare
            className={cn(
              'h-4 w-4',
              enabled
                ? 'text-emerald-400 light:text-emerald-600'
                : 'text-[var(--color-text-faint)]'
            )}
          />
          <div>
            <div className="text-sm font-medium">
              {enabled ? 'Briefing activé' : 'Briefing désactivé'}
            </div>
            <div className="text-xs text-[var(--color-text-dim)]">
              Push CRON à 7h UTC aux opt-in.
            </div>
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={() => setEnabled((v) => !v)}
          className={cn(
            'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
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
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-medium text-[var(--color-text-dim)]">
            Template HTML (placeholder <code className="font-mono">{'{{firstName}}'}</code>)
          </span>
          <span className="text-[10px] text-[var(--color-text-faint)] tabular-nums">
            {template.length} / 4000
          </span>
        </div>
        <Textarea
          value={template}
          onChange={(e) => setTemplate(e.target.value)}
          rows={10}
          className="font-mono text-xs"
          disabled={!enabled}
        />
      </div>

      <div className="flex justify-end">
        <Button onClick={submit} disabled={pending}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          Enregistrer
        </Button>
      </div>
    </div>
  );
}
