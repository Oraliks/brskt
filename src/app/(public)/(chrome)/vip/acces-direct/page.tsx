import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  Infinity as InfinityIcon,
  Lock,
  Send,
} from 'lucide-react';
import { Section, SectionHeader } from '@/components/shared/section';
import { Badge } from '@/components/ui/badge';
import { requireAuth } from '@/lib/auth/server';
import { getActivePaidAccess } from '@/lib/vip-paid-access';
import { getVipPaidAccessConfig } from '@/lib/settings/vip-paid-access';
import { VipPaidAccessForm } from '@/components/vip/vip-paid-access-form';
import { formatPrice } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function VipAccesDirectPage({
  searchParams,
}: {
  searchParams: Promise<{ cancelled?: string }>;
}) {
  const session = await requireAuth();
  if (!session.user.email || !session.user.onboardingCompletedAt) {
    redirect('/onboarding?redirectTo=/vip/acces-direct');
  }

  const params = await searchParams;
  const [paidAccess, config] = await Promise.all([
    getActivePaidAccess(session.user.id),
    getVipPaidAccessConfig(),
  ]);

  // Si l'option est désactivée → renvoie vers /vip
  if (!config.enabled) redirect('/vip');

  // Si user a déjà un accès actif → renvoie vers /vip pour voir l'état
  if (paidAccess && paidAccess.status !== 'pending_payment') {
    redirect('/vip');
  }

  return (
    <Section className="pt-24 pb-20">
      <div className="max-w-2xl mx-auto">
        <Link
          href="/vip"
          className="inline-flex items-center gap-1 text-xs text-[var(--color-text-dim)] hover:text-[var(--color-text)] mb-4"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Choix d&apos;accès VIP
        </Link>

        <SectionHeader
          eyebrow="Accès VIP — direct payant"
          title={
            <>
              Paye, et tu es{' '}
              <span className="font-serif italic">dedans.</span>
            </>
          }
          description="Tu as déjà ton broker. Tu veux juste l'accès au groupe Telegram. Paye une fois, accès à vie."
          align="left"
        />

        {/* Bandeau "annulé" si l'user revient du provider en cancel */}
        {params.cancelled === '1' && (
          <div className="mt-6 rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200 inline-flex items-start gap-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>
              Tu as annulé le paiement. Tu peux retenter ci-dessous, ou
              choisir une autre méthode.
            </span>
          </div>
        )}

        {/* Récap prix + bénéfices */}
        <div className="mt-8 glass-strong rounded-[var(--radius-lg)] p-6 flex flex-col sm:flex-row sm:items-center gap-6 justify-between">
          <div>
            <Badge variant="gold">Paiement unique</Badge>
            <h2 className="font-serif text-xl mt-2">Accès VIP Telegram</h2>
            <ul className="mt-3 space-y-1.5 text-sm text-[var(--color-text-dim)]">
              <li className="flex items-center gap-2">
                <InfinityIcon className="h-3.5 w-3.5 text-emerald-300" />
                Accès à vie au groupe privé
              </li>
              <li className="flex items-center gap-2">
                <Send className="h-3.5 w-3.5 text-emerald-300" />
                Lien d&apos;invitation auto par le bot
              </li>
              <li className="flex items-center gap-2">
                <Lock className="h-3.5 w-3.5 text-emerald-300" />
                Aucune condition CPA ni qualification
              </li>
            </ul>
          </div>
          <div className="text-right">
            <div className="font-serif text-5xl text-gradient">
              {formatPrice(config.priceEur)}
            </div>
            <div className="text-xs text-[var(--color-text-faint)]">
              paiement unique · TTC
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="mt-8">
          <VipPaidAccessForm
            defaultFirstName={session.user.telegramFirstName ?? ''}
            existingPending={paidAccess?.status === 'pending_payment'}
          />
        </div>

        {/* Disclaimer pourquoi on demande le nom */}
        <div className="mt-6 glass rounded-[var(--radius-md)] p-4 text-xs text-[var(--color-text-dim)] flex gap-3">
          <Lock className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <div>
            <strong className="text-[var(--color-text)]">
              Pourquoi on demande ton nom complet ?
            </strong>{' '}
            Les comptes Telegram peuvent changer de pseudo ou être recréés.
            Le nom légal qui apparaît dans la communication du paiement est
            ce qui nous permet de t&apos;identifier de façon fiable si tu
            perds l&apos;accès à ton Telegram. Aucun usage commercial, juste
            un point d&apos;ancrage.
          </div>
        </div>

        {/* Pas de remboursement */}
        <div className="mt-3 rounded-md bg-rose-500/10 border border-rose-500/20 p-3 text-xs text-rose-200 flex gap-2">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>
            <strong>Pas de remboursement.</strong> L&apos;accès est à vie.
            Le paiement valide ton entrée dans le groupe — assure-toi
            d&apos;avoir bien lu les conditions avant de continuer.
          </span>
        </div>
      </div>
    </Section>
  );
}
