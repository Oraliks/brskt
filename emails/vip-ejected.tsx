import { Link, Text } from '@react-email/components';
import { EmailLayout, styles } from './_components';

interface Props {
  firstName: string;
  reason: string;
}

export default function VipEjectedEmail({ firstName, reason }: Props) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://boursikotons.com';
  return (
    <EmailLayout preview="Tu as été retiré du groupe VIP.">
      <Text style={styles.heading}>Tu as été retiré du groupe VIP</Text>
      <Text style={styles.paragraph}>
        Salut {firstName}, comme prévu par notre fonctionnement, ton accès au
        groupe VIP Telegram a été révoqué.
      </Text>
      <Text
        style={{
          ...styles.paragraph,
          background: 'rgba(239,68,68,0.1)',
          border: '1px solid rgba(239,68,68,0.25)',
          padding: '12px 16px',
          borderRadius: '10px',
        }}
      >
        <strong>Raison :</strong>
        <br />
        {reason}
      </Text>
      <Text style={styles.paragraph}>
        Tu peux toujours réintégrer le groupe — la procédure est détaillée sur
        ton dashboard.
      </Text>
      <Text style={styles.paragraph}>
        <Link href={`${appUrl}/dashboard/ejected`} style={styles.cta}>
          Voir les conditions de réintégration
        </Link>
      </Text>
    </EmailLayout>
  );
}
