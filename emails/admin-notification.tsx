import { Link, Text } from '@react-email/components';
import { EmailLayout, styles } from './_components';

interface Props {
  type: string;
  summary: string;
  link?: string;
}

export default function AdminNotificationEmail({
  type,
  summary,
  link,
}: Props) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://boursikotons.com';
  const fullLink = link ?? `${appUrl}/admin`;
  return (
    <EmailLayout preview={`Admin : ${type}`}>
      <Text style={styles.heading}>Notification admin</Text>
      <Text
        style={{
          ...styles.paragraph,
          fontFamily: 'monospace',
          fontSize: '12px',
          color: '#7c7fff',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
        }}
      >
        {type}
      </Text>
      <Text style={styles.paragraph}>{summary}</Text>
      <Text style={styles.paragraph}>
        <Link href={fullLink} style={styles.cta}>
          Ouvrir le back-office
        </Link>
      </Text>
    </EmailLayout>
  );
}
