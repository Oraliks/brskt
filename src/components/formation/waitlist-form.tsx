'use client';

import { useState, useTransition } from 'react';
import { CheckCircle2, Loader2, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';
import { joinWaitlistAction } from '@/lib/actions/waitlist';

interface Props {
  mode: 'remote' | 'onsite';
  /** Si pré-renseigné par session, on auto-fill. */
  defaultEmail?: string;
  defaultFirstName?: string;
}

export function WaitlistForm({
  mode,
  defaultEmail = '',
  defaultFirstName = '',
}: Props) {
  const [email, setEmail] = useState(defaultEmail);
  const [firstName, setFirstName] = useState(defaultFirstName);
  const [notes, setNotes] = useState('');
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const result = await joinWaitlistAction({
        mode,
        email,
        firstName: firstName.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      if (result.success) {
        setDone(true);
        toast({ title: '✓ Inscrit à la liste d\'attente' });
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
      <div className="rounded-[var(--radius-md)] bg-emerald-500/10 border border-emerald-500/30 p-5 flex items-start gap-3">
        <CheckCircle2 className="h-5 w-5 text-emerald-300 light:text-emerald-700 flex-shrink-0 mt-0.5" />
        <div className="text-sm">
          <strong>Tu es inscrit·e</strong> à la liste d&apos;attente. On te
          contacte par email dès qu&apos;une place se libère pour la formation{' '}
          {mode === 'onsite' ? 'présentiel à Dubaï' : 'à distance'}.
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <Label htmlFor="wl-firstname" className="text-xs">
            Prénom <span className="text-[var(--color-text-faint)]">(optionnel)</span>
          </Label>
          <Input
            id="wl-firstname"
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="Ton prénom"
            className="mt-1.5 h-10"
            autoComplete="given-name"
          />
        </div>
        <div>
          <Label htmlFor="wl-email" className="text-xs">
            Email <span className="text-rose-300">*</span>
          </Label>
          <Input
            id="wl-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="toi@email.com"
            required
            className="mt-1.5 h-10"
            autoComplete="email"
          />
        </div>
      </div>
      <div>
        <Label htmlFor="wl-notes" className="text-xs">
          Une précision sur tes disponibilités{' '}
          <span className="text-[var(--color-text-faint)]">(optionnel)</span>
        </Label>
        <Textarea
          id="wl-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={
            mode === 'onsite'
              ? 'Ex: dispo en juin, préférence semaine, etc.'
              : 'Ex: dispo plutôt soir/weekend, pas avant juillet.'
          }
          rows={2}
          maxLength={500}
          className="mt-1.5 text-sm"
        />
      </div>
      <Button type="submit" disabled={pending || !email} className="w-full sm:w-auto">
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Mail className="h-4 w-4" />
        )}
        Me prévenir
      </Button>
      <p className="text-[11px] text-[var(--color-text-faint)] leading-relaxed">
        Aucun spam. Tu peux te désinscrire à tout moment en répondant à
        l&apos;email.
      </p>
    </form>
  );
}
