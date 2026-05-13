import { Link, Text } from '@react-email/components';
import { EmailLayout, styles } from './_components';

interface Props {
  firstName: string;
  formationTitle: string;
  proposedDate: string;
  adminNotes?: string | null;
  bookingId: string;
}

export default function BookingProposedEmail({
  firstName,
  formationTitle,
  proposedDate,
  adminNotes,
  bookingId,
}: Props) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://boursikotons.com';
  return (
    <EmailLayout preview="L'équipe te propose une autre date">
      <Text style={styles.heading}>L'équipe te propose une autre date</Text>
      <Text style={styles.paragraph}>
        Salut {firstName}, pour ta formation <strong>{formationTitle}</strong>,
        on te propose plutôt cette date :
      </Text>
      <Text
        style={{
          ...styles.paragraph,
          fontSize: '22px',
          fontWeight: '600',
          color: '#ffffff',
          padding: '14px 18px',
          background: 'rgba(99,102,241,0.1)',
          border: '1px solid rgba(99,102,241,0.3)',
          borderRadius: '10px',
        }}
      >
        {proposedDate}
      </Text>
      {adminNotes && (
        <Text
          style={{
            ...styles.paragraph,
            fontStyle: 'italic',
            background: 'rgba(255,255,255,0.03)',
            padding: '12px 16px',
            borderRadius: '10px',
            borderLeft: '3px solid rgba(255,255,255,0.2)',
          }}
        >
          « {adminNotes} »
        </Text>
      )}
      <Text style={styles.paragraph}>
        Tu peux <strong>accepter</strong> ou <strong>refuser</strong> cette
        proposition depuis ton dashboard. En cas de refus, remboursement
        intégral.
      </Text>
      <Text style={styles.paragraph}>
        <Link href={`${appUrl}/dashboard#${bookingId}`} style={styles.cta}>
          Voir et répondre
        </Link>
      </Text>
    </EmailLayout>
  );
}
