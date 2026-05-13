import { Link, Text } from '@react-email/components';
import { EmailLayout, styles } from './_components';

interface Props {
  firstName: string;
  formationTitle: string;
  bookingId: string;
}

export default function BookingReceivedEmail({
  firstName,
  formationTitle,
  bookingId,
}: Props) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://boursikotons.com';
  return (
    <EmailLayout preview="On a bien reçu ta demande de réservation.">
      <Text style={styles.heading}>Salut {firstName},</Text>
      <Text style={styles.paragraph}>
        On a bien reçu ta demande de réservation pour la formation{' '}
        <strong>{formationTitle}</strong>.
      </Text>
      <Text style={styles.paragraph}>
        Notre équipe revient vers toi sous 24h pour valider l'un de tes
        créneaux préférés — ou t'en proposer un autre si besoin.
      </Text>
      <Text style={styles.paragraph}>
        <Link href={`${appUrl}/dashboard`} style={styles.cta}>
          Voir ma réservation
        </Link>
      </Text>
      <Text style={{ ...styles.paragraph, fontSize: '12px', color: '#8a8a96' }}>
        Référence : #{bookingId.slice(0, 8)}
      </Text>
    </EmailLayout>
  );
}
