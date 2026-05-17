import Link from 'next/link';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Infinity as InfinityIcon,
  Send,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatPrice } from '@/lib/utils';

type PaidAccess = {
  id: string;
  status: 'pending_payment' | 'paid' | 'active' | 'ejected';
  firstName: string;
  lastName: string;
  amountEur: string;
  telegramInviteLink: string | null;
  paidAt: Date | null;
  activatedAt: Date | null;
  ejectionReason: string | null;
};

/**
 * Affiche l'état d'un accès VIP payant selon son status :
 *  - pending_payment : "paiement en cours" + lien retour checkout
 *  - paid : "paiement reçu, on t'envoie le lien Telegram"
 *  - active : "tu es membre VIP — accès à vie"
 *  - ejected : "tu as été éjecté" + raison
 */
export function VipPaidAccessSummary({ access }: { access: PaidAccess }) {
  if (access.status === 'pending_payment') {
    return (
      <div className="glass-strong rounded-[var(--radius-lg)] p-8 text-center space-y-4">
        <Clock className="h-10 w-10 text-amber-300 mx-auto" />
        <h3 className="font-serif text-2xl">Paiement en cours</h3>
        <p className="text-sm text-[var(--color-text-dim)] max-w-md mx-auto">
          On attend la confirmation du provider. Si tu as fermé l&apos;onglet
          de paiement, tu peux retenter.
        </p>
        <div className="text-xs text-[var(--color-text-faint)]">
          {access.firstName} {access.lastName} ·{' '}
          {formatPrice(Number(access.amountEur))}
        </div>
        <Link
          href="/vip/acces-direct"
          className="inline-flex items-center gap-2 rounded-full bg-[var(--color-inverse)] text-[var(--color-on-inverse)] px-5 py-2.5 text-sm font-medium"
        >
          Retenter le paiement
        </Link>
      </div>
    );
  }

  if (access.status === 'paid') {
    return (
      <div className="glass-strong rounded-[var(--radius-lg)] p-8 text-center space-y-4">
        <CheckCircle2 className="h-10 w-10 text-emerald-300 mx-auto" />
        <h3 className="font-serif text-2xl">Paiement reçu</h3>
        <p className="text-sm text-[var(--color-text-dim)] max-w-md mx-auto">
          Merci ! On vient de t&apos;envoyer ton lien d&apos;invitation
          Telegram en DM. Si tu ne vois rien dans quelques secondes,
          ouvre le bot{' '}
          <code className="text-[var(--color-accent-hover)]">/start</code>{' '}
          et il sera renvoyé.
        </p>
        <Badge variant="success" className="inline-flex items-center gap-1">
          <Send className="h-3 w-3" />
          Invitation envoyée
        </Badge>
      </div>
    );
  }

  if (access.status === 'ejected') {
    return (
      <div className="glass-strong rounded-[var(--radius-lg)] p-8 text-center space-y-4 border border-rose-500/30">
        <AlertCircle className="h-10 w-10 text-rose-400 mx-auto" />
        <h3 className="font-serif text-2xl">Accès révoqué</h3>
        {access.ejectionReason && (
          <p className="text-sm text-[var(--color-text-dim)] max-w-md mx-auto">
            Raison : <em>{access.ejectionReason}</em>
          </p>
        )}
        <p className="text-xs text-[var(--color-text-faint)]">
          Contacte le support pour discuter d&apos;une réintégration.
        </p>
      </div>
    );
  }

  // status === 'active'
  return (
    <div className="space-y-4">
      <div className="glass-strong rounded-[var(--radius-lg)] p-8 text-center space-y-4 border border-emerald-500/30">
        <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-emerald-500/20 mx-auto">
          <CheckCircle2 className="h-8 w-8 text-emerald-300" />
        </div>
        <h3 className="font-serif text-3xl">Tu es membre VIP.</h3>
        <p className="text-sm text-[var(--color-text-dim)] max-w-md mx-auto">
          Accès direct payant validé. Le bot t&apos;a envoyé ton lien
          d&apos;invitation sur Telegram.
        </p>
        <div className="flex items-center justify-center gap-2 text-xs text-amber-300">
          <InfinityIcon className="h-4 w-4" />
          <span className="font-medium uppercase tracking-wider">
            Accès à vie
          </span>
        </div>
      </div>

      <div className="glass rounded-[var(--radius-md)] p-4 text-sm text-[var(--color-text-dim)] space-y-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <span>Identité paiement</span>
          <span className="font-medium text-[var(--color-text)]">
            {access.firstName} {access.lastName}
          </span>
        </div>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <span>Montant payé</span>
          <span className="font-mono text-[var(--color-text)]">
            {formatPrice(Number(access.amountEur))}
          </span>
        </div>
        {access.paidAt && (
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span>Paiement</span>
            <span className="text-xs text-[var(--color-text-faint)] font-mono">
              {new Date(access.paidAt).toLocaleDateString('fr-FR')}
            </span>
          </div>
        )}
      </div>

      <p className="text-xs text-[var(--color-text-faint)] text-center">
        Tu as perdu ton lien ? Tape{' '}
        <code className="text-[var(--color-accent-hover)]">/start</code> au
        bot, il te renverra une nouvelle invitation. Sinon, contacte le
        support.
      </p>
    </div>
  );
}
