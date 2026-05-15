'use client';

import { useState, useTransition } from 'react';
import { CheckCircle2, Loader2, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';
import { joinWaitlistAuthAction } from '@/lib/actions/waitlist';

/**
 * Variante "auth" du formulaire waitlist pour /formation/reserver.
 *
 * Le format (`mode`) est passé en prop — il vient du BookingForm parent
 * (déduit de la formation sélectionnée à l'étape 1). Pas de double sélection.
 *
 * Le prénom + email + telegram_id sont récupérés via la session côté serveur.
 * Quand un créneau s'ouvre, l'admin notifie par DM Telegram.
 */
interface Props {
  /** Mode déduit de la formation choisie dans le BookingForm parent.
   *  null = aucune formation sélectionnée, on affiche un état "choisis d'abord". */
  mode: 'remote' | 'onsite' | null;
}

export function WaitlistFormAuth({ mode }: Props) {
  const [notes, setNotes] = useState('');
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!mode) {
      toast({
        title: 'Choisis d\'abord un format',
        description: 'Sélectionne Distance ou Dubaï dans l\'étape 1.',
        variant: 'destructive',
      });
      return;
    }
    start(async () => {
      const result = await joinWaitlistAuthAction({
        mode,
        notes: notes.trim() || undefined,
      });
      if (result.success) {
        setDone(true);
        toast({ title: '✓ Inscrit·e à la liste d\'attente' });
      } else {
        toast({
          title: 'Erreur',
          description: result.error,
          variant: 'destructive',
        });
      }
    });
  }

  if (done) {
    return (
      <div className="rounded-[var(--radius-md)] bg-emerald-500/10 border border-emerald-500/30 p-3 flex items-start gap-3">
        <CheckCircle2 className="h-4 w-4 text-emerald-300 light:text-emerald-700 flex-shrink-0 mt-0.5" />
        <div className="text-sm">
          <strong>Tu es inscrit·e</strong> à la liste d&apos;attente
          {mode === 'onsite'
            ? ' (présentiel à Dubaï)'
            : mode === 'remote'
            ? ' (formation à distance)'
            : ''}
          . On t&apos;envoie un message sur Telegram dès qu&apos;une place se
          libère.
        </div>
      </div>
    );
  }

  if (!mode) {
    return (
      <p className="text-xs text-[var(--color-text-dim)]">
        Choisis d&apos;abord un format dans l&apos;étape 1, puis reviens ici.
      </p>
    );
  }

  const modeLabel =
    mode === 'onsite' ? 'Dubaï · 3500€' : 'Distance · 1500€';

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="flex items-center gap-2 text-xs">
        <span className="text-[var(--color-text-dim)]">Liste d&apos;attente :</span>
        <span
          className={
            mode === 'onsite'
              ? 'inline-flex items-center px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-300 light:text-amber-700 text-xs font-medium'
              : 'inline-flex items-center px-2 py-0.5 rounded-md bg-[var(--color-accent)]/15 border border-[var(--color-accent)]/30 text-[var(--color-accent-hover)] text-xs font-medium'
          }
        >
          {modeLabel}
        </span>
      </div>

      <div>
        <Label htmlFor="wl-notes" className="text-xs">
          Précision sur tes disponibilités{' '}
          <span className="text-[var(--color-text-faint)]">(optionnel)</span>
        </Label>
        <Textarea
          id="wl-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Ex: dispo plutôt en juin, préférence semaine."
          rows={2}
          maxLength={500}
          className="mt-1.5 text-sm"
        />
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-[11px] text-[var(--color-text-faint)] leading-relaxed flex items-center gap-1.5">
          <MessageCircle className="h-3 w-3" />
          On te DM dès qu&apos;une place se libère.
        </p>
        <Button type="submit" size="sm" disabled={pending}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          M&apos;inscrire
        </Button>
      </div>
    </form>
  );
}
