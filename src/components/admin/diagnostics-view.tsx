'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  HelpCircle,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StatCard, StatCardGrid } from '@/components/admin/stat-card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';

export type CheckStatus = 'ok' | 'warn' | 'error';
export type CheckCategory = 'telegram' | 'auth' | 'webhook' | 'env';

export interface DiagnosticsCheck {
  id: string;
  label: string;
  /** Sous-titre court (ex: "ID 8837423409", "Config: @bot · Telegram: @bot"). */
  sublabel?: string;
  category: CheckCategory;
  status: CheckStatus;
  /** Texte court affiché dans la colonne Détail. */
  detail: string;
  /** Action recommandée (affichée dans le dialog "Voir"). */
  action?: string;
  /** Valeur copiable (token tronqué, URL, IDs). Si absent, bouton Copier caché. */
  copyValue?: string;
  /** URL doc externe. Si présent, remplace le bouton "Copier" par "Doc". */
  docUrl?: string;
  /** Indique que ce check supporte un re-check ciblé (juste refresh la page côté Next). */
  recheckable?: boolean;
}

const AUTO_REFRESH_SECONDS = 30;

const CATEGORY_LABEL: Record<CheckCategory | 'all', string> = {
  all: 'Tous',
  telegram: 'Telegram',
  auth: 'Auth',
  webhook: 'Webhook',
  env: 'Env',
};

const CATEGORY_TONE: Record<CheckCategory, string> = {
  telegram:
    'bg-sky-500/15 border-sky-500/30 text-sky-300 light:text-sky-700',
  auth: 'bg-indigo-500/15 border-indigo-500/30 text-indigo-300 light:text-indigo-700',
  webhook:
    'bg-amber-500/15 border-amber-500/30 text-amber-300 light:text-amber-700',
  env: 'bg-violet-500/15 border-violet-500/30 text-violet-300 light:text-violet-700',
};

const STATUS_VARIANT: Record<CheckStatus, { icon: typeof CheckCircle2; tone: string; label: string }> = {
  ok: {
    icon: CheckCircle2,
    tone: 'text-emerald-300 light:text-emerald-700',
    label: 'OK',
  },
  warn: {
    icon: AlertTriangle,
    tone: 'text-amber-300 light:text-amber-700',
    label: 'Warn',
  },
  error: {
    icon: AlertCircle,
    tone: 'text-rose-300 light:text-rose-700',
    label: 'Erreur',
  },
};

interface Props {
  checks: DiagnosticsCheck[];
  /** Date ISO du dernier fetch côté serveur — sert au "il y a Xs" du header. */
  fetchedAt: string;
}

/**
 * Vue principale du Diagnostics : KPIs + tabs filtre + table + dialogs.
 * Auto-refresh la page via router.refresh() toutes les 30s.
 *
 * Le "live" est en réalité un refresh périodique : ça suffit largement pour
 * du diagnostic infra qui change rarement, et c'est bcp moins coûteux qu'une
 * connection SSE/WS.
 */
