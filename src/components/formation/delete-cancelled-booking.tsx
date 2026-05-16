'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { deleteAbandonedBookingAction } from '@/lib/actions/bookings';

interface Props {
  bookingId: string;
}

/**
 * Bouton de suppression d'un booking cancelled.
 * Affiche une confirmation native avant d'appeler l'action.
 */
export function DeleteCancelledBooking({ bookingId }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function onDelete() {
    if (
      !confirm(
        'Supprimer cette réservation ? Tu pourras en créer une nouvelle ensuite.'
      )
    )
      return;
    start(async () => {
      const result = await deleteAbandonedBookingAction(bookingId);
      if (result.success) {
        toast({ title: '✓ Réservation supprimée' });
        router.refresh();
      } else {
        toast({
          title: 'Suppression impossible',
          description: result.error,
          variant: 'destructive',
        });
      }
    });
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onDelete}
      disabled={pending}
      className="text-rose-300 light:text-rose-700 hover:bg-rose-500/10 max-w-full whitespace-nowrap"
    >
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
      ) : (
        <Trash2 className="h-4 w-4 flex-shrink-0" />
      )}
      {/* Texte court sur Mini App (sm:hidden évite le débord), version
          longue sur ≥sm. Évite que l'icône soit clippée dans des
          parents flex étroits. */}
      <span className="sm:hidden">Recommencer</span>
      <span className="hidden sm:inline">Supprimer et recommencer</span>
    </Button>
  );
}
