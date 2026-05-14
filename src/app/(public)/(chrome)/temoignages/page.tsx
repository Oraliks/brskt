import type { Metadata } from 'next';
import { Quote, Star } from 'lucide-react';
import { Section, SectionHeader } from '@/components/shared/section';
import { Badge } from '@/components/ui/badge';

export const metadata: Metadata = {
  title: 'Témoignages',
  description:
    'Ce que disent les membres de la formation et du groupe VIP Telegram Boursikotons.',
};

interface Testimonial {
  name: string;
  role: string;
  body: string;
  rating?: 1 | 2 | 3 | 4 | 5;
  tag?: 'formation' | 'vip';
}

/**
 * Les témoignages sont actuellement hardcodés (placeholder marketing).
 * À terme : migration vers une table `testimonials` éditable par l'admin
 * + form de soumission par les membres en post-formation.
 */
const TESTIMONIALS: Testimonial[] = [
  {
    name: 'Karim D.',
    role: 'Formation présentiel Dubaï · 2025',
    body: 'La semaine à Dubaï a complètement changé ma vision du trading. Le 1-to-1 fait toute la différence : tu poses tes vraies questions, tu vois ton compte commenté en direct. Six mois plus tard je suis toujours en gain mois après mois.',
    rating: 5,
    tag: 'formation',
  },
  {
    name: 'Sofia M.',
    role: 'Groupe VIP · membre depuis 8 mois',
    body: 'Je suivais des "signaux" payants avant, jamais rentable. Ici c\'est différent : on apprend à analyser, on m\'explique pourquoi un setup est bon ou non. Le groupe VIP est gratuit donc rien à perdre.',
    rating: 5,
    tag: 'vip',
  },
  {
    name: 'Antoine L.',
    role: 'Formation distance · 2025',
    body: 'Je travaillais à temps plein, impossible de me déplacer. La formation à distance en 7 jours s\'est adaptée à mon emploi du temps. Honnêtement le contenu est aussi solide qu\'un présentiel, juste sans le voyage.',
    rating: 5,
    tag: 'formation',
  },
  {
    name: 'Laila B.',
    role: 'Groupe VIP · 14 mois',
    body: 'Ce que j\'apprécie c\'est la discipline transmise. On ne te promet pas la lune, on t\'enseigne à gérer ton risque. Mon compte a doublé en un an avec une stratégie simple et reproductible.',
    rating: 5,
    tag: 'vip',
  },
  {
    name: 'Maxime P.',
    role: 'Formation présentiel Dubaï · 2024',
    body: 'Vraie immersion. On vit la routine d\'un trader pro pendant 7 jours. Les autres participants sont devenus mes camarades de discussion sur Telegram — c\'est aussi ça la vraie valeur.',
    rating: 5,
    tag: 'formation',
  },
  {
    name: 'Yasmine K.',
    role: 'Groupe VIP · 6 mois',
    body: 'Le bot quotidien avec les niveaux à surveiller le matin, c\'est un game changer. Je ne trade plus à l\'aveugle. Et le quiz hebdomadaire force à réviser, j\'adore.',
    rating: 5,
    tag: 'vip',
  },
];

export default function TestimonialsPage() {
  return (
    <Section>
      <SectionHeader
        eyebrow="Ils en parlent"
        title="Témoignages"
        description="Ce que les membres pensent de la formation et du groupe VIP. Tous sont actuellement encore actifs."
      />

      <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3 max-w-6xl mx-auto">
        {TESTIMONIALS.map((t, i) => (
          <TestimonialCard key={i} t={t} />
        ))}
      </div>

      <div className="mt-16 text-center max-w-xl mx-auto space-y-3">
        <p className="text-sm text-[var(--color-text-dim)]">
          Tu fais partie du programme et tu veux partager ton retour ?
        </p>
        <a
          href="https://t.me/boursi_support"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[var(--color-surface-tint)] border border-[var(--color-border)] hover:bg-[var(--color-surface-tint-strong)] hover:border-[var(--color-border-strong)] text-sm transition-all"
        >
          Envoyer mon témoignage
        </a>
      </div>
    </Section>
  );
}

function TestimonialCard({ t }: { t: Testimonial }) {
  const rating = t.rating ?? 5;
  return (
    <article className="glass rounded-2xl p-6 flex flex-col gap-4 h-full transition-all hover:-translate-y-0.5 hover:border-[var(--color-border-strong)]">
      <div className="flex items-start justify-between gap-3">
        <Quote className="h-5 w-5 text-[var(--color-accent-hover)] opacity-70 flex-shrink-0" />
        {t.tag && (
          <Badge variant={t.tag === 'formation' ? 'gold' : 'default'}>
            {t.tag === 'formation' ? 'Formation' : 'VIP'}
          </Badge>
        )}
      </div>

      <p className="text-sm leading-relaxed text-[var(--color-text)] flex-1">
        {t.body}
      </p>

      <div>
        <div className="flex gap-0.5 mb-1.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              className={
                i < rating
                  ? 'h-3.5 w-3.5 text-amber-400 fill-amber-400'
                  : 'h-3.5 w-3.5 text-[var(--color-text-faint)]'
              }
            />
          ))}
        </div>
        <div className="text-sm font-medium">{t.name}</div>
        <div className="text-xs text-[var(--color-text-dim)]">{t.role}</div>
      </div>
    </article>
  );
}
