import { ImageResponse } from 'next/og';

export const alt = 'Boursikotons — Formation trading professionnel & VIP Telegram';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/**
 * OG image partagée par défaut (Twitter, Telegram, Discord, etc.).
 * Pour des OG par page, créer un opengraph-image.tsx dans le dossier de la page.
 */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background:
            'radial-gradient(ellipse at top left, #1e1b4b 0%, #0a0a0f 60%)',
          color: 'white',
          display: 'flex',
          flexDirection: 'column',
          padding: 80,
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            fontSize: 28,
            fontWeight: 600,
            color: '#a5b4fc',
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              background:
                'linear-gradient(135deg, #6366f1 0%, #ec4899 100%)',
              borderRadius: 14,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: 36,
              fontWeight: 800,
            }}
          >
            B
          </div>
          Boursikotons
        </div>

        <div
          style={{
            marginTop: 80,
            fontSize: 84,
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: -2,
            maxWidth: 980,
          }}
        >
          Trader avec une équipe pro
        </div>

        <div
          style={{
            marginTop: 24,
            fontSize: 38,
            color: '#94a3b8',
            lineHeight: 1.3,
            maxWidth: 980,
          }}
        >
          Formation à distance ou à Dubaï · Groupe VIP Telegram via partenariat
          broker.
        </div>

        <div
          style={{
            marginTop: 'auto',
            display: 'flex',
            gap: 32,
            fontSize: 22,
            color: '#64748b',
          }}
        >
          <div>boursikotons.com</div>
          <div>·</div>
          <div>Trading depuis 2018</div>
        </div>
      </div>
    ),
    { ...size }
  );
}
