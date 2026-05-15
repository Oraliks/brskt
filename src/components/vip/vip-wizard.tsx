'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Clock,
  Copy,
  ExternalLink,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/use-toast';
import {
  confirmVipMembershipAction,
  requestTelegramInviteAction,
  startVipFunnelAction,
  submitBrokerAccountAction,
  submitDepositAction,
} from '@/lib/actions/vip';
import type { VipApplication } from '@/lib/db/schema';
import { cn } from '@/lib/utils';

type Step = VipApplication['step'];

const STEP_ORDER: Step[] = [
  'link_generated',
  'signup_pending',
  'signup_validated',
  'deposit_pending',
  'deposit_validated',
  'telegram_invited',
  'in_group',
];

interface VipWizardProps {
  application: VipApplication | null;
  /** Progression de trading 0-100 — pertinente quand step = in_group */
  tradingProgressPct?: number;
  /**
   * Mode IronFX courant. En mode 'api', les webhooks detectent
   * automatiquement le dépôt — on adapte l'UI pour ne pas demander
   * la saisie manuelle au user.
   */
  ironfxMode?: 'manual' | 'api';
}

export function VipWizard({
  application,
  tradingProgressPct = 0,
  ironfxMode = 'manual',
}: VipWizardProps) {
  const currentStep = application?.step ?? null;

  if (currentStep === 'ejected') {
    return <EjectedView application={application!} />;
  }

  return (
    <div className="space-y-5">
      <ProgressHeader currentStep={currentStep} />
      <StepRenderer
        application={application}
        tradingProgressPct={tradingProgressPct}
        ironfxMode={ironfxMode}
      />
    </div>
  );
}

function ProgressHeader({ currentStep }: { currentStep: Step | null }) {
  const idx = currentStep ? STEP_ORDER.indexOf(currentStep) : -1;
  const progress = ((idx + 1) / STEP_ORDER.length) * 100;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs">
        <span className="text-[var(--color-text-dim)] uppercase tracking-wider">
          Progression
        </span>
        <span className="font-mono text-[var(--color-text-dim)]">
          Étape {Math.max(idx + 1, 0)} / {STEP_ORDER.length}
        </span>
      </div>
      <Progress value={Math.max(progress, 4)} />
    </div>
  );
}

function StepRenderer({
  application,
  tradingProgressPct,
  ironfxMode,
}: {
  application: VipApplication | null;
  tradingProgressPct: number;
  ironfxMode: 'manual' | 'api';
}) {
  const step = application?.step ?? null;

  if (step === null) {
    return <StartStep />;
  }

  switch (step) {
    case 'link_generated':
    case 'clicked':
      return <BrokerAccountStep application={application!} />;
    case 'signup_pending':
      return <WaitingStep title="On valide ton inscription broker" />;
    case 'signup_validated':
      // En mode API, le dépôt sera détecté auto par le webhook — on indique
      // au user qu'il n'a rien à saisir, juste à déposer chez le broker.
      return ironfxMode === 'api' ? (
        <DepositApiWaitStep />
      ) : (
        <DepositStep application={application!} />
      );
    case 'deposit_pending':
      return <WaitingStep title="On valide ton dépôt" />;
    case 'deposit_validated':
      return <GenerateInviteStep />;
    case 'telegram_invited':
      return <InviteStep inviteLink={application!.telegramInviteLink ?? ''} />;
    case 'in_group':
      return <SuccessStep tradingProgressPct={tradingProgressPct} />;
    default:
      return null;
  }
}

function StartStep() {
  const router = useRouter();
  const [pending, start] = useTransition();

  function handleStart() {
    start(async () => {
      const result = await startVipFunnelAction();
      if (result.success) {
        router.refresh();
      } else {
        toast({
          title: 'Erreur',
          description: result.error,
          variant: 'destructive',
        });
      }
    });
  }

  return (
    <StepCard
      badge="01"
      title="Démarre ton funnel VIP"
      description="On va générer ton lien partenaire personnalisé. Une fois inscrit chez le broker via ce lien, tu reviens ici déclarer ton compte."
    >
      <Button size="lg" onClick={handleStart} disabled={pending}>
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        Générer mon lien
        <ArrowRight className="h-4 w-4" />
      </Button>
    </StepCard>
  );
}

