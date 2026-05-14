import { Link, Text } from '@react-email/components';
import { EmailLayout, styles } from './_components';

interface Props {
  firstName: string;
  /** Nombre de relances déjà envoyées avant celle-ci (0 = première, 1 = deuxième). */
  reminderNumber: 0 | 1;
  /** L'étape où le user est resté coincé. */
  step:
    | 'link_generated'
    | 'signup_validated'
    | 'deposit_pending'
    | 'deposit_validated'
    | 'telegram_invited';
}

/**
 * Email de relance pour un funnel VIP en pause.
 * - 1ère relance (reminderNumber=0) : J+2 — ton léger, "où en es-tu ?"
 * - 2ème relance (reminderNumber=1) : J+7 — ton plus direct, dernier rappel
 *
 * Le contenu est adapté à l'étape pour ne pas dire "fais ton dépôt" à
 * quelqu'un qui n'a même pas créé son compte broker.
 */
export default function VipReminderEmail({
  firstName,
  reminderNumber,
  step,
}: Props) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://boursikotons.com';

  // Contenu spécifique à chaque étape
  const stepCopy: Record<
    Props['step'],
    { headline: string; body: string; cta: string }
  > = {
    link_generated: {
      headline: "Ton lien d'affiliation t'attend",
      body: "Tu as commencé le funnel VIP mais tu n'as pas encore créé ton compte chez le broker. C'est l'étape la plus rapide : 5 min en passant par ton lien dédié.",
      cta: 'Continuer mon inscription',
    },
    signup_validated: {
      headline: 'Plus que ton premier dépôt',
      body: "Ton inscription broker est validée. Il ne te reste qu'à effectuer ton premier dépôt (min. 250€) pour accéder au groupe VIP. On reste sur tes fonds, jamais sur les nôtres.",
      cta: 'Indiquer mon dépôt',
    },
    deposit_pending: {
      headline: 'On attend la confirmation de ton dépôt',
      body: "Tu as déclaré ton dépôt, on est en train de le valider. Si tu ne l'as pas encore effectué côté broker, c'est le moment — on ne peut pas avancer sans.",
      cta: 'Voir ma progression',
    },
    deposit_validated: {
      headline: 'Génère ton lien Telegram',
      body: "Ton dépôt est validé. Il te reste une seule étape : générer ton lien d'invitation Telegram (à usage unique, valide 24h) et rejoindre le groupe.",
      cta: 'Récupérer mon lien',
    },
    telegram_invited: {
      headline: 'Tu n\'as pas utilisé ton lien Telegram',
      body: "Ton lien d'invitation a peut-être expiré. Génère-en un nouveau et rejoins le groupe VIP — c'est ouvert quand tu veux.",
      cta: 'Régénérer mon lien',
    },
  };

  const copy = stepCopy[step];
  const isLast = reminderNumber === 1;

  return (
    <EmailLayout
      preview={
        isLast
          ? `Dernier rappel : ${copy.headline.toLowerCase()}`
          : copy.headline
      }
    >
      <Text style={styles.heading}>
        {isLast
          ? `${copy.headline} — dernier rappel`
          : `Salut ${firstName}, ${copy.headline.toLowerCase()}`}
      </Text>
      <Text style={styles.paragraph}>{copy.body}</Text>

      <Text style={styles.paragraph}>
        <Link href={`${appUrl}/vip`} style={styles.cta}>
          {copy.cta}
        </Link>
      </Text>

      <Text
        style={{
          ...styles.paragraph,
          background: 'rgba(99,102,241,0.08)',
          border: '1px solid rgba(99,102,241,0.25)',
          padding: '12px 16px',
          borderRadius: '10px',
          fontSize: '13px',
        }}
      >
        💎 <strong>Rappel :</strong> le VIP est 100% gratuit — tu payes 0€ à
        Boursikotons. Notre rémunération vient du broker partenaire quand tu
        trades, donc on a intérêt à ce que tu réussisses.
      </Text>

      {isLast && (
        <Text
          style={{
            ...styles.paragraph,
            fontSize: '12px',
            color: '#7c7c87',
            fontStyle: 'italic',
          }}
        >
          C'est le dernier email automatique qu'on t'envoie sur ce funnel.
          Tu peux reprendre quand tu veux depuis ton dashboard.
        </Text>
      )}
    </EmailLayout>
  );
}