export function DiagnosticsView({ checks, fetchedAt }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [category, setCategory] = useState<CheckCategory | 'all'>('all');
  const [helpOpen, setHelpOpen] = useState(true);
  const [detailCheck, setDetailCheck] = useState<DiagnosticsCheck | null>(null);
  /** Ticker pour afficher "il y a Xs" dynamiquement sans server refresh. */
  const [tick, setTick] = useState(0);

  // Auto-refresh toutes les 30s
  useEffect(() => {
    const id = setInterval(() => {
      start(() => router.refresh());
    }, AUTO_REFRESH_SECONDS * 1000);
    return () => clearInterval(id);
  }, [router]);

  // Tick toutes les secondes pour le "il y a Xs"
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const counts = useMemo(() => {
    return {
      ok: checks.filter((c) => c.status === 'ok').length,
      warn: checks.filter((c) => c.status === 'warn').length,
      error: checks.filter((c) => c.status === 'error').length,
    };
  }, [checks]);

  const filteredChecks = useMemo(() => {
    if (category === 'all') return checks;
    return checks.filter((c) => c.category === category);
  }, [checks, category]);

  function relaunch() {
    start(() => router.refresh());
    toast({ title: 'Relance en cours…' });
  }

  function copyValue(value: string) {
    navigator.clipboard.writeText(value).then(
      () => toast({ title: 'Copié' }),
      () => toast({ title: 'Copie échouée', variant: 'destructive' })
    );
  }

  // tick déclenche un re-render pour mettre à jour timeAgo
  void tick;
  const fetchedAtDate = new Date(fetchedAt);
  const agoLabel = formatAgo(fetchedAtDate);

  return (
    <>
      {/* Bandeau "Live" + relancer */}
      <div className="flex flex-wrap items-center justify-end gap-3 mb-5">
        <Badge variant="success" className="text-xs gap-1.5">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Live
        </Badge>
        <span className="text-xs text-[var(--color-text-dim)] inline-flex items-center gap-1.5">
          Dernière mise à jour : {agoLabel}
          <button
            type="button"
            onClick={relaunch}
            disabled={pending}
            aria-label="Rafraîchir"
            className="ml-0.5 inline-flex items-center justify-center hover:text-[var(--color-text)]"
          >
            {pending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
          </button>
        </span>
        <Button onClick={relaunch} disabled={pending} size="sm" className="gap-1.5">
          {pending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          Relancer tous les checks
        </Button>
      </div>

      {/* 4 KPI cards */}
      <StatCardGrid cols={4} className="mb-5">
        <StatCard
          label="OK"
          value={counts.ok}
          tone="success"
          icon={<CheckCircle2 className="h-4 w-4" />}
        />
        <StatCard
          label="Avertissements"
          value={counts.warn}
          tone={counts.warn > 0 ? 'warning' : 'default'}
          icon={<AlertTriangle className="h-4 w-4" />}
        />
        <StatCard
          label="Erreurs"
          value={counts.error}
          tone={counts.error > 0 ? 'danger' : 'default'}
          icon={<AlertCircle className="h-4 w-4" />}
        />
        <StatCard
          label="Auto-refresh"
          value={`${AUTO_REFRESH_SECONDS} s`}
          tone="info"
          icon={<Clock className="h-4 w-4" />}
        />
      </StatCardGrid>

      {/* Tabs filtre */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {(['all', 'telegram', 'auth', 'webhook', 'env'] as const).map(
            (cat) => {
              const c =
                cat === 'all'
                  ? checks.length
                  : checks.filter((x) => x.category === cat).length;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition-colors',
                    category === cat
                      ? 'bg-indigo-500/20 border border-indigo-500/40 text-[var(--color-text)] font-medium'
                      : 'border border-[var(--color-border)] text-[var(--color-text-dim)] hover:bg-[var(--color-surface-tint)]'
                  )}
                >
                  {CATEGORY_LABEL[cat]}
                  {c > 0 && (
                    <span className="text-[var(--color-text-faint)] tabular-nums">
                      {c}
                    </span>
                  )}
                </button>
              );
            }
          )}
        </div>
        <div className="flex-1" />
        <span className="text-xs text-[var(--color-text-dim)] tabular-nums">
          {filteredChecks.length} check{filteredChecks.length > 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      <div className="glass rounded-[var(--radius-lg)] overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Check</TableHead>
              <TableHead>Catégorie</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Détail</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredChecks.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="py-10 text-center text-sm text-[var(--color-text-dim)]"
                >
                  Aucun check dans cette catégorie.
                </TableCell>
              </TableRow>
            ) : (
              filteredChecks.map((check) => (
                <CheckRow
                  key={check.id}
                  check={check}
                  onSeeDetail={() => setDetailCheck(check)}
                  onCopy={copyValue}
                  onRecheck={relaunch}
                  recheckPending={pending}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Aide */}
      <HelpPanel open={helpOpen} onToggle={() => setHelpOpen(!helpOpen)} />

      {/* Dialog détail */}
      <Dialog
        open={!!detailCheck}
        onOpenChange={(o) => !o && setDetailCheck(null)}
      >
        {detailCheck && <DetailDialog check={detailCheck} />}
      </Dialog>
    </>
  );
}

function CheckRow({
  check,
  onSeeDetail,
  onCopy,
  onRecheck,
  recheckPending,
}: {
  check: DiagnosticsCheck;
  onSeeDetail: () => void;
  onCopy: (value: string) => void;
  onRecheck: () => void;
  recheckPending: boolean;
}) {
  const status = STATUS_VARIANT[check.status];
  const StatusIcon = status.icon;
  return (
    <TableRow>
      <TableCell>
        <div className="flex items-start gap-2.5 min-w-0">
          <span
            className={cn(
              'inline-flex h-6 w-6 items-center justify-center rounded-full border flex-shrink-0 mt-0.5',
              check.status === 'ok'
                ? 'bg-emerald-500/15 border-emerald-500/30'
                : check.status === 'warn'
                ? 'bg-amber-500/15 border-amber-500/30'
                : 'bg-rose-500/15 border-rose-500/30'
            )}
          >
            <StatusIcon className={cn('h-3.5 w-3.5', status.tone)} />
          </span>
          <div className="min-w-0">
            <div className="text-sm font-medium leading-tight">
              {check.label}
            </div>
            {check.sublabel && (
              <div className="text-[10px] text-[var(--color-text-faint)] mt-0.5 font-mono truncate">
                {check.sublabel}
              </div>
            )}
          </div>
        </div>
      </TableCell>
      <TableCell>
        <span
          className={cn(
            'inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] border',
            CATEGORY_TONE[check.category]
          )}
        >
          {CATEGORY_LABEL[check.category]}
        </span>
      </TableCell>
      <TableCell>
        <span className="inline-flex items-center gap-1.5 text-xs">
          <span
            className={cn(
              'inline-block h-1.5 w-1.5 rounded-full',
              check.status === 'ok'
                ? 'bg-emerald-400'
                : check.status === 'warn'
                ? 'bg-amber-400'
                : 'bg-rose-400'
            )}
          />
          <span className={status.tone}>{status.label}</span>
        </span>
      </TableCell>
      <TableCell className="text-xs text-[var(--color-text-dim)] max-w-md truncate">
        {check.detail}
      </TableCell>
      <TableCell className="text-right">
        <div className="inline-flex items-center gap-1.5 justify-end">
          <Button
            size="sm"
            variant="secondary"
            onClick={onSeeDetail}
            className="h-7 px-2 gap-1 text-[11px]"
          >
            Voir
            <ExternalLink className="h-3 w-3" />
          </Button>
          {check.docUrl ? (
            <Button
              size="sm"
              variant="secondary"
              asChild
              className="h-7 px-2 gap-1 text-[11px]"
            >
              <Link href={check.docUrl} target="_blank" rel="noopener noreferrer">
                Doc
                <ExternalLink className="h-3 w-3" />
              </Link>
            </Button>
          ) : check.recheckable ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={onRecheck}
              disabled={recheckPending}
              className="h-7 px-2 gap-1 text-[11px]"
            >
              Relancer
              <RefreshCw className="h-3 w-3" />
            </Button>
          ) : check.copyValue ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onCopy(check.copyValue!)}
              className="h-7 px-2 gap-1 text-[11px]"
            >
              Copier
              <Copy className="h-3 w-3" />
            </Button>
          ) : null}
        </div>
      </TableCell>
    </TableRow>
  );
}

