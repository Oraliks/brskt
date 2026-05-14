'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { Logo } from './logo';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface NavbarProps {
  authenticated?: boolean;
}

const links = [
  { href: '/formation', label: 'Formation' },
  { href: '/vip', label: 'VIP Telegram' },
];

export function Navbar({ authenticated = false }: NavbarProps) {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 w-full">
      <div className="absolute inset-0 backdrop-blur-md bg-[var(--color-bg)]/60 border-b border-[var(--color-border)]" />
      <div className="relative mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Logo />

        <nav className="hidden md:flex items-center gap-8">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-[var(--color-text-dim)] hover:text-[var(--color-text)] transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-2">
          {authenticated ? (
            <Button asChild size="sm" variant="secondary">
              <Link href="/dashboard">Dashboard</Link>
            </Button>
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

        <button
          className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-[var(--color-surface-tint)]"
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
              className="text-sm text-[var(--color-text-dim)] py-2"
            >
              {link.label}
            </Link>
          ))}
          <div className="flex flex-col gap-2 pt-3 border-t border-[var(--color-border)]">
            {authenticated ? (
              <Button asChild size="sm" variant="secondary">
                <Link href="/dashboard">Dashboard</Link>
              </Button>
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
