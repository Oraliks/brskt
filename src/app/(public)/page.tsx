import { MeshBackground } from '@/components/landing/mesh-background';
import { LandingNav } from '@/components/landing/landing-nav';
import { LandingShell } from '@/components/landing/landing-shell';
import { HeroSection } from '@/components/landing/sections/hero-section';
import { FormationsSection } from '@/components/landing/sections/formations-section';
import { VipSection } from '@/components/landing/sections/vip-section';
import { CtaSection } from '@/components/landing/sections/cta-section';
import { getSession } from '@/lib/auth/server';

const LABELS = ['Accueil', 'Groupe VIP', 'Formation', 'Rejoindre'];

export default async function HomePage() {
  const session = await getSession().catch(() => null);

  return (
    <>
      <MeshBackground />
      <LandingShell labels={LABELS} nav={<LandingNav authenticated={Boolean(session?.user)} />}>
        <HeroSection />
        <VipSection />
        <FormationsSection />
        <CtaSection />
      </LandingShell>
    </>
  );
}
