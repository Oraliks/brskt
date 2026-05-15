import Script from 'next/script';

/**
 * Script inline injecté en <head> avant l'hydratation React.
 *
 * Lit la préférence (`localStorage` → `prefers-color-scheme` → 'dark') et
 * applique l'attribut `data-theme` sur <html> AVANT le premier paint.
 * Évite le flash dark→light pour les users qui ont choisi light.
 *
 * Pourquoi `next/script` et pas un `<script>` direct ?
 * React 19 émet un warning console pour tout `<script dangerouslySetInnerHTML>`
 * rendu via JSX ("Encountered a script tag while rendering React component").
 * `next/script` + `strategy="beforeInteractive"` produit le même résultat
 * (inline dans le HTML SSR, exécuté avant le first paint) sans le warning,
 * et `id` permet à Next de dédupliquer si le composant est re-rendu.
 *
 * `suppressHydrationWarning` reste requis sur <html> côté layout puisque
 * le server rend sans attribut et le client l'ajoute.
 */
export function ThemeScript() {
  return (
    // Le lint warning `no-before-interactive-script-outside-document` cible
    // Pages Router. Avec App Router (Next 13+), beforeInteractive est OK dans
    // tout composant Server rendu depuis app/layout.tsx — ce qui est notre cas.
    // eslint-disable-next-line @next/next/no-before-interactive-script-outside-document
    <Script id="theme-bootstrap" strategy="beforeInteractive">
      {`(function(){try{var s=localStorage.getItem('theme');var t=s==='light'||s==='dark'?s:(window.matchMedia&&window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark');document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`}
    </Script>
  );
}
