'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { RotateCcw, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/**
 * Filtres de l'audit log :
 *  - Search texte (action / cible) — debounced 250ms
 *  - Dropdown Date (Tout / Aujourd'hui / 7j / 30j)
 *  - Dropdown Admin (liste dynamique)
 *  - Dropdown Action (liste dynamique)
 *  - Bouton Réinitialiser
 *
 * Tous les changements pushent vers `?q=…&date=…&admin=…&action=…&page=1`,
 * la page server refetch. Pas de state DB côté client. Le ⌘K met le focus
 * sur le search.
 */

export interface AuditFilterOption {
  value: string;
  label: string;
  /** Nb d'entrées matchant — affiché en gris à droite. */
  count?: number;
}

interface Props {
  admins: AuditFilterOption[];
  actions: AuditFilterOption[];
}

const DATE_OPTIONS: AuditFilterOption[] = [
  { value: '', label: 'Tout' },
  { value: 'today', label: "Aujourd'hui" },
  { value: '7d', label: '7 derniers jours' },
  { value: '30d', label: '30 derniers jours' },
];

export function AuditFilters({ admins, actions }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, start] = useTransition();
  const searchInputRef = useRef<HTMLInputElement>(null);

  const currentQ = searchParams.get('q') ?? '';
  const currentDate = searchParams.get('date') ?? '';
  const currentAdmin = searchParams.get('admin') ?? '';
  const currentAction = searchParams.get('action') ?? '';

  const [search, setSearch] = useState(currentQ);

  // Resync local search avec URL si on revient via reset/navigation
  useEffect(() => {
    setSearch(currentQ);
  }, [currentQ]);

  // Debounce search input → push après 250ms inactif.
  // pushParams capture searchParams/router/pathname mais on ne veut PAS
  // re-fire à chaque changement d'URL ; on dépend seulement de `search`.
  useEffect(() => {
    if (search === currentQ) return;
    const t = setTimeout(() => {
      const next = new URLSearchParams(searchParams.toString());
      if (search) next.set('q', search);
      else next.delete('q');
      next.delete('page');
      start(() => {
        router.push(`${pathname}?${next.toString()}`);
      });
    }, 250);
    return () => clearTimeout(t);
  }, [search, currentQ, pathname, router, searchParams, start]);

  // Raccourci ⌘K / Ctrl+K → focus le search
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  function pushParams(updates: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === '') next.delete(key);
      else next.set(key, value);
    }
    start(() => {
      router.push(`${pathname}?${next.toString()}`);
    });
  }

  function reset() {
    setSearch('');
    start(() => {
      router.push(pathname);
    });
  }

  const hasActiveFilter =
    currentQ || currentDate || currentAdmin || currentAction;

  return (
    <div className="glass rounded-[var(--radius-lg)] p-3 flex flex-wrap items-end gap-2 mb-4">
      {/* Search */}
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--color-text-faint)] pointer-events-none" />
        <Input
          ref={searchInputRef}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher une action, cible..."
          className="pl-9 pr-14"
        />
        <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 hidden sm:inline-flex items-center gap-0.5 text-[9px] font-mono text-[var(--color-text-faint)] bg-[var(--color-surface-tint)] border border-[var(--color-border)] rounded px-1 py-0.5 pointer-events-none">
          ⌘K
        </kbd>
      </div>

      {/* Date */}
      <FilterSelect
        label="Date"
        value={currentDate}
        placeholder="Sélectionner..."
        options={DATE_OPTIONS}
        onChange={(v) => pushParams({ date: v || null, page: null })}
      />

      {/* Admin */}
      <FilterSelect
        label="Admin"
        value={currentAdmin}
        placeholder="Tous"
        options={[{ value: '', label: 'Tous' }, ...admins]}
        onChange={(v) => pushParams({ admin: v || null, page: null })}
      />

      {/* Action */}
      <FilterSelect
        label="Action"
        value={currentAction}
        placeholder="Toutes"
        options={[{ value: '', label: 'Toutes' }, ...actions]}
        onChange={(v) => pushParams({ action: v || null, page: null })}
      />

      <Button
        variant="secondary"
        size="default"
        onClick={reset}
        disabled={!hasActiveFilter || pending}
        className="gap-1.5"
      >
        <RotateCcw className="h-3.5 w-3.5" />
        Réinitialiser
      </Button>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  placeholder,
  options,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  options: AuditFilterOption[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="min-w-[160px]">
      <label className="text-[10px] uppercase tracking-wider text-[var(--color-text-dim)] mb-1 block">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-9 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-tint)] px-3 text-sm hover:bg-[var(--color-surface-tint-strong)] transition-colors cursor-pointer"
      >
        {options.length === 1 && options[0]!.value === '' ? (
          <option value="">{placeholder}</option>
        ) : (
          options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
              {o.count !== undefined ? ` (${o.count})` : ''}
            </option>
          ))
        )}
      </select>
    </div>
  );
}
