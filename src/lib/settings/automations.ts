/**
 * Toggles + délais + templates pour toutes les automatisations CRON.
 *
 * Stocké dans `app_settings` key='automations'. Chaque CRON lit ce setting
 * en début de run et fail-fast si son toggle est OFF — pas besoin de
 * redéployer pour désactiver une autom.
 *
 * Les templates supportent les placeholders entre accolades :
 *  {firstName}, {formationTitle}, {checkoutUrl}, {appUrl}, {daysOpen}, etc.
 * Le caller substitue avant l'envoi.
 */

import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { appSettings } from '@/lib/db/schema';

const KEY = 'automations';

export interface AutomationConfig {
  /** Auto-relance des bookings restés en pending_payment. */
  paymentReminder: {
    enabled: boolean;
    /** Heures après création avant 1er DM relance. */
    firstNudgeHours: number;
    /** Heures pour le 2e DM (rappel). */
    secondNudgeHours: number;
    /** Jours avant auto-cancel si toujours pas payé. */
    autoCancelDays: number;
    template1: string;
    template2: string;
    templateCancel: string;
  };
  /** Drop-off du funnel VIP : user n'a pas progressé depuis X jours. */
  vipDropoff: {
    enabled: boolean;
    firstNudgeDays: number;
    secondNudgeDays: number;
    template1: string;
    template2: string;
  };
  /** Demande de témoignage J+X après qualification CPA ou completion formation. */
  testimonialRequest: {
    enabled: boolean;
    delayDays: number;
    template: string;
  };
  /** Stats hebdo aux admins. */
  weeklyAdminStats: {
    enabled: boolean;
    /** 0 = dimanche, 1 = lundi, ..., 6 = samedi (UTC). */
    dayOfWeek: number;
    hourUtc: number;
  };
  /** Reminders avant formation. */
  formationReminders: {
    enabled: boolean;
    daysBefore: number[]; // ex: [7, 1]
    template: string;
  };
  /** NPS après formation completed. */
  npsRequest: {
    enabled: boolean;
    delayDays: number;
    question: string;
  };
  /** Briefing matinal : auto-généré vs template manuel. */
  briefingMode: 'auto' | 'manual';
}

export const DEFAULT_AUTOMATIONS: AutomationConfig = {
  paymentReminder: {
    enabled: true,
    firstNudgeHours: 48,
    secondNudgeHours: 72,
    autoCancelDays: 7,
    template1:
      `💳 <b>Ton créneau n'est pas garanti</b>\n\n` +
      `Salut {firstName} ! Ta réservation pour <b>{formationTitle}</b> attend ` +
      `toujours le paiement. Tant que tu n'as pas réglé, la place reste ouverte ` +
      `à d'autres.\n\nFinalise ici : {checkoutUrl}`,
    template2:
      `⏰ <b>Dernier rappel — {formationTitle}</b>\n\n` +
      `Ta réservation date d'il y a {daysOpen} jours et n'est pas encore payée.\n` +
      `Si tu finalises sous 4 jours, on garde ta place. Sinon on annulera ` +
      `automatiquement.\n\nPayer : {checkoutUrl}`,
    templateCancel:
      `❌ <b>Réservation expirée</b>\n\n` +
      `Ta réservation pour <b>{formationTitle}</b> a été annulée automatiquement ` +
      `(non payée après {daysOpen} jours). Tu peux refaire une demande à tout ` +
      `moment : {appUrl}/formation/reserver`,
  },
  vipDropoff: {
    enabled: true,
    firstNudgeDays: 7,
    secondNudgeDays: 14,
    template1:
      `👋 <b>Tu as démarré le funnel VIP</b>\n\n` +
      `Salut {firstName}, on a vu que tu as commencé mais pas terminé. Une ` +
      `question ? Réponds ici ou tape /help.\n\n` +
      `Continuer : {appUrl}/vip`,
    template2:
      `🤔 <b>Rappel VIP — toujours partant ?</b>\n\n` +
      `Aucun stress si tu as changé d'avis. Ton lien reste valide à vie. ` +
      `Si tu veux qu'on t'aide à débloquer une étape, dis-moi.\n\n` +
      `{appUrl}/vip`,
  },
  testimonialRequest: {
    enabled: true,
    delayDays: 30,
    template:
      `⭐ <b>Ton retour nous aiderait</b>\n\n` +
      `Salut {firstName}, ça fait 30 jours que tu es {context}. Si tu as 2 min, ` +
      `partage ton expérience avec :\n\n` +
      `<code>/temoignage Ton avis ici…</code>\n\n` +
      `On le valide et il apparaît sur {appUrl}/temoignages avec ton @ cliquable. ` +
      `Ça nous aide énormément, et ça aide les futurs membres à se décider.`,
  },
  weeklyAdminStats: {
    enabled: true,
    dayOfWeek: 1, // lundi
    hourUtc: 8,
  },
  formationReminders: {
    enabled: true,
    daysBefore: [7, 1],
    template:
      `📚 <b>Formation dans {daysLeft} jour(s)</b>\n\n` +
      `Salut {firstName}, ta formation <b>{formationTitle}</b> arrive le ` +
      `<b>{date}</b>.\n\n{logistics}`,
  },
  npsRequest: {
    enabled: true,
    delayDays: 15,
    question:
      `📊 <b>Comment tu noterais ta formation ?</b>\n\n` +
      `De 0 à 10, à quel point recommanderais-tu Boursikotons à un ami ?\n\n` +
      `<i>Ta réponse est anonyme côté équipe, juste pour qu'on s'améliore.</i>`,
  },
  briefingMode: 'auto',
};

export async function getAutomations(): Promise<AutomationConfig> {
  try {
    const row = await db.query.appSettings.findFirst({
      where: eq(appSettings.key, KEY),
    });
    if (!row) return DEFAULT_AUTOMATIONS;
    // Deep merge avec defaults pour gérer l'ajout de nouvelles autom
    return mergeDeep(DEFAULT_AUTOMATIONS, row.value as Partial<AutomationConfig>);
  } catch (err) {
    console.error('[automations] read failed', err);
    return DEFAULT_AUTOMATIONS;
  }
}

type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export async function setAutomations(
  patch: DeepPartial<AutomationConfig>,
  userId: string
): Promise<void> {
  const current = await getAutomations();
  const next = mergeDeep(current, patch as Partial<AutomationConfig>);
  const value = next as unknown as Record<string, unknown>;
  await db
    .insert(appSettings)
    .values({
      key: KEY,
      value,
      updatedBy: userId,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value, updatedBy: userId, updatedAt: new Date() },
    });
}

/**
 * Substitue les placeholders {key} dans un template.
 * Les clés inconnues sont laissées telles quelles pour faciliter le debug.
 */
export function renderTemplate(
  template: string,
  vars: Record<string, string | number>
): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const v = vars[key];
    return v !== undefined ? String(v) : match;
  });
}

function mergeDeep<T>(base: T, patch: Partial<T>): T {
  if (!patch || typeof patch !== 'object') return base;
  const out: Record<string, unknown> = {
    ...(base as Record<string, unknown>),
  };
  for (const k of Object.keys(patch)) {
    const v = (patch as Record<string, unknown>)[k];
    if (
      v &&
      typeof v === 'object' &&
      !Array.isArray(v) &&
      typeof out[k] === 'object'
    ) {
      out[k] = mergeDeep(out[k], v as Partial<unknown>);
    } else if (v !== undefined) {
      out[k] = v;
    }
  }
  return out as T;
}
