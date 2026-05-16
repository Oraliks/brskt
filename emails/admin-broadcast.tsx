import {
  Body,
  Container,
  Head,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components';

interface AdminBroadcastEmailProps {
  /** HTML brut tel qu'écrit par l'admin (déjà sanitisé serveur). */
  bodyHtml: string;
  /** Optionnel : prénom pour personnalisation. */
  firstName?: string;
  /** Preview text affiché dans la liste mail (max 90 caractères). */
  preview?: string;
}

/**
 * Template email broadcast — wrapper minimaliste autour du HTML fourni
 * par l'admin. Pas de header/footer marketés agressifs : reste sobre,
 * façon "un mail du fondateur" plutôt que newsletter.
 */
export default function AdminBroadcastEmail({
  bodyHtml,
  firstName,
  preview,
}: AdminBroadcastEmailProps) {
  const helloLine = firstName ? `Salut ${firstName},` : 'Salut,';

  return (
    <Html lang="fr">
      <Head />
      <Preview>{preview ?? 'Message de Boursikotons'}</Preview>
      <Body
        style={{
          backgroundColor: '#f5f5f7',
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          margin: 0,
          padding: '24px 12px',
        }}
      >
        <Container
          style={{
            maxWidth: 560,
            margin: '0 auto',
            backgroundColor: '#ffffff',
            borderRadius: 12,
            padding: '32px 24px',
          }}
        >
          <Section>
            <Text
              style={{
                fontSize: 14,
                lineHeight: 1.5,
                color: '#54545e',
                marginTop: 0,
                marginBottom: 16,
              }}
            >
              {helloLine}
            </Text>
            <div
              style={{ fontSize: 15, lineHeight: 1.6, color: '#0a0a0f' }}
              dangerouslySetInnerHTML={{ __html: bodyHtml }}
            />
          </Section>

          <Section
            style={{
              marginTop: 32,
              paddingTop: 16,
              borderTop: '1px solid #e5e5ea',
            }}
          >
            <Text
              style={{
                fontSize: 11,
                color: '#8a8a96',
                lineHeight: 1.5,
                marginTop: 0,
              }}
            >
              Tu reçois cet email parce que tu es inscrit·e à Boursikotons.
              Pour te désinscrire des emails marketing, réponds-nous avec
              « stop ». Pour les emails techniques (confirmations,
              factures), c&apos;est lié à ton compte.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
