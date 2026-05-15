'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, MapPin, Wifi } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';
import { adminUpdateFormationAction } from '@/lib/actions/admin';
import { cn, formatPrice } from '@/lib/utils';

export interface FormationItem {
  id: string;
  title: string;
  slug: string;
  mode: 'remote' | 'onsite';
  description: string;
  priceEur: number;
  durationDays: number;
  dailyCapacity: number;
  active: boolean;
}

interface Props {
  items: FormationItem[];
}

export function FormationsAdminList({ items }: Props) {
  return (
    <div className="space-y-4">
      {items.map((f) => (
        <FormationCard key={f.id} initial={f} />
      ))}
    </div>
  );
}

function FormationCard({ initial }: { initial: FormationItem }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description);
  const [priceEur, setPriceEur] = useState(String(initial.priceEur));
  const [durationDays, setDurationDays] = useState(String(initial.durationDays));
  const [dailyCapacity, setDailyCapacity] = useState(String(initial.dailyCapacity));
  const [active, setActive] = useState(initial.active);

  const Icon = initial.mode === 'onsite' ? MapPin : Wifi;
  const dirty =
    title !== initial.title ||
    description !== initial.description ||
    Number(priceEur) !== initial.priceEur ||
    Number(durationDays) !== initial.durationDays ||
    Number(dailyCapacity) !== initial.dailyCapacity ||
    active !== initial.active;

  function save() {
    const priceNum = Number(priceEur);
    const durNum = Number(durationDays);
    const capNum = Number(dailyCapacity);
    if (!Number.isFinite(priceNum) || priceNum < 0) {
      toast({ title: 'Prix invalide', variant: 'destructive' });
      return;
    }
    if (!Number.isFinite(durNum) || durNum < 1 || durNum > 60) {
      toast({ title: 'Durée invalide (1-60 jours)', variant: 'destructive' });
      return;
    }
    if (!Number.isFinite(capNum) || capNum < 1 || capNum > 50) {
      toast({ title: 'Capacité invalide (1-50)', variant: 'destructive' });
      return;
    }
    start(async () => {
      const result = await adminUpdateFormationAction({
        formationId: initial.id,
        title,
        description,
        priceEur: priceNum,
        durationDays: durNum,
        dailyCapacity: capNum,
        active,
      });
      if (result.success) {
        toast({ title: '✓ Formation mise à jour' });
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
    <div
      className={cn(
        'glass rounded-[var(--radius-lg)] p-5 space-y-4 transition-opacity',
        !active && 'opacity-70'
      )}
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <span
            className={cn(
              'inline-flex h-10 w-10 items-center justify-center rounded-md border',
              initial.mode === 'onsite'
                ? 'bg-amber-400/15 border-amber-400/30 text-amber-300 light:text-amber-700'
                : 'bg-indigo-500/15 border-indigo-500/30 text-indigo-300 light:text-indigo-700'
            )}
          >
            <Icon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-semibold truncate">
                {initial.title}
              </h3>
              <Badge variant={initial.mode === 'onsite' ? 'gold' : 'default'}>
                {initial.mode === 'onsite' ? 'Présentiel' : 'Distance'}
              </Badge>
              {!active && <Badge variant="danger">Désactivée</Badge>}
            </div>
            <div className="text-xs text-[var(--color-text-faint)] font-mono mt-0.5">
              slug: {initial.slug}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--color-text-dim)]">
            {active ? 'Active' : 'Inactive'}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={active}
            onClick={() => setActive((v) => !v)}
            className={cn(
              'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
              active ? 'bg-emerald-500' : 'bg-[var(--color-surface-tint-strong)]'
            )}
          >
            <span
              className={cn(
                'inline-block h-4 w-4 rounded-full bg-white transition-transform',
                active ? 'translate-x-6' : 'translate-x-1'
              )}
            />
          </button>
        </div>
      </div>

      <div className="grid sm:grid-cols-[1fr_120px_120px_120px] gap-3">
        <div>
          <Label htmlFor={`title-${initial.id}`} className="text-xs">
            Titre
          </Label>
          <Input
            id={`title-${initial.id}`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1.5"
          />
        </div>
        <div>
          <Label htmlFor={`price-${initial.id}`} className="text-xs">
            Prix (€)
          </Label>
          <Input
            id={`price-${initial.id}`}
            type="number"
            min={0}
            step={50}
            value={priceEur}
            onChange={(e) => setPriceEur(e.target.value)}
            className="mt-1.5 tabular-nums"
          />
        </div>
        <div>
          <Label htmlFor={`dur-${initial.id}`} className="text-xs">
            Durée (jours)
          </Label>
          <Input
            id={`dur-${initial.id}`}
            type="number"
            min={1}
            max={60}
            value={durationDays}
            onChange={(e) => setDurationDays(e.target.value)}
            className="mt-1.5 tabular-nums"
          />
        </div>
        <div>
          <Label htmlFor={`cap-${initial.id}`} className="text-xs">
            Places / jour
          </Label>
          <Input
            id={`cap-${initial.id}`}
            type="number"
            min={1}
            max={50}
            value={dailyCapacity}
            onChange={(e) => setDailyCapacity(e.target.value)}
            className="mt-1.5 tabular-nums"
            title="Capacité max de participants par jour. Au-delà, l'admin doit forcer."
          />
        </div>
      </div>

      <div>
        <Label htmlFor={`desc-${initial.id}`} className="text-xs">
          Description
        </Label>
        <Textarea
          id={`desc-${initial.id}`}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          maxLength={2000}
          className="mt-1.5 text-sm"
        />
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap pt-2 border-t border-[var(--color-border)]">
        <div className="text-xs text-[var(--color-text-faint)]">
          Prix actuel sur le site :{' '}
          <strong className="text-[var(--color-text)]">
            {formatPrice(Number(priceEur))}
          </strong>
          {dirty && (
            <span className="ml-2 text-amber-300 light:text-amber-700">
              · non sauvegardé
            </span>
          )}
        </div>
        <Button size="sm" onClick={save} disabled={!dirty || pending}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          Enregistrer
        </Button>
      </div>
    </div>
  );
}
