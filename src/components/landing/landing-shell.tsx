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
const DESKTOP_BREAKPOINT = '(min-width: 768px)';

export function LandingShell({ labels, nav, children }: LandingShellProps) {
  const sections = useMemo(
    () => Children.toArray(children).filter(isValidElement),
    [children]
  );
  const total = sections.length;

  const [active, setActive] = useState(0);
  const [isDesktop, setIsDesktop] = useState(true);

  const lockedUntil = useRef(0);
  const touchStartY = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Array<HTMLDivElement | null>>([]);

  // Détecter desktop vs mobile
  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_BREAKPOINT);
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  const goTo = useCallback(
    (index: number) => {
      if (index < 0 || index >= total) return;

      if (!isDesktop) {
        // Mobile : scroll natif vers la section
        const el = sectionRefs.current[index];
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          setActive(index);
        }
        return;
      }

      const now = Date.now();
      if (now < lockedUntil.current) return;
      lockedUntil.current = now + ANIM_MS;
      setActive(index);
    },
    [total, isDesktop]
  );

  // ----- Desktop only : wheel + keyboard + body lock -----
  useEffect(() => {
    if (!isDesktop) return;

    function onWheel(e: WheelEvent) {
      if (Date.now() < lockedUntil.current) return;
      if (e.deltaY === 0) return;
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
  }, [total, isDesktop]);

  useEffect(() => {
    if (!isDesktop) return;
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
  }, [total, isDesktop]);

  useEffect(() => {
    if (!isDesktop) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isDesktop]);

  // ----- Mobile only : touch swipe (optionnel) + intersection observer pour active dot -----
  useEffect(() => {
    if (isDesktop) return;

    function onStart(e: TouchEvent) {
      touchStartY.current = e.touches[0]?.clientY ?? 0;
    }
    function onEnd(e: TouchEvent) {
      const endY = e.changedTouches[0]?.clientY ?? 0;
      const diff = touchStartY.current - endY;
      if (Math.abs(diff) <= 80) return;
      if (Date.now() < lockedUntil.current) return;
      const direction = diff > 0 ? 1 : -1;
      const next = active + direction;
      if (next < 0 || next >= total) return;
      const el = sectionRefs.current[next];
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
    // Swipe désactivé sur mobile pour laisser le scroll natif libre.
    // Le indicator suit via IntersectionObserver ci-dessous.
    void onStart;
    void onEnd;
  }, [isDesktop, active, total]);

  useEffect(() => {
    if (isDesktop) return;
    const els = sectionRefs.current.filter(
      (el): el is HTMLDivElement => el !== null
    );
    if (els.length === 0) return;

    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && e.intersectionRatio > 0.4) {
            const idx = els.indexOf(e.target as HTMLDivElement);
            if (idx !== -1) setActive(idx);
          }
        }
      },
      { threshold: [0.4, 0.7] }
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [isDesktop, total]);

  return (
    <LandingContext.Provider value={{ active, total, goTo }}>
      <div
        ref={containerRef}
        className={cn(
          'relative',
          isDesktop ? 'h-[100dvh] w-screen overflow-hidden' : 'min-h-screen'
        )}
      >
        {nav}

        {/* Sections */}
        <div
          className={cn(
            'relative z-10',
            isDesktop ? 'h-full w-full' : 'flex flex-col'
          )}
        >
          {sections.map((child, i) => (
            <div
              key={i}
              ref={(el) => {
                sectionRefs.current[i] = el;
              }}
              data-section={i}
              className={cn(
                'flex items-center justify-center px-5 sm:px-12',
                isDesktop
                  ? cn(
                      'absolute inset-0 py-24 transition-all duration-700 ease-[cubic-bezier(0.4,0,0.2,1)]',
                      active === i
                        ? 'opacity-100 translate-y-0 pointer-events-auto'
                        : 'opacity-0 translate-y-5 pointer-events-none'
                    )
                  : 'min-h-[100dvh] py-20'
              )}
            >
              {child}
            </div>
          ))}
        </div>

        {/* Side nav dots (desktop only) */}
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

        {/* Compteur — desktop bottom-left ; mobile : caché (les sections s'enchainent) */}
        <div className="fixed bottom-8 left-8 z-50 hidden md:block font-mono text-xs text-[var(--color-text-dim)] tracking-[0.1em] opacity-0 animate-[radix-fade-in_1s_1.2s_forwards]">
          <span className="text-white font-medium">
            {String(active + 1).padStart(2, '0')}
          </span>{' '}
          / {String(total).padStart(2, '0')}
        </div>

        {/* Scroll hint (desktop only) */}
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
