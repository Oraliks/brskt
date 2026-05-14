import Link from 'next/link';
import { Logo } from './logo';

const SUPPORT_TELEGRAM = 'https://t.me/boursi_support';

/**
 * Footer minimaliste — une seule ligne, identique sur toutes les pages.
 * Logo + lien CGV + lien support + copyright.
 *
 * Volontairement compact : la majorité des liens "produits" sont déjà dans
 * la navbar, dupliquer en bas crée du bruit.
 */
export function Footer() {
  return (
    <footer className="mt-12 border-t border-[var(--color-border)]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Logo />
          <span className="text-xs text-[var(--color-text-faint)]">
            © {new Date().getFullYear()} · Dubai, UAE
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs">
          <Link
            href="/legal/cgv"
            className="text-[var(--color-text-dim)] hover:text-[var(--color-text)] transition-colors"
          >
            CGV
          </Link>
          <Link
            href={SUPPORT_TELEGRAM}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--color-text-dim)] hover:text-[var(--color-text)] transition-colors inline-flex items-center gap-1.5"
          >
            <TelegramIcon className="h-3 w-3" />
            Support
          </Link>
        </div>
      </div>
    </footer>
  );
}

function TelegramIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z" />
    </svg>
  );
}
