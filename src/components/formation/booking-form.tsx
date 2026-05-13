'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, MapPin, Plus, Trash2, Wifi } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';
import { createBookingAction } from '@/lib/actions/bookings';
import { formatPrice, cn } from '@/lib/utils';
import type { Formation } from '@/lib/db/schema';

interface BookingFormProps {
  formations: Formation[];
  defaultMode?: string;
}

type Slot = { start: string; end: string };

export function BookingForm({ formations, defaultMode }: BookingFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const initialFormation =
    formations.find(
      (f) =>
        (defaultMode === 'remote' && f.mode === 'remote') ||
        (defaultMode === 'onsite' && f.mode === 'onsite') ||
        defaultMode === f.slug
    ) ?? formations[0];

  const [formationId, setFormationId] = useState<string | undefined>(
    initialFormation?.id
  );
  const [slots, setSlots] = useState<Slot[]>([{ start: '', end: '' }]);
  const [asap, setAsap] = useState(false);
  const [notes, setNotes] = useState('');

  const selected = formations.find((f) => f.id === formationId);

  function addSlot() {
    if (slots.length >= 3) return;
    setSlots((s) => [...s, { start: '', end: '' }]);
  }

  function removeSlot(idx: number) {
    setSlots((s) => s.filter((_, i) => i !== idx));
  }

  function updateSlot(idx: number, field: 'start' | 'end', value: string) {
    setSlots((s) =>
      s.map((slot, i) => (i === idx ? { ...slot, [field]: value } : slot))
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formationId) {
      toast({ title: 'Choisis une formation', variant: 'destructive' });
      return;
    }

    const validSlots = slots.filter((s) => s.start && s.end);

    if (validSlots.length === 0 && !asap) {
      toast({
        title: 'Propose au moins un créneau',
        description: 'Ou coche "Dès que possible".',
        variant: 'destructive',
      });
      return;
    }

    startTransition(async () => {
      const result = await createBookingAction({
        formationId,
        preferredDates: validSlots,
        preferredAsap: asap,
      });

      if (result.success) {
        toast({
          title: '✓ Demande envoyée',
          description: 'On revient vers toi sous 24h pour valider les dates.',
        });
        router.push('/dashboard');
      } else {
        toast({
          title: 'Erreur',
          description: result.error,
          variant: 'destructive',
        });
      }
    });
  }

  // Min date = aujourd'hui (YYYY-MM-DD)
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Choix formation */}
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium mb-3 block">
          1. Format
        </legend>
        <div className="grid sm:grid-cols-2 gap-3">
          {formations.map((f) => (
            <label
              key={f.id}
              className={cn(
                'glass rounded-[var(--radius-lg)] p-5 cursor-pointer transition-all hover:border-white/14',
                formationId === f.id &&
                  'border-[var(--color-accent)] bg-[var(--color-accent)]/5'
              )}
            >
              <input
                type="radio"
                name="formation"
                value={f.id}
                checked={formationId === f.id}
                onChange={() => setFormationId(f.id)}
                className="sr-only"
              />
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Badge variant={f.mode === 'onsite' ? 'gold' : 'default'}>
                    {f.mode === 'onsite' ? (
                      <MapPin className="h-3 w-3 mr-1" />
                    ) : (
                      <Wifi className="h-3 w-3 mr-1" />
                    )}
                    {f.mode === 'onsite' ? 'Dubaï' : 'Distance'}
                  </Badge>
                  <h3 className="mt-3 font-semibold text-sm">{f.title}</h3>
                </div>
                <div className="text-right">
                  <div className="font-serif text-2xl text-gradient">
                    {formatPrice(Number(f.priceEur))}
                  </div>
                </div>
              </div>
            </label>
          ))}
        </div>
      </fieldset>

      {/* Créneaux préférés */}
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium mb-1 block">
          2. Tes créneaux préférés
        </legend>
        <p className="text-xs text-[var(--color-text-dim)] mb-4">
          Propose jusqu'à 3 plages de dates. On validera l'une d'elles ou on te
          proposera une alternative.
        </p>

        <div className="space-y-3">
          {slots.map((slot, idx) => (
            <div
              key={idx}
              className="glass rounded-[var(--radius-md)] p-4 grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3 items-end"
            >
              <div className="space-y-1.5">
                <Label htmlFor={`start-${idx}`} className="text-xs">
                  Début
                </Label>
                <Input
                  id={`start-${idx}`}
                  type="date"
                  min={today}
                  value={slot.start}
                  onChange={(e) => updateSlot(idx, 'start', e.target.value)}
                  disabled={asap}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`end-${idx}`} className="text-xs">
                  Fin
                </Label>
                <Input
                  id={`end-${idx}`}
                  type="date"
                  min={slot.start || today}
                  value={slot.end}
                  onChange={(e) => updateSlot(idx, 'end', e.target.value)}
                  disabled={asap}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeSlot(idx)}
                disabled={slots.length === 1 || asap}
                className="text-[var(--color-text-dim)]"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}

          {slots.length < 3 && !asap && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={addSlot}
              className="text-[var(--color-text-dim)]"
            >
              <Plus className="h-4 w-4" />
              Ajouter un créneau
            </Button>
          )}
        </div>

        <div className="pt-3 border-t border-[var(--color-border)]">
          <Checkbox
            label={
              <span>
                <strong>Dès que possible</strong> · ouvert à toute date proposée
                par l'équipe
              </span>
            }
            checked={asap}
            onChange={(e) => setAsap(e.target.checked)}
          />
        </div>
      </fieldset>

      {/* Notes (optionnel) */}
      <div className="space-y-2">
        <Label htmlFor="notes" className="text-sm font-medium">
          3. Note pour l'équipe <span className="text-[var(--color-text-faint)]">(optionnel)</span>
        </Label>
        <Textarea
          id="notes"
          rows={3}
          placeholder="Niveau actuel, attentes, contraintes…"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      {/* Récap */}
      {selected && (
        <div className="glass-strong rounded-[var(--radius-lg)] p-5 flex items-center justify-between">
          <div>
            <div className="text-xs text-[var(--color-text-dim)] uppercase tracking-wider">
              Total
            </div>
            <div className="font-serif text-3xl text-gradient mt-1">
              {formatPrice(Number(selected.priceEur))}
            </div>
            <p className="text-xs text-[var(--color-text-faint)] mt-1">
              Payable une fois les dates confirmées par l'équipe.
            </p>
          </div>
          <Button type="submit" size="lg" disabled={isPending}>
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {isPending ? 'Envoi…' : 'Envoyer ma demande'}
          </Button>
        </div>
      )}
    </form>
  );
}
