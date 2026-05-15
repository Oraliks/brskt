'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Plus, Tag, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from '@/components/ui/use-toast';
import {
  adminCreatePromoAction,
  adminDeletePromoAction,
  adminUpdatePromoAction,
} from '@/lib/actions/admin';
import { cn } from '@/lib/utils';

export interface PromoItem {
  id: string;
  code: string;
  discountType: 'percent' | 'fixed';
  discountValue: number;
  validFrom: string | null;
  validUntil: string | null;
  maxUses: number | null;
  usedCount: number;
  applicableMode: 'remote' | 'onsite' | null;
  active: boolean;
  notes: string | null;
  createdAt: string;
}

export function PromoList({ items }: { items: PromoItem[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [createOpen, setCreateOpen] = useState(false);

  function toggleActive(p: PromoItem) {
    start(async () => {
      const result = await adminUpdatePromoAction({
        promoId: p.id,
        active: !p.active,
      });
      if (result.success) {
        toast({ title: p.active ? '✓ Désactivé' : '✓ Réactivé' });
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

  function deletePromo(p: PromoItem) {
    if (!confirm(`Supprimer le code "${p.code}" ?`)) return;
    start(async () => {
      const result = await adminDeletePromoAction({ promoId: p.id });
      if (result.success) {
        toast({ title: '✓ Code supprimé' });
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
    <>
      <div className="flex justify-end mb-3">
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4" />
              Nouveau code
            </Button>
          </DialogTrigger>
          <CreatePromoDialog onCreated={() => setCreateOpen(false)} />
        </Dialog>
      </div>

      <div className="glass rounded-[var(--radius-lg)] overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Discount</TableHead>
              <TableHead>Usage</TableHead>
              <TableHead>Validité</TableHead>
              <TableHead>État</TableHead>
              <TableHead className="text-right">⋯</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center py-10 text-sm text-[var(--color-text-dim)]"
                >
                  Aucun code promo. Crée le premier ↗
                </TableCell>
              </TableRow>
            )}
            {items.map((p) => (
              <TableRow key={p.id} className={cn(!p.active && 'opacity-60')}>
                <TableCell>
                  <code className="font-mono text-sm font-semibold">
                    {p.code}
                  </code>
                  {p.notes && (
                    <div className="text-[10px] text-[var(--color-text-faint)] italic mt-0.5 max-w-xs truncate">
                      {p.notes}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-sm font-mono tabular-nums">
                  {p.discountType === 'percent'
                    ? `-${p.discountValue}%`
                    : `-${p.discountValue}€`}
                  {p.applicableMode && (
                    <Badge variant="secondary" className="ml-2 text-[10px]">
                      {p.applicableMode === 'onsite' ? 'Dubaï' : 'Distance'}
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-sm tabular-nums">
                  {p.usedCount}
                  {p.maxUses !== null && (
                    <span className="text-[var(--color-text-faint)]">
                      {' '}
                      / {p.maxUses}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-xs text-[var(--color-text-dim)]">
                  {p.validFrom && (
                    <div>du {formatShort(p.validFrom)}</div>
                  )}
                  {p.validUntil ? (
                    <div>jusqu&apos;au {formatShort(p.validUntil)}</div>
                  ) : (
                    <div className="text-[var(--color-text-faint)]">
                      sans limite
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={p.active}
                    onClick={() => toggleActive(p)}
                    disabled={pending}
                    className={cn(
                      'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
                      p.active
                        ? 'bg-emerald-500'
                        : 'bg-[var(--color-surface-tint-strong)]'
                    )}
                  >
                    <span
                      className={cn(
                        'inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform',
                        p.active ? 'translate-x-5' : 'translate-x-0.5'
                      )}
                    />
                  </button>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => deletePromo(p)}
                    disabled={pending}
                    className="text-rose-300 light:text-rose-700 hover:bg-rose-500/10 h-8 w-8"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

function formatShort(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  });
}

function CreatePromoDialog({ onCreated }: { onCreated: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [code, setCode] = useState('');
  const [type, setType] = useState<'percent' | 'fixed'>('percent');
  const [value, setValue] = useState('10');
  const [maxUses, setMaxUses] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [mode, setMode] = useState<'all' | 'remote' | 'onsite'>('all');
  const [notes, setNotes] = useState('');

  function submit() {
    const numValue = Number(value);
    if (!Number.isFinite(numValue) || numValue <= 0) {
      toast({ title: 'Valeur invalide', variant: 'destructive' });
      return;
    }
    if (type === 'percent' && numValue > 100) {
      toast({ title: 'Max 100 pour un %', variant: 'destructive' });
      return;
    }
    start(async () => {
      const result = await adminCreatePromoAction({
        code: code.toUpperCase().trim(),
        discountType: type,
        discountValue: numValue,
        validUntil: validUntil || undefined,
        maxUses: maxUses ? Number(maxUses) : undefined,
        applicableMode: mode === 'all' ? undefined : mode,
        active: true,
        notes: notes.trim() || undefined,
      });
      if (result.success) {
        toast({ title: `✓ Code ${code.toUpperCase()} créé` });
        onCreated();
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
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Nouveau code promo</DialogTitle>
        <DialogDescription>
          Les codes sont insensibles à la casse côté user (saisi en majuscules
          ici).
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-3">
        <div>
          <Label htmlFor="code" className="text-xs">
            Code (3-40 chars, A-Z 0-9 _ -)
          </Label>
          <Input
            id="code"
            value={code}
            onChange={(e) =>
              setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''))
            }
            placeholder="EX: WELCOME10"
            className="mt-1.5 font-mono"
            maxLength={40}
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Type de discount</Label>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              <TypeButton
                active={type === 'percent'}
                onClick={() => setType('percent')}
                label="Pourcentage"
                sub="ex. -10%"
              />
              <TypeButton
                active={type === 'fixed'}
                onClick={() => setType('fixed')}
                label="Montant fixe"
                sub="ex. -200€"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="value" className="text-xs">
              Valeur ({type === 'percent' ? '%' : '€'})
            </Label>
            <Input
              id="value"
              type="number"
              min={0}
              max={type === 'percent' ? 100 : 100000}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="mt-1.5 tabular-nums"
            />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <Label htmlFor="until" className="text-xs">
              Expire le{' '}
              <span className="text-[var(--color-text-faint)]">
                (optionnel)
              </span>
            </Label>
            <Input
              id="until"
              type="date"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="max" className="text-xs">
              Max utilisations{' '}
              <span className="text-[var(--color-text-faint)]">
                (optionnel)
              </span>
            </Label>
            <Input
              id="max"
              type="number"
              min={1}
              max={100000}
              value={maxUses}
              onChange={(e) => setMaxUses(e.target.value)}
              placeholder="Illimité si vide"
              className="mt-1.5 tabular-nums"
            />
          </div>
        </div>

        <div>
          <Label className="text-xs">Applicable à</Label>
          <div className="mt-1.5 grid grid-cols-3 gap-2">
            <TypeButton
              active={mode === 'all'}
              onClick={() => setMode('all')}
              label="Tout"
              sub="Distance + Dubaï"
            />
            <TypeButton
              active={mode === 'remote'}
              onClick={() => setMode('remote')}
              label="Distance"
              sub="1500€"
            />
            <TypeButton
              active={mode === 'onsite'}
              onClick={() => setMode('onsite')}
              label="Dubaï"
              sub="3500€"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="notes" className="text-xs">
            Notes internes{' '}
            <span className="text-[var(--color-text-faint)]">
              (optionnel, non visible user)
            </span>
          </Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Ex: Partenaire influencer @xyz, offre Black Friday, etc."
            className="mt-1.5 text-sm"
          />
        </div>
      </div>

      <DialogFooter>
        <Button onClick={submit} disabled={pending || !code}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          <Tag className="h-4 w-4" />
          Créer le code
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function TypeButton({
  active,
  onClick,
  label,
  sub,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  sub: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? 'rounded-[var(--radius-md)] border border-[var(--color-accent)] bg-[var(--color-accent)]/10 px-3 py-2 text-left'
          : 'rounded-[var(--radius-md)] border border-[var(--color-border)] bg-transparent px-3 py-2 text-left hover:bg-[var(--color-surface-tint)]'
      }
    >
      <div className="text-sm font-medium">{label}</div>
      <div className="text-[10px] text-[var(--color-text-dim)]">{sub}</div>
    </button>
  );
}
