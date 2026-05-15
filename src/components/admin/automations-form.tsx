'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { TabsContent } from '@/components/ui/tabs';
import { toast } from '@/components/ui/use-toast';
import { adminSetAutomationsAction } from '@/lib/actions/admin';
import type { AutomationConfig } from '@/lib/settings/automations';
import { cn } from '@/lib/utils';

interface Props {
  initial: AutomationConfig;
}

const DAYS_OF_WEEK = [
  'Dimanche',
  'Lundi',
  'Mardi',
  'Mercredi',
  'Jeudi',
  'Vendredi',
  'Samedi',
];

/**
 * Form unifié pour /admin/automations. Tient tout le state local et
 * persiste en un seul submit (toutes les sections en un patch).
 */
export function AutomationsForm({ initial }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [config, setConfig] = useState<AutomationConfig>(initial);

  function set<K extends keyof AutomationConfig>(
    section: K,
    patch: Partial<AutomationConfig[K]>
  ) {
    setConfig((c) => ({
      ...c,
      [section]: { ...(c[section] as object), ...patch },
    }));
  }

  function save() {
    start(async () => {
      const result = await adminSetAutomationsAction(config);
      if (result.success) {
        toast({ title: '✓ Automatisations mises à jour' });
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
    <>
      <TabsContent value="payment">
        <SectionWrapper
          title="Auto-relance bookings non payés"
          description="CRON quotidien qui DM les users dont le booking est resté en pending_payment, puis auto-cancel."
          enabled={config.paymentReminder.enabled}
          onToggle={(v) => set('paymentReminder', { enabled: v })}
        >
          <div className="grid sm:grid-cols-3 gap-3">
            <NumberField
              label="1er DM après (heures)"
              value={config.paymentReminder.firstNudgeHours}
              onChange={(v) =>
                set('paymentReminder', { firstNudgeHours: v })
              }
              min={1}
              max={720}
            />
            <NumberField
              label="2e DM après (heures)"
              value={config.paymentReminder.secondNudgeHours}
              onChange={(v) =>
                set('paymentReminder', { secondNudgeHours: v })
              }
              min={1}
              max={720}
            />
            <NumberField
              label="Auto-cancel après (jours)"
              value={config.paymentReminder.autoCancelDays}
              onChange={(v) =>
                set('paymentReminder', { autoCancelDays: v })
              }
              min={1}
              max={90}
            />
          </div>
          <TemplateField
            label="Template 1er DM"
            value={config.paymentReminder.template1}
            onChange={(v) => set('paymentReminder', { template1: v })}
            placeholders="{firstName} {formationTitle} {checkoutUrl} {daysOpen}"
          />
          <TemplateField
            label="Template 2e DM"
            value={config.paymentReminder.template2}
            onChange={(v) => set('paymentReminder', { template2: v })}
            placeholders="{firstName} {formationTitle} {checkoutUrl} {daysOpen}"
          />
          <TemplateField
            label="Template annulation auto"
            value={config.paymentReminder.templateCancel}
            onChange={(v) =>
              set('paymentReminder', { templateCancel: v })
            }
            placeholders="{firstName} {formationTitle} {daysOpen} {appUrl}"
          />
        </SectionWrapper>
      </TabsContent>

      <TabsContent value="vip">
        <SectionWrapper
          title="Drop-off VIP funnel"
          description="Relance les users qui ont commencé le funnel VIP mais n'ont pas progressé depuis X jours."
          enabled={config.vipDropoff.enabled}
          onToggle={(v) => set('vipDropoff', { enabled: v })}
        >
          <div className="grid sm:grid-cols-2 gap-3">
            <NumberField
              label="1er nudge après (jours)"
              value={config.vipDropoff.firstNudgeDays}
              onChange={(v) => set('vipDropoff', { firstNudgeDays: v })}
              min={1}
              max={90}
            />
            <NumberField
              label="2e nudge après (jours)"
              value={config.vipDropoff.secondNudgeDays}
              onChange={(v) => set('vipDropoff', { secondNudgeDays: v })}
              min={1}
              max={180}
            />
          </div>
          <TemplateField
            label="Template 1er nudge"
            value={config.vipDropoff.template1}
            onChange={(v) => set('vipDropoff', { template1: v })}
            placeholders="{firstName} {appUrl}"
          />
          <TemplateField
            label="Template 2e nudge"
            value={config.vipDropoff.template2}
            onChange={(v) => set('vipDropoff', { template2: v })}
            placeholders="{firstName} {appUrl}"
          />
        </SectionWrapper>
      </TabsContent>

      <TabsContent value="testimonial">
        <SectionWrapper
          title="Demande de témoignage post-qualification"
          description="J+X jours après qualification CPA ou completion d'une formation, DM pour solliciter un témoignage."
          enabled={config.testimonialRequest.enabled}
          onToggle={(v) => set('testimonialRequest', { enabled: v })}
        >
          <NumberField
            label="Délai après qualif/completion (jours)"
            value={config.testimonialRequest.delayDays}
            onChange={(v) =>
              set('testimonialRequest', { delayDays: v })
            }
            min={1}
            max={180}
          />
          <TemplateField
            label="Template"
            value={config.testimonialRequest.template}
            onChange={(v) => set('testimonialRequest', { template: v })}
            placeholders="{firstName} {context} {appUrl}"
          />
        </SectionWrapper>
      </TabsContent>

      <TabsContent value="formation">
        <SectionWrapper
          title="Reminders pré-formation"
          description="J-X jours avant chaque formation confirmée, DM au user (logistique, lien zoom, etc.)."
          enabled={config.formationReminders.enabled}
          onToggle={(v) => set('formationReminders', { enabled: v })}
        >
          <div>
            <Label className="text-xs">
              Jours avant formation (séparés par virgule)
            </Label>
            <Input
              value={config.formationReminders.daysBefore.join(', ')}
              onChange={(e) => {
                const parts = e.target.value
                  .split(',')
                  .map((s) => Number(s.trim()))
                  .filter((n) => Number.isFinite(n) && n >= 0 && n <= 60);
                set('formationReminders', { daysBefore: parts });
              }}
              placeholder="7, 1"
              className="mt-1.5"
            />
          </div>
          <TemplateField
            label="Template"
            value={config.formationReminders.template}
            onChange={(v) => set('formationReminders', { template: v })}
            placeholders="{firstName} {formationTitle} {date} {daysLeft} {logistics}"
          />
        </SectionWrapper>

        <SectionWrapper
          title="NPS post-formation"
          description="J+X jours après formation completed, DM avec un bouton inline 0-10."
          enabled={config.npsRequest.enabled}
          onToggle={(v) => set('npsRequest', { enabled: v })}
          className="mt-4"
        >
          <NumberField
            label="Délai après completion (jours)"
            value={config.npsRequest.delayDays}
            onChange={(v) => set('npsRequest', { delayDays: v })}
            min={1}
            max={180}
          />
          <TemplateField
            label="Question NPS"
            value={config.npsRequest.question}
            onChange={(v) => set('npsRequest', { question: v })}
            placeholders="{firstName} {formationTitle}"
          />
        </SectionWrapper>
      </TabsContent>

      <TabsContent value="admin">
        <SectionWrapper
          title="Stats hebdo aux admins"
          description="Récap des 7 derniers jours envoyé en DM aux ADMIN_TELEGRAM_IDS."
          enabled={config.weeklyAdminStats.enabled}
          onToggle={(v) => set('weeklyAdminStats', { enabled: v })}
        >
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Jour de la semaine</Label>
              <select
                value={config.weeklyAdminStats.dayOfWeek}
                onChange={(e) =>
                  set('weeklyAdminStats', {
                    dayOfWeek: Number(e.target.value),
                  })
                }
                className="mt-1.5 w-full h-10 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white/[0.02] px-3 text-sm"
              >
                {DAYS_OF_WEEK.map((d, i) => (
                  <option key={i} value={i}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            <NumberField
              label="Heure UTC (0-23)"
              value={config.weeklyAdminStats.hourUtc}
              onChange={(v) => set('weeklyAdminStats', { hourUtc: v })}
              min={0}
              max={23}
            />
          </div>
          <p className="text-[11px] text-[var(--color-text-faint)]">
            Le récap est généré auto à partir de la DB (bookings, paiements,
            VIP, waitlist). Aucun template à éditer.
          </p>
        </SectionWrapper>

        <SectionWrapper
          title="Briefing matinal"
          description="Sur le bot Telegram à 7h UTC. Mode 'auto' = généré depuis Yahoo Finance + calendrier macro. Mode 'manual' = template configuré dans /admin/settings."
          enabled={config.briefingMode === 'auto'}
          onToggle={(v) =>
            setConfig((c) => ({ ...c, briefingMode: v ? 'auto' : 'manual' }))
          }
          toggleLabelOn="Auto-généré"
          toggleLabelOff="Template manuel"
          className="mt-4"
        >
          <p className="text-xs text-[var(--color-text-dim)]">
            En mode auto, le bot compose le message en runtime avec :
          </p>
          <ul className="text-xs text-[var(--color-text-dim)] list-disc list-inside ml-2 space-y-0.5">
            <li>Prix overnight (Yahoo Finance) : EUR/USD, BTC, Gold, SPX…</li>
            <li>Events macro du jour (ForexFactory, déjà synced)</li>
            <li>Niveaux R/S calculés sur 24h</li>
          </ul>
        </SectionWrapper>
      </TabsContent>

      <div className="sticky bottom-4 mt-6 flex justify-end">
        <Button onClick={save} disabled={pending} size="lg">
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          Enregistrer toutes les automatisations
        </Button>
      </div>
    </>
  );
}

function SectionWrapper({
  title,
  description,
  enabled,
  onToggle,
  children,
  toggleLabelOn,
  toggleLabelOff,
  className,
}: {
  title: string;
  description: string;
  enabled: boolean;
  onToggle: (v: boolean) => void;
  children: React.ReactNode;
  toggleLabelOn?: string;
  toggleLabelOff?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'glass rounded-[var(--radius-lg)] p-5 space-y-4',
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="mt-1 text-xs text-[var(--color-text-dim)] leading-relaxed">
            {description}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span
            className={cn(
              'text-[10px] uppercase tracking-wider font-medium',
              enabled
                ? 'text-emerald-300 light:text-emerald-700'
                : 'text-[var(--color-text-faint)]'
            )}
          >
            {enabled
              ? toggleLabelOn ?? 'Actif'
              : toggleLabelOff ?? 'Désactivé'}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            onClick={() => onToggle(!enabled)}
            className={cn(
              'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
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
      </div>
      <div className={cn('space-y-3', !enabled && 'opacity-60 pointer-events-none')}>
        {children}
      </div>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (Number.isFinite(v)) onChange(v);
        }}
        className="mt-1.5 tabular-nums"
      />
    </div>
  );
}

function TemplateField({
  label,
  value,
  onChange,
  placeholders,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholders: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <Label className="text-xs">{label}</Label>
        <span className="text-[10px] text-[var(--color-text-faint)] font-mono">
          {placeholders}
        </span>
      </div>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={5}
        className="font-mono text-xs"
      />
    </div>
  );
}
