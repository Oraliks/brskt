import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-md)] text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg)] [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] shadow-[0_8px_24px_-8px_rgba(99,102,241,0.5)]',
        secondary:
          'bg-[var(--color-surface-tint)] text-[var(--color-text)] border border-[var(--color-border)] hover:bg-[var(--color-surface-tint-strong)]',
        ghost:
          'text-[var(--color-text)] hover:bg-[var(--color-surface-tint)]',
        outline:
          'border border-[var(--color-border-strong)] text-[var(--color-text)] hover:bg-[var(--color-surface-tint)]',
        destructive:
          'bg-[var(--color-danger)] text-white hover:bg-red-600',
        link:
          'text-[var(--color-accent)] underline-offset-4 hover:underline',
        glow:
          'bg-gradient-to-b from-[var(--color-accent)] to-indigo-600 text-white hover:to-indigo-500 shadow-[var(--shadow-glow)]',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-8 px-3 text-xs',
        lg: 'h-12 px-6 text-base',
        xl: 'h-14 px-8 text-base font-semibold',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
