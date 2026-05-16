import { and, count, eq, isNotNull } from 'drizzle-orm';
import { Megaphone } from 'lucide-react';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import {
  AdminContainer,
  AdminPageHeader,
} from '@/components/admin/page-header';
import { BroadcastForm } from '@/components/admin/broadcast-form';

export const dynamic = 'force-dynamic';

export default async function AdminBroadcastPage() {
  // Compte les destinataires potentiels par audience pour aider l'admin à
  // choisir. Filtre toujours sur isNotNull(email) — pas d'envoi sans email.
  const [briefingRow, eventsRow, onboardedRow] = await Promise.all([
    db
      .select({ c: count() })
      .from(users)
      .where(and(isNotNull(users.email), eq(users.botSubscribedBriefing, true))),
    db
      .select({ c: count() })
      .from(users)
      .where(and(isNotNull(users.email), eq(users.botSubscribedEvents, true))),
    db
      .select({ c: count() })
      .from(users)
      .where(
        and(
          isNotNull(users.email),
          isNotNull(users.onboardingCompletedAt)
        )
      ),
  ]);

  return (
    <AdminContainer>
      <AdminPageHeader
        title="Email broadcast"
        description="Envoie un email à un segment d'utilisateurs. Toujours tester avant l'envoi réel — l'opération est irréversible."
        actions={
          <span className="inline-flex items-center gap-1.5 text-xs text-[var(--color-text-dim)]">
            <Megaphone className="h-3.5 w-3.5" />
            Outil interne
          </span>
        }
      />

      <div className="glass rounded-[var(--radius-lg)] p-5 md:p-6">
        <BroadcastForm
          estimates={{
            briefing: briefingRow[0]?.c ?? 0,
            events: eventsRow[0]?.c ?? 0,
            all_onboarded: onboardedRow[0]?.c ?? 0,
          }}
        />
      </div>
    </AdminContainer>
  );
}
