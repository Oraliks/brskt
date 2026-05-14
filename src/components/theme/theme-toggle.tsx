'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';

type Theme = 'light' | 'dark';

/**
 * Bouton toggle sun/moon. Source de vérité : l'attribut `data-theme` sur
 * <html> (déjà set par ThemeScript avant hydratation). On lit cet état
 * initial via `useEffect` pour éviter les mismatch d'hydratation.
 *
 * Variants :
 *  - `variant="nav"`     : pour la landing-nav (rond, fond glass)
 *  - `variant="ghost"`   : pour la sidebar admin / dashboard (transparent)
 *  - `variant="floating"`: bouton flottant standalone (debug ou page sans nav)
 */
interface Props {
  variant?: 'nav' | 'ghost' | 'floating';
  className?: string;
}

export function ThemeToggle({ variant = 'nav', className }: Props) {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    // Source de vérité : l'attribut posé par ThemeScript
    const current = document.documentElement.getAttribute('data-theme');
    setTheme(current === 'light' ? 'light' : 'dark');
  }, []);

  function toggle() {
    const next: Theme = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem('theme', next);
    } catch {
      /* localStorage indispo (private mode) — ignore */
    }
  }

  // Pendant le 1er render côté client, theme = null → on rend un placeholder
  // pour éviter le mismatch SSR. Une fois hydraté, l'icône apparaît.
  const isLight = theme === 'light';
  const label = isLight ? 'Passer en mode sombre' : 'Passer en mode clair';

  const base =
    'inline-flex items-center justify-center transition-colors outline-none';

  if (variant === 'floating') {
    return (
      <button
        type="button"
        onClick={toggle}
        aria-label={label}
        title={label}
        className={cn(
          base,
          'fixed bottom-6 right-6 z-[80] h-11 w-11 rounded-full',
          'bg-[var(--color-bg-elevated)] border border-[var(--color-border)]',
          'shadow-lg hover:border-[var(--color-border-strong)]',
          className
        )}
      >
        {theme === null ? null : isLight ? (
          <Moon className="h-4 w-4" />
        ) : (
          <Sun className="h-4 w-4" />
        )}
      </button>
    );
  }

  if (variant === 'ghost') {
    return (
      <button
        type="button"
        onClick={toggle}
        aria-label={label}
        title={label}
        className={cn(
          base,
          'h-9 w-9 rounded-md',
          'text-[var(--color-text-dim)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-tint)]',
          className
        )}
      >
        {theme === null ? null : isLight ? (
          <Moon className="h-4 w-4" />
        ) : (
          <Sun className="h-4 w-4" />
        )}
      </button>
    );
  }

  // variant='nav' (default) — bouton rond intégré dans la landing-nav glass
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className={cn(
        base,
        'h-8 w-8 rounded-full',
        'text-[var(--color-text-dim)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-tint)]',
        className
      )}
    >
      {theme === null ? null : isLight ? (
        <Moon className="h-4 w-4" />
      ) : (
        <Sun className="h-4 w-4" />
      )}
    </button>
  );
}
