'use client';

import Link from 'next/link';
import { useState } from 'react';
import { LogOut, Menu, Settings, Sparkles, X } from 'lucide-react';
import { Logo } from './logo';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ThemeToggle } from '@/components/theme/theme-toggle';
import { logoutAction } from '@/lib/actions/auth';
import { cn } from '@/lib/utils';

interface NavbarProps {
  /** Si fourni, l'user est connecté → on affiche avatar dropdown + ThemeToggle. */
  user?: {
    name: string;
    image?: string | null;
  } | null;
  /** Si true, l'user a accès à /admin (lien affiché dans le dropdown). */
  isAdmin?: boolean;
}

const PUBLIC_LINKS = [
  { href: '/formation', label: 'Formation' },
  { href: '/vip', label: 'VIP Telegram' },
  { href: '/temoignages', label: 'Témoignages' },
];

const AUTH_LINKS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/jeux', label: 'Jeux' },
  { href: '/formation', label: 'Formation' },
  { href: '/vip', label: 'VIP Telegram' },
  { href: '/temoignages', label: 'Témoignages' },
];

/**
 * Navbar unifiée : adapte ses liens et son côté droit selon l'état auth.
 *
 *  - Pas connecté → liens publics (Formation, VIP, Témoignages) +
 *    boutons "Se connecter" / "Réserver"
 *  - Connecté → liens app (Dashboard, Formation, VIP) + avatar dropdown
 *    (Mon espace, Admin, Déconnexion)
 *  - Admin → en plus, lien "Admin" doré dans la nav + dans le dropdown
 *
 * Utilisée dans (public)/(chrome)/layout.tsx et (app)/layout.tsx.
 */
export function Navbar({ user, isAdmin }: NavbarProps) {
  const [open, setOpen] = useState(false);
  const authenticated = !!user;
  const links = authenticated ? AUTH_LINKS : PUBLIC_LINKS;
  const initial = (user?.name ?? '?').charAt(0).toUpperCase();

  return (
    <header className="sticky top-0 z-40 w-full">
      <div className="absolute inset-0 backdrop-blur-md bg-[var(--color-bg)]/60 border-b border-[var(--color-border)]" />
      <div className="relative mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-8">
          <Logo />
          <nav className="hidden md:flex items-center gap-6">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm text-[var(--color-text-dim)] hover:text-[var(--color-text)] transition-colors"
              >
                {link.label}
              </Link>
            ))}
            {isAdmin && (
              <Link
                href="/admin"
                className="text-sm text-amber-300/80 hover:text-amber-200 transition-colors inline-flex items-center gap-1"
              >
                <Sparkles className="h-3 w-3" />
                Admin
              </Link>
            )}
          </nav>
        </div>

        <div className="hidden md:flex items-center gap-2">
          <ThemeToggle variant="ghost" />
          {authenticated ? (
            <DropdownMenu>
              <DropdownMenuTrigger className="inline-flex items-center gap-2 rounded-full hover:bg-[var(--color-surface-tint)] transition-colors p-1 pr-3">
                {user?.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.image} alt="" className="h-7 w-7 rounded-full" />
                ) : (
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-pink-500 text-xs font-medium text-white">
                    {initial}
                  </span>
                )}
                <span className="text-sm">{user?.name}</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[180px]">
                <DropdownMenuItem asChild>
                  <Link href="/dashboard">Mon espace</Link>
                </DropdownMenuItem>
                {isAdmin && (
                  <DropdownMenuItem asChild>
                    <Link href="/admin/settings">
                      <Settings className="h-4 w-4" />
                      Paramètres
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-rose-400 light:text-rose-600 focus:text-rose-300"
                  onSelect={() => {
                    void logoutAction();
                  }}
                >
                  <LogOut className="h-4 w-4" />
                  Se déconnecter
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Button asChild size="sm" variant="ghost">
                <Link href="/login">Se connecter</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/formation/reserver">Réserver</Link>
              </Button>
            </>
          )}
        </div>

        <div className="md:hidden flex items-center gap-1">
          <ThemeToggle variant="ghost" />
          <button
            className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-[var(--color-surface-tint)]"
            onClick={() => setOpen((v) => !v)}
            aria-label="Menu"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      <div
        className={cn(
          'md:hidden relative overflow-hidden transition-all',
          open ? 'max-h-96' : 'max-h-0'
        )}
      >
        <div className="backdrop-blur-md bg-[var(--color-bg)]/95 border-b border-[var(--color-border)] px-4 py-4 flex flex-col gap-3">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="text-sm text-[var(--color-text-dim)] py-2"
            >
              {link.label}
            </Link>
          ))}
          {isAdmin && (
            <Link
              href="/admin"
              onClick={() => setOpen(false)}
              className="text-sm text-amber-300/80 py-2 inline-flex items-center gap-1"
            >
              <Sparkles className="h-3 w-3" />
              Admin
            </Link>
          )}
          <div className="flex flex-col gap-2 pt-3 border-t border-[var(--color-border)]">
            {authenticated ? (
              <form action={logoutAction}>
                <Button
                  type="submit"
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-rose-300"
                >
                  <LogOut className="h-4 w-4" />
                  Déconnexion
                </Button>
              </form>
            ) : (
              <>
                <Button asChild size="sm" variant="ghost">
                  <Link href="/login">Se connecter</Link>
                </Button>
                <Button asChild size="sm">
                  <Link href="/formation/reserver">Réserver</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
