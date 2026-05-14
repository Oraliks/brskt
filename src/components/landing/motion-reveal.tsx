'use client';

import { motion, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';

interface MotionRevealProps {
  children: ReactNode;
  /** Délai en secondes avant le start (utile pour staggered reveals). */
  delay?: number;
  /** Distance du translateY initial en px. Défaut : 24. */
  y?: number;
  /** Durée en secondes. Défaut : 0.6. */
  duration?: number;
  /** Marge bottom du viewport pour trigger (ex: '-100px' = 100px avant). */
  viewportMargin?: string;
  className?: string;
  /** Tag HTML wrapper (par défaut div). */
  as?: 'div' | 'section' | 'article' | 'header';
}

/**
 * Wrapper Motion "fade + slide-up on view". S'auto-désactive si l'utilisateur
 * a `prefers-reduced-motion: reduce` (accessibilité).
 *
 * Usage :
 *   <MotionReveal>contenu</MotionReveal>
 *   <MotionReveal delay={0.1} y={32}>contenu</MotionReveal>
 */
export function MotionReveal({
  children,
  delay = 0,
  y = 24,
  duration = 0.6,
  viewportMargin = '-80px',
  className,
  as = 'div',
}: MotionRevealProps) {
  const reduced = useReducedMotion();
  const Component =
    as === 'div'
      ? motion.div
      : as === 'section'
      ? motion.section
      : as === 'article'
      ? motion.article
      : motion.header;

  if (reduced) {
    // Pas d'animation = on rend statique
    return <div className={className}>{children}</div>;
  }

  return (
    <Component
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: viewportMargin }}
      transition={{ duration, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </Component>
  );
}

/**
 * Variante stagger : émet des delays incrémentaux à chaque enfant.
 * Wrap-around d'enfants direct — chaque enfant doit déjà être un MotionReveal
 * pour bénéficier du delay calculé via index.
 */
export function MotionStaggerGroup({
  children,
  baseDelay = 0,
  step = 0.08,
  className,
}: {
  children: ReactNode[];
  baseDelay?: number;
  step?: number;
  className?: string;
}) {
  return (
    <div className={className}>
      {children.map((child, i) => (
        <MotionReveal key={i} delay={baseDelay + i * step}>
          {child}
        </MotionReveal>
      ))}
    </div>
  );
}
