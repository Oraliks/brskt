/**
 * Décor de fond animé (orbs + grille). Server component (CSS only, no JS).
 * En mode light, les orbs sont fortement atténués pour ne pas saturer
 * le fond clair (passent de opacity 0.3-0.5 à 0.08-0.15).
 */
export function BackgroundFX() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* Grille subtile */}
      <div className="absolute inset-0 bg-grid opacity-30 light:opacity-20 [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_50%,transparent_100%)]" />

      {/* Halo radial principal */}
      <div className="absolute inset-0 bg-radial-glow" />

      {/* Orb violet */}
      <div
        className="absolute -top-32 left-1/4 h-[480px] w-[480px] rounded-full opacity-50 light:opacity-15 blur-3xl"
        style={{
          background:
            'radial-gradient(circle, rgba(99,102,241,0.4) 0%, transparent 70%)',
          animation: 'float 12s ease-in-out infinite',
        }}
      />

      {/* Orb rose */}
      <div
        className="absolute top-1/3 right-1/4 h-[400px] w-[400px] rounded-full opacity-30 light:opacity-10 blur-3xl"
        style={{
          background:
            'radial-gradient(circle, rgba(236,72,153,0.3) 0%, transparent 70%)',
          animation: 'float 16s ease-in-out infinite reverse',
        }}
      />

      {/* Vignette bas — utilise --color-bg pour s'adapter au thème */}
      <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-[var(--color-bg)] to-transparent" />
    </div>
  );
}
