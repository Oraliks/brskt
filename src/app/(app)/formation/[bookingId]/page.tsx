import { notFound } from 'next/navigation';
import Link from 'next/link';
import { and, eq } from 'drizzle-orm';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Download,
  MapPin,
  MessageCircle,
  Sparkles,
  Wifi,
} from 'lucide-react';
import { db } from '@/lib/db';
import { bookings } from '@/lib/db/schema';
import { requireAuth } from '@/lib/auth/server';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Section } from '@/components/shared/section';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ bookingId: string }>;
}

/**
 * Page post-formation : visible quand un booking est `completed` ou
 * `confirmed` (avec confirmedDate dépassée). Affiche les ressources,
 * replays et next steps (upsell VIP).
 *
 * Pour MVP : contenu hardcodé. À évoluer vers une table
 * `formation_resources` quand la liste de ressources grandit.
 */
export default async function PostFormationPage({ params }: PageProps) {
  const { bookingId } = await params;
  const session = await requireAuth();

  const booking = await db.query.bookings.findFirst({
    where: and(
      eq(bookings.id, bookingId),
      eq(bookings.userId, session.user.id)
    ),
    with: { formation: true },
  });

  if (!booking) notFound();

  // Accessible si formation terminée OU date confirmée passée
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const confirmedDate = booking.confirmedDate ? new Date(booking.confirmedDate) : null;
  const formationEnded =
    booking.status === 'completed' ||
    (confirmedDate !== null && confirmedDate < today);

  if (!formationEnded) {
    // Pas encore le moment — renvoyer vers le checkout/dashboard normal
    notFound();
  }

  const formation = booking.formation;
  const isOnsite = formation.mode === 'onsite';

  return (
    <Section className="pt-12 pb-24">
      <div className="max-w-3xl mx-auto">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-sm text-[var(--color-text-dim)] hover:text-[var(--color-text)] mb-8"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour au dashboard
        </Link>

        <Badge variant="success">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Formation terminée
        </Badge>

        <h1 className="mt-4 font-serif text-3xl md:text-5xl text-gradient leading-tight">
          Bravo, tu as terminé.
        </h1>

        <p className="mt-4 text-[var(--color-text-dim)]">
          <strong className="text-[var(--color-text)]">{formation.title}</strong>{' '}
          ·{' '}
          <Badge variant={isOnsite ? 'gold' : 'default'}>
            {isOnsite ? (
              <MapPin className="h-3 w-3 mr-1" />
            ) : (
              <Wifi className="h-3 w-3 mr-1" />
            )}
            {isOnsite ? 'Dubaï' : 'Distance'}
          </Badge>
          {confirmedDate && (
            <>
              {' · '}
              <span className="font-mono text-xs">
                {formatDate(confirmedDate)}
              </span>
            </>
          )}
        </p>

        {/* Ressources */}
        <div className="mt-10 glass-strong rounded-[var(--radius-lg)] p-6 md:p-8">
          <h2 className="font-semibold text-lg flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-[var(--color-accent-hover)]" />
            Ressources de la formation
          </h2>
          <p className="mt-1 text-sm text-[var(--color-text-dim)]">
            Garde-les sous la main, elles te serviront pendant des mois.
          </p>

          <ul className="mt-6 space-y-2">
            <ResourceItem
              title="Replays vidéo des 5 modules"
              description="Toutes les sessions enregistrées (~25h de contenu)"
              status="pending"
            />
            <ResourceItem
              title="Workbook PDF — exercices & cheat sheets"
              description="Setups chartistes, calendrier économique, journal de trade"
              status="pending"
            />
            <ResourceItem
              title="Templates TradingView"
              description="Indicateurs configurés selon notre méthode"
              status="pending"
            />
            <ResourceItem
              title="Accès au groupe alumni privé"
              description="Échanges entre anciens, suivi par l'équipe"
              status="pending"
            />
          </ul>

          <div className="mt-6 rounded-md bg-amber-500/10 border border-amber-500/25 p-3 text-xs text-amber-200 light:text-amber-700">
            ⓘ Les ressources te seront envoyées par mail dans les 48h suivant
            la fin de la formation. Si tu ne les as pas reçues, contacte{' '}
            <Link
              href="https://t.me/boursi_support"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              @boursi_support
            </Link>
            .
          </div>
        </div>

        {/* Upsell VIP */}
        <div className="mt-6 glass rounded-[var(--radius-lg)] p-6 md:p-8 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/8 to-transparent pointer-events-none" />
          <div className="relative">
            <Badge variant="gold">
              <Sparkles className="h-3 w-3 mr-1" />
              Suite logique
            </Badge>
            <h3 className="mt-4 font-semibold text-lg">
              Rejoins le groupe VIP Telegram (gratuit)
            </h3>
            <p className="mt-2 text-sm text-[var(--color-text-dim)]">
              Maintenant que tu as la méthode, pratique en live avec nous.
              Signaux quotidiens, débriefs, échanges entre traders. C&apos;est
              gratuit — on est payé par le broker, pas par toi.
            </p>
            <Button asChild size="lg" className="mt-4">
              <Link href="/vip">
                Démarrer le funnel VIP
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>

        {/* Support */}
        <div className="mt-6 flex items-center justify-between gap-4 rounded-[var(--radius-md)] bg-[var(--color-surface-tint)] border border-[var(--color-border)] p-4 text-sm">
          <div className="flex items-start gap-3">
            <MessageCircle className="h-4 w-4 text-blue-300 light:text-blue-700 mt-0.5" />
            <div>
              <strong>Une question sur ce qui a été enseigné ?</strong>
              <p className="text-xs text-[var(--color-text-dim)] mt-0.5">
                Notre équipe te répond directement.
              </p>
            </div>
          </div>
          <Button asChild size="sm" variant="secondary">
            <Link
              href="https://t.me/boursi_support"
              target="_blank"
              rel="noopener noreferrer"
            >
              Contacter
              <ArrowRight className="h-3 w-3" />
            </Link>
          </Button>
        </div>
      </div>
    </Section>
  );
}

function ResourceItem({
  title,
  description,
  status,
}: {
  title: string;
  description: string;
  status: 'available' | 'pending';
}) {
  return (
    <li className="flex items-start gap-3 p-3 rounded-md bg-[var(--color-surface-tint)] hover:bg-[var(--color-surface-tint-strong)] transition-colors">
      <span
        className={
          status === 'available'
            ? 'inline-flex h-9 w-9 items-center justify-center rounded-md bg-emerald-500/15 border border-emerald-500/30 flex-shrink-0'
            : 'inline-flex h-9 w-9 items-center justify-center rounded-md bg-[var(--color-surface-tint-strong)] border border-[var(--color-border)] flex-shrink-0'
        }
      >
        {status === 'available' ? (
          <Download className="h-4 w-4 text-emerald-400 light:text-emerald-700" />
        ) : (
          <BookOpen className="h-4 w-4 text-[var(--color-text-faint)]" />
        )}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium">{title}</div>
        <div className="text-xs text-[var(--color-text-dim)] mt-0.5">
          {description}
        </div>
      </div>
      <Badge variant={status === 'available' ? 'success' : 'secondary'}>
        {status === 'available' ? 'Dispo' : 'À venir'}
      </Badge>
    </li>
  );
}
