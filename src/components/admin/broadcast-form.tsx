'use client';

import { useState, useTransition } from 'react';
import {
  AlertTriangle,
  Eye,
  Loader2,
  Mail,
  Send,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/use-toast';
import { adminBroadcastAction } from '@/lib/actions/admin';
import { cn } from '@/lib/utils';

type Audience = 'briefing' | 'events' | 'all_onboarded';

interface Props {
  /** Compteurs estimés par audience pour afficher dans le sélecteur. */
  estimates: Record<Audience, number>;
}

const AUDIENCE_OPTIONS: Array<{
  value: Audience;
  label: string;
  description: string;
}> = [
  {
    value: 'briefing',
    label: 'Opt-in briefing matinal',
    description: 'Users inscrits au push CRON 7h UTC',
  },
  {
    value: 'events',
    label: 'Opt-in alertes macro',
    description: 'Users inscrits aux events économiques',
  },
  {
    value: 'all_onboarded',
    label: 'Tous les onboardés',
    description: 'Tous les comptes avec email + onboarding complet',
  },
];

export function BroadcastForm({ estimates }: Props) {
  const [subject, setSubject] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [audience, setAudience] = useState<Audience>('briefing');
  const [pending, start] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);

  function submitTest() {
    if (!subject.trim() || !bodyHtml.trim()) {
      toast({
        title: 'Champs incomplets',
        description: 'Sujet et contenu sont requis.',
        variant: 'destructive',
      });
      return;
    }
    start(async () => {
      const result = await adminBroadcastAction({
        subject,
        bodyHtml,
        audience,
        testOnly: true,
      });
      if (result.success) {
        toast({
          title: '✓ Email test envoyé',
          description: 'Vérifie ta boîte (ton email admin).',
        });
      } else {
        toast({
          title: 'Erreur envoi test',
          description: result.error,
          variant: 'destructive',
        });
      }
    });
  }

  function submitReal() {
    if (!subject.trim() || !bodyHtml.trim()) {
      toast({
        title: 'Champs incomplets',
        description: 'Sujet et contenu sont requis.',
        variant: 'destructive',
      });
      return;
    }
    setConfirmOpen(true);
  }

  function confirmedSubmit() {
    start(async () => {
      const result = await adminBroadcastAction({
        subject,
        bodyHtml,
        audience,
        testOnly: false,
      });
      if (result.success) {
        toast({
          title: `✓ Broadcast envoyé`,
          description: `${result.data.sent}/${result.data.targeted} OK · ${result.data.failed} échec${result.data.failed > 1 ? 's' : ''}`,
        });
        setConfirmOpen(false);
        setSubject('');
        setBodyHtml('');
      } else {
        toast({
          title: 'Erreur',
          description: result.error,
          variant: 'destructive',
        });
      }
    });
  }

  const audienceCount = estimates[audience] ?? 0;

  return (
    <div className="space-y-5">
      {/* Audience */}
      <div>
        <Label className="text-xs">Audience</Label>
        <div className="mt-2 grid sm:grid-cols-3 gap-2">
          {AUDIENCE_OPTIONS.map((opt) => {
            const active = audience === opt.value;
            const count = estimates[opt.value] ?? 0;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setAudience(opt.value)}
                className={cn(
                  'rounded-[var(--radius-md)] border p-3 text-left transition-colors',
                  active
                    ? 'border-[var(--color-accent)]/40 bg-[var(--color-accent)]/8'
                    : 'border-[var(--color-border)] hover:bg-[var(--color-surface-tint)]'
                )}
              >
                <div className="flex items-baseline justify-between gap-2 mb-1">
                  <span className="text-sm font-medium">{opt.label}</span>
                  <Badge variant="secondary" className="text-[10px]">
                    {count}
                  </Badge>
                </div>
                <div className="text-[11px] text-[var(--color-text-dim)] leading-snug">
                  {opt.description}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Sujet */}
      <div>
        <Label htmlFor="bc-subject">Sujet de l&apos;email</Label>
        <Input
          id="bc-subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Ex : Nouvelle formation crypto le 15 juin"
          maxLength={200}
          className="mt-1.5"
        />
        <p className="mt-1 text-[10px] text-[var(--color-text-faint)] tabular-nums">
          {subject.length} / 200
        </p>
      </div>

      {/* Body HTML */}
      <div>
        <Label htmlFor="bc-body">
          Contenu (HTML)
          <span className="text-[var(--color-text-faint)] text-xs ml-2">
            · les balises &lt;p&gt; &lt;b&gt; &lt;a&gt; &lt;ul&gt; etc.
            sont supportées
          </span>
        </Label>
        <Textarea
          id="bc-body"
          value={bodyHtml}
          onChange={(e) => setBodyHtml(e.target.value)}
          rows={12}
          maxLength={20_000}
          className="mt-1.5 font-mono text-xs"
          placeholder={`<p>Bonjour,</p>\n<p>On lance une nouvelle formation crypto le <b>15 juin</b>.\nInscriptions ouvertes ici : <a href="https://brskt.vercel.app/formation">brskt.vercel.app/formation</a></p>\n<p>À très vite,<br>L'équipe Boursikotons</p>`}
        />
        <p className="mt-1 text-[10px] text-[var(--color-text-faint)] tabular-nums">
          {bodyHtml.length} / 20 000
        </p>
      </div>

      {/* Avertissement */}
      <div className="rounded-[var(--radius-md)] bg-amber-500/10 border border-amber-500/25 p-3 text-xs text-amber-200 light:text-amber-800 flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
        <div>
          <strong>Important :</strong> commence toujours par un{' '}
          <em>test</em> à ton propre email pour vérifier le rendu. L&apos;envoi
          réel est irréversible et ne peut pas être stoppé en cours.
        </div>
      </div>

      {/* Boutons */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[var(--color-border)]">
        <div className="text-xs text-[var(--color-text-dim)]">
          Cible :{' '}
          <strong className="text-[var(--color-text)]">
            {audienceCount} destinataire{audienceCount > 1 ? 's' : ''}
          </strong>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={submitTest}
            disabled={pending}
            className="gap-1.5"
          >
            {pending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Eye className="h-3.5 w-3.5" />
            )}
            Envoyer un test (à moi)
          </Button>
          <Button
            type="button"
            onClick={submitReal}
            disabled={pending}
            className="gap-1.5"
          >
            <Send className="h-3.5 w-3.5" />
            Envoyer à {audienceCount}
          </Button>
        </div>
      </div>

      {/* Confirmation modale */}
      {confirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => !pending && setConfirmOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="glass rounded-[var(--radius-lg)] p-6 max-w-md w-full space-y-4 border border-[var(--color-border-strong)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-rose-500/15 border border-rose-500/30 text-rose-300">
                <Mail className="h-5 w-5" />
              </span>
              <div>
                <div className="text-sm font-semibold">Confirmer l&apos;envoi</div>
                <div className="text-xs text-[var(--color-text-dim)] mt-0.5">
                  À <strong>{audienceCount}</strong> destinataire
                  {audienceCount > 1 ? 's' : ''} · audience{' '}
                  <strong>{audience}</strong>
                </div>
              </div>
            </div>
            <div className="rounded-[var(--radius-md)] bg-rose-500/5 border border-rose-500/20 p-3 text-xs text-[var(--color-text-dim)]">
              <Sparkles className="h-3.5 w-3.5 inline mr-1 text-rose-300" />
              L&apos;envoi est <strong>irréversible</strong>. Tu es certain
              que tu as testé avant ?
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => setConfirmOpen(false)}
                disabled={pending}
              >
                Annuler
              </Button>
              <Button onClick={confirmedSubmit} disabled={pending}>
                {pending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Oui, envoyer maintenant
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
