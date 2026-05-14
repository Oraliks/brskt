import type { Metadata } from 'next';
import { Section, SectionHeader } from '@/components/shared/section';

export const metadata: Metadata = {
  title: 'Conditions générales de vente',
  description:
    'Conditions générales applicables aux formations Boursikotons et à l\'accès au groupe VIP Telegram.',
};

export default function CgvPage() {
  return (
    <Section>
      <SectionHeader
        eyebrow="Mentions"
        title="Conditions générales de vente"
        description="Dernière mise à jour : mai 2026"
      />

      <div className="prose prose-invert max-w-3xl mx-auto text-sm leading-relaxed space-y-8 text-[var(--color-text-dim)]">
        <section>
          <h2 className="text-base font-semibold text-[var(--color-text)] mb-2">
            1. Éditeur
          </h2>
          <p>
            Boursikotons FZ-LLC — Dubaï, Émirats arabes unis. Adresse complète et
            numéro de registre disponibles sur demande à{' '}
            <a
              href="mailto:contact@boursikotons.com"
              className="text-[var(--color-accent-hover)] hover:underline"
            >
              contact@boursikotons.com
            </a>
            .
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-[var(--color-text)] mb-2">
            2. Produits proposés
          </h2>
          <p>
            Boursikotons commercialise (a) des formations au trading
            (distance 1500€, présentiel à Dubaï 3500€) et (b) un accès gratuit
            à un groupe VIP Telegram via partenariat affilié avec un broker tiers
            (IronFX). L'accès au groupe VIP ne fait l'objet d'aucun paiement
            direct de l'utilisateur — il est conditionné à l'ouverture d'un
            compte broker et à un dépôt initial sur ce compte (qui reste la
            propriété de l'utilisateur).
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-[var(--color-text)] mb-2">
            3. Formations — paiement et livraison
          </h2>
          <ul className="list-disc list-inside space-y-1.5">
            <li>
              Modes de paiement : carte (Paddle), PayPal, crypto (NOWPayments).
            </li>
            <li>
              Le prix de la formation présentiel n'inclut <strong>pas</strong>{' '}
              le billet d'avion A/R Dubaï ni l'hébergement.
            </li>
            <li>
              Paiement en 3 fois disponible : la formation a lieu après
              réception de la 3<sup>e</sup> échéance.
            </li>
            <li>
              <strong>Aucun remboursement</strong> n'est accordé une fois la
              réservation initiée — un créneau est bloqué et la logistique
              engagée dès le 1<sup>er</sup> paiement. Si tu ne peux pas
              honorer la date, contacte-nous : un report est possible une fois,
              sous réserve de disponibilité.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-[var(--color-text)] mb-2">
            4. Groupe VIP — conditions d'accès et d'exclusion
          </h2>
          <ul className="list-disc list-inside space-y-1.5">
            <li>
              L'accès est conditionné à l'ouverture d'un compte chez le broker
              partenaire via notre lien d'affiliation, et à un dépôt initial
              minimum de 250€ (montant maximal recommandé pour les débutants :
              1500€).
            </li>
            <li>
              Le membre reste libre de ses retraits, MAIS un retrait effectué
              <strong>avant qualification CPA</strong> (i.e. avant que nous
              ayons perçu notre commission affilié auprès du broker) entraîne
              <strong>l'exclusion automatique</strong> du groupe. L'utilisateur
              est notifié par email et sur son tableau de bord.
            </li>
            <li>
              Une fois la qualification CPA atteinte, l'utilisateur peut retirer
              librement et conserve son accès au groupe.
            </li>
            <li>
              Boursikotons se réserve le droit d'exclure un membre en cas
              d'abus, de comportement nuisible au groupe ou de violation des
              règles internes communiquées à l'inscription.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-[var(--color-text)] mb-2">
            5. Aucune garantie de résultat
          </h2>
          <p>
            Le trading comporte des risques. Boursikotons fournit des outils,
            une méthodologie et des analyses mais ne garantit aucun résultat
            financier. L'utilisateur est seul responsable de ses décisions de
            trading et de ses pertes éventuelles.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-[var(--color-text)] mb-2">
            6. Données personnelles
          </h2>
          <p>
            Les données collectées (Telegram ID, nom, email, historique
            d'inscriptions et de paiements) sont utilisées exclusivement pour
            la fourniture du service. Elles ne sont jamais revendues. Un
            utilisateur peut demander la suppression de son compte à tout moment
            via{' '}
            <a
              href="mailto:contact@boursikotons.com"
              className="text-[var(--color-accent-hover)] hover:underline"
            >
              contact@boursikotons.com
            </a>
            .
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-[var(--color-text)] mb-2">
            7. Litiges
          </h2>
          <p>
            Tout litige relatif aux présentes est soumis au droit des Émirats
            arabes unis et à la compétence exclusive des juridictions de Dubaï.
          </p>
        </section>
      </div>
    </Section>
  );
}
