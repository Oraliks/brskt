'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  ArrowLeftFromLine,
  Bot,
  Briefcase,
  CalendarCheck,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  LayoutDashboard,
  Tag,
  Menu,
  MessageSquare,
  Settings,
  Shield,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  UserCog,
  Users,
  Wrench,
  X,
  Zap,
} from 'lucide-react';
import { Logo } from '@/components/shared/logo';
import { ThemeToggle } from '@/components/theme/theme-toggle';
import { logoutAction } from '@/lib/actions/auth';
import { cn } from '@/lib/utils';

interface AdminSidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
}

interface NavLink {
  href: string;
  label: string;
  icon: LucideIcon;
}

interface NavGroup {
  id: string;
  label: string;
  icon: LucideIcon;
  items: NavLink[];
}

type NavItem = NavLink | NavGroup;

function isGroup(item: NavItem): item is NavGroup {
  return 'items' in item;
}

const NAV: NavItem[] = [
  { href: '/admin', label: 'Overview', icon: LayoutDashboard },
  { href: '/admin/calendar', label: 'Calendrier', icon: CalendarDays },
  {
    id: 'reservations',
    label: 'Réservations',
    icon: CalendarCheck,
    items: [
      { href: '/admin/bookings', label: 'Réservations', icon: CalendarCheck },
      { href: '/admin/formations', label: 'Formations', icon: GraduationCap },
      { href: '/admin/promos', label: 'Codes promo', icon: Tag },
    ],
  },
  {
    id: 'clients',
    label: 'Clients',
    icon: Briefcase,
    items: [
      { href: '/admin/coachings', label: 'Coachings (offline)', icon: Briefcase },
      { href: '/admin/vip', label: 'VIP', icon: Sparkles },
      { href: '/admin/funnel', label: 'Funnel', icon: TrendingDown },
    ],
  },
  {
    id: 'communaute',
    label: 'Communauté',
    icon: Users,
    items: [
      { href: '/admin/users', label: 'Utilisateurs', icon: UserCog },
      { href: '/admin/testimonials', label: 'Témoignages', icon: MessageSquare },
    ],
  },
  {
    id: 'bot',
    label: 'Bot & Auto',
    icon: Bot,
    items: [
      { href: '/admin/bot', label: 'Bot Telegram', icon: Bot },
      { href: '/admin/automations', label: 'Automatisations', icon: Zap },
    ],
  },
  {
    id: 'systeme',
    label: 'Système',
    icon: Wrench,
    items: [
      { href: '/admin/audit', label: 'Audit log', icon: ShieldCheck },
      { href: '/admin/diagnostics', label: 'Diagnostics', icon: Activity },
      { href: '/admin/settings', label: 'Paramètres', icon: Settings },
    ],
  },
];

const STORAGE_KEY = 'admin-sidebar-open-groups';

/**
 * Détermine quels groupes doivent être ouverts au mount :
 *  - Le groupe contenant la route active s'ouvre toujours (UX : on voit
 *    où on est dans l'arborescence).
 *  - Les groupes mémorisés dans localStorage restent ouverts.
 */
function getInitialOpenGroups(pathname: string): Set<string> {
  const fromActive = new Set<string>();
  for (const item of NAV) {
    if (isGroup(item) && item.items.some((sub) => pathname.startsWith(sub.href))) {
      fromActive.add(item.id);
    }
  }
  if (typeof window === 'undefined') return fromActive;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const stored = JSON.parse(raw) as string[];
      stored.forEach((id) => fromActive.add(id));
    }
  } catch {
    // localStorage indispo / JSON cassé → on garde juste fromActive
  }
  return fromActive;
}

