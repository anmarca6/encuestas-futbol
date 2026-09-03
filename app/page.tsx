'use client';
import { useState } from 'react';
import { AppShell, type SectionId } from '@/components/app-shell';
import {
  HomeSection,
  MatchdaySection,
  PredictSection,
  StandsSection,
  ProfileSection,
} from '@/components/sections';
export default function Home() {
  const [active, setActive] = useState<SectionId>('inicio');
  const predict = () => setActive('predice');
  return (
    <AppShell active={active} navigate={setActive}>
      {active === 'inicio' && <HomeSection predict={predict} />}{' '}
      {active === 'jornada' && <MatchdaySection predict={predict} />}{' '}
      {active === 'predice' && <PredictSection />}
      {active === 'grada' && <StandsSection />}
      {active === 'perfil' && <ProfileSection />}
    </AppShell>
  );
}
