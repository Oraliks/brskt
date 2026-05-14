import Link from 'next/link';
import { Check, MessageCircle, ShieldCheck, Wallet } from 'lucide-react';
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
              groupe VIP et notre travail. <strong className="text-white">Ton dépôt reste à 100% sur ton compte broker</strong> — c'est ton capital pour trader,
              tu peux le retirer (sous conditions, voir ci-dessous).
            </p>
          </div>

          <div className="h-px bg-[var(--color-border)]" />

          <div>
            <p className="text-sm font-medium text-amber-300 mb-2">
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
