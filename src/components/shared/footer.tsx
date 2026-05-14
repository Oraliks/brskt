import Link from 'next/link';
import { Logo } from './logo';

export function Footer() {
  return (
    <footer className="mt-32 border-t border-[var(--color-border)]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid gap-8 md:grid-cols-4">
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
            title="Compte"
            links={[
              { href: '/login', label: 'Connexion' },
              { href: '/dashboard', label: 'Mon espace' },
              { href: '/dashboard', label: 'Mes réservations' },
            ]}
          />

          <FooterColumn
            title="Contact"
            links={[
              { href: 'mailto:contact@boursikotons.com', label: 'Email' },
              {
                href:
                  process.env.NEXT_PUBLIC_TELEGRAM_CHANNEL_URL ??
                  'https://t.me/',
                label: 'Canal Telegram',
              },
            ]}
          />
        </div>

        <div className="mt-12 flex flex-col gap-2 md:flex-row md:items-center md:justify-between border-t border-[var(--color-border)] pt-6">
          <p className="text-xs text-[var(--color-text-faint)]">
            © {new Date().getFullYear()} Boursikotons. Tous droits réservés.
          </p>
          <p className="text-xs text-[var(--color-text-faint)]">
            Dubai, UAE
          </p>
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
  links: Array<{ href: string; label: string }>;
}) {
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-[var(--color-text)]">{title}</h4>
      <ul className="space-y-2">
        {links.map((link) => (
          <li key={link.href + link.label}>
            <Link
              href={link.href}
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