export function AdminSidebar({
  collapsed,
  onToggleCollapse,
}: AdminSidebarProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Set<string>>(
    () => new Set()
  );

  // Hydratation : on lit localStorage au mount uniquement (sinon mismatch SSR).
  // Volontairement [] sans pathname — l'effet ci-dessous gère l'auto-expand
  // sur navigation.
  useEffect(() => {
    setOpenGroups(getInitialOpenGroups(pathname));
  }, []);

  // Quand on navigue, on force l'ouverture du groupe contenant la route active.
  // On ne ferme pas les autres pour respecter le choix utilisateur.
  useEffect(() => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      for (const item of NAV) {
        if (isGroup(item) && item.items.some((sub) => pathname.startsWith(sub.href))) {
          next.add(item.id);
        }
      }
      return next;
    });
  }, [pathname]);

  // Persistance localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...openGroups]));
    } catch {
      // Quota dépassé ou mode privé → silencieux
    }
  }, [openGroups]);

  function toggleGroup(id: string) {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Auto-close du drawer quand on navigue
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Lock body scroll quand drawer ouvert
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const activeHref = useMemo(() => {
    // Match le plus spécifique d'abord pour éviter que '/admin' matche tout.
    const all = NAV.flatMap((item) =>
      isGroup(item) ? item.items.map((s) => s.href) : [item.href]
    );
    const sorted = [...all].sort((a, b) => b.length - a.length);
    return (
      sorted.find((href) =>
        href === '/admin' ? pathname === href : pathname.startsWith(href)
      ) ?? null
    );
  }, [pathname]);

  return (
    <>
      {/* Top bar mobile */}
      <header className="md:hidden sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-[var(--color-border)] bg-[var(--color-bg-elevated)]/80 backdrop-blur-md px-4 py-3">
        <Logo />
        <span className="inline-flex items-center gap-1.5 text-[10px] text-amber-300 uppercase tracking-wider">
          <Shield className="h-3 w-3" />
          Back-office
        </span>
        <button
          onClick={() => setOpen(true)}
          aria-label="Ouvrir le menu admin"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[var(--color-border)] hover:bg-[var(--color-surface-tint)]"
        >
          <Menu className="h-5 w-5" />
        </button>
      </header>

      {/* Drawer overlay (mobile) */}
      {open && (
        <button
          type="button"
          aria-label="Fermer le menu"
          onClick={() => setOpen(false)}
          className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm animate-[radix-fade-in_0.2s_ease-out]"
        />
      )}

      {/* Sidebar — desktop fixed (toujours visible), mobile drawer */}
      <aside
        className={cn(
          'flex flex-col border-r border-[var(--color-border)] bg-[var(--color-bg-elevated)]/95 md:bg-[var(--color-bg-elevated)]/40 backdrop-blur-md',
          // Desktop fixed : la sidebar est sortie du flow normal, le main
          // a un margin-left équivalent dans AdminShell. Garantit qu'elle
          // reste toujours en place quel que soit le scroll, sans dépendre
          // de sticky (capricieux selon les overflow ancêtres).
          'md:fixed md:top-0 md:left-0 md:h-[100dvh] md:z-40 md:flex md:translate-x-0',
          'md:transition-[width] md:duration-200',
          collapsed ? 'md:w-16' : 'md:w-64',
          // Mobile drawer
          'fixed inset-y-0 left-0 z-50 w-72 transition-transform duration-300',
          open ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        )}
      >
        {/* Header sidebar : Logo + bouton collapse (desktop) + close (mobile) */}
        <div
          className={cn(
            'border-b border-[var(--color-border)] flex items-center justify-between',
            collapsed ? 'md:px-2 md:py-4' : 'px-6 py-6',
            'px-6 py-6'
          )}
        >
          {!collapsed && (
            <div className="md:block">
              <Logo />
              <div className="mt-2 inline-flex items-center gap-1.5 text-xs text-amber-300">
                <Shield className="h-3 w-3" />
                Back-office
              </div>
            </div>
          )}
          {collapsed && (
            <div className="hidden md:flex w-full justify-center">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-300">
                <Shield className="h-4 w-4" />
              </span>
            </div>
          )}
          <button
            onClick={() => setOpen(false)}
            aria-label="Fermer le menu"
            className="md:hidden inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-[var(--color-surface-tint)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav
          className={cn(
            'flex-1 min-h-0 py-4 space-y-0.5 overflow-y-auto overflow-x-hidden',
            collapsed ? 'md:px-2' : 'px-3'
          )}
        >
          {NAV.map((item) => {
            if (!isGroup(item)) {
              const active = activeHref === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    'flex items-center gap-3 rounded-md text-sm transition-colors',
                    collapsed ? 'md:justify-center md:px-2 px-3 py-2' : 'px-3 py-2',
                    active
                      ? 'bg-white/8 text-[var(--color-text)]'
                      : 'text-[var(--color-text-dim)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-tint)]'
                  )}
                >
                  <item.icon className="h-4 w-4 flex-shrink-0" />
                  <span className={cn(collapsed && 'md:hidden')}>
                    {item.label}
                  </span>
                </Link>
              );
            }

            const isOpen = openGroups.has(item.id);
            const hasActiveChild = item.items.some(
              (sub) => activeHref === sub.href
            );

            // Quand collapsed sur desktop : on affiche juste l'icône du
            // groupe sans pouvoir l'expand (sinon ça déborde). Les enfants
            // restent accessibles via click direct sur un sous-lien actif.
            // En mobile/expanded normal, on garde le comportement initial.
            if (collapsed) {
              return (
                <div
                  key={item.id}
                  title={item.label}
                  className={cn(
                    'hidden md:flex items-center justify-center rounded-md py-2',
                    hasActiveChild
                      ? 'text-[var(--color-text)] bg-white/8'
                      : 'text-[var(--color-text-dim)]'
                  )}
                >
                  <item.icon className="h-4 w-4" />
                </div>
              );
            }

            return (
              <div key={item.id} className="pt-1">
                <button
                  type="button"
                  onClick={() => toggleGroup(item.id)}
                  aria-expanded={isOpen}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                    hasActiveChild
                      ? 'text-[var(--color-text)]'
                      : 'text-[var(--color-text-dim)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-tint)]'
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  <span className="flex-1 text-left">{item.label}</span>
                  <ChevronDown
                    className={cn(
                      'h-3.5 w-3.5 transition-transform duration-200',
                      isOpen ? 'rotate-0' : '-rotate-90'
                    )}
                  />
                </button>
                <div
                  className={cn(
                    'grid transition-[grid-template-rows] duration-200 ease-out',
                    isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                  )}
                >
                  <div className="overflow-hidden min-h-0">
                    <div className="pl-3 mt-0.5 space-y-0.5 border-l border-[var(--color-border)] ml-3">
                      {item.items.map((sub) => {
                        const active = activeHref === sub.href;
                        return (
                          <Link
                            key={sub.href}
                            href={sub.href}
                            className={cn(
                              'flex items-center gap-3 px-3 py-1.5 rounded-md text-sm transition-colors',
                              active
                                ? 'bg-white/8 text-[var(--color-text)]'
                                : 'text-[var(--color-text-dim)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-tint)]'
                            )}
                          >
                            <sub.icon className="h-3.5 w-3.5" />
                            {sub.label}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </nav>

        <div
          className={cn(
            'border-t border-[var(--color-border)] space-y-1',
            collapsed ? 'md:p-2 p-3' : 'p-3'
          )}
        >
          {/* Bouton collapse — desktop uniquement */}
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={collapsed ? 'Étendre la sidebar' : 'Réduire la sidebar'}
            title={collapsed ? 'Étendre' : 'Réduire'}
            className={cn(
              'hidden md:flex items-center gap-3 w-full rounded-md text-sm text-[var(--color-text-dim)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-tint)] transition-colors',
              collapsed ? 'justify-center px-2 py-2' : 'px-3 py-2'
            )}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <>
                <ChevronLeft className="h-4 w-4" />
                <span>Réduire</span>
              </>
            )}
          </button>

          <div
            className={cn(
              'flex items-center',
              collapsed ? 'md:flex-col md:gap-1' : 'justify-between px-1'
            )}
          >
            <Link
              href="/dashboard"
              title={collapsed ? 'Retour côté user' : undefined}
              className={cn(
                'flex items-center gap-3 rounded-md text-sm text-[var(--color-text-dim)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-tint)]',
                collapsed
                  ? 'md:justify-center md:w-full md:px-2 md:py-2 flex-1 px-3 py-2'
                  : 'px-3 py-2 flex-1'
              )}
            >
              <ArrowLeftFromLine className="h-4 w-4 flex-shrink-0" />
              <span className={cn(collapsed && 'md:hidden')}>
                Retour côté user
              </span>
            </Link>
            <div className={cn(collapsed && 'md:w-full md:flex md:justify-center')}>
              <ThemeToggle variant="ghost" />
            </div>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              title={collapsed ? 'Déconnexion' : undefined}
              className={cn(
                'w-full flex items-center gap-3 rounded-md text-sm text-rose-400 light:text-rose-600 hover:bg-rose-500/10',
                collapsed ? 'md:justify-center md:px-2 md:py-2 px-3 py-2' : 'px-3 py-2'
              )}
            >
              <ArrowLeftFromLine className="h-4 w-4 rotate-180 flex-shrink-0" />
              <span className={cn(collapsed && 'md:hidden')}>Déconnexion</span>
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}
