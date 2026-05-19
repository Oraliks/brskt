import Link from 'next/link';
import {
  ArrowRight,
  Briefcase,
  CheckCircle2,
  Coins,
  CreditCard,
  Infinity as InfinityIcon,
  Zap,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatPrice } from '@/lib/utils';

/**
 * Choix entre les 2 chemins d'accès au VIP Telegram :
 *  - Funnel broker partenaire (0€) — recommandé, classique
 *  - Accès direct payant — pour ceux qui ont déjà leur broker
 *
 * `requireLogin` : si true, les liens passent par /login?redirectTo=...
 * Utilisé sur la landing publique (user pas encore loggé).
 */
export function VipPathChoice({
  priceEur,
  requireLogin = false,
}: {
  priceEur: number;
  requireLogin?: boolean;
}) {
  const brokerHref = requireLogin
    ? '/login?redirectTo=' + encodeURIComponent('/vip?path=affiliate')
    : '?path=affiliate';
  const directHref = requireLogin
    ? '/login?redirectTo=' + encodeURIComponent('/vip/acces-direct')
    : '/vip/acces-direct';

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Option 1 — funnel affilié (gratuit, recommandée) */}
      <Link
        href={brokerHref}
        scroll={false}
        className="relative glass-strong rounded-[var(--radius-lg)] p-6 flex flex-col gap-4 transition-all hover:-translate-y-0.5 hover:border-[var(--color-border-strong)]"
      >
        <div className="absolute -top-2 left-6">
          <Badge variant="success">Recommandé</Badge>
        </div>
        <div className="flex items-start justify-between">
          <Briefcase className="h-6 w-6 text-emerald-300" />
          <div className="text-right">
            <div className="font-serif text-3xl text-gradient">0€</div>
            <div className="text-xs text-[var(--color-text-faint)]">
              gratuit
            </div>
          </div>
        </div>
        <div>
          <h3 className="font-serif text-xl">Via broker partenaire</h3>
          <p className="text-sm text-[var(--color-text-dim)] mt-1">
            Inscription chez IronFX via notre lien d&apos;affiliation,
            dépôt minimum 250€ — on est rémunérés par le broker, pas par
            toi.
          </p>
        </div>
        <ul className="space-y-2 text-sm text-[var(--color-text-dim)] flex-1">
          <Bullet>0€ payés à Boursikotons</Bullet>
          <Bullet>Funnel guidé étape par étape</Bullet>
          <Bullet>Ton dépôt te sert pour trader</Bullet>
        </ul>
        <span className="inline-flex items-center gap-1.5 text-sm text-[var(--color-accent-hover)] mt-2">
          Démarrer le funnel
          <ArrowRight className="h-4 w-4" />
        </span>
      </Link>

      {/* Option 2 — accès direct payant */}
      <Link
        href={directHref}
        className="relative glass-strong rounded-[var(--radius-lg)] p-6 flex flex-col gap-4 transition-all hover:-translate-y-0.5 hover:border-[var(--color-border-strong)]"
      >
        <div className="absolute -top-2 left-6">
          <Badge variant="gold">J&apos;ai déjà un broker</Badge>
        </div>
        <div className="flex items-start justify-between">
          <Coins className="h-6 w-6 text-amber-300" />
          <div className="text-right">
            <div className="font-serif text-3xl text-gradient">
              {formatPrice(priceEur)}
            </div>
            <div className="text-xs text-[var(--color-text-faint)]">
              paiement unique
            </div>
          </div>
        </div>
        <div>
          <h3 className="font-serif text-xl">Accès direct</h3>
          <p className="text-sm text-[var(--color-text-dim)] mt-1">
            Tu trades déjà ailleurs ? Paye une fois et reçois ton lien
            d&apos;accès au VIP automatiquement.
          </p>
        </div>
        <ul className="space-y-2 text-sm text-[var(--color-text-dim)] flex-1">
          <Bullet icon={InfinityIcon}>Accès à vie au groupe</Bullet>
          <Bullet icon={Zap}>Lien Telegram envoyé en quelques secondes</Bullet>
          <Bullet icon={CreditCard}>CB / PayPal / Crypto</Bullet>
        </ul>
        <span className="inline-flex items-center gap-1.5 text-sm text-[var(--color-accent-hover)] mt-2">
          Payer et accéder
          <ArrowRight className="h-4 w-4" />
        </span>
      </Link>
    </div>
  );
}

function Bullet({
  children,
  icon: Icon = CheckCircle2,
}: {
  children: React.ReactNode;
  icon?: React.ElementType;
}) {
  return (
    <li className="flex items-start gap-2.5">
      <Icon className="h-4 w-4 text-emerald-300 flex-shrink-0 mt-0.5" />
      <span>{children}</span>
    </li>
  );
}
