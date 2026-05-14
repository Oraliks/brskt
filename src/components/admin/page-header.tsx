import * as React from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  /** Si fourni, affiche un fil d'ariane au-dessus du titre. */
  eyebrow?: string;
}

export function AdminPageHeader({
  title,
  description,
  actions,
  eyebrow,
}: PageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6">
      <div className="min-w-0">
        {eyebrow && (
          <div className="text-[11px] uppercase tracking-wider text-[var(--color-text-faint)] mb-1">
            {eyebrow}
          </div>
        )}
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-[var(--color-text-dim)] max-w-3xl">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex gap-2 flex-wrap items-center">{actions}</div>
      )}
    </div>
  );
}

export function AdminContainer({ children }: { children: React.ReactNode }) {
  return <div className="p-5 md:p-8 max-w-7xl mx-auto">{children}</div>;
}