// Validation broker ID côté client : IronFX = généralement 6-10 chiffres.
// On accepte aussi alphanum pour autres formats possibles, min 3 chars.
const BROKER_ID_REGEX = /^[A-Za-z0-9_-]{3,50}$/;

function BrokerAccountStep({
  application,
}: {
  application: VipApplication;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [accountId, setAccountId] = useState('');
  const [touched, setTouched] = useState(false);

  const trimmed = accountId.trim();
  const isValid = BROKER_ID_REGEX.test(trimmed);
  const showError = touched && trimmed.length > 0 && !isValid;
  const isDigitsOnly = /^\d+$/.test(trimmed);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!isValid) {
      toast({
        title: 'Numéro de compte invalide',
        description:
          'Format attendu : chiffres ou alphanumériques (3-50 caractères).',
        variant: 'destructive',
      });
      return;
    }
    start(async () => {
      const result = await submitBrokerAccountAction({
        brokerAccountId: trimmed,
      });
      if (result.success) {
        toast({ title: '✓ Inscription envoyée', description: 'On valide sous 24h.' });
        router.refresh();
      } else {
        toast({
          title: 'Erreur',
          description: result.error,
          variant: 'destructive',
        });
      }
    });
  }

  return (
    <div className="space-y-6">
      <StepCard
        badge="02"
        title="1. Ouvre ton compte broker"
        description="Clique sur ton lien partenaire et inscris-toi chez le broker."
      >
        <div className="rounded-[var(--radius-md)] bg-[var(--color-surface-tint)] border border-[var(--color-border)] p-4">
          <Label className="text-xs text-[var(--color-text-dim)] uppercase tracking-wider">
            Ton lien partenaire
          </Label>
          <div className="mt-2 flex flex-col sm:flex-row gap-2">
            <Input
              readOnly
              value={application.affiliateLink}
              className="font-mono text-xs"
            />
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                size="default"
                onClick={() => {
                  navigator.clipboard.writeText(application.affiliateLink);
                  toast({ title: 'Lien copié' });
                }}
              >
                <Copy className="h-4 w-4" />
              </Button>
              <Button asChild size="default">
                <a
                  href={application.affiliateLink}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Ouvrir
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            </div>
          </div>

          {/* Slot vidéo IronFX — discret, collapsible. Sera rempli plus tard
              quand on aura enregistré le walkthrough. */}
          <IronFxSignupVideoSlot />
        </div>
      </StepCard>

      <StepCard
        badge="03"
        title="2. Déclare ton numéro de compte broker"
        description="Une fois ton compte créé chez le broker, copie son ID ici. On le validera sous 24h."
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="brokerAccountId">Numéro de compte broker</Label>
            <Input
              id="brokerAccountId"
              className="mt-2"
              placeholder="Ex: 1234567"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              onBlur={() => setTouched(true)}
              aria-invalid={showError}
              required
            />
            {showError ? (
              <p className="mt-1.5 text-xs text-rose-400 light:text-rose-600">
                Format invalide. Le numéro doit faire 3 à 50 caractères
                alphanumériques (chiffres, lettres, _, -).
              </p>
            ) : trimmed.length > 0 && isDigitsOnly ? (
              <p className="mt-1.5 text-xs text-emerald-400 light:text-emerald-700">
                ✓ Format chiffres ({trimmed.length} caractères) — typique IronFX.
              </p>
            ) : (
              <p className="mt-1.5 text-xs text-[var(--color-text-faint)]">
                Tu trouves ton ID dans ton espace IronFX (rubrique
                &laquo; Mes comptes &raquo; ou &laquo; Trading Account &raquo;).
                C&apos;est généralement un nombre à 6-10 chiffres.
              </p>
            )}
          </div>
          <Button
            type="submit"
            size="lg"
            disabled={pending || (touched && !isValid)}
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            Envoyer pour validation
          </Button>
        </form>
      </StepCard>
    </div>
  );
}

