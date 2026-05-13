import { Link, Text } from '@react-email/components';
import { EmailLayout, styles } from './_components';

interface Props {
  firstName: string;
  botUsername?: string;
}

export default function WelcomeEmail({ firstName, botUsername }: Props) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://boursikotons.com';
  return (
    <EmailLayout preview="Bienvenue chez Boursikotons">
      <Text style={styles.heading}>Bienvenue {firstName} 👋</Text>
      <Text style={styles.paragraph}>
        Ton compte Boursikotons est créé. À partir d'ici tu peux :
      </Text>
      <Text style={styles.paragraph}>
        • <strong>Réserver une formation</strong> trading (à distance ou à Dubaï)
        <br />
        • <strong>Démarrer le funnel VIP Telegram</strong> — 100% gratuit, payé
        en commission par notre broker partenaire
      </Text>
      <Text style={styles.paragraph}>
        <Link href={`${appUrl}/dashboard`} style={styles.cta}>
          Aller sur mon espace
        </Link>
      </Text>
      {botUsername && (
        <Text
          style={{
            ...styles.paragraph,
            background: 'rgba(99,102,241,0.1)',
            border: '1px solid rgba(99,102,241,0.3)',
            padding: '12px 16px',
            borderRadius: '10px',
            fontSize: '13px',
          }}
        >
          💡 <strong>Pour les notifs en temps réel :</strong> envoie{' '}
          <code>/start</code> à{' '}
          <Link href={`https://t.me/${botUsername}`} style={{ color: '#7c7fff' }}>
            @{botUsername}
          </Link>{' '}
          sur Telegram. Tu recevras toutes les confirmations directement là-bas.
        </Text>
      )}
    </EmailLayout>
  );
}
