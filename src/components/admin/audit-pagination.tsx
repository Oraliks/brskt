'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  page: number;
  perPage: number;
  total: number;
}

const PER_PAGE_OPTIONS = [10, 20, 50, 100];

/**
 * Pagination + sélecteur "par page" pour l'audit log.
 * Drive l'état via les query params `?page=N&perPage=M` — refresh server-side.
 * Sliding window de 5 pages autour de la page courante.
 */
export function AuditPagination({ page, perPage, total }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, start] = useTransition();

  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const firstIdx = total === 0 ? 0 : (page - 1) * perPage + 1;
  const lastIdx = Math.min(page * perPage, total);

  function go(newPage: number, newPerPage?: number) {
    const next = new URLSearchParams(searchParams.toString());
    if (newPage === 1) next.delete('page');
    else next.set('page', String(newPage));
    if (newPerPage && newPerPage !== 20) next.set('perPage', String(newPerPage));
    else if (newPerPage === 20) next.delete('perPage');
    start(() => {
      router.push(`${pathname}?${next.toString()}`);
    });
  }

  // Sliding window de pages : on montre toujours la 1ère et la dernière,
  // + une fenêtre de ±2 autour de la page courante, avec des "…" entre.
  const windowSize = 2;
  const pages: Array<number | 'ellipsis'> = [];
  for (let i = 1; i <= totalPages; i++) {
    if (
      i === 1 ||
      i === totalPages ||
      (i >= page - windowSize && i <= page + windowSize)
    ) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== 'ellipsis') {
      pages.push('ellipsis');
    }
  }

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <select
          value={perPage}
          onChange={(e) => go(1, Number(e.target.value))}
          className="h-8 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-tint)] px-2 text-xs hover:bg-[var(--color-surface-tint-strong)] cursor-pointer"
        >
          {PER_PAGE_OPTIONS.map((n) => (
            <option key={n} value={n}>
              {n} par page
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-xs text-[var(--color-text-dim)] tabular-nums">
          {firstIdx}–{lastIdx} sur {total}
        </span>
        <div className="inline-flex items-center gap-1">
          <button
            type="button"
            onClick={() => go(Math.max(1, page - 1))}
            disabled={page <= 1}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--color-border)] text-[var(--color-text-dim)] hover:bg-[var(--color-surface-tint)] disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Page précédente"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          {pages.map((p, i) =>
            p === 'ellipsis' ? (
              <span
                key={`e-${i}`}
                className="px-1 text-xs text-[var(--color-text-faint)]"
              >
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => go(p)}
                className={cn(
                  'inline-flex h-8 min-w-[32px] items-center justify-center rounded-md text-xs px-2 transition-colors',
                  p === page
                    ? 'bg-indigo-500/20 border border-indigo-500/40 text-[var(--color-text)] font-semibold'
                    : 'border border-[var(--color-border)] text-[var(--color-text-dim)] hover:bg-[var(--color-surface-tint)]'
                )}
                aria-current={p === page ? 'page' : undefined}
              >
                {p}
              </button>
            )
          )}
          <button
            type="button"
            onClick={() => go(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--color-border)] text-[var(--color-text-dim)] hover:bg-[var(--color-surface-tint)] disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Page suivante"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
