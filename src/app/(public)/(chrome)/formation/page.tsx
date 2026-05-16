import Link from 'next/link';
import { ArrowRight, Bell, Check, MapPin, Wifi } from 'lucide-react';
import { db } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Section, SectionHeader } from '@/components/shared/section';
import { PaymentDisclaimer } from '@/components/formation/payment-disclaimer';
import { formatPrice } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const curriculum = [
  {
    label: 'Module 01',
    title: 'Graphiques',
    points: [
      'Lecture des chandeliers et structures de marché',
      'Supports, résistances, tendances',
      'Configurations chartistes et setups',
    ],
  },
  {
    label: 'Module 02',
    title: 'Fondamental',
    points: [
      'Comprendre les actualités économiques',
      'Calendrier économique et impact',
      'Banques centrales, taux, indicateurs clés',
    ],
  },
  {
    label: 'Module 03',
    title: 'Matières premières',
    points: [
      'Or, pétrole, indices : spécificités',
      'Saisonnalité et cycles',
      'Corrélations avec le Forex et les crypto',
    ],
  },
  {
    label: 'Module 04',
    title: 'Psychologie',
    points: [
      'Discipline du trader pro',
      'Gestion émotionnelle des pertes et gains',
      'Routine pré- et post-marché',
    ],
  },
  {
    label: 'Module 05',
    title: 'Money management',
    points: [
      'Risque par trade, taille de position',
      'Construire un journal de trading',
      'Plan de trading personnalisé',
    ],
  },
];

