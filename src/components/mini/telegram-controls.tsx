'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTelegram } from './telegram-webapp';

/**
 * Affiche le bouton principal Telegram (sticky bottom natif) sur la page
 * où ce composant est monté. Pourquoi un composant déclaratif plutôt que
 * des appels impératifs : permet d'utiliser la même logique de mount/
 * unmount que pour n'importe quel JSX, et garantit que le bouton
 * disparaît quand on quitte la page (cleanup useEffect).
 *
 * No-op si on n'est pas en Mini App — le composant peut rester monté
 * partout sans risque.
 */
export function TelegramMainButton({
  text,
  onClick,
  disabled,
  loading,
}: {
  text: string;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  const { tg } = useTelegram();
  // Ref pour le callback : permet de bind une seule fois côté Telegram
  // (qui ne déduplique pas les listeners) tout en gardant le dernier
  // closure du user dans le call.
  const onClickRef = useRef(onClick);
  useEffect(() => {
    onClickRef.current = onClick;
  }, [onClick]);

  // Bind/unbind unique tied au cycle de vie du composant
  useEffect(() => {
    if (!tg) return;
    const btn = tg.MainButton;
    const handler = () => onClickRef.current();
    btn.onClick(handler);
    btn.show();
    return () => {
      btn.offClick(handler);
      btn.hide();
    };
  }, [tg]);

  // Sync texte
  useEffect(() => {
    if (!tg) return;
    tg.MainButton.setText(text);
  }, [tg, text]);

  // Sync disabled
  useEffect(() => {
    if (!tg) return;
    if (disabled) tg.MainButton.disable();
    else tg.MainButton.enable();
  }, [tg, disabled]);

  // Sync loading
  useEffect(() => {
    if (!tg) return;
    if (loading) tg.MainButton.showProgress();
    else tg.MainButton.hideProgress();
  }, [tg, loading]);

  return null;
}

/**
 * Affiche le bouton « retour » natif Telegram en haut à gauche. Par défaut,
 * `router.back()` côté Next.js. Override possible via `onBack`.
 *
 * Le bouton remplace la flèche de fermeture habituelle — le user a
 * toujours moyen de fermer via le X / swipe down, donc on le cache pas
 * complètement, juste on substitue l'action.
 */
export function TelegramBackButton({ onBack }: { onBack?: () => void }) {
  const { tg } = useTelegram();
  const router = useRouter();

  useEffect(() => {
    if (!tg) return;
    const handler = () => {
      if (onBack) onBack();
      else router.back();
    };
    tg.BackButton.onClick(handler);
    tg.BackButton.show();
    return () => {
      tg.BackButton.offClick(handler);
      tg.BackButton.hide();
    };
  }, [tg, onBack, router]);

  return null;
}

/**
 * Empêche la fermeture accidentelle du Mini App pendant qu'il est monté.
 * À utiliser pendant un flow critique (checkout, soumission, etc.) pour
 * que le swipe-to-close du user déclenche une confirmation Telegram.
 */
export function TelegramClosingConfirmation() {
  const { tg } = useTelegram();

  useEffect(() => {
    if (!tg) return;
    tg.enableClosingConfirmation();
    return () => tg.disableClosingConfirmation();
  }, [tg]);

  return null;
}
