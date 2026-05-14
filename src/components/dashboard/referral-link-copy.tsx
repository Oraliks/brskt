'use client';

import { useState } from 'react';
import { Check, Copy, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Props {
  link: string;
  /** Si fourni, sera utilisé comme texte de partage natif (Web Share API). */
  shareText?: string;
}

/**
 * Affiche le lien parrain de l'user avec :
 *  - Champ readonly cliquable (sélectionne tout au focus)
 *  - Bouton "copier" qui tombe sur navigator.clipboard avec fallback
 *  - Bouton "partager" qui utilise Web Share API si dispo
 */
export function ReferralLinkCopy({ link, shareText }: Props) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback : selection visuelle (pas de copy programmatique)
      const input = document.getElementById('ref-link-input') as HTMLInputElement | null;
      input?.select();
    }
  }

  async function share() {
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await navigator.share({
          title: 'Boursikotons',
          text: shareText ?? 'Rejoins-moi sur Boursikotons :',
          url: link,
        });
      } catch {
        // user cancel — silent
      }
    } else {
      // Fallback simple : copier
      copy();
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <input
          id="ref-link-input"
          type="text"
          readOnly
          value={link}
          onFocus={(e) => e.currentTarget.select()}
          className="flex-1 min-w-0 h-10 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white/[0.02] px-3 text-xs font-mono text-[var(--color-text)] focus-visible:outline-none focus-visible:border-[var(--color-accent)]"
        />
        <Button
          variant="secondary"
          size="sm"
          onClick={copy}
          className={cn('h-10', copied && 'text-emerald-300')}
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? 'Copié' : 'Copier'}
        </Button>
        <Button variant="ghost" size="sm" onClick={share} className="h-10">
          <Send className="h-4 w-4" />
          Partager
        </Button>
      </div>
    </div>
  );
}
