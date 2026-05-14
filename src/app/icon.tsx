import { ImageResponse } from 'next/og';

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

/**
 * Favicon généré dynamiquement. Sert /icon.png — Next.js gère <link rel="icon">.
 */
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: 'linear-gradient(135deg, #6366f1 0%, #ec4899 100%)',
          color: 'white',
          fontSize: 22,
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 8,
        }}
      >
        B
      </div>
    ),
    { ...size }
  );
}
