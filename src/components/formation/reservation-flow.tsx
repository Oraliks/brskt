'use client';

import { useState } from 'react';
import { Clock } from 'lucide-react';
import { BookingForm } from './booking-form';
import { WaitlistFormAuth } from './waitlist-form-auth';
import type { Formation } from '@/lib/db/schema';

/**
 * Wrapper Client Component pour /formation/reserver.
 *
 * Tient le state du mode courant (transmis par BookingForm via onModeChange)
 * et le partage avec le WaitlistFormAuth. Évite la double sélection
 * Distance/Dubaï : l'utilisateur choisit une fois, la waitlist hérite.
 *
 * Ne peut pas être fait depuis un Server Component parent car on ne peut
 * pas passer une render prop fonction à travers la frontière Server→Client.
 */

interface Props {
  formations: Formation[];
  defaultMode?: string;
}

export function ReservationFlow({ formations, defaultMode }: Props) {
  const [currentMode, setCurrentMode] = useState<'remote' | 'onsite' | null>(
    null
  );

  return (
    <BookingForm
      formations={formations}
      defaultMode={defaultMode}
      onModeChange={setCurrentMode}
      slotAfterDates={
        <details className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-tint)] p-3 group">
          <summary className="cursor-pointer flex items-center justify-between gap-3 list-none">
            <div className="flex items-center gap-2.5 min-w-0">
              <Clock className="h-4 w-4 text-amber-300 light:text-amber-700 flex-shrink-0" />
              <div className="min-w-0">
                <div className="text-sm font-semibold">
                  Aucun de tes créneaux ne convient finalement ?
                </div>
                <div className="text-xs text-[var(--color-text-dim)] leading-snug">
                  Mets-toi sur la liste d&apos;attente — on te DM dès
                  qu&apos;une place s&apos;ouvre.
                </div>
              </div>
            </div>
            <span className="text-xs text-[var(--color-text-dim)] group-open:rotate-180 transition-transform flex-shrink-0">
              ▼
            </span>
          </summary>
          <div className="mt-3 pt-3 border-t border-[var(--color-border)]">
            <WaitlistFormAuth mode={currentMode} />
          </div>
        </details>
      }
    />
  );
}
