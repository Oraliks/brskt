import { count, eq } from 'drizzle-orm';
import { unstable_cache } from 'next/cache';
import { MeshBackground } from '@/components/landing/mesh-background';
import { LandingNav } from '@/components/landing/landing-nav';
import { LandingShell } from '@/components/landing/landing-shell';
import { HeroSection } from '@/components/landing/sections/hero-section';
import { FormationsSection } from '@/components/landing/sections/formations-section';
import { VipSection } from '@/components/landing/sections/vip-section';
import { CtaSection } from '@/components/landing/sections/cta-section';
import { getSession } from '@/lib/auth/server';
import { db } from '@/lib/db';
import { manualIronfxStatus } from '@/lib/db/schema';

const LABELS = ['Accueil', 'Groupe VIP', 'Formation', 'Rejoindre'];

/**
 * Compteur "X membres qualifiés" — social proof sur la landing.
 * Cache 1h : le count est stable, pas besoin de hit DB à chaque view.
 * Fail-safe : retourne 0 si la DB est inaccessible (la section masque le
 * compteur quand count = 0, donc pas d'effet visible négatif).
 */
const getQualifiedVipCount = unstable_cache(
  async (): Promise<number> => {
    try {
      const result = await db
        .select({ c: count() })
        .from(manualIronfxStatus)
        .where(eq(manualIronfxStatus.cpaQualified, true));
      return result[0]?.c ?? 0;
    } catch (err) {
      console.error('[landing] qualifiedVipCount fetch failed', err);
      return 0;
    }
  },
  ['vip-qualified-count'],
  { revalidate: 3600, tags: ['vip-qualified-count'] }
);

export default async function HomePage() {
  const [session, qualifiedVipCount] = await Promise.all([
    getSession().catch(() => null),
    getQualifiedVipCount(),
  ]);

  return (
    <>
      <MeshBackground />
      <LandingShell labels={LABELS} nav={<LandingNav authenticated={Boolean(session?.user)} />}>
        <HeroSection />
        <VipSection qualifiedCount={qualifiedVipCount} />
        <FormationsSection />
        <CtaSection />
      </LandingShell>
    </>
  );
}
