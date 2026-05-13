import { Link, Text } from '@react-email/components';
import { EmailLayout, styles } from './_components';

interface Props {
  firstName: string;
}

export default function VipDepositValidatedEmail({ firstName }: Props) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://boursikotons.com';
  return (
    <EmailLayout preview="Ton dépôt est validé. Récupère ton lien Telegram.">
      <Text style={styles.heading}>Bienvenue dans le VIP 🎉</Text>
      <Text style={styles.paragraph}>
        Salut {firstName}, ton dépôt est confirmé. Tu peux dès maintenant
        générer ton lien d'invitation Telegram (à usage unique, expire en
        24h).
      </Text>
      <Text style={styles.paragraph}>
        <Link href={`${appUrl}/vip`} style={styles.cta}>
          Récupérer mon lien Telegram
        </Link>
      </Text>
      <Text
        style={{
          ...styles.paragraph,
          background: 'rgba(245,158,11,0.1)',
          border: '1px solid rgba(245,158,11,0.3)',
          padding: '12px 16px',
          borderRadius: '10px',
          fontSize: '13px',
        }}
      >
        ⚠ <strong>Rappel important :</strong> tant que tu ne retires pas tes
        fonds avant qualification CPA, tu restes dans le groupe. Sinon → kick
        automatique.
      </Text>
    </EmailLayout>
  );
}
