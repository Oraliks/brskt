import Link from 'next/link';
import { ArrowRight, Coins } from 'lucide-react';
import { formatPrice } from '@/lib/utils';

/**
 * Bannière "Switch path" : visible sur le wizard du funnel broker pour
 * les users qui ont déjà démarré le funnel mais veulent zapper vers
 * l'accès direct 250€.
 *
 * Le message change selon où l'user en est dans le funnel pour ne pas
 * être indélicat (un user qui a déjà déposé n'a pas envie qu'on lui
 * suggère de payer en plus).
 */
export function VipSwitchToDirectBanner({
  priceEur,
  currentStep,
}: {
  priceEur: number;
  currentStep: string;
}) {
  // Pour les steps avancés (déjà déposé), on est plus discret — l'user
  // a déjà engagé du capital chez le broker, lui suggérer de payer en
  // plus serait étrange.
  const isAdvanced =
    currentStep === 'deposit_pending' ||
    currentStep === 'deposit_validated' ||
    currentStep === 'telegram_invited';

  const headline = isAdvanced
    ? 'Tu veux quand même passer en accès direct ?'
    : 'Tu as déjà un broker ailleurs ?';
  const description = isAdvanced
    ? 'Tu peux abandonner la qualification CPA et payer pour entrer tout de suite. Ton dépôt broker reste à toi, tu peux le retirer.'
    : 'Évite tout le funnel et paye une fois pour rentrer dans le groupe en quelques secondes.';

  return (
    <Link
      href="/vip/acces-direct"
      className="group block rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-tint)] p-4 hover:border-amber-500/40 hover:bg-amber-500/5 transition-all"
    >
      <div className="flex items-center gap-4">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500/30 to-orange-700/20 flex-shrink-0">
          <Coins className="h-5 w-5 text-amber-300" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-wider text-amber-300 font-mono mb-0.5">
            Accès direct · {formatPrice(priceEur)}
          </div>
          <div className="text-sm font-medium text-[var(--color-text)] leading-tight">
            {headline}
          </div>
          <div className="text-xs text-[var(--color-text-dim)] mt-0.5">
            {description}
          </div>
        </div>
        <ArrowRight className="h-4 w-4 text-[var(--color-text-faint)] group-hover:text-amber-300 transition-colors flex-shrink-0" />
      </div>
    </Link>
  );
}
