import { Gift } from 'lucide-react';
import type { WelcomeBonus } from '@/lib/settings/welcome-bonus';

/**
 * Bandeau d'offre de bienvenue IronFX, affiché sur /vip et sur la
 * landing quand `welcome_bonus.enabled` est true (toggle admin).
 *
 * Design : accent emerald + gift icon, doit attirer l'œil sans être agressif.
 */
export function WelcomeBonusBanner({ bonus }: { bonus: WelcomeBonus }) {
  return (
    <div className="relative overflow-hidden rounded-[var(--radius-lg)] border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 to-transparent p-5">
      <div className="absolute inset-0 bg-grid opacity-10 pointer-events-none" />
      <div className="relative flex items-start gap-4">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-emerald-500/15 border border-emerald-500/40 flex-shrink-0">
          <Gift className="h-5 w-5 text-emerald-400 light:text-emerald-700" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-wider text-emerald-300 light:text-emerald-700 mb-1 font-semibold">
            Offre de bienvenue
          </div>
          <h3 className="text-base font-semibold">{bonus.title}</h3>
          <p className="mt-1 text-sm text-[var(--color-text-dim)]">
            {bonus.description}
          </p>
          {bonus.fineprint && (
            <p className="mt-2 text-xs text-[var(--color-text-faint)]">
              {bonus.fineprint}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
