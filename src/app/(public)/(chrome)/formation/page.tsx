import Link from 'next/link';
import { ArrowRight, Check, MapPin, Wifi } from 'lucide-react';
import { db } from '@/lib/db';
import { formations } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
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
  const list = await db.query.formations
    .findMany({ where: eq(formations.active, true) })
    .catch(() => []);

  const remote = list.find((f) => f.mode === 'remote');
  const onsite = list.find((f) => f.mode === 'onsite');

  return (
    <>
      <Section className="pt-32 pb-12">
        <SectionHeader
          eyebrow="Formation"
          title={
            <>
              7 jours pour devenir
              <br />
              <span className="font-serif italic">trader.</span>
            </>
          }
          description="5 modules à acquérir. La formation dure 7 jours, mais on reste avec toi jusqu'à ce que tout soit assimilé."
        />
      </Section>

      <Section className="py-12">
        <div className="grid gap-6 lg:grid-cols-2">
          <FormationCard
            icon={Wifi}
            badge="Distance"
            title={remote?.title ?? 'Formation Trading à distance'}
            description={remote?.description ?? '7 jours en visio privée 1:1.'}
            price={remote?.priceEur ? Number(remote.priceEur) : 1500}
            mode="remote"
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

      <Section className="py-12" id="programme">
        <SectionHeader
          eyebrow="Programme"
          title={
            <>
              5 modules, <span className="font-serif italic">7 jours minimum.</span>
            </>
          }
          description="On valide chaque module avant de passer au suivant. Si on déborde sur les 7 jours, on continue — l'objectif c'est que tu maîtrises, pas qu'on coche une case."
        />

        <div className="mt-12 max-w-4xl mx-auto space-y-4">
          {curriculum.map((mod) => (
            <div
              key={mod.label}
              className="glass rounded-[var(--radius-lg)] p-6 md:p-8 grid md:grid-cols-[180px_1fr] gap-6"
            >
              <div>
                <div className="font-mono text-xs text-[var(--color-text-faint)] tracking-wider uppercase">
                  {mod.label}
                </div>
                <div className="mt-1 font-serif text-xl">{mod.title}</div>
              </div>
              <div>
                <ul className="space-y-2">
                  {mod.points.map((p) => (
                    <li
                      key={p}
                      className="flex items-start gap-3 text-sm text-[var(--color-text-dim)]"
                    >
                      <Check className="h-4 w-4 text-[var(--color-accent-hover)] flex-shrink-0 mt-0.5" />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section className="py-12">
        <div className="glass-strong rounded-[var(--radius-2xl)] p-10 md:p-16 text-center">
          <h2 className="font-serif text-3xl md:text-5xl text-gradient">
            Tu choisis tes dates.
          </h2>
          <p className="mt-4 text-[var(--color-text-dim)] max-w-xl mx-auto">
            Tu proposes jusqu'à 3 créneaux préférés. On revient vers toi sous 24h
            pour valider ou te proposer une alternative.{' '}
            <strong className="text-white">
              Paiement en 1 fois ou en 3 fois sans frais.
            </strong>
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Button asChild size="xl" variant="glow">
              <Link href="/formation/reserver">
                Réserver maintenant
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </Section>

      <Section className="pt-0 pb-24">
        <div className="max-w-3xl mx-auto">
          <PaymentDisclaimer variant="full" tone="neutral" />
        </div>
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
}: FormationCardProps) {
  return (
    <div className="relative">
      {highlight && (
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

        {note && (
          <div className="mt-6 inline-flex items-center gap-2 text-xs text-amber-300/80 bg-amber-500/10 border border-amber-500/20 rounded-md px-3 py-2">
            <span>⚠</span> {note}
          </div>
        )}

        <div className="mt-8">
          <Button asChild size="lg" className="w-full">
            <Link href={`/formation/reserver?mode=${mode}`}>
              Réserver
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