function DetailDialog({ check }: { check: DiagnosticsCheck }) {
  const status = STATUS_VARIANT[check.status];
  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 flex-wrap">
          {check.label}
          <Badge
            variant={
              check.status === 'ok'
                ? 'success'
                : check.status === 'warn'
                ? 'warning'
                : 'danger'
            }
            className="text-[10px]"
          >
            {status.label}
          </Badge>
          <span
            className={cn(
              'inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] border',
              CATEGORY_TONE[check.category]
            )}
          >
            {CATEGORY_LABEL[check.category]}
          </span>
        </DialogTitle>
        {check.sublabel && (
          <DialogDescription className="font-mono text-[11px]">
            {check.sublabel}
          </DialogDescription>
        )}
      </DialogHeader>

      <div className="space-y-3">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-dim)] mb-1">
            Détail
          </div>
          <div className="text-sm bg-[var(--color-surface-tint)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-3 break-words">
            {check.detail}
          </div>
        </div>

        {check.action && (
          <div>
            <div className="text-[10px] uppercase tracking-wider text-amber-300 light:text-amber-700 mb-1">
              Action recommandée
            </div>
            <div className="text-sm bg-amber-500/5 border border-amber-500/25 rounded-[var(--radius-md)] p-3 break-words">
              {check.action}
            </div>
          </div>
        )}
      </div>

      <DialogFooter>
        {check.copyValue && (
          <Button
            variant="secondary"
            onClick={() => {
              navigator.clipboard.writeText(check.copyValue!);
              toast({ title: 'Copié' });
            }}
          >
            <Copy className="h-4 w-4" />
            Copier la valeur
          </Button>
        )}
        {check.docUrl && (
          <Button variant="secondary" asChild>
            <Link href={check.docUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" />
              Voir la doc
            </Link>
          </Button>
        )}
      </DialogFooter>
    </DialogContent>
  );
}

