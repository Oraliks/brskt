'use client';

import {
  Children,
  isValidElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { LandingContext } from './landing-context';
import { cn } from '@/lib/utils';

interface LandingShellProps {
  labels: readonly string[];
  /** Navigation rendue dans le provider (a accès au contexte) */
  nav?: React.ReactNode;
  children: React.ReactNode;
}

const ANIM_MS = 800;

export function LandingShell({ labels, nav, children }: LandingShellProps) {
  const sections = useMemo(
    () => Children.toArray(children).filter(isValidElement),
    [children]
  );
  const total = sections.length;

  const [active, setActive] = useState(0);

  // Lock via timestamp (plus simple que isAnimating + setTimeout qui peut rester coincé)
  const lockedUntil = useRef(0);
  const touchStartY = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const goTo = useCallback(
    (index: number) => {
      const now = Date.now();
      if (now < lockedUntil.current) return;
      if (index < 0 || index >= total) return;
      lockedUntil.current = now + ANIM_MS;
      setActive((prev) => (index === prev ? prev : index));
    },
    [total]
  );

  // Wheel — attaché uniquement à window (les events sur le container bubble)
  useEffect(() => {
    function onWheel(e: WheelEvent) {
      if (Date.now() < lockedUntil.current) return;
      if (e.deltaY === 0) return;
      // Lock IMMÉDIATEMENT pour bloquer les events suivants dans la même rafale
      lockedUntil.current = Date.now() + ANIM_MS;
      const direction = e.deltaY > 0 ? 1 : -1;
      setActive((prev) => {
        const next = prev + direction;
        if (next < 0 || next >= total) return prev;
        return next;
      });
    }
    window.addEventListener('wheel', onWheel, { passive: true });
    return () => window.removeEventListener('wheel', onWheel);
  }, [total]);

  // Keyboard
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      let direction: 1 | -1 | 0 = 0;
      if (e.key === 'ArrowDown' || e.key === 'PageDown') direction = 1;
      else if (e.key === 'ArrowUp' || e.key === 'PageUp') direction = -1;
      if (direction === 0) return;
      e.preventDefault();
      if (Date.now() < lockedUntil.current) return;
      lockedUntil.current = Date.now() + ANIM_MS;
      setActive((prev) => {
        const next = prev + direction;
        if (next < 0 || next >= total) return prev;
        return next;
      });
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [total]);

  // Touch
  useEffect(() => {
    function onStart(e: TouchEvent) {
      touchStartY.current = e.touches[0]?.clientY ?? 0;
    }
    function onEnd(e: TouchEvent) {
      const endY = e.changedTouches[0]?.clientY ?? 0;
      const diff = touchStartY.current - endY;
      if (Math.abs(diff) <= 50) return;
      if (Date.now() < lockedUntil.current) return;
      lockedUntil.current = Date.now() + ANIM_MS;
      const direction = diff > 0 ? 1 : -1;
      setActive((prev) => {
        const next = prev + direction;
        if (next < 0 || next >= total) return prev;
        return next;
      });
    }
    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchend', onEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchend', onEnd);
    };
  }, [total]);

  // Bloque le scroll du body uniquement quand le landing est monté
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <LandingContext.Provider value={{ active, total, goTo }}>
      <div
        ref={containerRef}
        className="relative h-[100dvh] w-screen overflow-hidden"
      >
        {nav}

        {/* Sections empilées */}
        <div className="sections relative z-10 h-full w-full">
          {sections.map((child, i) => (
            <div
              key={i}
              data-section={i}
              className={cn(
                'absolute inset-0 flex items-center justify-center px-6 sm:px-12 py-24 transition-all duration-700 ease-[cubic-bezier(0.4,0,0.2,1)]',
                active === i
                  ? 'opacity-100 translate-y-0 pointer-events-auto'
                  : 'opacity-0 translate-y-5 pointer-events-none'
              )}
            >
              {child}
            </div>
          ))}
        </div>

        {/* Side nav dots (desktop) */}
        <div className="fixed right-8 top-1/2 -translate-y-1/2 z-50 hidden md:flex flex-col gap-4 opacity-0 animate-[radix-fade-in_1s_1s_forwards]">
          {labels.map((label, i) => (
            <button
              key={label}
              onClick={() => goTo(i)}
              className="group relative p-2 -m-2 outline-none"
              aria-label={label}
            >
              <span
                className={cn(
                  'block h-2 w-2 rounded-full transition-all',
                  active === i
                    ? 'bg-white scale-[1.4]'
                    : 'bg-white/20 group-hover:bg-white/40'
                )}
              />
              <span className="absolute right-full mr-3 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-md bg-[var(--color-bg-elevated)] border border-[var(--color-border)] px-2 py-1 text-[11px] text-[var(--color-text)] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                {label}
              </span>
            </button>
          ))}
        </div>

        {/* Section counter (bottom-left) */}
        <div className="fixed bottom-8 left-8 z-50 font-mono text-xs text-[var(--color-text-dim)] tracking-[0.1em] opacity-0 animate-[radix-fade-in_1s_1.2s_forwards]">
          <span className="text-white font-medium">
            {String(active + 1).padStart(2, '0')}
          </span>{' '}
          / {String(total).padStart(2, '0')}
        </div>

        {/* Scroll hint (bottom-center, desktop) */}
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 hidden md:flex items-center gap-2 text-[11px] text-[var(--color-text-dim)] opacity-0 animate-[radix-fade-in_1s_1.5s_forwards] pointer-events-none">
          Navigation :
          <kbd className="rounded border border-[var(--color-border)] bg-white/[0.08] px-1.5 py-0.5 text-[10px] font-mono">
            ↑
          </kbd>
          <kbd className="rounded border border-[var(--color-border)] bg-white/[0.08] px-1.5 py-0.5 text-[10px] font-mono">
            ↓
          </kbd>
          ou
          <kbd className="rounded border border-[var(--color-border)] bg-white/[0.08] px-1.5 py-0.5 text-[10px] font-mono">
            scroll
          </kbd>
        </div>
      </div>
    </LandingContext.Provider>
  );
}
