import { Link, Text } from '@react-email/components';
import { EmailLayout, styles } from './_components';

interface Props {
  firstName: string;
}

export default function VipSignupValidatedEmail({ firstName }: Props) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://boursikotons.com';
  return (
    <EmailLayout preview="Ton inscription broker est validée. Passe à la suite.">
      <Text style={styles.heading}>Inscription validée ✓</Text>
      <Text style={styles.paragraph}>
        Salut {firstName}, on a bien retrouvé ton compte broker. Tu peux
        maintenant déposer le minimum (250€) puis revenir déclarer ton dépôt
        sur la plateforme.
      </Text>
      <Text style={styles.paragraph}>
        <Link href={`${appUrl}/vip`} style={styles.cta}>
          Aller au funnel VIP
        </Link>
      </Text>
    </EmailLayout>
  );
}
