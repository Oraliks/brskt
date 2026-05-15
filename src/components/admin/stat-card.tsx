import * as React from 'react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon?: React.ReactNode;
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  className?: string;
}

const toneStyles: Record<NonNullable<StatCardProps['tone']>, string> = {
  default: 'text-[var(--color-text)]',
  success: 'text-emerald-300 light:text-emerald-700',
  warning: 'text-amber-300 light:text-amber-700',
  danger: 'text-rose-300 light:text-rose-700',
  info: 'text-sky-300 light:text-sky-700',
};

/**
 * KPI card compact. Affiche un label, une valeur dominante et un hint optionnel.
 */
export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = 'default',
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        'glass rounded-[var(--radius-md)] px-4 py-3 flex items-start gap-3 min-w-0',
        className
      )}
    >
      {icon && (
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-[var(--color-surface-tint)] border border-[var(--color-border)] flex-shrink-0">
          {icon}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-dim)]">
          {label}
        </div>
        <div className={cn('mt-0.5 text-xl font-semibold tabular-nums', toneStyles[tone])}>
          {value}
        </div>
        {hint && (
          <div className="mt-0.5 text-[11px] text-[var(--color-text-faint)]">
            {hint}
          </div>
        )}
      </div>
    </div>
  );
}

export function StatCardGrid({
  children,
  cols = 4,
  className,
}: {
  children: React.ReactNode;
  cols?: 2 | 3 | 4 | 5;
  className?: string;
}) {
  const colClass = {
    2: 'sm:grid-cols-2',
    3: 'sm:grid-cols-2 lg:grid-cols-3',
    4: 'sm:grid-cols-2 lg:grid-cols-4',
    5: 'sm:grid-cols-2 lg:grid-cols-5',
  }[cols];
  return (
    <div className={cn('grid gap-3', colClass, className)}>{children}</div>
  );
}
