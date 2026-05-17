import Script from 'next/script';
import type { ThemeMode } from '@/lib/settings/theme-mode';

/**
 * Script inline injecté en <head> avant l'hydratation React.
 *
 * Comportement selon `mode` (admin setting) :
 *  - `both` : lit la préférence user (`localStorage` → prefers-color-scheme)
 *  - `light_only` : force light, ignore localStorage
 *  - `dark_only` : force dark, ignore localStorage
 *
 * On stocke aussi `data-theme-mode` sur <html> pour que le ThemeToggle
 * sache si afficher ou non le bouton (hide si != 'both').
 */
export function ThemeScript({ mode }: { mode: ThemeMode }) {
  const escapedMode = mode === 'light_only' || mode === 'dark_only' ? mode : 'both';
  return (
    // eslint-disable-next-line @next/next/no-before-interactive-script-outside-document
    <Script id="theme-bootstrap" strategy="beforeInteractive">
      {`(function(){try{var m='${escapedMode}';document.documentElement.setAttribute('data-theme-mode',m);if(m==='light_only'){document.documentElement.setAttribute('data-theme','light');return;}if(m==='dark_only'){document.documentElement.removeAttribute('data-theme');return;}var s=localStorage.getItem('theme');var t=s==='light'||s==='dark'?s:(window.matchMedia&&window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark');document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`}
    </Script>
  );
}
