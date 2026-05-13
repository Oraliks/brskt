'use client';

import { useEffect } from 'react';

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Fallback de dernier recours : utilisé si le root layout lui-même crash.
 * Doit définir son propre <html> et <body>.
 */
export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    console.error('[boursikotons global error]', error);
  }, [error]);

  return (
    <html lang="fr">
      <body
        style={{
          background: '#07070b',
          color: '#f5f5f7',
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
        }}
      >
        <div style={{ maxWidth: 500, textAlign: 'center' }}>
          <div
            style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 12,
              color: 'rgba(252, 165, 165, 0.8)',
              textTransform: 'uppercase',
              letterSpacing: '0.2em',
              marginBottom: 24,
            }}
          >
            Erreur critique · APP_GLOBAL_500
          </div>
          <h1
            style={{
              fontSize: 'clamp(64px, 10vw, 120px)',
              fontWeight: 500,
              fontFamily: 'Times New Roman, serif',
              fontStyle: 'italic',
              margin: '0 0 16px 0',
              background: 'linear-gradient(180deg, #ffffff 0%, #b8b8c2 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            500
          </h1>
          <h2
            style={{
              fontSize: 24,
              fontWeight: 600,
              margin: '0 0 12px 0',
            }}
          >
            Le site a rencontré un souci.
          </h2>
          <p style={{ color: '#8a8a96', fontSize: 14, lineHeight: 1.5, margin: 0 }}>
            Une erreur critique a empêché la page de se charger.
          </p>
          {error.digest && (
            <p
              style={{
                marginTop: 16,
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 12,
                color: '#fca5a5',
              }}
            >
              Référence : {error.digest}
            </p>
          )}
          <div style={{ marginTop: 32, display: 'flex', justifyContent: 'center', gap: 12 }}>
            <button
              onClick={() => reset()}
              style={{
                background: '#ffffff',
                color: '#07070b',
                border: 'none',
                padding: '12px 24px',
                borderRadius: 999,
                fontWeight: 500,
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              Réessayer
            </button>
            <a
              href="/"
              style={{
                background: 'rgba(255,255,255,0.05)',
                color: '#ffffff',
                border: '1px solid rgba(255,255,255,0.14)',
                padding: '12px 24px',
                borderRadius: 999,
                fontWeight: 500,
                fontSize: 14,
                textDecoration: 'none',
              }}
            >
              Accueil
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
