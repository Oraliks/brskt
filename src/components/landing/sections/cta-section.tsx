'use client';

import Link from 'next/link';
import { MotionReveal } from '../motion-reveal';

export function CtaSection() {
  return (
    <MotionReveal as="div" className="text-center max-w-[700px]">
      <h2 className="text-[clamp(36px,5vw,56px)] font-semibold tracking-[-0.03em] leading-[1.1] mb-4">
        Prêt à{' '}
        <span
          className="font-serif italic font-normal"
          style={{
            background: 'linear-gradient(135deg, #14b8a6, #6366f1)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          commencer
        </span>{' '}
        ?
      </h2>
      <p className="text-[17px] text-[var(--color-text-dim)] max-w-[540px] mx-auto mb-8">
        Connecte-toi avec Telegram. Tout le reste prend moins de 5 minutes.
      </p>

      <Link
        href="/login"
        className="btn-shimmer group inline-flex items-center gap-2 px-9 py-4 rounded-full text-white text-base font-medium transition-all duration-300 hover:-translate-y-1 hover:scale-[1.03] active:scale-[0.97]"
        style={{
          background: 'linear-gradient(135deg, #2AABEE 0%, #229ED9 100%)',
          boxShadow: '0 12px 30px rgba(42, 171, 238, 0.3)',
        }}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="white"
          className="transition-transform group-hover:rotate-[8deg]"
        >
          <path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z" />
        </svg>
        Continuer avec Telegram
      </Link>

      <p className="mt-6 text-[13px] text-[var(--color-text-dim)]">
        Pas besoin d'email pour démarrer · Aucun spam
      </p>
    </MotionReveal>
  );
}
