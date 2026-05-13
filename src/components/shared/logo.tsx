import Link from 'next/link';
import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
  variant?: 'full' | 'short';
  href?: string | null;
}

export function Logo({ className, variant = 'full', href = '/' }: LogoProps) {
  const content = (
    <span
      className={cn(
        'inline-flex items-center gap-2 select-none',
        className
      )}
    >
      <span className="relative inline-flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-indigo-500 to-pink-500 shadow-[0_0_20px_rgba(99,102,241,0.5)]">
        <span className="font-serif text-white text-base leading-none">B</span>
      </span>
      {variant === 'full' && (
        <span className="font-semibold tracking-tight text-base">
          Boursikotons
        </span>
      )}
    </span>
  );

  if (href === null) return content;
  return <Link href={href}>{content}</Link>;
}
