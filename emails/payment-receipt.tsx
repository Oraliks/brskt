import { Link, Text } from '@react-email/components';
import { EmailLayout, styles } from './_components';

interface Props {
  firstName: string;
  formationTitle: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  paymentId: string;
}

export default function PaymentReceiptEmail({
  firstName,
  formationTitle,
  amount,
  currency,
  paymentMethod,
  paymentId,
}: Props) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://boursikotons.com';
  return (
    <EmailLayout preview={`Paiement de ${amount} ${currency} confirmé`}>
      <Text style={styles.heading}>Paiement confirmé ✓</Text>
      <Text style={styles.paragraph}>
        Salut {firstName}, ton paiement pour{' '}
        <strong>{formationTitle}</strong> est bien reçu.
      </Text>
      <Text
        style={{
          ...styles.paragraph,
          padding: '16px',
          backgroundColor: 'rgba(255,255,255,0.03)',
          borderRadius: '10px',
          fontFamily: 'monospace',
          fontSize: '13px',
        }}
      >
        Montant : <strong>{amount} {currency}</strong>
        <br />
        Méthode : {paymentMethod}
        <br />
        Référence : #{paymentId.slice(0, 12)}
      </Text>
      <Text style={styles.paragraph}>
        Tu recevras un email avec les détails pratiques (lien visio, planning)
        quelques jours avant la formation.
      </Text>
      <Text style={styles.paragraph}>
        <Link href={`${appUrl}/dashboard`} style={styles.cta}>
          Voir mon espace
        </Link>
      </Text>
    </EmailLayout>
  );
}
