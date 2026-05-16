import Link from 'next/link';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { requireAuth } from '@/lib/auth/server';
import { Section, SectionHeader } from '@/components/shared/section';
import { Badge } from '@/components/ui/badge';
import { getWheelStatus, WHEEL_SEGMENTS } from '@/lib/games/wheel';
import { db } from '@/lib/db';
import { gameWheelSpins } from '@/lib/db/schema';
import { desc, eq } from 'drizzle-orm';
import { WheelSpinner } from '@/components/games/wheel-spinner';
import { TelegramBackButton } from '@/components/mini/telegram-controls';

export const dynamic = 'force-dynamic';

export default async function RouePage() {
  const { user } = await requireAuth();
  const [status, recent] = await Promise.all([
    getWheelStatus(user.id),
    db
      .select()
      .from(gameWheelSpins)
      .where(eq(gameWheelSpins.userId, user.id))
      .orderBy(desc(gameWheelSpins.spunAt))
      .limit(10),
  ]);

  return (
    <>
      <TelegramBackButton />
      <Section className="pt-10 pb-3">
        <div className="flex items-center gap-2 text-xs text-[var(--color-text-dim)] mb-4">
          <Link
            href="/jeux"
            className="inline-flex items-center gap-1 hover:text-[var(--color-text)]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Jeux
          </Link>
        </div>
        <SectionHeader
          eyebrow="Roue de la fortune"
          title={
            <>
              Un spin par semaine,{' '}
              <span className="font-serif italic">toujours gagnant.</span>
            </>
          }
          description="XP, jackpot 1000 XP, ou codes promo formation. Pas de cases vides — chaque tour donne quelque chose."
          align="left"
        />
      </Section>

      <Section className="py-4">
        <WheelSpinner
          segments={WHEEL_SEGMENTS}
          canSpin={status.canSpin}
          nextSpinAt={status.nextSpinAt?.toISOString() ?? null}
        />
      </Section>

      {recent.length > 0 && (
        <Section className="py-4">
          <h3 className="text-sm uppercase tracking-wider text-[var(--color-text-faint)] mb-3">
            Mes derniers tours
          </h3>
          <div className="glass rounded-[var(--radius-md)] divide-y divide-[var(--color-border)]">
            {recent.map((r) => (
              <div
                key={r.id}
                className="px-4 py-3 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3">
                  <Sparkles className="h-4 w-4 text-amber-300" />
                  <div>
                    <div className="text-sm">{r.rewardLabel}</div>
                    {r.rewardType === 'promo' && r.rewardValue && (
                      <code className="text-[10px] font-mono text-[var(--color-accent-hover)]">
                        {r.rewardValue}
                      </code>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {r.rewardType === 'promo' && (
                    <Badge variant="gold" className="text-[10px]">
                      Code
                    </Badge>
                  )}
                  <span className="text-[10px] text-[var(--color-text-faint)] font-mono">
                    {new Date(r.spunAt).toLocaleDateString('fr-FR')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}
    </>
  );
}
