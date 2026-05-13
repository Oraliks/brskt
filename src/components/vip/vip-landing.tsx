import Link from 'next/link';
import { Check, MessageCircle, ShieldCheck, Wallet } from 'lucide-react';
import { Section, SectionHeader } from '@/components/shared/section';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const benefits = [
  'Setups Forex / indices / crypto au quotidien',
  'Alertes en temps réel + débriefs',
  'Communauté de traders sérieux',
  'Accès gratuit tant que ton compte broker est actif',
];

const conditions = [
  { icon: Wallet, text: 'Inscription chez notre broker partenaire via lien' },
  { icon: ShieldCheck, text: 'Dépôt minimum 250€ sur ton compte' },
  { icon: MessageCircle, text: "Validation puis lien d'invitation Telegram" },
];

export function VipLanding() {
  return (
    <>
      <Section className="pt-32 pb-12">
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <Badge variant="gold">VIP Telegram</Badge>
          <h1 className="font-serif text-5xl md:text-7xl text-gradient leading-[1.05]">
            Le groupe
            <br />
            <span className="italic text-gradient-accent">qui change tout.</span>
          </h1>
          <p className="text-lg text-[var(--color-text-dim)] max-w-xl mx-auto">
            Accès gratuit à vie en passant par notre lien partenaire broker.
            Pas d'abonnement, pas de paiement direct.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
            <Button asChild size="xl" variant="glow">
              <Link href="/login?redirectTo=/vip">Démarrer le funnel</Link>
            </Button>
            <Button asChild size="xl" variant="ghost">
              <Link href="/#methode">Comprendre la méthode</Link>
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
        <div className="max-w-2xl mx-auto glass-strong rounded-[var(--radius-2xl)] p-10 text-center">
          <p className="text-sm font-medium text-amber-300 mb-2">
            ⚠ Règle importante
          </p>
          <h3 className="font-serif text-2xl md:text-3xl">
            Tu retires avant d'avoir tradé ? Tu sors du groupe.
          </h3>
          <p className="mt-4 text-sm text-[var(--color-text-dim)]">
            Notre groupe est financé par la commission que le broker nous verse
            sur ton activité. Si tu retires ton dépôt avant qu'on touche, tu es
            automatiquement éjecté. C'est le deal.
          </p>
        </div>
      </Section>
    </>
  );
}
