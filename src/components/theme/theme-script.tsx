/**
 * Script inline injecté en <head> avant l'hydratation React.
 *
 * Lit la préférence (`localStorage` → `prefers-color-scheme` → 'dark') et
 * applique l'attribut `data-theme` sur <html> AVANT le premier paint.
 * Évite le flash dark→light pour les users qui ont choisi light.
 *
 * `suppressHydrationWarning` est requis sur <html> côté layout puisque le
 * server rend sans attribut et le client l'ajoute.
 */
export function ThemeScript() {
  const code = `
(function() {
  try {
    var saved = localStorage.getItem('theme');
    var theme = saved === 'light' || saved === 'dark'
      ? saved
      : (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    document.documentElement.setAttribute('data-theme', theme);
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
})();
  `.trim();
  // dangerouslySetInnerHTML is OK ici car le contenu est statique côté serveur
  // et n'utilise aucune donnée user.
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
