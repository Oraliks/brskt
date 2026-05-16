/**
 * Loader global utilisé comme suspense fallback pour les transitions
 * entre routes. Affiché pendant que les RSC chargent côté serveur.
 *
 * Design : spinner centré avec gradient violet→rose pour matcher le
 * thème + top progress bar discrète. Volontairement minimal pour ne
 * pas être intrusif sur les transitions rapides.
 */
export default function Loading() {
  return (
    <>
      {/* Top progress bar — barre fine animée tout en haut du viewport */}
      <div
        className="fixed top-0 left-0 right-0 z-[100] h-0.5 overflow-hidden pointer-events-none"
        aria-hidden="true"
      >
        <div className="h-full w-1/3 bg-gradient-to-r from-indigo-500 via-pink-500 to-indigo-500 animate-[loading-bar_1.2s_ease-in-out_infinite]" />
      </div>

      {/* Spinner centré */}
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div
            className="h-9 w-9 rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-accent)] animate-spin"
            role="status"
            aria-label="Chargement en cours"
          />
          <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-faint)]">
            Chargement
          </span>
        </div>
      </div>
    </>
  );
}
