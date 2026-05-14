'use client';

import * as React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: React.ReactNode;
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, id, ...props }, ref) => {
    const inputId = id ?? React.useId();
    return (
      <label
        htmlFor={inputId}
        className={cn(
          'inline-flex items-center gap-2.5 cursor-pointer select-none group',
          props.disabled && 'cursor-not-allowed opacity-50'
        )}
      >
        <span className="relative inline-flex">
          <input
            ref={ref}
            type="checkbox"
            id={inputId}
            className="peer sr-only"
            {...props}
          />
          <span
            className={cn(
              'flex h-5 w-5 items-center justify-center rounded-[6px] border border-[var(--color-border-strong)] bg-[var(--color-surface-tint)] transition-all',
              'peer-checked:bg-[var(--color-accent)] peer-checked:border-[var(--color-accent)]',
              'peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--color-accent)] peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-[var(--color-bg)]',
              'group-hover:border-[var(--color-border-strong)]',
              className
            )}
          >
            <Check
              className="h-3.5 w-3.5 text-white opacity-0 peer-checked:opacity-100"
              strokeWidth={3}
            />
          </span>
        </span>
        {label && <span className="text-sm">{label}</span>}
      </label>
    );
  }
);
Checkbox.displayName = 'Checkbox';

export { Checkbox };