function DepositStep(_props: { application: VipApplication }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [amount, setAmount] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const n = Number(amount);
    if (Number.isNaN(n) || n < 250) {
      toast({
        title: 'Dépôt minimum 250€',
        variant: 'destructive',
      });
      return;
    }
    start(async () => {
      const result = await submitDepositAction({
        amount: n,
        currency: 'EUR',
      });
      if (result.success) {
        toast({
          title: '✓ Dépôt déclaré',
          description: 'On valide sous 24h.',
        });
        router.refresh();
      } else {
        toast({
          title: 'Erreur',
          description: result.error,
          variant: 'destructive',
        });
      }
    });
  }

  const warning = Number(amount) > 1500;

  return (
    <StepCard
      badge="04"
      title="Déclare ton dépôt"
      description="Le montant que tu as déposé sur TON compte broker. Cet argent reste à toi, c'est ton capital pour trader. On vérifie juste que tu as bien déposé pour t'envoyer ton accès VIP."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="amount">Montant déposé (EUR)</Label>
          <div className="relative mt-2">
            <Input
              id="amount"
              type="number"
              inputMode="decimal"
              step="1"
              min={250}
              placeholder="250"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="pr-12"
              required
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-[var(--color-text-dim)]">
              EUR
            </span>
          </div>
        </div>

        {warning && (
          <div className="flex items-start gap-3 rounded-[var(--radius-md)] bg-amber-500/10 border border-amber-500/30 p-4 text-sm">
            <AlertTriangle className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <strong>Conseil débutant :</strong> ne dépasse pas 1 500€ tant que
              tu n'as pas pris confiance avec ta méthode. Tu peux toujours
              redéposer plus tard.
            </div>
          </div>
        )}

        <Button type="submit" size="lg" disabled={pending}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          Envoyer pour validation
        </Button>
      </form>
    </StepCard>
  );
}

function WaitingStep({ title }: { title: string }) {
  return (
    <StepCard
      badge={<Clock className="h-3 w-3" />}
      title={title}
      description="Notre équipe valide manuellement chaque étape. Tu recevras un email dès que c'est OK — généralement sous 24h ouvrées."
    >
      <Badge variant="warning">En cours de traitement</Badge>
    </StepCard>
  );
}

/**
 * Slot pour une vidéo "comment s'inscrire IronFX en 30s".
 *
 * Aujourd'hui : juste un mini collapsible "Voir comment faire" avec un
 * texte placeholder. Le jour où la vidéo sera enregistrée, on remplace
 * le contenu par un <video src=... /> ou un embed YouTube/Vimeo.
 *
 * Volontairement discret (mt-3, text-xs) pour ne pas dominer l'UI.
 */
function IronFxSignupVideoSlot() {
  const videoUrl = process.env.NEXT_PUBLIC_IRONFX_SIGNUP_VIDEO_URL;
  return (
    <details className="mt-3 group">
      <summary className="text-xs text-[var(--color-text-dim)] hover:text-[var(--color-text)] cursor-pointer inline-flex items-center gap-1 select-none">
        <span className="group-open:hidden">▸</span>
        <span className="hidden group-open:inline">▾</span>
        Comment s&apos;inscrire chez IronFX en 30 secondes
      </summary>
      <div className="mt-2 text-xs text-[var(--color-text-dim)] leading-relaxed">
        {videoUrl ? (
          <video
            controls
            src={videoUrl}
            className="w-full rounded-md aspect-video"
          />
        ) : (
          <div className="rounded-md bg-[var(--color-surface-tint)] p-3 italic text-[var(--color-text-faint)]">
            Vidéo bientôt disponible. En attendant : clique sur ton lien,
            remplis le formulaire (nom, email, pays), valide ton email,
            puis viens copier ton ID de compte ici.
          </div>
        )}
      </div>
    </details>
  );
}

