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

export function AdminSidebar() {
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

      {/* Sidebar — desktop persistante, mobile drawer */}
      <aside
        className={cn(
          'flex flex-col border-r border-[var(--color-border)] bg-[var(--color-bg-elevated)]/95 md:bg-[var(--color-bg-elevated)]/40 backdrop-blur-md',
          // Desktop : sticky + self-start pour empêcher le flex-stretch de
          // pousser la hauteur au-delà du viewport (sinon sticky casse).
          // h-[100dvh] = dynamic viewport height (gère mieux mobile)
          'md:sticky md:top-0 md:self-start md:h-[100dvh] md:max-h-screen md:w-64 md:translate-x-0 md:flex',
          // Mobile drawer
          'fixed md:relative inset-y-0 left-0 z-50 w-72 transition-transform duration-300',
          open ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        )}
      >
        <div className="px-6 py-6 border-b border-[var(--color-border)] flex items-center justify-between">
          <div>
            <Logo />
            <div className="mt-2 inline-flex items-center gap-1.5 text-xs text-amber-300">
              <Shield className="h-3 w-3" />
              Back-office
            </div>
          </div>
          <button
            onClick={() => setOpen(false)}
            aria-label="Fermer le menu"
            className="md:hidden inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-[var(--color-surface-tint)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 min-h-0 px-3 py-4 space-y-0.5 overflow-y-auto">
          {NAV.map((item) => {
            if (!isGroup(item)) {
              const active = activeHref === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                    active
                      ? 'bg-white/8 text-[var(--color-text)]'
                      : 'text-[var(--color-text-dim)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-tint)]'
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            }

            const isOpen = openGroups.has(item.id);
            const hasActiveChild = item.items.some(
              (sub) => activeHref === sub.href
            );

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
                {/*
                  Trick CSS grid-template-rows pour animer la hauteur sans
                  connaître la valeur en pixels. L'enfant DOIT avoir min-h-0
                  + overflow-hidden, sinon le contenu déborde au lieu de
                  s'effondrer. Plus simple et plus performant qu'une
                  transition sur max-height avec une valeur arbitraire.
                */}
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

        <div className="border-t border-[var(--color-border)] p-3 space-y-1">
          <div className="flex items-center justify-between px-1">
            <Link
              href="/dashboard"
              className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-[var(--color-text-dim)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-tint)] flex-1"
            >
              <ArrowLeftFromLine className="h-4 w-4" />
              Retour côté user
            </Link>
            <ThemeToggle variant="ghost" />
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-rose-400 light:text-rose-600 hover:bg-rose-500/10"
            >
              <ArrowLeftFromLine className="h-4 w-4 rotate-180" />
              Déconnexion
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}
