import * as React from 'react';
import { cn } from '@/lib/utils';

interface SectionCardProps {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}

/**
 * Carte de section compacte pour les pages admin.
 * Header optionnel (titre + description + actions), body padding contrôlé.
 */
export function SectionCard({
  title,
  description,
  icon,
  actions,
  className,
  bodyClassName,
  children,
}: SectionCardProps) {
  const hasHeader = title || description || actions;
  return (
    <section
      className={cn(
        'glass rounded-[var(--radius-lg)] overflow-hidden',
        className
      )}
    >
      {hasHeader && (
        <header className="flex items-start justify-between gap-3 px-4 py-3 border-b border-[var(--color-border)]">
          <div className="flex items-start gap-3 min-w-0">
            {icon && (
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-[var(--color-surface-tint)] border border-[var(--color-border)] flex-shrink-0 mt-0.5">
                {icon}
              </span>
            )}
            <div className="min-w-0">
              {title && (
                <h2 className="text-sm font-semibold tracking-tight">
                  {title}
                </h2>
              )}
              {description && (
                <p className="mt-0.5 text-xs text-[var(--color-text-dim)] leading-relaxed">
                  {description}
                </p>
              )}
            </div>
          </div>
          {actions && (
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {actions}
            </div>
          )}
        </header>
      )}
      <div className={cn('p-4', bodyClassName)}>{children}</div>
    </section>
  );
}
