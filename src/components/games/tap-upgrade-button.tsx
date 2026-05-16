'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { purchaseTapUpgradeAction } from '@/lib/actions/games';
import { useHaptic } from '@/components/mini/telegram-webapp';

/**
 * Bouton d'achat d'un upgrade permanent du jeu de clic.
 * Confirm natif pour éviter le clic accidentel — l'achat est définitif
 * et consomme l'XP du user.
 */
export function TapUpgradeButton({
  upgradeId,
  disabled,
  label,
  icon,
}: {
  upgradeId: 'combo' | 'drain' | 'xp';
  disabled: boolean;
  label: string;
  icon?: React.ReactNode;
}) {
  const router = useRouter();
  const haptic = useHaptic();
  const [pending, start] = useTransition();

  function onClick() {
    if (disabled || pending) return;
    if (
      !confirm(
        "Acheter cette amélioration ? Le coût en XP est déduit de ton total."
      )
    )
      return;

    haptic.impact('medium');
    start(async () => {
      const res = await purchaseTapUpgradeAction(upgradeId);
      if (!res.success) {
        haptic.error();
        toast({
          title: 'Achat refusé',
          description: res.error,
          variant: 'destructive',
        });
        return;
      }
      haptic.success();
      toast({
        title: `✨ ${res.data.label} débloqué`,
        description: `Nouveau total : ${res.data.newTotal} XP.`,
      });
      router.refresh();
    });
  }

  return (
    <Button
      type="button"
      onClick={onClick}
      disabled={disabled || pending}
      size="sm"
      variant={disabled ? 'secondary' : 'default'}
      className="w-full"
    >
      {pending ? (
        <>
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Achat…
        </>
      ) : (
        <>
          {icon}
          {label}
        </>
      )}
    </Button>
  );
}
