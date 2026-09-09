'use client';
import { useEffect, useState } from 'react';
import { AppShell, type SectionId } from '@/components/app-shell';
import {
  HomeSection,
  GameRulesSection,
  MatchdaySection,
  StandsSection,
  CommunityRankingSection,
  ProfileSection,
} from '@/components/sections';
import { PredictionWizard } from '@/components/prediction-wizard';
import type { CommunityUser } from '@/lib/community-types';
import type { FootballDataPayload } from '@/lib/football-data-types';
export default function Home() {
  const [active, setActive] = useState<SectionId>('inicio');
  const [predictionOpen, setPredictionOpen] = useState(false);
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
  const predict = () => setPredictionOpen(true);
  const navigate = (section: SectionId) => {
    if (section === 'predice') return setPredictionOpen(true);
    setActive(section);
  };
  return (
    <>
    <AppShell active={active} navigate={navigate}>
      {active === 'inicio' && (
        <HomeSection
          predict={predict}
          openRules={() => setActive('reglas')}
          footballData={footballData}
        />
      )}{' '}
      {active === 'jornada' && (
        <MatchdaySection predict={predict} footballData={footballData} />
      )}{' '}
      {active === 'grada' && <StandsSection />}
      {active === 'clasificacion' && <CommunityRankingSection />}
      {active === 'reglas' && <GameRulesSection predict={predict} />}
      {active === 'perfil' && <ProfileSection user={user} />}
    </AppShell>
    <PredictionWizard
      open={predictionOpen}
      onOpenChange={setPredictionOpen}
      user={user}
      onRegistered={setUser}
      onPublished={() => {
        setPredictionOpen(false);
        setActive('grada');
      }}
    />
    </>
  );
}
