'use client';

import Link from 'next/link';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin, Pencil, Wifi } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from '@/components/ui/use-toast';
import { adminUpdateFormationAction } from '@/lib/actions/admin';
import { cn, formatPrice } from '@/lib/utils';

export interface FormationRow {
  id: string;
  title: string;
  slug: string;
  mode: 'remote' | 'onsite';
  priceEur: number;
  durationDays: number;
  dailyCapacity: number;
  active: boolean;
}

/**
 * Vue liste allégée des formations (style table compacte).
 * Édition via page dédiée /admin/formations/[id], pas de modale.
 * Toggle "actif" se fait inline (action rapide) — les autres champs
 * passent par la page d'édition.
 */
export function FormationsTable({ items }: { items: FormationRow[] }) {
  if (items.length === 0) {
    return (
      <div className="glass rounded-[var(--radius-lg)] p-10 text-center">
        <p className="text-sm text-[var(--color-text-dim)]">
          Aucune formation. Crée la première via{' '}
          <Link
            href="/admin/formations/new"
            className="text-[var(--color-accent-hover)] hover:underline"
          >
            Nouvelle formation
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="glass rounded-[var(--radius-lg)] overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Formation</TableHead>
            <TableHead>Type</TableHead>
            <TableHead className="text-right">Prix</TableHead>
            <TableHead className="text-right">Durée</TableHead>
            <TableHead className="text-right">Places / jour</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((f) => (
            <FormationRowItem key={f.id} formation={f} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function FormationRowItem({ formation: f }: { formation: FormationRow }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const Icon = f.mode === 'onsite' ? MapPin : Wifi;

  function toggleActive() {
    start(async () => {
      const result = await adminUpdateFormationAction({
        formationId: f.id,
        active: !f.active,
      });
      if (result.success) {
        toast({
          title: f.active ? '✓ Désactivée' : '✓ Activée',
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

  return (
    <TableRow className={cn(!f.active && 'opacity-60')}>
      <TableCell>
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            className={cn(
              'inline-flex h-7 w-7 items-center justify-center rounded-md border flex-shrink-0',
              f.mode === 'onsite'
                ? 'bg-amber-400/15 border-amber-400/30 text-amber-300 light:text-amber-700'
                : 'bg-indigo-500/15 border-indigo-500/30 text-indigo-300 light:text-indigo-700'
            )}
          >
            <Icon className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0">
            <div className="text-sm font-medium truncate">{f.title}</div>
            <div className="text-[10px] font-mono text-[var(--color-text-faint)] truncate">
              /{f.slug}
            </div>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <Badge variant={f.mode === 'onsite' ? 'gold' : 'default'}>
          {f.mode === 'onsite' ? 'Présentiel' : 'Distance'}
        </Badge>
      </TableCell>
      <TableCell className="text-right font-mono tabular-nums text-sm">
        {formatPrice(f.priceEur)}
      </TableCell>
      <TableCell className="text-right font-mono tabular-nums text-sm">
        {f.durationDays} j
      </TableCell>
      <TableCell className="text-right font-mono tabular-nums text-sm">
        {f.dailyCapacity}
      </TableCell>
      <TableCell>
        <button
          type="button"
          onClick={toggleActive}
          disabled={pending}
          className="inline-flex items-center gap-2 group"
          aria-label={f.active ? 'Désactiver' : 'Activer'}
        >
          <span
            className={cn(
              'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
              f.active
                ? 'bg-emerald-500'
                : 'bg-[var(--color-surface-tint-strong)]'
            )}
          >
            <span
              className={cn(
                'inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform',
                f.active ? 'translate-x-[18px]' : 'translate-x-1'
              )}
            />
          </span>
          <span className="text-xs text-[var(--color-text-dim)] group-hover:text-[var(--color-text)]">
            {f.active ? 'Active' : 'Inactive'}
          </span>
        </button>
      </TableCell>
      <TableCell className="text-right">
        <Button
          size="sm"
          variant="secondary"
          asChild
          className="gap-1.5 h-8"
        >
          <Link href={`/admin/formations/${f.id}`}>
            <Pencil className="h-3.5 w-3.5" />
            Modifier
          </Link>
        </Button>
      </TableCell>
    </TableRow>
  );
}
