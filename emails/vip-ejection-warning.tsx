import { Link, Text } from '@react-email/components';
import { EmailLayout, styles } from './_components';

interface Props {
  firstName: string;
  reason: string;
}

/**
 * Email de warning envoyé ~24h avant une éjection automatique.
 * Donne au user une fenêtre pour régulariser (annuler le retrait,
 * rouvrir le compte, etc.).
 *
 * Ton : ferme mais pas aggressif. La règle a été expliquée à l'inscription.
 */
export default function VipEjectionWarningEmail({ firstName, reason }: Props) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://boursikotons.com';
  return (
    <EmailLayout preview="Action requise — risque d'éjection du groupe VIP">
      <Text style={styles.heading}>⚠️ Risque d&apos;éjection — agis vite</Text>

      <Text style={styles.paragraph}>
        Salut {firstName}, on a détecté une situation à risque sur ton
        compte qui va déclencher une <strong>éjection automatique du groupe
        VIP</strong> au prochain check (~24h).
      </Text>

      <Text
        style={{
          ...styles.paragraph,
          background: 'rgba(245,158,11,0.1)',
          border: '1px solid rgba(245,158,11,0.3)',
          padding: '14px 18px',
          borderRadius: '10px',
          fontSize: '14px',
        }}
      >
        <strong>Raison détectée :</strong>
        <br />
        {reason}
      </Text>

      <Text style={styles.paragraph}>
        <strong>Comment éviter l&apos;éjection :</strong>
      </Text>

      <Text style={{ ...styles.paragraph, fontSize: '14px' }}>
        • Si tu as fait un retrait sans avoir généré la commission CPA :
        redépose le montant sur ton compte broker pour que ton activité
        de trading puisse continuer.
        <br />
        <br />
        • Si ton compte a été clôturé : ouvre un nouveau compte via notre
        lien d&apos;affiliation et effectue un nouveau dépôt.
        <br />
        <br />
        • Si tu penses qu&apos;il y a une erreur : contacte-nous immédiatement
        via Telegram <Link href="https://t.me/boursi_support">@boursi_support</Link>.
      </Text>

      <Text style={styles.paragraph}>
        <Link href={`${appUrl}/dashboard`} style={styles.cta}>
          Voir mon statut
        </Link>
      </Text>

      <Text
        style={{
          ...styles.paragraph,
          fontSize: '12px',
          color: '#a3a3ad',
          marginTop: '20px',
        }}
      >
        Sans action de ta part, l&apos;éjection sera effective au prochain
        check quotidien. Cet email n&apos;est envoyé qu&apos;une seule fois
        par incident.
      </Text>
    </EmailLayout>
  );
}
