import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import * as React from 'react';

const main = {
  backgroundColor: '#07070b',
  color: '#f5f5f7',
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  margin: 0,
  padding: 0,
};

const container = {
  maxWidth: '560px',
  margin: '40px auto',
  padding: '32px',
  backgroundColor: '#0e0e15',
  borderRadius: '16px',
  border: '1px solid rgba(255,255,255,0.08)',
};

const heading = {
  fontSize: '24px',
  fontWeight: '600',
  lineHeight: '1.3',
  color: '#ffffff',
  margin: '0 0 16px 0',
};

const paragraph = {
  fontSize: '15px',
  lineHeight: '1.65',
  color: '#c9c9d3',
  margin: '12px 0',
};

const footer = {
  fontSize: '12px',
  color: '#54545e',
  textAlign: 'center' as const,
  margin: '24px 0 0 0',
};

const cta = {
  display: 'inline-block',
  backgroundColor: '#6366f1',
  color: '#ffffff',
  padding: '12px 24px',
  borderRadius: '10px',
  textDecoration: 'none',
  fontWeight: '500',
  fontSize: '15px',
};

const logo = {
  fontSize: '20px',
  fontWeight: '600',
  letterSpacing: '-0.01em',
  color: '#ffffff',
  margin: '0 0 24px 0',
};

const hr = {
  border: 'none',
  borderTop: '1px solid rgba(255,255,255,0.08)',
  margin: '24px 0',
};

interface LayoutProps {
  preview: string;
  children: React.ReactNode;
}

export function EmailLayout({ preview, children }: LayoutProps) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={logo}>Boursikotons</Text>
          {children}
          <Hr style={hr} />
          <Text style={footer}>
            Boursikotons · Dubaï UAE ·{' '}
            <Link
              href={process.env.NEXT_PUBLIC_APP_URL ?? 'https://boursikotons.com'}
              style={{ color: '#7c7fff' }}
            >
              boursikotons.com
            </Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export const styles = {
  heading,
  paragraph,
  cta,
  hr,
  footer,
  section: { padding: '0' } as React.CSSProperties,
};

export { Section };
