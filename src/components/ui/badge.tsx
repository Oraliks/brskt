import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-[var(--color-accent)]/15 text-[var(--color-accent-hover)] border-[var(--color-accent)]/30',
        secondary:
          'border-[var(--color-border)] bg-white/5 text-[var(--color-text)]',
        success:
          'border-transparent bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
        warning:
          'border-transparent bg-amber-500/15 text-amber-300 border-amber-500/30',
        danger:
          'border-transparent bg-rose-500/15 text-rose-300 border-rose-500/30',
        gold:
          'border-transparent bg-amber-400/10 text-amber-300 border-amber-400/30',
        outline:
          'border-[var(--color-border-strong)] text-[var(--color-text)]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
