'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Loader2,
  MapPin,
  Save,
  Trash2,
  Wifi,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';
import {
  adminCreateFormationAction,
  adminDeleteFormationAction,
  adminUpdateFormationAction,
} from '@/lib/actions/admin';
import { cn } from '@/lib/utils';

/**
 * Formulaire d'édition / création de formation, page complète (pas une modale).
 * En mode édition, le slug et le mode sont read-only :
 *  - slug : changer l'URL publique casserait le SEO et les liens partagés
 *  - mode : changerait le sens des bookings existants (présentiel ↔ distance)
 */

export interface FormationFormInitial {
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
  /** Si fourni → mode édition. Sinon → mode création. */
  initial?: FormationFormInitial;
}

export function FormationForm({ initial }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const isEdit = !!initial;

  const [title, setTitle] = useState(initial?.title ?? '');
  const [slug, setSlug] = useState(initial?.slug ?? '');
  const [mode, setMode] = useState<'remote' | 'onsite'>(
    initial?.mode ?? 'remote'
  );
  const [description, setDescription] = useState(initial?.description ?? '');
  const [priceEur, setPriceEur] = useState(
    String(initial?.priceEur ?? '1500')
  );
  const [durationDays, setDurationDays] = useState(
    String(initial?.durationDays ?? 7)
  );
  const [dailyCapacity, setDailyCapacity] = useState(
    String(initial?.dailyCapacity ?? 3)
  );
  const [active, setActive] = useState(initial?.active ?? true);

  function submit() {
    const priceNum = Number(priceEur);
    const durNum = Number(durationDays);
    const capNum = Number(dailyCapacity);

    if (!title.trim() || title.trim().length < 3) {
      toast({ title: 'Titre trop court (3 char. min)', variant: 'destructive' });
      return;
    }
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
      if (isEdit) {
        const result = await adminUpdateFormationAction({
          formationId: initial.id,
          title: title.trim(),
          description: description.trim(),
          priceEur: priceNum,
          durationDays: durNum,
          dailyCapacity: capNum,
          active,
        });
        if (result.success) {
          toast({ title: '✓ Formation mise à jour' });
          router.push('/admin/formations');
          router.refresh();
        } else {
          toast({
            title: 'Erreur',
            description: result.error,
            variant: 'destructive',
          });
        }
      } else {
        // Validation slug uniquement en création (read-only en édition)
        const cleanSlug = slug.trim().toLowerCase();
        if (!/^[a-z0-9-]{2,80}$/.test(cleanSlug)) {
          toast({
            title: 'Slug invalide',
            description: 'Minuscules, chiffres et tirets, 2-80 caractères.',
            variant: 'destructive',
          });
          return;
        }

        const result = await adminCreateFormationAction({
          title: title.trim(),
          slug: cleanSlug,
          mode,
          description: description.trim() || undefined,
          priceEur: priceNum,
          durationDays: durNum,
          dailyCapacity: capNum,
          active,
        });
        if (result.success) {
          toast({ title: '✓ Formation créée' });
          router.push('/admin/formations');
          router.refresh();
        } else {
          toast({
            title: 'Erreur',
            description: result.error,
            variant: 'destructive',
          });
        }
      }
    });
  }

  function remove() {
    if (!isEdit) return;
    if (
      !confirm(
        `Supprimer "${initial.title}" ?\n\nSi des réservations y font référence, la suppression sera refusée — désactive la formation à la place.`
      )
    )
      return;
    start(async () => {
      const result = await adminDeleteFormationAction(initial.id);
      if (result.success) {
        toast({ title: '✓ Formation supprimée' });
        router.push('/admin/formations');
        router.refresh();
      } else {
        toast({
          title: 'Suppression refusée',
          description: result.error,
          variant: 'destructive',
        });
      }
    });
  }

  const ModeIcon = mode === 'onsite' ? MapPin : Wifi;

  return (
    <div className="space-y-5">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link href="/admin/formations">
            <ArrowLeft className="h-4 w-4" />
            Retour aux formations
          </Link>
        </Button>
      </div>

      <div className="glass rounded-[var(--radius-lg)] p-5 md:p-6 space-y-5">
        {/* Header — mode + statut */}
        <div className="flex items-start justify-between gap-3 flex-wrap pb-4 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-3 min-w-0">
            <span
              className={cn(
                'inline-flex h-10 w-10 items-center justify-center rounded-md border',
                mode === 'onsite'
                  ? 'bg-amber-400/15 border-amber-400/30 text-amber-300 light:text-amber-700'
                  : 'bg-indigo-500/15 border-indigo-500/30 text-indigo-300 light:text-indigo-700'
              )}
            >
              <ModeIcon className="h-4 w-4" />
            </span>
            <div>
              <div className="text-xs uppercase tracking-wider text-[var(--color-text-dim)]">
                {isEdit ? 'Édition formation' : 'Nouvelle formation'}
              </div>
              <Badge
                variant={mode === 'onsite' ? 'gold' : 'default'}
                className="mt-1"
              >
                {mode === 'onsite' ? 'Présentiel Dubaï' : 'Distance (visio)'}
              </Badge>
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
                active
                  ? 'bg-emerald-500'
                  : 'bg-[var(--color-surface-tint-strong)]'
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

        {/* Mode (création uniquement, immuable en édition) */}
        {!isEdit && (
          <div>
            <Label className="text-xs">Format</Label>
            <div className="mt-1.5 grid sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMode('remote')}
                className={cn(
                  'inline-flex items-center gap-2 rounded-[var(--radius-md)] border px-3 py-2 text-sm text-left',
                  mode === 'remote'
                    ? 'bg-indigo-500/10 border-indigo-500/40 text-[var(--color-text)]'
                    : 'border-[var(--color-border)] text-[var(--color-text-dim)] hover:bg-[var(--color-surface-tint)]'
                )}
              >
                <Wifi className="h-4 w-4" />
                <div>
                  <div className="font-medium">Distance</div>
                  <div className="text-[10px] opacity-70">
                    Visio Telegram, dispo internationale
                  </div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setMode('onsite')}
                className={cn(
                  'inline-flex items-center gap-2 rounded-[var(--radius-md)] border px-3 py-2 text-sm text-left',
                  mode === 'onsite'
                    ? 'bg-amber-400/10 border-amber-400/40 text-[var(--color-text)]'
                    : 'border-[var(--color-border)] text-[var(--color-text-dim)] hover:bg-[var(--color-surface-tint)]'
                )}
              >
                <MapPin className="h-4 w-4" />
                <div>
                  <div className="font-medium">Présentiel Dubaï</div>
                  <div className="text-[10px] opacity-70">
                    A/R avion non inclus
                  </div>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Titre + slug */}
        <div className="grid sm:grid-cols-[1fr_240px] gap-3">
          <div>
            <Label htmlFor="title" className="text-xs">
              Titre
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex : Formation Trading à Distance"
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="slug" className="text-xs">
              Slug (URL){' '}
              {isEdit && (
                <span className="text-[var(--color-text-faint)]">
                  · non modifiable
                </span>
              )}
            </Label>
            <Input
              id="slug"
              value={slug}
              onChange={(e) =>
                setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))
              }
              placeholder="trading-distance"
              className="mt-1.5 font-mono text-xs"
              readOnly={isEdit}
              disabled={isEdit}
            />
            <p className="mt-1 text-[10px] text-[var(--color-text-faint)]">
              /formation/<strong>{slug || '...'}</strong>
            </p>
          </div>
        </div>

        {/* Prix / Durée / Places */}
        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <Label htmlFor="price" className="text-xs">
              Prix (€)
            </Label>
            <Input
              id="price"
              type="number"
              min={0}
              step={50}
              value={priceEur}
              onChange={(e) => setPriceEur(e.target.value)}
              className="mt-1.5 tabular-nums"
            />
          </div>
          <div>
            <Label htmlFor="dur" className="text-xs">
              Durée (jours)
            </Label>
            <Input
              id="dur"
              type="number"
              min={1}
              max={60}
              value={durationDays}
              onChange={(e) => setDurationDays(e.target.value)}
              className="mt-1.5 tabular-nums"
            />
          </div>
          <div>
            <Label htmlFor="cap" className="text-xs">
              Places / jour
            </Label>
            <Input
              id="cap"
              type="number"
              min={1}
              max={50}
              value={dailyCapacity}
              onChange={(e) => setDailyCapacity(e.target.value)}
              className="mt-1.5 tabular-nums"
            />
            <p className="mt-1 text-[10px] text-[var(--color-text-faint)]">
              Capacité par jour avant warning saturation
            </p>
          </div>
        </div>

        {/* Description */}
        <div>
          <Label htmlFor="desc" className="text-xs">
            Description
          </Label>
          <Textarea
            id="desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
            maxLength={2000}
            placeholder="7 jours en visio privée. 5 modules à acquérir (Graphiques, Fondamental, Matières premières, Psychologie, Money management)."
            className="mt-1.5 text-sm"
          />
          <p className="mt-1 text-[10px] text-[var(--color-text-faint)]">
            {description.length} / 2000 caractères
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          {isEdit && (
            <Button
              variant="ghost"
              onClick={remove}
              disabled={pending}
              className="text-rose-300 light:text-rose-700"
            >
              <Trash2 className="h-4 w-4" />
              Supprimer
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" asChild>
            <Link href="/admin/formations">Annuler</Link>
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {isEdit ? 'Enregistrer' : 'Créer la formation'}
          </Button>
        </div>
      </div>
    </div>
  );
}