/**
 * Step "dépôt" en mode API : le webhook IronFX nous remontera
 * automatiquement le dépôt. On ne demande aucune saisie au user — juste
 * un message "fais ton dépôt chez le broker, on le détecte direct".
 */
function DepositApiWaitStep() {
  return (
    <StepCard
      badge="04"
      title="Fais ton dépôt chez le broker"
      description="Aucune saisie ici — notre système détecte automatiquement ton dépôt via notre intégration broker. Tu seras notifié dès qu'on l'a vu."
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-[var(--radius-md)] bg-blue-500/10 border border-blue-500/25 p-4 text-sm">
          <Clock className="h-5 w-5 text-blue-300 light:text-blue-700 flex-shrink-0 mt-0.5" />
          <div>
            <strong className="text-blue-200 light:text-blue-800">
              Détection automatique active
            </strong>
            <p className="mt-1 text-[var(--color-text-dim)]">
              Dépose au moins 250€ sur ton compte broker via leur interface.
              Dès que la transaction est confirmée côté broker, on la voit
              et on te débloque l&apos;étape suivante.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3 rounded-[var(--radius-md)] bg-amber-500/10 border border-amber-500/30 p-4 text-sm">
          <AlertTriangle className="h-5 w-5 text-amber-400 light:text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <strong>Conseil débutant :</strong> ne dépasse pas 1 500€ tant
            que tu n&apos;as pas pris confiance avec ta méthode. Tu peux
            toujours redéposer plus tard.
          </div>
        </div>
      </div>
    </StepCard>
  );
}

function GenerateInviteStep() {
  const router = useRouter();
  const [pending, start] = useTransition();

  function handleGenerate() {
    start(async () => {
      const result = await requestTelegramInviteAction();
      if (result.success) {
        toast({ title: '✓ Lien Telegram généré' });
        router.refresh();
      } else {
        toast({
          title: 'Erreur',
          description: result.error,
          variant: 'destructive',
        });
      }
    });
  }

  return (
    <StepCard
      badge={<Sparkles className="h-3 w-3" />}
      title="Tout est validé."
      description="Génère ton lien d'invitation Telegram à usage unique. Il expire dans 24h."
    >
      <Button size="lg" variant="glow" onClick={handleGenerate} disabled={pending}>
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        Générer mon lien Telegram
        <ArrowRight className="h-4 w-4" />
      </Button>
    </StepCard>
  );
}

function InviteStep({ inviteLink }: { inviteLink: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [opened, setOpened] = useState(false);

  function confirm() {
    start(async () => {
      const result = await confirmVipMembershipAction();
      if (result.success) {
        toast({ title: '🎉 Bienvenue dans le VIP !' });
        router.refresh();
      } else {
        toast({
          title: 'Pas encore détecté',
          description: result.error,
          variant: 'destructive',
        });
      }
    });
  }

  return (
    <StepCard
      badge={<Sparkles className="h-3 w-3" />}
      title="Bienvenue dans le VIP."
      description="Clique pour rejoindre le groupe Telegram privé. Une fois à l'intérieur, reviens ici et clique 'J'ai rejoint'."
    >
      <div className="flex flex-col sm:flex-row gap-3">
        <Button asChild size="lg" variant="glow" className="w-full sm:w-auto">
          <a
            href={inviteLink}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpened(true)}
          >
            Rejoindre le groupe VIP
            <ExternalLink className="h-4 w-4" />
          </a>
        </Button>
        <Button
          size="lg"
          variant={opened ? 'default' : 'secondary'}
          onClick={confirm}
          disabled={pending}
          className="w-full sm:w-auto"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Check className="h-4 w-4" />
          )}
          J&apos;ai rejoint, vérifier
        </Button>
      </div>
      <p className="mt-3 text-xs text-[var(--color-text-faint)]">
        Le lien est à usage unique. Si ça ne marche pas, attends 30s puis retente.
      </p>
    </StepCard>
  );
}

