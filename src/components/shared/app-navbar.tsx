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
import { logoutAction } from '@/lib/actions/auth';
import { cn } from '@/lib/utils';

interface AppNavbarProps {
  userName: string;
  userImage?: string | null;
  isAdmin?: boolean;
}

const links = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/vip', label: 'VIP Telegram' },
];

export function AppNavbar({ userName, userImage, isAdmin }: AppNavbarProps) {
  const [open, setOpen] = useState(false);
  const initial = userName.charAt(0).toUpperCase();

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

        <DropdownMenu>
          <DropdownMenuTrigger className="hidden md:inline-flex items-center gap-2 rounded-full hover:bg-white/5 transition-colors p-1 pr-3">
            {userImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={userImage}
                alt=""
                className="h-7 w-7 rounded-full"
              />
            ) : (
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-pink-500 text-xs font-medium text-white">
                {initial}
              </span>
            )}
            <span className="text-sm">{userName}</span>
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
              className="text-rose-300 focus:text-rose-200"
              onSelect={() => {
                void logoutAction();
              }}
            >
              <LogOut className="h-4 w-4" />
              Se déconnecter
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <button
          className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-white/5"
          onClick={() => setOpen((v) => !v)}
          aria-label="Menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
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
              className="text-sm py-2"
            >
              {link.label}
            </Link>
          ))}
          {isAdmin && (
            <Link
              href="/admin"
              onClick={() => setOpen(false)}
              className="text-sm py-2 text-amber-300/80"
            >
              Admin
            </Link>
          )}
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
        </div>
      </div>
    </header>
  );
}
