'use client';

import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { useLanding } from '../landing-context';

const steps = [
  { n: 1, title: 'Inscription', body: 'Connexion via Telegram en un clic.' },
  { n: 2, title: 'Compte broker', body: 'Ouverture via notre lien partenaire — 100% gratuit.' },
  {
    n: 3,
    title: 'Ton dépôt',
    body: 'À partir de 250€ — ton argent reste à toi, c\'est ce que tu vas trader.',
  },
  { n: 4, title: 'Accès VIP', body: 'Lien Telegram envoyé après validation. Rien à payer.' },
];

interface Props {
  /** Nombre de membres VIP qualifiés CPA. 0 = on masque le compteur. */
  qualifiedCount?: number;
}

export function VipSection({ qualifiedCount = 0 }: Props) {
  const { goTo } = useLanding();
  const showProof = qualifiedCount > 0;

  return (
    <div className="text-center max-w-[1100px] w-full">
      <h2 className="text-[clamp(36px,5vw,56px)] font-semibold tracking-[-0.03em] leading-[1.1] mb-4">
        Le groupe{' '}
        <span
          className="font-serif italic font-normal"
          style={{
            background: 'linear-gradient(135deg, #6366f1, #ec4899)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          VIP Telegram
        </span>
      </h2>

      {showProof && (
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 mb-5">
          <CheckCircle2 className="h-3 w-3" />
          <span>
            <strong className="text-emerald-200 font-semibold tabular-nums">
              {qualifiedCount.toLocaleString('fr-FR')}
            </strong>{' '}
            {qualifiedCount === 1 ? 'membre qualifié' : 'membres qualifiés'} —
            toujours dans le groupe
          </span>
        </div>
      )}

      <p className="text-[17px] text-[var(--color-text-dim)] max-w-[600px] mx-auto mb-3">
        <strong className="text-[var(--color-text)]">L'accès au groupe VIP est gratuit.</strong>{' '}
        Tu déposes ton propre argent sur ton compte broker pour trader —
        nous, on est payés en commission par le broker, pas par toi.
      </p>
      <p className="text-sm text-[var(--color-text-faint)] max-w-[540px] mx-auto mb-12">
        Aucun abonnement, aucun frais caché. 4 étapes simples.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-12">
        {steps.map((s, i) => (
          <div
            key={s.n}
            className="text-left bg-[rgba(20,20,30,0.5)] light:bg-white/90 backdrop-blur-xl border border-[var(--color-border)] rounded-[20px] p-6 transition-all duration-300 hover:-translate-y-1.5 hover:border-indigo-500/40 hover:bg-[rgba(99,102,241,0.05)] light:hover:bg-indigo-50 hover:shadow-xl group"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-pink-500 flex items-center justify-center text-[14px] font-semibold mb-4 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-[6deg] shadow-lg shadow-indigo-500/30">
              {s.n}
            </div>
            <h4 className="text-[15px] font-medium mb-1.5">{s.title}</h4>
            <p className="text-xs text-[var(--color-text-dim)] leading-[1.5]">
              {s.body}
            </p>
          </div>
        ))}
      </div>

      <button
        onClick={() => goTo(3)}
        className="btn-shimmer group inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-white text-[var(--color-bg)] text-sm font-medium hover:-translate-y-1 hover:scale-[1.02] hover:shadow-[0_16px_40px_-8px_rgba(255,255,255,0.35)] active:scale-[0.98] transition-all duration-300"
      >
        Commencer maintenant
        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
      </button>
    </div>
  );
}
