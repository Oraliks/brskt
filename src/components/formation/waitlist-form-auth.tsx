'use client';

import { useState, useTransition } from 'react';
import { CheckCircle2, Loader2, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';
import { joinWaitlistAuthAction } from '@/lib/actions/waitlist';

/**
 * Variante "auth" du formulaire waitlist : pour les utilisateurs déjà
 * connectés sur /formation/reserver. On ne demande que :
 *  - le format (select Distance/Dubaï)
 *  - une note libre (optionnelle, contraintes calendrier)
 *
 * Le prénom + email + telegram_id sont récupérés via la session côté serveur.
 * Quand un créneau s'ouvre, l'admin notifie par DM Telegram (pas email).
 */
export function WaitlistFormAuth() {
  const [mode, setMode] = useState<'remote' | 'onsite'>('remote');
  const [notes, setNotes] = useState('');
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
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
      <div className="rounded-[var(--radius-md)] bg-emerald-500/10 border border-emerald-500/30 p-4 flex items-start gap-3">
        <CheckCircle2 className="h-5 w-5 text-emerald-300 light:text-emerald-700 flex-shrink-0 mt-0.5" />
        <div className="text-sm">
          <strong>Tu es inscrit·e</strong> à la liste d&apos;attente pour la
          formation{' '}
          {mode === 'onsite' ? 'présentiel à Dubaï' : 'à distance'}. On t&apos;envoie
          un message sur Telegram dès qu&apos;une place se libère.
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <Label htmlFor="wl-mode" className="text-xs">
          Format souhaité
        </Label>
        <div className="mt-1.5 grid grid-cols-2 gap-2">
          <ModeButton
            active={mode === 'remote'}
            onClick={() => setMode('remote')}
            label="Distance"
            sub="1500€"
          />
          <ModeButton
            active={mode === 'onsite'}
            onClick={() => setMode('onsite')}
            label="Dubaï"
            sub="3500€"
            tone="amber"
          />
        </div>
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
          On te DM via le bot Telegram dès qu&apos;une place se libère.
        </p>
        <Button type="submit" size="sm" disabled={pending}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          M&apos;inscrire
        </Button>
      </div>
    </form>
  );
}

function ModeButton({
  active,
  onClick,
  label,
  sub,
  tone = 'default',
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  sub: string;
  tone?: 'default' | 'amber';
}) {
  const activeClass =
    tone === 'amber'
      ? 'border-amber-500/50 bg-amber-500/10'
      : 'border-[var(--color-accent)] bg-[var(--color-accent)]/10';
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? `rounded-[var(--radius-md)] border ${activeClass} px-3 py-2 text-left transition-all`
          : 'rounded-[var(--radius-md)] border border-[var(--color-border)] bg-transparent px-3 py-2 text-left hover:bg-[var(--color-surface-tint)] transition-all'
      }
    >
      <div className="text-sm font-medium">{label}</div>
      <div className="text-[10px] text-[var(--color-text-dim)]">{sub}</div>
    </button>
  );
}
