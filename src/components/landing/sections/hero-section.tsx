'use client';

import { ArrowRight } from 'lucide-react';
import { useLanding } from '../landing-context';

export function HeroSection() {
  const { goTo } = useLanding();

  return (
    <div className="relative w-full max-w-4xl text-center">
      {/* Badge */}
      <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-xs text-indigo-300 mb-8 opacity-0 animate-[radix-fade-in_0.8s_0.1s_forwards] hover:border-indigo-400/50 hover:bg-indigo-500/15 transition-colors">
        <span className="landing-pulse-dot h-1.5 w-1.5 rounded-full bg-indigo-300" />
        Trading depuis 2018
      </div>

      {/* Title */}
      <h1 className="text-[clamp(30px,8vw,88px)] leading-[1.05] tracking-[-0.04em] font-semibold mb-6 break-words">
        <span className="block opacity-0 translate-y-6 animate-[hero-slide-up_0.8s_0.25s_forwards]">
          Maîtrise les marchés
        </span>
        <span
          className="block font-serif italic font-normal opacity-0 translate-y-6 animate-[hero-slide-up_0.8s_0.4s_forwards] animate-gradient"
          style={{
            background:
              'linear-gradient(135deg, #6366f1 0%, #ec4899 50%, #14b8a6 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            backgroundSize: '200% 200%',
          }}
        >
          comme un pro.
        </span>
      </h1>

      <p className="text-[19px] text-[var(--color-text-dim)] leading-[1.5] max-w-[540px] mx-auto mb-10 opacity-0 translate-y-4 animate-[hero-slide-up_0.7s_0.55s_forwards]">
        Une semaine de formation intensive, en présentiel à Dubaï ou à
        distance. Méthodologie testée, résultats mesurables.
      </p>

      <div className="flex flex-col sm:flex-row gap-3 justify-center opacity-0 translate-y-4 animate-[hero-slide-up_0.7s_0.7s_forwards]">
        <button
          onClick={() => goTo(1)}
          className="btn-shimmer group inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-white text-[var(--color-bg)] text-sm font-medium hover:-translate-y-1 hover:scale-[1.02] hover:shadow-[0_16px_40px_-8px_rgba(255,255,255,0.4)] active:scale-[0.98] transition-all duration-300"
        >
          Rejoindre le VIP
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
        </button>
        <button
          onClick={() => goTo(2)}
          className="group inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-white/5 border border-[var(--color-border)] text-white text-sm font-medium backdrop-blur-sm hover:bg-white/10 hover:border-white/30 hover:-translate-y-1 active:scale-[0.98] transition-all duration-300"
        >
          Voir les formations
          <ArrowRight className="h-3.5 w-3.5 opacity-0 -translate-x-1 transition-all group-hover:opacity-100 group-hover:translate-x-0" />
        </button>
      </div>

      {/* Floating chart — absolu sur desktop pour overlay, dans le flow sur mobile */}
      <svg
        viewBox="0 0 600 120"
        preserveAspectRatio="none"
        className="mt-10 md:mt-0 md:absolute md:left-1/2 md:-translate-x-1/2 md:-bottom-32 w-full md:w-[80%] max-w-[600px] mx-auto h-[80px] md:h-[120px] opacity-0 animate-[radix-fade-in_1.5s_1.5s_forwards] pointer-events-none"
      >
        <defs>
          <linearGradient id="chart-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d="M0,90 L50,75 L100,80 L150,60 L200,65 L250,45 L300,50 L350,35 L400,40 L450,25 L500,30 L550,15 L600,20"
          stroke="#6366f1"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="2000"
          strokeDashoffset="2000"
        >
          <animate
            attributeName="stroke-dashoffset"
            from="2000"
            to="0"
            dur="3s"
            fill="freeze"
          />
        </path>
        <path
          d="M0,90 L50,75 L100,80 L150,60 L200,65 L250,45 L300,50 L350,35 L400,40 L450,25 L500,30 L550,15 L600,20 L600,120 L0,120 Z"
          fill="url(#chart-grad)"
          opacity="0"
        >
          <animate
            attributeName="opacity"
            from="0"
            to="1"
            begin="2s"
            dur="1s"
            fill="freeze"
          />
        </path>
      </svg>
    </div>
  );
}
