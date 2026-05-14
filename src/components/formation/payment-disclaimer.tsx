import { AlertTriangle, CheckCircle2, Lock } from 'lucide-react';

/**
 * Disclaimer commun pour les conditions de paiement / annulation des formations.
 *
 * À afficher sur :
 *  - /formation (page publique de présentation)
 *  - /formation/reserver (avant validation)
 *  - /checkout/[bookingId] (page de paiement)
 *  - dashboard (carte formation si paiement en cours)
 *  - email de confirmation de réservation
 *
 * 3 messages clés :
 *  1. Aucun remboursement (avec justification logistique)
 *  2. La formation a lieu UNIQUEMENT après paiement total
 *  3. Le paiement en 3x est notre flexibilité — déjà généreuse
 */

interface Props {
  /** 'compact' = encadré court, 'full' = avec les 3 sections expliquées */
  variant?: 'compact' | 'full';
  /** Couleur de fond — 'amber' (warning) ou 'neutral' (info) */
  tone?: 'amber' | 'neutral';
}

export function PaymentDisclaimer({
  variant = 'full',
  tone = 'amber',
}: Props) {
  const bg =
    tone === 'amber'
      ? 'bg-amber-500/8 border-amber-500/30'
      : 'bg-white/[0.03] border-[var(--color-border)]';
  const textColor = tone === 'amber' ? 'text-amber-200' : 'text-white';

  if (variant === 'compact') {
    return (
      <div
        className={`rounded-[var(--radius-md)] border ${bg} p-3 text-xs text-[var(--color-text-dim)] leading-relaxed`}
      >
        <strong className={textColor}>Conditions :</strong> aucun remboursement
        une fois la réservation initiée (créneau bloqué, préparation
        logistique). La formation a lieu après réception de la totalité des
        paiements.
      </div>
    );
  }

  return (
    <div
      className={`rounded-[var(--radius-lg)] border ${bg} p-5 text-sm space-y-3`}
    >
      <h4 className={`font-semibold ${textColor} flex items-center gap-2`}>
        <AlertTriangle className="h-4 w-4 flex-shrink-0" />
        Conditions à connaître avant de réserver
      </h4>

      <ul className="space-y-3 text-[var(--color-text)]">
        <li className="flex items-start gap-3">
          <Lock className="h-4 w-4 mt-0.5 text-amber-300 flex-shrink-0" />
          <div>
            <strong>Aucun remboursement une fois la réservation initiée.</strong>{' '}
            Dès le 1<sup>er</sup> paiement, ton créneau est bloqué et la
            préparation démarre : planification instructeur, accès aux
            ressources privées, organisation logistique (présentiel : salle,
            matériel, repas). Annuler représente un travail
            d'organisation que nous ne pouvons plus reprendre une fois lancé.
          </div>
        </li>

        <li className="flex items-start gap-3">
          <Lock className="h-4 w-4 mt-0.5 text-amber-300 flex-shrink-0" />
          <div>
            <strong>
              La formation a lieu uniquement après réception de la totalité du
              paiement.
            </strong>{' '}
            Si tu choisis le paiement en 3 fois, les trois échéances doivent
            être réglées avant la date de formation. Sans paiement complet, la
            formation est reportée puis annulée si non régularisée.
          </div>
        </li>

        <li className="flex items-start gap-3">
          <CheckCircle2 className="h-4 w-4 mt-0.5 text-emerald-400 flex-shrink-0" />
          <div>
            <strong>Notre flexibilité :</strong> le paiement en 3 fois sans
            frais. C'est déjà une marge de manœuvre rare dans le secteur — on
            l'offre pour rendre la formation accessible, donc on ne peut pas
            cumuler avec un droit de remboursement.
          </div>
        </li>
      </ul>
    </div>
  );
}