function HelpPanel({
  open,
  onToggle,
}: {
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="mt-5 glass rounded-[var(--radius-lg)] p-4 md:p-5">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-3 text-left"
      >
        <div className="flex items-center gap-2.5">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 light:text-indigo-700">
            <HelpCircle className="h-3.5 w-3.5" />
          </span>
          <h3 className="text-sm font-semibold">
            Connexion utilisateur — aide rapide
          </h3>
        </div>
        <span
          className={cn(
            'text-[var(--color-text-dim)] transition-transform',
            open ? 'rotate-0' : '-rotate-90'
          )}
        >
          ⌃
        </span>
      </button>
      <div
        className={cn(
          'grid transition-[grid-template-rows] duration-200',
          open ? 'grid-rows-[1fr] mt-3' : 'grid-rows-[0fr] mt-0'
        )}
      >
        <div className="overflow-hidden min-h-0">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Step
              n={1}
              text={
                <>
                  Vérifier que tous les checks sont au vert (surtout{' '}
                  <code className="text-[10px]">/setdomain</code> chez @BotFather).
                </>
              }
            />
            <Step
              n={2}
              text={
                <>
                  Demander d&apos;envoyer{' '}
                  <code className="text-[10px]">/start</code> au bot, puis
                  revenir sur la page de login.
                </>
              }
            />
            <Step
              n={3}
              text={
                <>
                  En dernier recours :{' '}
                  <code className="text-[10px]">/login</code> dans le bot DM —
                  magic-link valable 10 min.
                </>
              }
            />
            <Step
              n={4}
              text={
                <>
                  Sur desktop : vérifier que la popup Telegram n&apos;est pas
                  bloquée.
                </>
              }
            />
          </div>
          <div className="mt-4 flex justify-end">
            <Button asChild variant="default" size="sm">
              <Link
                href="https://core.telegram.org/widgets/login"
                target="_blank"
                rel="noopener noreferrer"
                className="gap-1.5"
              >
                Voir la doc
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Step({ n, text }: { n: number; text: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-[var(--radius-md)] bg-[var(--color-surface-tint)] border border-[var(--color-border)] p-3">
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 light:text-indigo-700 text-[11px] font-semibold flex-shrink-0">
        {n}
      </span>
      <div className="text-xs leading-snug text-[var(--color-text-dim)]">
        {text}
      </div>
    </div>
  );
}

function formatAgo(d: Date): string {
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 5) return 'à l\'instant';
  if (seconds < 60) return `il y a ${seconds}s`;
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `il y a ${mins}min`;
  const hours = Math.floor(mins / 60);
  return `il y a ${hours}h`;
}
