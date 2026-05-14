import * as React from 'react';
import { cn } from '@/lib/utils';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-11 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white/[0.02] px-4 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-faint)]',
          'transition-colors',
          'focus-visible:outline-none focus-visible:border-[var(--color-accent)] focus-visible:bg-white/[0.04]',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-[var(--color-text)]',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export { Input };
