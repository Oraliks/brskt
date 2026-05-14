'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  ArrowLeftFromLine,
  CalendarCheck,
  LayoutDashboard,
  Menu,
  Settings,
  Shield,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  Users,
  X,
} from 'lucide-react';
import { Logo } from '@/components/shared/logo';
import { ThemeToggle } from '@/components/theme/theme-toggle';
import { logoutAction } from '@/lib/actions/auth';
import { cn } from '@/lib/utils';

const links = [
  { href: '/admin', label: 'Overview', icon: LayoutDashboard },
  { href: '/admin/bookings', label: 'Réservations', icon: CalendarCheck },
  { href: '/admin/vip', label: 'VIP', icon: Sparkles },
  { href: '/admin/funnel', label: 'Funnel', icon: TrendingDown },
  { href: '/admin/users', label: 'Utilisateurs', icon: Users },
  { href: '/admin/audit', label: 'Audit log', icon: ShieldCheck },
  { href: '/admin/settings', label: 'Paramètres', icon: Settings },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

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

        <nav className="flex-1 min-h-0 px-3 py-4 space-y-1 overflow-y-auto">
          {links.map((link) => {
            const active =
              link.href === '/admin'
                ? pathname === link.href
                : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                  active
                    ? 'bg-white/8 text-[var(--color-text)]'
                    : 'text-[var(--color-text-dim)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-tint)]'
                )}
              >
                <link.icon className="h-4 w-4" />
                {link.label}
              </Link>
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
