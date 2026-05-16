'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Activity,
  Bot,
  Briefcase,
  CalendarCheck,
  CalendarDays,
  Command,
  GraduationCap,
  LayoutDashboard,
  MessageSquare,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Tag,
  TrendingDown,
  UserCog,
  Users,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface PaletteItem {
  id: string;
  label: string;
  /** Section affichée dans le séparateur. */
  group: 'Navigation' | 'Actions';
  /** Mots-clés additionnels pour le matching. */
  keywords?: string[];
  icon: LucideIcon;
  href?: string;
  onSelect?: () => void;
}

/**
 * Palette de commandes ⌘K / Ctrl+K — navigation et actions admin rapides.
 * Pas de lib externe (genre cmdk) — implem maison minimaliste mais
 * suffisante : fuzzy search basique, navigation clavier, mount global.
 *
 * Monté au niveau du AdminShell. Toggle via ⌘K (Mac) ou Ctrl+K (Windows).
 */
export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Toggle global via raccourci clavier
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
        setQuery('');
        setSelectedIdx(0);
      }
      if (e.key === 'Escape') {
        setOpen(false);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Auto-focus input à l'ouverture
  useEffect(() => {
    if (open) {
      // setTimeout pour laisser le dialog s'ouvrir avant le focus
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const items: PaletteItem[] = useMemo(
    () => [
      // Navigation admin
      {
        id: 'overview',
        label: 'Vue d\'ensemble',
        group: 'Navigation',
        icon: LayoutDashboard,
        href: '/admin',
        keywords: ['dashboard', 'accueil', 'home'],
      },
      {
        id: 'calendar',
        label: 'Calendrier',
        group: 'Navigation',
        icon: CalendarDays,
        href: '/admin/calendar',
        keywords: ['agenda', 'sessions'],
      },
      {
        id: 'bookings',
        label: 'Réservations',
        group: 'Navigation',
        icon: CalendarCheck,
        href: '/admin/bookings',
        keywords: ['resa', 'formations'],
      },
      {
        id: 'bookings-list',
        label: 'Toutes les réservations',
        group: 'Navigation',
        icon: CalendarCheck,
        href: '/admin/bookings/list',
        keywords: ['liste', 'table'],
      },
      {
        id: 'waitlist',
        label: 'Liste d\'attente',
        group: 'Navigation',
        icon: CalendarCheck,
        href: '/admin/bookings/waitlist',
        keywords: ['file', 'attente'],
      },
      {
        id: 'formations',
        label: 'Formations',
        group: 'Navigation',
        icon: GraduationCap,
        href: '/admin/formations',
        keywords: ['cours', 'prix'],
      },
      {
        id: 'promos',
        label: 'Codes promo',
        group: 'Navigation',
        icon: Tag,
        href: '/admin/promos',
        keywords: ['réduction', 'reduction'],
      },
      {
        id: 'coachings',
        label: 'Coachings offline',
        group: 'Navigation',
        icon: Briefcase,
        href: '/admin/coachings',
        keywords: ['hors-site', 'manuel'],
      },
      {
        id: 'vip',
        label: 'VIP Telegram',
        group: 'Navigation',
        icon: Sparkles,
        href: '/admin/vip',
        keywords: ['groupe', 'cpa'],
      },
      {
        id: 'funnel',
        label: 'Funnel',
        group: 'Navigation',
        icon: TrendingDown,
        href: '/admin/funnel',
        keywords: ['conversion', 'drop-off'],
      },
      {
        id: 'users',
        label: 'Utilisateurs',
        group: 'Navigation',
        icon: UserCog,
        href: '/admin/users',
        keywords: ['users', 'membres', 'clients'],
      },
      {
        id: 'testimonials',
        label: 'Témoignages',
        group: 'Navigation',
        icon: MessageSquare,
        href: '/admin/testimonials',
        keywords: ['avis', 'feedback'],
      },
      {
        id: 'bot',
        label: 'Bot Telegram',
        group: 'Navigation',
        icon: Bot,
        href: '/admin/bot',
        keywords: ['telegram', 'commandes'],
      },
      {
        id: 'automations',
        label: 'Automatisations',
        group: 'Navigation',
        icon: Zap,
        href: '/admin/automations',
        keywords: ['auto', 'crons'],
      },
      {
        id: 'audit',
        label: 'Journal d\'audit',
        group: 'Navigation',
        icon: ShieldCheck,
        href: '/admin/audit',
        keywords: ['logs', 'historique'],
      },
      {
        id: 'diagnostics',
        label: 'Diagnostics',
        group: 'Navigation',
        icon: Activity,
        href: '/admin/diagnostics',
        keywords: ['santé', 'sante', 'webhook', 'check'],
      },
      {
        id: 'settings',
        label: 'Paramètres',
        group: 'Navigation',
        icon: Settings,
        href: '/admin/settings',
        keywords: ['config'],
      },
      // Actions rapides
      {
        id: 'export-bookings',
        label: 'Exporter les réservations (CSV)',
        group: 'Actions',
        icon: CalendarCheck,
        href: '/api/admin/export/bookings.csv',
        keywords: ['export', 'csv', 'téléchargement'],
      },
      {
        id: 'export-coachings',
        label: 'Exporter les coachings (CSV)',
        group: 'Actions',
        icon: Briefcase,
        href: '/api/admin/export/coachings.csv',
        keywords: ['export', 'csv'],
      },
      {
        id: 'export-waitlist',
        label: 'Exporter la liste d\'attente (CSV)',
        group: 'Actions',
        icon: Users,
        href: '/api/admin/export/waitlist.csv',
        keywords: ['export', 'csv'],
      },
      {
        id: 'export-audit',
        label: 'Exporter le journal d\'audit (CSV)',
        group: 'Actions',
        icon: ShieldCheck,
        href: '/api/admin/export/audit.csv',
        keywords: ['export', 'csv'],
      },
    ],
    []
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) => {
      const haystack = [it.label, ...(it.keywords ?? [])]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [items, query]);

  // Reset selection à chaque changement de query
  useEffect(() => {
    setSelectedIdx(0);
  }, [query]);

  function select(item: PaletteItem) {
    setOpen(false);
    if (item.onSelect) {
      item.onSelect();
    } else if (item.href) {
      // Si lien externe (api/*), download. Sinon navigation interne.
      if (item.href.startsWith('/api/')) {
        window.location.href = item.href;
      } else {
        router.push(item.href);
      }
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(filtered.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = filtered[selectedIdx];
      if (item) select(item);
    }
  }

  if (!open) return null;

  // Regroupement par section pour l'affichage
  const grouped = filtered.reduce<Record<string, PaletteItem[]>>((acc, it) => {
    (acc[it.group] ||= []).push(it);
    return acc;
  }, {});

  // Index global pour le highlight (parcours dans l'ordre des groupes)
  let globalIdx = 0;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center pt-[15vh] px-4 bg-black/60 backdrop-blur-sm"
      onClick={() => setOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label="Palette de commandes"
    >
      <div
        className="w-full max-w-xl glass rounded-[var(--radius-lg)] border border-[var(--color-border-strong)] overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--color-border)]">
          <Search className="h-4 w-4 text-[var(--color-text-faint)] flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Tape pour rechercher une page ou une action…"
            className="flex-1 bg-transparent border-0 outline-none text-sm placeholder:text-[var(--color-text-faint)]"
            autoComplete="off"
          />
          <kbd className="hidden sm:inline-flex h-5 items-center px-1.5 rounded border border-[var(--color-border)] bg-[var(--color-surface-tint)] text-[10px] font-mono text-[var(--color-text-faint)]">
            esc
          </kbd>
        </div>

        {/* Résultats */}
        <div className="max-h-[50vh] overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-[var(--color-text-dim)]">
              Aucun résultat pour « {query} »
            </div>
          ) : (
            Object.entries(grouped).map(([group, list]) => (
              <div key={group} className="mb-1">
                <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wider text-[var(--color-text-faint)]">
                  {group}
                </div>
                {list.map((item) => {
                  const idx = globalIdx++;
                  const isSelected = idx === selectedIdx;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onMouseEnter={() => setSelectedIdx(idx)}
                      onClick={() => select(item)}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-2 text-sm text-left transition-colors',
                        isSelected
                          ? 'bg-[var(--color-accent)]/15 text-[var(--color-text)]'
                          : 'text-[var(--color-text-dim)] hover:bg-[var(--color-surface-tint)]'
                      )}
                    >
                      <item.icon className="h-4 w-4 flex-shrink-0" />
                      <span className="flex-1 truncate">{item.label}</span>
                      {isSelected && (
                        <span className="text-[10px] text-[var(--color-text-faint)]">
                          ↵
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer hints */}
        <div className="flex items-center justify-between gap-3 px-4 py-2 border-t border-[var(--color-border)] bg-[var(--color-surface-tint)] text-[10px] text-[var(--color-text-faint)]">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1">
              <Command className="h-3 w-3" />K pour ouvrir/fermer
            </span>
            <span>↑ ↓ naviguer · ↵ choisir</span>
          </div>
          <span>{filtered.length} résultat{filtered.length > 1 ? 's' : ''}</span>
        </div>
      </div>
    </div>
  );
}
