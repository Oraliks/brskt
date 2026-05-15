'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bell,
  Calculator,
  Calendar,
  Check,
  Flame,
  Gift,
  HelpCircle,
  Loader2,
  Send,
  Trophy,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { adminSetBotFeaturesAction } from '@/lib/actions/admin';
import type { BotFeatures } from '@/lib/settings/bot-features';
import { cn } from '@/lib/utils';

interface Props {
  initial: BotFeatures;
}

interface FeatureMeta {
  key: keyof BotFeatures;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  affects: string[]; // commandes / CRONs impactés
}

const FEATURES: FeatureMeta[] = [
  {
    key: 'quiz',
    title: 'Quiz quotidien',
    description:
      'Question du jour pushée à 18h UTC, leaderboard hebdo. Désactiver = pas de quiz envoyé + commandes /quiz et /leaderboard inactives.',
    icon: Trophy,
    affects: ['/quiz', '/leaderboard', 'CRON daily-quiz'],
  },
  {
    key: 'priceAlerts',
    title: 'Alertes de prix',
    description:
      'Alertes FX/crypto déclenchées toutes les 5 min. Désactiver = aucune nouvelle alerte ne se déclenche, commandes /alert /alerts /unalert inactives.',
    icon: Bell,
    affects: ['/alert', '/alerts', '/unalert', 'CRON check-price-alerts'],
  },
  {
    key: 'economicAlerts',
    title: 'Calendrier économique',
    description:
      'Alertes 30 min avant les events macro (NFP, CPI, FOMC). Désactiver = aucune notification + commandes /events /subscribe events inactives.',
    icon: Calendar,
    affects: ['/events', '/subscribe events', 'CRON check-economic-alerts'],
  },
  {
    key: 'calculators',
    title: 'Calculatrices trading',
    description:
      '/size, /rr, /pip, /convert. Très peu de raisons de désactiver — c\'est de la pure utilité user.',
    icon: Calculator,
    affects: ['/size', '/rr', '/pip', '/convert'],
  },
  {
    key: 'inline',
    title: 'Mode inline (@boursikotonsbot ...)',
    description:
      'Le bot répond quand mentionné dans n\'importe quel chat (price quotes partageables). Marketing organique.',
    icon: Send,
    affects: ['inline query handler'],
  },
  {
    key: 'referral',
    title: 'Parrainage',
    description:
      '/invite + tracking des /start ref_<code> + podium sur le dashboard.',
    icon: Gift,
    affects: ['/invite', '/start ref_*', 'dashboard widget'],
  },
  {
    key: 'streak',
    title: 'Streak engagement',
    description:
      'Compteur de jours consécutifs d\'interaction avec le bot. Désactiver = /streak inactif, tracking arrêté.',
    icon: Flame,
    affects: ['/streak', 'tracking bumpBotStreak'],
  },
  {
    key: 'qualify',
    title: 'Questionnaire qualification',
    description:
      '/qualify — 3 questions inline pour profiler le user (expérience, objectif, temps dispo).',
    icon: HelpCircle,
    affects: ['/qualify'],
  },
];

export function BotFeaturesForm({ initial }: Props) {
  const router = useRouter();
  const [features, setFeatures] = useState<BotFeatures>(initial);
  const [pending, start] = useTransition();
  const [dirty, setDirty] = useState(false);
  /**
   * "✓ Enregistré" reste visible 3s après chaque save réussi puis disparaît.
   * Sert d'indicateur visuel passif quand l'admin clique sur Enregistrer.
   */
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    if (!justSaved) return;
    const t = setTimeout(() => setJustSaved(false), 3000);
    return () => clearTimeout(t);
  }, [justSaved]);

  function toggle(key: keyof BotFeatures) {
    setFeatures((prev) => ({ ...prev, [key]: !prev[key] }));
    setDirty(true);
  }

  function save() {
    start(async () => {
      const updates: Partial<BotFeatures> = {};
      for (const key of Object.keys(features) as (keyof BotFeatures)[]) {
        if (features[key] !== initial[key]) {
          updates[key] = features[key];
        }
      }
      if (Object.keys(updates).length === 0) {
        setDirty(false);
        return;
      }
      const result = await adminSetBotFeaturesAction(updates);
      if (result.success) {
        toast({ title: '✓ Toggles mis à jour' });
        setDirty(false);
        setJustSaved(true);
        router.refresh();
      } else {
        toast({
          title: 'Erreur',
          description: result.error,
          variant: 'destructive',
        });
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {FEATURES.map((f) => (
          <FeatureRow
            key={f.key}
            meta={f}
            enabled={features[f.key]}
            onToggle={() => toggle(f.key)}
          />
        ))}
      </div>

      <div className="flex items-center gap-3 pt-2">
        <Button onClick={save} disabled={!dirty || pending}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          Enregistrer les changements
        </Button>
        {justSaved && !dirty && (
          <span className="inline-flex items-center gap-1 text-xs text-emerald-300 light:text-emerald-700">
            <Check className="h-3.5 w-3.5" />
            Enregistré
          </span>
        )}
        {dirty && (
          <span className="text-xs text-amber-300 light:text-amber-700">
            Modifications en attente
          </span>
        )}
      </div>
    </div>
  );
}

function FeatureRow({
  meta,
  enabled,
  onToggle,
}: {
  meta: FeatureMeta;
  enabled: boolean;
  onToggle: () => void;
}) {
  const Icon = meta.icon;
  return (
    <div
      className={cn(
        'rounded-[var(--radius-md)] border p-4 transition-colors',
        enabled
          ? 'border-[var(--color-border)] bg-[var(--color-surface-tint)]'
          : 'border-[var(--color-border)] bg-transparent opacity-70'
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            'inline-flex h-9 w-9 items-center justify-center rounded-md flex-shrink-0 border',
            enabled
              ? 'bg-[var(--color-accent)]/15 border-[var(--color-accent)]/30'
              : 'bg-[var(--color-surface-tint-strong)] border-[var(--color-border)]'
          )}
        >
          <Icon
            className={cn(
              'h-4 w-4',
              enabled
                ? 'text-[var(--color-accent-hover)]'
                : 'text-[var(--color-text-faint)]'
            )}
          />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-3">
            <strong className="text-sm">{meta.title}</strong>
            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              onClick={onToggle}
              className={cn(
                'relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0',
                enabled
                  ? 'bg-emerald-500'
                  : 'bg-[var(--color-surface-tint-strong)]'
              )}
            >
              <span
                className={cn(
                  'inline-block h-4 w-4 rounded-full bg-white transition-transform',
                  enabled ? 'translate-x-6' : 'translate-x-1'
                )}
              />
            </button>
          </div>
          <p className="text-xs text-[var(--color-text-dim)] mt-1 leading-relaxed">
            {meta.description}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {meta.affects.map((a) => (
              <code
                key={a}
                className="text-[10px] font-mono bg-[var(--color-surface-tint-strong)] px-1.5 py-0.5 rounded"
              >
                {a}
              </code>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
