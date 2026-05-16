'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

// ============================================================
// Types Telegram WebApp (sous-ensemble qu'on utilise)
// ============================================================

interface TelegramThemeParams {
  bg_color?: string;
  text_color?: string;
  hint_color?: string;
  link_color?: string;
  button_color?: string;
  button_text_color?: string;
  secondary_bg_color?: string;
  header_bg_color?: string;
  accent_text_color?: string;
  section_bg_color?: string;
  section_header_text_color?: string;
  subtitle_text_color?: string;
  destructive_text_color?: string;
}

interface TelegramButton {
  text: string;
  isVisible: boolean;
  isActive: boolean;
  isProgressVisible: boolean;
  setText(text: string): TelegramButton;
  onClick(cb: () => void): TelegramButton;
  offClick(cb: () => void): TelegramButton;
  show(): TelegramButton;
  hide(): TelegramButton;
  enable(): TelegramButton;
  disable(): TelegramButton;
  showProgress(leaveActive?: boolean): TelegramButton;
  hideProgress(): TelegramButton;
}

interface TelegramBackButton {
  isVisible: boolean;
  onClick(cb: () => void): TelegramBackButton;
  offClick(cb: () => void): TelegramBackButton;
  show(): TelegramBackButton;
  hide(): TelegramBackButton;
}

interface TelegramHapticFeedback {
  impactOccurred(
    style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'
  ): void;
  notificationOccurred(type: 'error' | 'success' | 'warning'): void;
  selectionChanged(): void;
}

export interface TelegramWebApp {
  initData?: string;
  initDataUnsafe?: { start_param?: string; user?: { id: number } };
  version: string;
  colorScheme: 'light' | 'dark';
  themeParams: TelegramThemeParams;
  isExpanded: boolean;
  viewportHeight: number;
  viewportStableHeight: number;

  ready(): void;
  expand(): void;
  close(): void;

  setHeaderColor(color: 'bg_color' | 'secondary_bg_color' | string): void;
  setBackgroundColor(color: 'bg_color' | 'secondary_bg_color' | string): void;

  enableClosingConfirmation(): void;
  disableClosingConfirmation(): void;

  MainButton: TelegramButton;
  BackButton: TelegramBackButton;
  HapticFeedback: TelegramHapticFeedback;

  onEvent(eventType: string, cb: () => void): void;
  offEvent(eventType: string, cb: () => void): void;
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

// ============================================================
// Context
// ============================================================

interface TelegramContextValue {
  /** Instance window.Telegram.WebApp si on est dans Telegram, sinon null. */
  tg: TelegramWebApp | null;
  /** True si on a détecté un Telegram WebApp valide. */
  isMiniApp: boolean;
  /** Initial start_param (deep-link param) une fois Mini App prête. */
  startParam: string | null;
}

const TelegramContext = createContext<TelegramContextValue>({
  tg: null,
  isMiniApp: false,
  startParam: null,
});

/**
 * Provider à monter dans le layout `/mini/*`. Détecte window.Telegram.WebApp,
 * appelle `ready()` + `expand()`, et applique la sync de couleurs header /
 * background pour que le Mini App s'intègre dans Telegram visuellement.
 *
 * Volontairement minimaliste : on n'override PAS la palette du site avec
 * `themeParams` du user — notre design a son identité. On synchronise
 * juste le `colorScheme` (dark/light) via `data-theme` sur <html>, et on
 * dit à Telegram quelles couleurs utiliser pour la barre en haut et le
 * fond, pour qu'il n'y ait pas de bandeau de couleur étrangère.
 */
export function TelegramProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [tg, setTg] = useState<TelegramWebApp | null>(null);
  const [startParam, setStartParam] = useState<string | null>(null);

  useEffect(() => {
    // Attente courte : `next/script beforeInteractive` charge le SDK
    // mais l'hydratation React peut être plus rapide.
    let attempts = 0;
    const interval = setInterval(() => {
      const inst = window.Telegram?.WebApp;
      attempts += 1;
      if (inst) {
        clearInterval(interval);
        try {
          inst.ready();
          inst.expand();

          // Sync data-theme avec colorScheme Telegram
          if (inst.colorScheme === 'light') {
            document.documentElement.setAttribute('data-theme', 'light');
          } else {
            document.documentElement.removeAttribute('data-theme');
          }

          // Sync header & background colors → look natif. Couleurs
          // hardcodées au bg-elevated de notre palette pour éviter
          // le flash de couleur différente.
          // Dark : #0e0e15 (bg-elevated dark mode).
          // Light : #ffffff.
          const headerBg = inst.colorScheme === 'light' ? '#ffffff' : '#0e0e15';
          try {
            inst.setHeaderColor(headerBg);
            inst.setBackgroundColor(headerBg);
          } catch {
            // Versions Telegram anciennes peuvent rejeter ces appels
          }

          // Récupère start_param pour le routing
          setStartParam(inst.initDataUnsafe?.start_param ?? null);
          setTg(inst);
        } catch (err) {
          console.warn('[telegram] init failed', err);
        }
      }
      if (attempts > 50) {
        // Pas Telegram, on stoppe pour éviter de boucler indéfiniment
        clearInterval(interval);
      }
    }, 100);
    return () => clearInterval(interval);
  }, []);

  const value = useMemo<TelegramContextValue>(
    () => ({
      tg,
      isMiniApp: tg !== null,
      startParam,
    }),
    [tg, startParam]
  );

  return (
    <TelegramContext.Provider value={value}>{children}</TelegramContext.Provider>
  );
}

export function useTelegram() {
  return useContext(TelegramContext);
}

// ============================================================
// Hook : haptic feedback (no-op si pas en Mini App)
// ============================================================

/**
 * Wrapper pratique : appelle le haptic feedback si on est en Mini App,
 * sinon ne fait rien. Utiliser librement dans tout composant client.
 */
export function useHaptic() {
  const { tg } = useTelegram();
  return useMemo(
    () => ({
      impact: (style: 'light' | 'medium' | 'heavy' = 'medium') => {
        try {
          tg?.HapticFeedback.impactOccurred(style);
        } catch {
          // older versions or web fallback
        }
      },
      success: () => {
        try {
          tg?.HapticFeedback.notificationOccurred('success');
        } catch {
          /* ignore */
        }
      },
      error: () => {
        try {
          tg?.HapticFeedback.notificationOccurred('error');
        } catch {
          /* ignore */
        }
      },
      warning: () => {
        try {
          tg?.HapticFeedback.notificationOccurred('warning');
        } catch {
          /* ignore */
        }
      },
      selection: () => {
        try {
          tg?.HapticFeedback.selectionChanged();
        } catch {
          /* ignore */
        }
      },
    }),
    [tg]
  );
}
