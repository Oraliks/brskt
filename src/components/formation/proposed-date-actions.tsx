'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from '@/components/ui/use-toast';
import { respondToProposedDateAction } from '@/lib/actions/bookings';

interface Props {
  bookingId: string;
}

export function ProposedDateActions({ bookingId }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState('');

  function accept() {
    start(async () => {
      const result = await respondToProposedDateAction({
        bookingId,
        action: 'accept',
      });
      if (result.success) {
        toast({
          title: '✓ Date confirmée',
          description: 'Tu recevras les détails pratiques quelques jours avant.',
        });
        router.refresh();
      } else {
        toast({
          title: 'Erreur',
          description: result.error,
          variant: 'destructive',
        });
      }
    });
  }

  function reject() {
    start(async () => {
      const result = await respondToProposedDateAction({
        bookingId,
        action: 'reject',
        reason: reason.trim() || undefined,
      });
      if (result.success) {
        toast({
          title: 'Réservation annulée',
          description: 'Notre équipe va te recontacter pour le remboursement.',
        });
        setRejectOpen(false);
        router.refresh();
      } else {
        toast({
          title: 'Erreur',
          description: result.error,
          variant: 'destructive',
        });
      }
    });
  }

  return (
    <>
      <div className="flex flex-col sm:flex-row gap-2">
        <Button
          onClick={accept}
          disabled={pending}
          className="bg-emerald-500 hover:bg-emerald-400 text-white"
        >
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          <Check className="h-4 w-4" />
          Accepter cette date
        </Button>
        <Button
          variant="ghost"
          onClick={() => setRejectOpen(true)}
          disabled={pending}
          className="text-rose-300 hover:text-rose-200 hover:bg-rose-500/10"
        >
          <X className="h-4 w-4" />
          Refuser et annuler
        </Button>
      </div>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Refuser et annuler la réservation</DialogTitle>
            <DialogDescription>
              La réservation sera annulée et notre équipe te contactera pour
              te rembourser intégralement.
            </DialogDescription>
          </DialogHeader>

          <div>
            <Label htmlFor="reason">
              Raison <span className="text-[var(--color-text-faint)]">(optionnel)</span>
            </Label>
            <Textarea
              id="reason"
              rows={3}
              className="mt-2"
              placeholder="Ex: cette date ne me convient pas non plus, contraintes personnelles…"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setRejectOpen(false)}>
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={reject}
              disabled={pending}
            >
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirmer le refus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
