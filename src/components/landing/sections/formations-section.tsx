'use client';

import Link from 'next/link';
import { ArrowRight, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FormationCardData {
  tag: string;
  title: string;
  desc: string;
  price: string;
  priceUnit: string;
  features: string[];
  checkColor: string;
  ctaLabel: string;
  href: string;
  variant: 'distance' | 'onsite';
}

const formations: FormationCardData[] = [
  {
    tag: 'Distance',
    title: 'Formation à distance',
    desc: 'Une semaine intensive via visio privée. Idéal pour apprendre depuis chez soi.',
    price: '1500€',
    priceUnit: '/ semaine',
    features: [
      '5 jours · sessions privées',
      'Calendrier flexible',
      'Support post-formation',
    ],
    checkColor: '#14b8a6',
    ctaLabel: 'Réserver à distance',
    href: '/formation/reserver?mode=remote',
    variant: 'distance',
  },
  {
    tag: 'Présentiel · Dubaï',
    title: 'Formation présentiel',
    desc: 'Une semaine intensive en personne à Dubaï. Apprentissage immersif au plus près du marché.',
    price: '3500€',
    priceUnit: '/ semaine',
    features: [
      '5 jours · 1-to-1',
      'Setup trading sur place',
      'Vol A/R non inclus',
    ],
    checkColor: '#ec4899',
    ctaLabel: 'Réserver à Dubaï',
    href: '/formation/reserver?mode=onsite',
    variant: 'onsite',
  },
];

export function FormationsSection() {
  return (
    <div className="grid md:grid-cols-2 gap-6 max-w-[1100px] w-full">
      {formations.map((f) => (
        <FormationCard key={f.tag} data={f} />
      ))}
    </div>
  );
}

function FormationCard({ data }: { data: FormationCardData }) {
  function handleMouseMove(e: React.MouseEvent<HTMLAnchorElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    e.currentTarget.style.setProperty('--mx', `${x}%`);
    e.currentTarget.style.setProperty('--my', `${y}%`);
  }

  return (
    <Link
      href={data.href}
      onMouseMove={handleMouseMove}
      className={cn(
        'spotlight-card group block bg-[rgba(20,20,30,0.5)] backdrop-blur-xl border border-[var(--color-border)] rounded-3xl p-10 transition-all duration-400 hover:-translate-y-1 hover:border-white/15',
        data.variant === 'onsite' && 'pink'
      )}
    >
      <span
        className={cn(
          'inline-block px-2.5 py-1 rounded-md text-[11px] font-medium uppercase tracking-[0.05em] mb-4',
          data.variant === 'distance'
            ? 'bg-indigo-500/15 text-indigo-300'
            : 'bg-pink-500/15 text-pink-300'
        )}
      >
        {data.tag}
      </span>

      <h3 className="text-[32px] font-medium tracking-[-0.02em] mb-3">
        {data.title}
      </h3>
      <p className="text-[15px] text-[var(--color-text-dim)] leading-[1.5] mb-6">
        {data.desc}
      </p>

      <div className="flex items-baseline gap-2 mb-8">
        <span className="text-[48px] font-medium tracking-[-0.03em] leading-none">
          {data.price}
        </span>
        <span className="text-[var(--color-text-dim)] text-sm">
          {data.priceUnit}
        </span>
      </div>

      <ul className="space-y-0 mb-8">
        {data.features.map((feat, i) => (
          <li
            key={feat}
            className={cn(
              'flex items-center gap-2.5 py-2 text-sm text-[var(--color-text-dim)]',
              i < data.features.length - 1 && 'border-b border-[var(--color-border)]'
            )}
          >
            <Check
              className="h-3.5 w-3.5 flex-shrink-0"
              strokeWidth={3}
              style={{ color: data.checkColor }}
            />
            {feat}
          </li>
        ))}
      </ul>

      <div
        className={cn(
          'flex items-center justify-between px-5 py-3.5 rounded-xl border border-[var(--color-border)] text-sm font-medium transition-all',
          'bg-white/5 text-white',
          'group-hover:bg-white group-hover:text-[var(--color-bg)] group-hover:border-white'
        )}
      >
        <span>{data.ctaLabel}</span>
        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
      </div>
    </Link>
  );
}
