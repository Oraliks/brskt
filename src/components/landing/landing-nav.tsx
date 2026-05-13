'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { useLanding } from './landing-context';
import { cn } from '@/lib/utils';

interface Props {
  authenticated?: boolean;
  /** Index de la section "Commencer" / CTA finale */
  ctaSectionIndex?: number;
}

const LINKS = [
  { label: 'VIP', sectionIndex: 1 },
  { label: 'Formation', sectionIndex: 2 },
];

export function LandingNav({ authenticated = false, ctaSectionIndex = 3 }: Props) {
  const { goTo } = useLanding();
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] opacity-0 animate-[radix-fade-in_1s_0.3s_forwards]">
      <nav className="flex items-center gap-2 sm:gap-4 px-3 sm:px-6 py-3 rounded-full bg-[rgba(20,20,30,0.6)] backdrop-blur-xl border border-[var(--color-border)] shadow-2xl">
        <button
          onClick={() => goTo(0)}
          className="flex items-center gap-2 px-2 outline-none"
        >
          <span className="landing-pulse-dot h-2 w-2 rounded-full bg-gradient-to-br from-indigo-500 to-pink-500" />
          <span className="text-[15px] font-semibold tracking-tight">
            Boursikotons
          </span>
        </button>

        <div className="hidden md:flex items-center gap-1">
          {LINKS.map((l) => (
            <button
              key={l.label}
              onClick={() => goTo(l.sectionIndex)}
              className="px-3 py-1 text-[13px] text-[var(--color-text-dim)] hover:text-white transition-colors rounded-full outline-none"
            >
              {l.label}
            </button>
          ))}
        </div>

        {authenticated ? (
          <Link
            href="/dashboard"
            className="hidden md:inline-flex items-center px-4 py-2 rounded-full bg-white text-[var(--color-bg)] text-[13px] font-medium hover:-translate-y-px hover:shadow-[0_8px_20px_rgba(255,255,255,0.15)] transition-all"
          >
            Dashboard
          </Link>
        ) : (
          <button
            onClick={() => goTo(ctaSectionIndex)}
            className="hidden md:inline-flex items-center px-4 py-2 rounded-full bg-white text-[var(--color-bg)] text-[13px] font-medium hover:-translate-y-px hover:shadow-[0_8px_20px_rgba(255,255,255,0.15)] transition-all outline-none"
          >
            Commencer
          </button>
        )}

        <button
          className="md:hidden inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-white/5"
          onClick={() => setOpen((v) => !v)}
          aria-label="Menu"
        >
          {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
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
        <div className="rounded-2xl bg-[rgba(20,20,30,0.85)] backdrop-blur-xl border border-[var(--color-border)] p-3 flex flex-col gap-1">
          {LINKS.map((l) => (
            <button
              key={l.label}
              onClick={() => {
                goTo(l.sectionIndex);
                setOpen(false);
              }}
              className="px-3 py-2 text-left text-sm rounded-md hover:bg-white/5"
            >
              {l.label}
            </button>
          ))}
          {authenticated ? (
            <Link
              href="/dashboard"
              onClick={() => setOpen(false)}
              className="mt-1 px-3 py-2 rounded-md bg-white text-[var(--color-bg)] text-sm font-medium text-center"
            >
              Dashboard
            </Link>
          ) : (
            <button
              onClick={() => {
                goTo(ctaSectionIndex);
                setOpen(false);
              }}
              className="mt-1 px-3 py-2 rounded-md bg-white text-[var(--color-bg)] text-sm font-medium text-center"
            >
              Commencer
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
