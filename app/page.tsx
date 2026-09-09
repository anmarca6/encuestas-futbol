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
import { SettingsSection } from '@/components/settings-section';
import type { CommunityUser } from '@/lib/community-types';
import type { CommunityPrediction } from '@/lib/community-types';
import type { FootballDataPayload } from '@/lib/football-data-types';
import type { PredictionDraft } from '@/lib/prediction-types';
import { getNextLevanteMatch } from '@/lib/levante-services';
export default function Home() {
  const [active, setActive] = useState<SectionId>('inicio');
  const [predictionOpen, setPredictionOpen] = useState(false);
  const [user, setUser] = useState<CommunityUser | null>(null);
  const [currentPrediction, setCurrentPrediction] = useState<PredictionDraft | null>(null);
  const [footballData, setFootballData] = useState<FootballDataPayload | null>(null);
  useEffect(() => {
    void fetch('/api/session')
      .then(
        async (response) =>
          (await response.json()) as { user: CommunityUser | null },
      )
      .then((result) => setUser(result.user))
      .catch(() => setUser(null));
    void fetch('/api/predictions?mine=1')
      .then(async (response) => (await response.json()) as { predictions?: CommunityPrediction[] })
      .then((result) => {
        const matchId = getNextLevanteMatch()?.id;
        const saved = result.predictions?.find((prediction) => prediction.matchId === matchId);
        setCurrentPrediction(saved ? {
          matchId: saved.matchId,
          predictedScore: { home: saved.homeScore, away: saved.awayScore },
          lineup: saved.lineup,
          scorers: saved.scorers,
          mvp: saved.mvp,
        } : null);
      })
      .catch(() => setCurrentPrediction(null));
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
    setActive(section);
  };
  return (
    <>
    <AppShell active={active} navigate={navigate}>
      {active === 'inicio' && (
        <HomeSection
          predict={predict}
          hasPrediction={currentPrediction?.matchId === getNextLevanteMatch()?.id}
          openRules={() => setActive('reglas')}
          footballData={footballData}
        />
      )}{' '}
      {active === 'jornada' && (
        <MatchdaySection footballData={footballData} />
      )}{' '}
      {active === 'grada' && <StandsSection />}
      {active === 'clasificacion' && <CommunityRankingSection />}
      {active === 'reglas' && <GameRulesSection />}
      {active === 'perfil' && <ProfileSection user={user} openSettings={() => setActive('ajustes')} />}
      {active === 'ajustes' && (
        <SettingsSection
          onBack={() => setActive('perfil')}
          onLogout={async () => {
            await fetch('/api/session', { method: 'DELETE' });
            setUser(null);
            setCurrentPrediction(null);
            setActive('inicio');
          }}
        />
      )}
    </AppShell>
    <PredictionWizard
      open={predictionOpen}
      onOpenChange={setPredictionOpen}
      user={user}
      existingPrediction={currentPrediction}
      onRegistered={setUser}
      onSaved={setCurrentPrediction}
      onPublished={() => {
        setPredictionOpen(false);
        setActive('grada');
      }}
    />
    </>
  );
}
