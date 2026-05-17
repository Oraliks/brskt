'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Moon, Sun, SunMoon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { adminSetThemeModeAction } from '@/lib/actions/admin';
import type { ThemeMode } from '@/lib/settings/theme-mode';
import { cn } from '@/lib/utils';

interface Props {
  initial: ThemeMode;
}

const OPTIONS: Array<{
  id: ThemeMode;
  label: string;
  sub: string;
  icon: React.ElementType;
}> = [
  {
    id: 'both',
    label: 'Les deux',
    sub: 'Toggle visible, l\'user choisit (défaut)',
    icon: SunMoon,
  },
  {
    id: 'light_only',
    label: 'Light uniquement',
    sub: 'Force light, toggle masqué',
    icon: Sun,
  },
  {
    id: 'dark_only',
    label: 'Dark uniquement',
    sub: 'Force dark, toggle masqué',
    icon: Moon,
  },
];

export function ThemeModeForm({ initial }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [mode, setMode] = useState<ThemeMode>(initial);

  function submit() {
    start(async () => {
      const result = await adminSetThemeModeAction({ mode });
      if (result.success) {
        toast({
          title:
            mode === 'both'
              ? '✓ Les deux thèmes disponibles'
              : mode === 'light_only'
              ? '✓ Light uniquement'
              : '✓ Dark uniquement',
          description:
            'Le changement s\'applique au prochain refresh chez les users.',
        });
        // Force un refresh global pour réappliquer le thème sur cette page
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
      <div className="grid sm:grid-cols-3 gap-3">
        {OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const active = mode === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => setMode(opt.id)}
              className={cn(
                'flex flex-col items-start gap-2 rounded-[var(--radius-md)] border p-4 text-left transition-colors',
                active
                  ? 'border-[var(--color-accent-hover)] bg-[var(--color-accent)]/10'
                  : 'border-[var(--color-border)] hover:bg-[var(--color-surface-tint)]'
              )}
            >
              <Icon
                className={cn(
                  'h-5 w-5',
                  active
                    ? 'text-[var(--color-accent-hover)]'
                    : 'text-[var(--color-text-dim)]'
                )}
              />
              <span className="text-sm font-medium">{opt.label}</span>
              <span className="text-xs text-[var(--color-text-faint)]">
                {opt.sub}
              </span>
            </button>
          );
        })}
      </div>

      <p className="text-xs text-[var(--color-text-faint)]">
        Le changement est appliqué dès qu\'un user refresh la page. Les
        users qui avaient choisi un thème spécifique voient leur choix
        écrasé par le forcing admin.
      </p>

      <Button onClick={submit} disabled={pending || mode === initial}>
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
