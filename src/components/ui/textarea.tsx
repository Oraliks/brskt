import * as React from 'react';
import { cn } from '@/lib/utils';

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          'flex min-h-[80px] w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white/[0.02] px-4 py-3 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-faint)] transition-colors',
          'focus-visible:outline-none focus-visible:border-[var(--color-accent)] focus-visible:bg-white/[0.04]',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        {...props}
      />
    );
  }
);
Textarea.displayName = 'Textarea';

export { Textarea };
