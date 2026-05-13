import { notFound, redirect } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
import { MapPin, Wifi } from 'lucide-react';
import { db } from '@/lib/db';
import { bookings, formations } from '@/lib/db/schema';
import { requireAuth } from '@/lib/auth/server';
import { Badge } from '@/components/ui/badge';
import { Section } from '@/components/shared/section';
import { CheckoutForm } from '@/components/formation/checkout-form';
import { formatPrice } from '@/lib/utils';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ bookingId: string }>;
}

export default async function CheckoutPage({ params }: PageProps) {
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

  // /checkout sert à reprendre un paiement abandonné (status pending_payment).
  // Dans le nouveau flow, le paiement initial se fait depuis /formation/reserver.
  if (booking.status !== 'pending_payment') {
    redirect('/dashboard');
  }

  const formation = booking.formation;
  const isOnsite = formation.mode === 'onsite';

  return (
    <Section className="pt-24 pb-32">
      <div className="max-w-3xl mx-auto">
        <p className="text-sm text-[var(--color-text-dim)] uppercase tracking-wider">
          Paiement
        </p>
        <h1 className="mt-2 font-serif text-4xl md:text-5xl text-gradient">
          Finalise ta réservation.
        </h1>

        <div className="mt-10 grid lg:grid-cols-[1fr_360px] gap-8">
          {/* Form */}
          <div className="space-y-6">
            <CheckoutForm
              bookingId={booking.id}
              amount={Number(formation.priceEur)}
            />
          </div>

          {/* Récap */}
          <aside className="space-y-4">
            <div className="glass-strong rounded-[var(--radius-lg)] p-6 sticky top-24">
              <Badge variant={isOnsite ? 'gold' : 'default'}>
                {isOnsite ? (
                  <MapPin className="h-3 w-3 mr-1" />
                ) : (
                  <Wifi className="h-3 w-3 mr-1" />
                )}
                {isOnsite ? 'Dubaï' : 'Distance'}
              </Badge>
              <h3 className="mt-4 font-semibold">{formation.title}</h3>
              <p className="text-sm text-[var(--color-text-dim)] mt-1">
                {formation.durationDays} jours
              </p>

              <div className="my-6 h-px bg-[var(--color-border)]" />

              <div className="flex justify-between items-baseline">
                <span className="text-sm text-[var(--color-text-dim)]">Total</span>
                <span className="font-serif text-2xl text-gradient">
                  {formatPrice(Number(formation.priceEur))}
                </span>
              </div>

              {isOnsite && (
                <div className="mt-6 rounded-md bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-amber-200">
                  ⚠ Billet d'avion A/R Dubaï <strong>non inclus</strong> dans
                  le prix. À organiser de ton côté.
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </Section>
  );
}
