import Link from 'next/link';
import {
  Check,
  Eye,
  MessageCircle,
  ShieldCheck,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { Section, SectionHeader } from '@/components/shared/section';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const benefits = [
  'Setups Forex / indices / crypto au quotidien',
  'Alertes en temps réel + débriefs',
  'Communauté de traders sérieux',
  "Accès illimité tant que ton compte broker reste actif",
];

const conditions = [
  {
    icon: Wallet,
    text: 'Inscription chez notre broker partenaire via notre lien — 100% gratuit',
  },
  {
    icon: ShieldCheck,
    text: 'Tu déposes 250€+ sur TON compte broker pour trader — c\'est ton argent, pas notre rémunération',
  },
  {
    icon: MessageCircle,
    text: 'Lien d\'invitation Telegram VIP envoyé après validation du dépôt',
  },
];

export function VipLanding() {
  return (
    <>
      <Section className="pt-32 pb-12">
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <Badge variant="gold">VIP Telegram · 100% gratuit</Badge>
          <h1 className="font-serif text-5xl md:text-7xl text-gradient leading-[1.05]">
            Le groupe
            <br />
            <span className="italic text-gradient-accent">qui change tout.</span>
          </h1>
          <p className="text-lg text-[var(--color-text-dim)] max-w-xl mx-auto">
            Aucun frais à nous payer — jamais. On gagne notre commission directement
            auprès du broker quand tu trades. Toi, tu gardes ton argent pour le trader.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
            <Button asChild size="xl" variant="glow">
              <Link href="/login?redirectTo=/vip">Démarrer le funnel</Link>
            </Button>
            <Button asChild size="xl" variant="ghost">
              <Link href="/formation">Voir la formation</Link>
            </Button>
          </div>
        </div>
      </Section>

      <Section className="py-12">
        <div className="grid lg:grid-cols-2 gap-12 items-start">
          <div>
            <SectionHeader
              align="left"
              eyebrow="Ce que tu reçois"
              title={
                <>
                  Tout, <span className="font-serif italic">tous les jours.</span>
                </>
              }
            />
            <ul className="mt-8 space-y-3">
              {benefits.map((b) => (
                <li
                  key={b}
                  className="flex items-start gap-3 text-base text-[var(--color-text)]"
                >
                  <span className="mt-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/15 border border-emerald-500/30 flex-shrink-0">
                    <Check className="h-3 w-3 text-emerald-400" strokeWidth={3} />
                  </span>
                  {b}
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-3">
            <div className="text-xs uppercase tracking-[0.2em] text-[var(--color-text-faint)] mb-4">
              Comment ça marche
            </div>
            {conditions.map((c, i) => (
              <div
                key={c.text}
                className="glass rounded-[var(--radius-lg)] p-5 flex items-start gap-4"
              >
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-[var(--color-accent)]/15 border border-[var(--color-accent)]/30 flex-shrink-0">
                  <c.icon className="h-4 w-4 text-[var(--color-accent-hover)]" />
                </span>
                <div className="flex-1">
                  <div className="text-xs font-mono text-[var(--color-text-faint)]">
                    Étape {i + 1}
                  </div>
                  <div className="mt-1 text-sm">{c.text}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* Aperçu visuel du groupe : faux messages stylisés Telegram pour
          donner une idée de l'ambiance sans révéler de vraies analyses */}
      <Section className="py-12">
        <div className="max-w-3xl mx-auto">
          <SectionHeader
            eyebrow="Aperçu"
            title={
              <>
                À quoi ça <span className="font-serif italic">ressemble.</span>
              </>
            }
            description="Un échantillon de l'activité quotidienne dans le groupe VIP."
          />
          <div className="mt-8 relative">
            <GroupPreview />
            {/* Overlay subtil "preview" pour signaler que ce sont des exemples */}
            <div className="absolute top-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-[var(--color-bg-elevated)]/80 backdrop-blur border border-[var(--color-border)] px-2.5 py-1 text-[10px] uppercase tracking-wider text-[var(--color-text-dim)]">
              <Eye className="h-3 w-3" />
              Aperçu illustratif
            </div>
          </div>
        </div>
      </Section>

      <Section className="py-12">
        <div className="max-w-3xl mx-auto glass-strong rounded-[var(--radius-2xl)] p-10 text-center space-y-8">
          <div>
            <p className="text-sm font-medium text-emerald-300 mb-2">
              💡 Comment c'est gratuit pour toi ?
            </p>
            <h3 className="font-serif text-2xl md:text-3xl">
              Le broker nous paye, pas toi.
            </h3>
            <p className="mt-4 text-sm text-[var(--color-text-dim)]">
              Quand tu ouvres ton compte via notre lien partenaire et que tu trades,
              le broker nous reverse une commission. Cette commission finance le
              groupe VIP et notre travail. <strong className="text-[var(--color-text)]">Ton dépôt reste à 100% sur ton compte broker</strong> — c'est ton capital pour trader,
              tu peux le retirer (sous conditions, voir ci-dessous).
            </p>
          </div>

          <div className="h-px bg-[var(--color-border)]" />

          <div>
            <p className="text-sm font-medium text-amber-300 light:text-amber-700 mb-2">
              ⚠ Règle importante
            </p>
            <h3 className="font-serif text-2xl md:text-3xl">
              Tu retires avant d'avoir tradé ? Tu sors du groupe.
            </h3>
            <p className="mt-4 text-sm text-[var(--color-text-dim)]">
              Comme notre rémunération vient de ton activité de trading, si tu retires
              ton dépôt sans avoir tradé, le broker ne nous reverse rien. Dans ce cas
              tu es automatiquement éjecté du VIP. C'est le seul deal — sinon tout est
              gratuit pour toi.
            </p>
          </div>
        </div>
      </Section>
    </>
  );
}

/**
 * Composant de preview : 3 "messages" stylisés à la Telegram avec contenu
 * floutté/expurgé. Donne le ton sans révéler de vraies analyses.
 */
function GroupPreview() {
  return (
    <div className="glass rounded-[var(--radius-lg)] p-4 md:p-6 space-y-3 relative overflow-hidden">
      <PreviewMessage
        author="Setup du jour · EUR/USD"
        time="08:42"
        badge="Signal"
        badgeVariant="success"
        icon={TrendingUp}
        lines={[
          'Cassure de range identifiée sur H1.',
          'Entry : ████████ · TP1 : ██████ · TP2 : ██████',
          'Risk : 1% max · SL serré sous le low',
        ]}
      />
      <PreviewMessage
        author="Calendrier macro · 14h30"
        time="13:17"
        badge="Heads-up"
        badgeVariant="warning"
        icon={MessageCircle}
        lines={[
          'CPI US sortie dans 1h15.',
          'Attendu : ███% · Précédent : ███%',
          'Préférer ne pas tenir de position avant la news.',
        ]}
      />
      <PreviewMessage
        author="Debrief de la semaine"
        time="Vendredi 18h"
        badge="Bilan"
        badgeVariant="default"
        icon={MessageCircle}
        lines={[
          '4 setups validés sur 5, +██% sur le compte témoin.',
          'Le setup XAU/USD a été annulé jeudi (volatilité news).',
          'Module replay disponible dans le canal vidéo.',
        ]}
      />
    </div>
  );
}

function PreviewMessage({
  author,
  time,
  badge,
  badgeVariant,
  icon: Icon,
  lines,
}: {
  author: string;
  time: string;
  badge: string;
  badgeVariant: 'success' | 'warning' | 'default';
  icon: React.ComponentType<{ className?: string }>;
  lines: string[];
}) {
  return (
    <div className="rounded-[var(--radius-md)] bg-[var(--color-surface-tint)] border border-[var(--color-border)] p-4">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-pink-500 flex-shrink-0">
          <Icon className="h-4 w-4 text-white" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium">{author}</span>
              <Badge variant={badgeVariant}>{badge}</Badge>
            </div>
            <span className="text-[10px] text-[var(--color-text-faint)] font-mono">
              {time}
            </span>
          </div>
          <div className="mt-2 space-y-1 text-sm text-[var(--color-text-dim)]">
            {lines.map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
