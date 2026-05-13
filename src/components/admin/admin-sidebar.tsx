'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ArrowLeftFromLine,
  CalendarCheck,
  LayoutDashboard,
  Settings,
  Shield,
  Sparkles,
  Users,
} from 'lucide-react';
import { Logo } from '@/components/shared/logo';
import { logoutAction } from '@/lib/actions/auth';
import { cn } from '@/lib/utils';

const links = [
  { href: '/admin', label: 'Overview', icon: LayoutDashboard },
  { href: '/admin/bookings', label: 'Réservations', icon: CalendarCheck },
  { href: '/admin/vip', label: 'VIP', icon: Sparkles },
  { href: '/admin/users', label: 'Utilisateurs', icon: Users },
  { href: '/admin/settings', label: 'Paramètres', icon: Settings },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex w-64 flex-col border-r border-[var(--color-border)] bg-[var(--color-bg-elevated)]/40 backdrop-blur-md sticky top-0 h-screen">
      <div className="px-6 py-6 border-b border-[var(--color-border)]">
        <Logo />
        <div className="mt-2 inline-flex items-center gap-1.5 text-xs text-amber-300">
          <Shield className="h-3 w-3" />
          Back-office
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
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
                  : 'text-[var(--color-text-dim)] hover:text-[var(--color-text)] hover:bg-white/5'
              )}
            >
              <link.icon className="h-4 w-4" />
              {link.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-[var(--color-border)] p-3 space-y-1">
        <Link
          href="/dashboard"
          className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-[var(--color-text-dim)] hover:text-[var(--color-text)] hover:bg-white/5"
        >
          <ArrowLeftFromLine className="h-4 w-4" />
          Retour côté user
        </Link>
        <form action={logoutAction}>
          <button
            type="submit"
            className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-rose-300 hover:bg-rose-500/10"
          >
            <ArrowLeftFromLine className="h-4 w-4 rotate-180" />
            Déconnexion
          </button>
        </form>
      </div>
    </aside>
  );
}
