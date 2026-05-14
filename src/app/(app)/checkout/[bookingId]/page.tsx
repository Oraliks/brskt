import { notFound, redirect } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
import { MapPin, Wifi } from 'lucide-react';
import { db } from '@/lib/db';
import { bookings, formations } from '@/lib/db/schema';
import { requireAuth } from '@/lib/auth/server';
import { Badge } from '@/components/ui/badge';
import { Section } from '@/components/shared/section';
import { CheckoutForm } from '@/components/formation/checkout-form';
import { PaymentDisclaimer } from '@/components/formation/payment-disclaimer';
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

  // /checkout sert à :
  //  - Reprendre un 1er paiement abandonné (status pending_payment, installmentsPaid=0)
  //  - Payer la prochaine échéance d'un booking en 3x (installmentsPaid > 0, < total)
  if (booking.status !== 'pending_payment') {
    redirect('/dashboard');
  }

  const formation = booking.formation;
  const isOnsite = formation.mode === 'onsite';
  const isInstallments = booking.paymentPlan === 'installments_3x';
  const fullPrice = Number(formation.priceEur);

  // Calcul du montant de l'échéance courante
  const perInstallment =
    Math.round((fullPrice / booking.installmentTotal) * 100) / 100;
  const nextIndex = booking.installmentsPaid + 1; // 1, 2 ou 3
  const isLast = nextIndex === booking.installmentTotal;
  const installmentAmount = isInstallments
    ? isLast
      ? Math.round(
          (fullPrice - perInstallment * (booking.installmentTotal - 1)) * 100
        ) / 100
      : perInstallment
    : fullPrice;

  const installmentMode = isInstallments && booking.installmentsPaid > 0;

  return (
    <Section className="pt-24 pb-32">
      <div className="max-w-3xl mx-auto">
        <p className="text-sm text-[var(--color-text-dim)] uppercase tracking-wider">
          {installmentMode
            ? `Échéance ${nextIndex} sur ${booking.installmentTotal}`
            : 'Paiement'}
        </p>
        <h1 className="mt-2 font-serif text-4xl md:text-5xl text-gradient">
          {installmentMode
            ? `Règle ton échéance ${nextIndex}.`
            : 'Finalise ta réservation.'}
        </h1>

        <div className="mt-10 grid lg:grid-cols-[1fr_360px] gap-8">
          {/* Form */}
          <div className="space-y-6">
            <CheckoutForm
              bookingId={booking.id}
              amount={installmentAmount}
              installmentMode={installmentMode}
            />

            <PaymentDisclaimer variant="compact" tone="amber" />
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

              {isInstallments ? (
                <div className="space-y-3">
                  <div className="flex justify-between items-baseline">
                    <span className="text-sm text-[var(--color-text-dim)]">
                      Échéance {nextIndex}/{booking.installmentTotal}
                    </span>
                    <span className="font-serif text-2xl text-gradient">
                      {formatPrice(installmentAmount)}
                    </span>
                  </div>
                  <div className="flex justify-between items-baseline text-xs text-[var(--color-text-dim)]">
                    <span>Total formation</span>
                    <span className="font-mono">{formatPrice(fullPrice)}</span>
                  </div>
                  <div className="flex gap-1.5 pt-1">
                    {Array.from({ length: booking.installmentTotal }).map(
                      (_, i) => (
                        <div
                          key={i}
                          className={`h-1.5 flex-1 rounded-full ${
                            i < booking.installmentsPaid
                              ? 'bg-emerald-400'
                              : i === booking.installmentsPaid
                              ? 'bg-indigo-400'
                              : 'bg-[var(--color-surface-tint-strong)]'
                          }`}
                        />
                      )
                    )}
                  </div>
                  <p className="text-xs text-[var(--color-text-dim)] pt-2 leading-relaxed">
                    La formation aura lieu une fois{' '}
                    <strong className="text-[var(--color-text)]">les 3 échéances</strong>{' '}
                    réglées.
                  </p>
                </div>
              ) : (
                <div className="flex justify-between items-baseline">
                  <span className="text-sm text-[var(--color-text-dim)]">
                    Total
                  </span>
                  <span className="font-serif text-2xl text-gradient">
                    {formatPrice(fullPrice)}
                  </span>
                </div>
              )}

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
