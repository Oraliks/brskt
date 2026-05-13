import * as React from 'react';
import { cn } from '@/lib/utils';

interface SectionProps extends React.HTMLAttributes<HTMLElement> {
  containerClassName?: string;
}

export function Section({
  children,
  className,
  containerClassName,
  ...props
}: SectionProps) {
  return (
    <section className={cn('py-20 md:py-28', className)} {...props}>
      <div
        className={cn(
          'mx-auto max-w-7xl px-4 sm:px-6 lg:px-8',
          containerClassName
        )}
      >
        {children}
      </div>
    </section>
  );
}

interface SectionHeaderProps {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  align?: 'left' | 'center';
  className?: string;
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  align = 'center',
  className,
}: SectionHeaderProps) {
  return (
    <div
      className={cn(
        'space-y-4 max-w-2xl',
        align === 'center' && 'mx-auto text-center',
        className
      )}
    >
      {eyebrow && (
        <div className="inline-flex items-center gap-2">
          <span className="h-px w-6 bg-[var(--color-accent)]" />
          <span className="text-xs uppercase tracking-[0.2em] text-[var(--color-accent-hover)] font-medium">
            {eyebrow}
          </span>
        </div>
      )}
      <h2 className="text-3xl md:text-5xl font-semibold tracking-tight text-gradient">
        {title}
      </h2>
      {description && (
        <p className="text-[var(--color-text-dim)] text-base md:text-lg">
          {description}
        </p>
      )}
    </div>
  );
}
