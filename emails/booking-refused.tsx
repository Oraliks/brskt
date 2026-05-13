import { Link, Text } from '@react-email/components';
import { EmailLayout, styles } from './_components';

interface Props {
  firstName: string;
  formationTitle: string;
  adminNotes: string;
  bookingId: string;
}

export default function BookingRefusedEmail({
  firstName,
  formationTitle,
  adminNotes,
  bookingId,
}: Props) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://boursikotons.com';
  return (
    <EmailLayout preview="Ta réservation a été refusée">
      <Text style={styles.heading}>Réservation refusée</Text>
      <Text style={styles.paragraph}>
        Salut {firstName}, malheureusement on ne peut pas honorer ta
        réservation pour <strong>{formationTitle}</strong>.
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
        {adminNotes}
      </Text>
      <Text style={styles.paragraph}>
        Tu seras remboursé intégralement dans les 48h. Notre équipe va te
        recontacter si besoin pour les modalités.
      </Text>
      <Text style={styles.paragraph}>
        <Link href={`${appUrl}/dashboard#${bookingId}`} style={styles.cta}>
          Voir ma réservation
        </Link>
      </Text>
    </EmailLayout>
  );
}
