'use client';
import { useEffect, useState } from 'react';
import { AppShell, type SectionId } from '@/components/app-shell';
import {
  HomeSection,
  MatchdaySection,
  PredictSection,
  StandsSection,
  ProfileSection,
} from '@/components/sections';
import type { CommunityUser } from '@/lib/community-types';
import type { FootballDataPayload } from '@/lib/football-data-types';
export default function Home() {
  const [active, setActive] = useState<SectionId>('inicio');
  const [user, setUser] = useState<CommunityUser | null>(null);
  const [footballData, setFootballData] = useState<FootballDataPayload | null>(null);
  useEffect(() => {
    void fetch('/api/session')
      .then(
        async (response) =>
          (await response.json()) as { user: CommunityUser | null },
      )
      .then((result) => setUser(result.user))
      .catch(() => setUser(null));
    void fetch('/api/football')
      .then(async (response) => {
        if (!response.ok) throw new Error('Football data unavailable');
        return (await response.json()) as FootballDataPayload;
      })
      .then(setFootballData)
      .catch(() => setFootballData(null));
  }, []);
  const predict = () => setActive('predice');
  return (
    <AppShell active={active} navigate={setActive}>
      {active === 'inicio' && (
        <HomeSection predict={predict} footballData={footballData} />
      )}{' '}
      {active === 'jornada' && (
        <MatchdaySection predict={predict} footballData={footballData} />
      )}{' '}
      {active === 'predice' && (
        <PredictSection user={user} onRegistered={setUser} />
      )}
      {active === 'grada' && <StandsSection />}
      {active === 'perfil' && <ProfileSection user={user} />}
    </AppShell>
  );
}
