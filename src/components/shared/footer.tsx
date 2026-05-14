import Link from 'next/link';
import { Logo } from './logo';

const SUPPORT_TELEGRAM = 'https://t.me/boursi_support';

interface FooterProps {
  /**
   * Variante "compact" pour les pages connectées (dashboard, checkout) :
   *  affiche uniquement logo + contact support + copyright. Pas de liens
   *  produits/compte (déjà accessibles via la nav et le dashboard).
   */
  compact?: boolean;
}

export function Footer({ compact = false }: FooterProps) {
  if (compact) {
    return (
      <footer className="mt-24 border-t border-[var(--color-border)]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Logo />
            <span className="text-xs text-[var(--color-text-faint)]">
              © {new Date().getFullYear()} · Dubai, UAE
            </span>
          </div>
          <Link
            href={SUPPORT_TELEGRAM}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-[var(--color-text-dim)] hover:text-[var(--color-text)] transition-colors inline-flex items-center gap-1.5"
          >
            <TelegramIcon className="h-4 w-4" />
            Support : @boursi_support
          </Link>
        </div>
      </footer>
    );
  }

  return (
    <footer className="mt-32 border-t border-[var(--color-border)]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid gap-8 md:grid-cols-3">
          <div className="space-y-4">
            <Logo />
            <p className="text-sm text-[var(--color-text-dim)] max-w-xs">
              Formation trading et accès groupe VIP Telegram.
              <br />
              Basé à Dubaï.
            </p>
          </div>

          <FooterColumn
            title="Produits"
            links={[
              { href: '/formation', label: 'Formation distance' },
              { href: '/formation', label: 'Formation Dubaï' },
              { href: '/vip', label: 'Groupe VIP Telegram' },
            ]}
          />

          <FooterColumn
            title="Contact"
            links={[
              {
                href: SUPPORT_TELEGRAM,
                label: 'Support : @boursi_support',
                external: true,
              },
              {
                href:
                  process.env.NEXT_PUBLIC_TELEGRAM_CHANNEL_URL ??
                  'https://t.me/',
                label: 'Canal Telegram',
                external: true,
              },
            ]}
          />
        </div>

        <div className="mt-12 flex flex-col gap-3 md:flex-row md:items-center md:justify-between border-t border-[var(--color-border)] pt-6">
          <p className="text-xs text-[var(--color-text-faint)]">
            © {new Date().getFullYear()} Boursikotons. Tous droits réservés.
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--color-text-faint)]">
            <Link
              href="/legal/cgv"
              className="hover:text-[var(--color-text-dim)] transition-colors"
            >
              CGV
            </Link>
            <span>·</span>
            <span>Dubai, UAE</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: Array<{ href: string; label: string; external?: boolean }>;
}) {
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-[var(--color-text)]">{title}</h4>
      <ul className="space-y-2">
        {links.map((link) => (
          <li key={link.href + link.label}>
            <Link
              href={link.href}
              {...(link.external
                ? { target: '_blank', rel: 'noopener noreferrer' }
                : {})}
              className="text-sm text-[var(--color-text-dim)] hover:text-[var(--color-text)] transition-colors"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TelegramIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z" />
    </svg>
  );
}
