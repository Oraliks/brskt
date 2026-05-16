'use client';

import { useEffect, useState } from 'react';
import { BackgroundFX } from '@/components/shared/background-fx';
import { Footer } from '@/components/shared/footer';
import { AdminSidebar } from './admin-sidebar';
import { CommandPalette } from './command-palette';
import { cn } from '@/lib/utils';

const COLLAPSE_KEY = 'admin-sidebar-collapsed';

/**
 * Coquille client de l'admin layout. Gère l'état collapsed de la sidebar
 * (persisté en localStorage) et ajuste le margin-left du main en
 * conséquence.
 *
 * Pourquoi un client component séparé : le layout admin est server (pour
 * `requireAdmin()`), donc l'état React doit vivre ailleurs. AdminShell
 * permet de garder la sidebar fixed (plus fiable que sticky) tout en
 * laissant le main s'adapter dynamiquement.
 */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Lecture localStorage au mount uniquement (évite SSR mismatch)
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(COLLAPSE_KEY);
      if (stored === '1') setCollapsed(true);
    } catch {
      // ignore
    }
    setHydrated(true);
  }, []);

  // Persistance
  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0');
    } catch {
      // ignore
    }
  }, [collapsed, hydrated]);

  return (
    <>
      <BackgroundFX />
      <AdminSidebar
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((v) => !v)}
      />
      <CommandPalette />
      <div
        className={cn(
          'min-h-screen flex flex-col transition-[margin-left] duration-200',
          // Sur mobile la sidebar est un drawer (off-canvas) → pas de ml
          // Sur desktop la sidebar est fixed → on laisse la place
          collapsed ? 'md:ml-16' : 'md:ml-64'
        )}
      >
        <main className="flex-1 min-w-0">{children}</main>
        <Footer />
      </div>
    </>
  );
}
