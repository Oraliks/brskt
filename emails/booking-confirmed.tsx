import { Link, Text } from '@react-email/components';
import { EmailLayout, styles } from './_components';

interface Props {
  firstName: string;
  formationTitle: string;
  isOnsite: boolean;
  confirmedDate: string;
  bookingId: string;
}

export default function BookingConfirmedEmail({
  firstName,
  formationTitle,
  isOnsite,
  confirmedDate,
  bookingId,
}: Props) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://boursikotons.com';
  return (
    <EmailLayout preview="Ta formation est confirmée — il ne reste qu'à payer.">
      <Text style={styles.heading}>Confirmé ! 🎉</Text>
      <Text style={styles.paragraph}>
        Salut {firstName}, ta formation <strong>{formationTitle}</strong> est
        confirmée pour le <strong>{confirmedDate}</strong>.
      </Text>
      <Text style={styles.paragraph}>
        Pour la valider définitivement, il ne reste qu'à régler. Tu peux payer
        par carte, PayPal ou crypto.
      </Text>
      <Text style={styles.paragraph}>
        <Link href={`${appUrl}/checkout/${bookingId}`} style={styles.cta}>
          Payer ma formation
        </Link>
      </Text>
      {isOnsite && (
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
          ⚠ <strong>Important :</strong> le billet d'avion A/R Dubaï n'est
          pas inclus dans le prix. À organiser de ton côté une fois le
          paiement effectué.
        </Text>
      )}
    </EmailLayout>
  );
}