export default async function FormationPage() {
  const list = await db.query.formations.findMany().catch(() => []);

  const remote = list.find((f) => f.mode === 'remote');
  const onsite = list.find((f) => f.mode === 'onsite');
  const botUsername = process.env.TELEGRAM_BOT_USERNAME ?? '';

  return (
    <>
      {/* HERO + 2 cards formats — fusionnés dans 1 section compacte */}
      <Section className="pt-16 pb-6">
        <SectionHeader
          eyebrow="Formation"
          title={
            <>
              7 jours pour devenir{' '}
              <span className="font-serif italic">trader.</span>
            </>
          }
          description="5 modules à acquérir. Si on déborde sur les 7 jours, on continue — l'objectif c'est que tu maîtrises."
          align="left"
        />

        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          <FormationCard
            icon={Wifi}
            badge="Distance"
            title={remote?.title ?? 'Formation Trading à distance'}
            description={remote?.description ?? '7 jours en visio privée 1:1.'}
            price={remote?.priceEur ? Number(remote.priceEur) : 1500}
            mode="remote"
            active={remote?.active ?? true}
            botUsername={botUsername}
            includes={[
              'Visio privée 1:1 sur 7 jours',
              '5 modules garantis acquis',
              'Tous les replays + ressources',
              'Plan de trading personnalisé',
              'Accès au funnel VIP Telegram',
            ]}
          />
          <FormationCard
            icon={MapPin}
            badge="Présentiel · Dubaï"
            title={onsite?.title ?? 'Formation Trading à Dubaï'}
            description={
              onsite?.description ??
              '7 jours intensifs sur place à Dubaï. Setup pro, immersion.'
            }
            price={onsite?.priceEur ? Number(onsite.priceEur) : 3500}
            mode="onsite"
            active={onsite?.active ?? true}
            botUsername={botUsername}
            includes={[
              "7 jours intensifs face-à-face",
              '5 modules garantis acquis',
              'Setup professionnel sur place',
              'Tous les avantages de la version distance',
              'Accès prioritaire au VIP',
            ]}
            note="Billet d'avion A/R non inclus"
            highlight
          />
        </div>
      </Section>

      {/* PROGRAMME — 5 modules en grid compact (3 + 2) */}
      <Section className="py-6" id="programme">
        <div className="flex items-baseline justify-between gap-4 flex-wrap mb-4">
          <div>
            <div className="inline-flex items-center gap-2 mb-1">
              <span className="h-px w-6 bg-[var(--color-accent)]" />
              <span className="text-xs uppercase tracking-[0.2em] text-[var(--color-accent-hover)] font-medium">
                Programme
              </span>
            </div>
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-gradient">
              5 modules, 7 jours minimum.
            </h2>
          </div>
          <p className="text-sm text-[var(--color-text-dim)] max-w-md">
            On valide chaque module avant de passer au suivant.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {curriculum.map((mod) => (
            <div
              key={mod.label}
              className="glass rounded-[var(--radius-lg)] p-4"
            >
              <div className="flex items-baseline gap-2 mb-2">
                <span className="font-mono text-[10px] text-[var(--color-text-faint)] tracking-wider uppercase">
                  {mod.label}
                </span>
                <span className="font-serif text-lg">{mod.title}</span>
              </div>
              <ul className="space-y-1.5">
                {mod.points.map((p) => (
                  <li
                    key={p}
                    className="flex items-start gap-2 text-xs text-[var(--color-text-dim)] leading-snug"
                  >
                    <Check className="h-3 w-3 text-[var(--color-accent-hover)] flex-shrink-0 mt-0.5" />
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      <Section className="py-6">
        <PaymentDisclaimer variant="full" tone="neutral" />
      </Section>
    </>
  );
}

interface FormationCardProps {
  icon: React.ElementType;
  badge: string;
  title: string;
  description: string;
  price: number;
  mode: 'remote' | 'onsite';
  includes: string[];
  note?: string;
  highlight?: boolean;
  active?: boolean;
  botUsername?: string;
}

function FormationCard({
  icon: Icon,
  badge,
  title,
  description,
  price,
  mode,
  includes,
  note,
  highlight,
  active = true,
  botUsername,
}: FormationCardProps) {
  return (
    <div className={`relative ${!active ? 'opacity-90' : ''}`}>
      {highlight && active && (
        <div className="absolute -inset-px rounded-[var(--radius-lg)] bg-gradient-to-br from-amber-500/30 via-pink-500/20 to-transparent blur-xl" />
      )}
      <div className="relative glass-strong rounded-[var(--radius-lg)] p-8 h-full flex flex-col">
        <div className="flex items-start justify-between">
          <Badge variant={highlight ? 'gold' : 'default'}>
            <Icon className="h-3 w-3 mr-1" />
            {badge}
          </Badge>
          <div className="text-right">
            <div className="font-serif text-4xl text-gradient">
              {formatPrice(price)}
            </div>
            <div className="text-xs text-[var(--color-text-faint)]">
              paiement unique
            </div>
          </div>
        </div>

        <h3 className="mt-6 text-2xl font-serif">{title}</h3>
        <p className="mt-2 text-sm text-[var(--color-text-dim)]">
          {description}
        </p>

        <ul className="mt-6 space-y-2.5 flex-1">
          {includes.map((p) => (
            <li
              key={p}
              className="flex items-start gap-3 text-sm text-[var(--color-text-dim)]"
            >
              <Check className="h-4 w-4 text-[var(--color-accent-hover)] flex-shrink-0 mt-0.5" />
              {p}
            </li>
          ))}
        </ul>

        {note && active && (
          <div className="mt-6 inline-flex items-center gap-2 text-xs text-amber-300/80 bg-amber-500/10 border border-amber-500/20 rounded-md px-3 py-2">
            <span>⚠</span> {note}
          </div>
        )}

        <div className="mt-8">
          {active ? (
            <Button asChild size="lg" className="w-full">
              <Link href={`/formation/reserver?mode=${mode}`}>
                Réserver
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          ) : (
            <FullBlock mode={mode} botUsername={botUsername} />
          )}
        </div>
      </div>
    </div>
  );
}

function FullBlock({
  mode,
  botUsername,
}: {
  mode: 'remote' | 'onsite';
  botUsername?: string;
}) {
  const hasBot = botUsername && botUsername.length > 0;
  return (
    <div className="space-y-3">
      <div className="rounded-[var(--radius-md)] border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-200/90 leading-relaxed">
        <strong className="block text-amber-200 mb-0.5">
          Sessions complètes
        </strong>
        Toutes les places sont prises — succès oblige. De nouvelles dates
        s&apos;ouvrent bientôt.
      </div>
      {hasBot ? (
        <Button asChild size="lg" variant="secondary" className="w-full">
          <Link
            href={`https://t.me/${botUsername}?start=waitlist_${mode}`}
            target="_blank"
            rel="noopener"
          >
            <Bell className="h-4 w-4" />
            Être notifié·e via Telegram
          </Link>
        </Button>
      ) : (
        <Button size="lg" variant="secondary" className="w-full" disabled>
          <Bell className="h-4 w-4" />
          Liste d&apos;attente bientôt
        </Button>
      )}
    </div>
  );
}
