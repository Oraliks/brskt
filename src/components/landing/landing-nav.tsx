'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { useLanding } from './landing-context';
import { ThemeToggle } from '@/components/theme/theme-toggle';
import { cn } from '@/lib/utils';

interface Props {
  authenticated?: boolean;
  /** Index de la section "Commencer" / CTA finale */
  ctaSectionIndex?: number;
}

/**
 * Liens de la nav landing. Deux types :
 *  - `sectionIndex` : scrolle vers la section N de la landing (snap)
 *  - `href` : navigation classique vers une autre page
 *
 * On utilise `'href' in l` côté JSX pour narrow proprement — un simple
 * ternaire `l.href ?` ne suffit pas (TS ne peut pas écarter le variant
 * sectionIndex sans tag explicite).
 */
type LandingLink = { label: string } & (
  | { sectionIndex: number }
  | { href: string }
);

const LINKS: LandingLink[] = [
  { label: 'VIP', sectionIndex: 1 },
  { label: 'Formation', sectionIndex: 2 },
  { label: 'Témoignages', href: '/temoignages' },
];

export function LandingNav({ authenticated = false, ctaSectionIndex = 3 }: Props) {
  const { goTo } = useLanding();
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] opacity-0 animate-[radix-fade-in_1s_0.3s_forwards]">
      <nav className="flex items-center gap-2 sm:gap-4 px-3 sm:px-6 py-3 rounded-full bg-[rgba(20,20,30,0.6)] light:bg-[rgba(255,255,255,0.75)] backdrop-blur-xl border border-[var(--color-border)] shadow-2xl light:shadow-[0_8px_32px_-8px_rgba(0,0,0,0.08)] transition-colors hover:border-[var(--color-border-strong)]">
        <button
          onClick={() => goTo(0)}
          className="group flex items-center gap-2 px-2 outline-none"
        >
          <span className="landing-pulse-dot h-2 w-2 rounded-full bg-gradient-to-br from-indigo-500 to-pink-500 transition-transform group-hover:scale-125" />
          <span className="text-[15px] font-semibold tracking-tight transition-colors group-hover:text-[var(--color-text)]">
            Boursikotons
          </span>
        </button>

        <div className="hidden md:flex items-center gap-1">
          {LINKS.map((l) =>
            'href' in l ? (
              <Link
                key={l.label}
                href={l.href}
                className="px-3 py-1 text-[13px] text-[var(--color-text-dim)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-tint)] transition-all rounded-full outline-none"
              >
                {l.label}
              </Link>
            ) : (
              <button
                key={l.label}
                onClick={() => goTo(l.sectionIndex)}
                className="px-3 py-1 text-[13px] text-[var(--color-text-dim)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-tint)] transition-all rounded-full outline-none"
              >
                {l.label}
              </button>
            )
          )}
        </div>

        <ThemeToggle variant="nav" className="hidden md:inline-flex" />

        {authenticated ? (
          <Link
            href="/dashboard"
            className="btn-shimmer hidden md:inline-flex items-center px-4 py-2 rounded-full bg-[var(--color-inverse)] text-[var(--color-on-inverse)] text-[13px] font-medium hover:-translate-y-0.5 hover:shadow-[0_12px_24px_-4px_rgba(0,0,0,0.18)] active:scale-95 transition-all duration-200"
          >
            Dashboard
          </Link>
        ) : (
          <button
            onClick={() => goTo(ctaSectionIndex)}
            className="btn-shimmer hidden md:inline-flex items-center px-4 py-2 rounded-full bg-[var(--color-inverse)] text-[var(--color-on-inverse)] text-[13px] font-medium hover:-translate-y-0.5 hover:shadow-[0_12px_24px_-4px_rgba(0,0,0,0.18)] active:scale-95 transition-all duration-200 outline-none"
          >
            Commencer
          </button>
        )}

        <ThemeToggle variant="nav" className="md:hidden" />

        <button
          className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-surface-tint-strong)] border border-[var(--color-border-strong)] text-[var(--color-text)] hover:bg-[var(--color-surface-tint)] transition-colors"
          onClick={() => setOpen((v) => !v)}
          aria-label="Menu"
          aria-expanded={open}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      <div
        className={cn(
          'md:hidden absolute top-full left-1/2 -translate-x-1/2 mt-3 min-w-[200px] transition-all',
          open
            ? 'opacity-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 -translate-y-2 pointer-events-none'
        )}
      >
        <div className="rounded-2xl bg-[rgba(20,20,30,0.85)] light:bg-[rgba(255,255,255,0.95)] backdrop-blur-xl border border-[var(--color-border)] p-3 flex flex-col gap-1 shadow-xl light:shadow-[0_12px_40px_-16px_rgba(0,0,0,0.12)]">
          {LINKS.map((l) =>
            'href' in l ? (
              <Link
                key={l.label}
                href={l.href}
                onClick={() => setOpen(false)}
                className="px-3 py-2 text-left text-sm rounded-md hover:bg-[var(--color-surface-tint)]"
              >
                {l.label}
              </Link>
            ) : (
              <button
                key={l.label}
                onClick={() => {
                  goTo(l.sectionIndex);
                  setOpen(false);
                }}
                className="px-3 py-2 text-left text-sm rounded-md hover:bg-[var(--color-surface-tint)]"
              >
                {l.label}
              </button>
            )
          )}
          {authenticated ? (
            <Link
              href="/dashboard"
              onClick={() => setOpen(false)}
              className="mt-1 px-3 py-2 rounded-md bg-[var(--color-inverse)] text-[var(--color-on-inverse)] text-sm font-medium text-center"
            >
              Dashboard
            </Link>
          ) : (
            <button
              onClick={() => {
                goTo(ctaSectionIndex);
                setOpen(false);
              }}
              className="mt-1 px-3 py-2 rounded-md bg-[var(--color-inverse)] text-[var(--color-on-inverse)] text-sm font-medium text-center"
            >
              Commencer
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