function SuccessStep({ tradingProgressPct }: { tradingProgressPct: number }) {
  const isQualified = tradingProgressPct >= 100;

  return (
    <div className="space-y-6">
      <div className="glass-strong rounded-[var(--radius-2xl)] p-10 text-center space-y-4">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 border border-emerald-500/30">
          <Check className="h-8 w-8 text-emerald-400" strokeWidth={3} />
        </div>
        <h2 className="font-serif text-3xl md:text-4xl text-gradient">
          Tu es membre VIP.
        </h2>
        <p className="text-[var(--color-text-dim)] max-w-md mx-auto">
          Bienvenue. On vérifie périodiquement l'activité de ton compte broker.
          Tant qu'il est actif, tu restes dans le groupe.
        </p>
        <Button asChild variant="secondary">
          <Link href="/dashboard">Voir mon espace</Link>
        </Button>
      </div>

      <div
        className={cn(
          'glass rounded-[var(--radius-lg)] p-6',
          isQualified && 'border-emerald-500/30 bg-emerald-500/5'
        )}
      >
        {isQualified ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/20 border border-emerald-500/40 text-lg">
                🎉
              </span>
              <div>
                <h3 className="font-semibold text-emerald-300">
                  Félicitations — tu es à 100%
                </h3>
                <p className="text-xs text-[var(--color-text-dim)]">
                  Ta place dans le VIP est sécurisée. Aucun risque de kick.
                </p>
              </div>
            </div>
            <div className="h-2 w-full rounded-full bg-white/5 overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-400"
                style={{ width: '100%' }}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-baseline justify-between">
              <h3 className="font-medium text-sm">
                Progression de trading depuis ton arrivée
              </h3>
              <span className="font-mono text-2xl font-medium text-white tabular-nums">
                {tradingProgressPct}%
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-white/5 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[var(--color-accent)] to-pink-500 transition-all"
                style={{
                  width: `${Math.max(0, Math.min(100, tradingProgressPct))}%`,
                }}
              />
            </div>
            <p className="text-xs text-[var(--color-text-dim)]">
              À 100%, ta place dans le VIP est sécurisée. D'ici là, évite de
              retirer tes fonds pour ne pas être éjecté automatiquement.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function EjectedView({ application }: { application: VipApplication }) {
  return (
    <div className="space-y-6">
      <div className="glass-strong rounded-[var(--radius-2xl)] p-8 border-rose-500/30">
        <Badge variant="danger">
          <AlertTriangle className="h-3 w-3 mr-1" />
          Éjecté du groupe VIP
        </Badge>
        <h2 className="mt-4 font-serif text-3xl">Tu n'es plus dans le groupe.</h2>
        {application.ejectionReason && (
          <div className="mt-6 rounded-[var(--radius-md)] bg-rose-500/10 border border-rose-500/20 p-4 text-sm">
            <strong className="block mb-2">Raison :</strong>
            {application.ejectionReason}
          </div>
        )}
        <p className="mt-6 text-sm text-[var(--color-text-dim)]">
          Pour réintégrer le groupe : redépose des fonds sur ton compte broker
          et contacte-nous via Telegram une fois que ton dépôt est confirmé.
        </p>
      </div>
    </div>
  );
}

function StepCard({
  badge,
  title,
  description,
  children,
  className,
}: {
  badge: React.ReactNode;
  title: string;
  description: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'glass-strong rounded-[var(--radius-lg)] p-6 md:p-8 space-y-4',
        className
      )}
    >
      <div className="flex items-center gap-3">
        <span className="inline-flex h-7 px-2.5 min-w-[28px] items-center justify-center rounded-md bg-[var(--color-accent)]/15 border border-[var(--color-accent)]/30 text-xs font-mono text-[var(--color-accent-hover)]">
          {badge}
        </span>
        <h3 className="text-xl font-semibold tracking-tight">{title}</h3>
      </div>
      <p className="text-sm text-[var(--color-text-dim)] leading-relaxed">
        {description}
      </p>
      {children && <div className="pt-2">{children}</div>}
    </div>
  );
}
