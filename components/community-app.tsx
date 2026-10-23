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
import { Registration } from '@/components/registration';
import { SettingsSection } from '@/components/settings-section';
import type { CommunityUser } from '@/lib/community-types';
import type { CommunityPrediction } from '@/lib/community-types';
import type { FootballDataPayload } from '@/lib/football-data-types';
import { applyKickoffOverrides, type KickoffOverrides } from '@/lib/kickoff-shared';
import type { PredictionDraft } from '@/lib/prediction-types';
import type { MvpOverride } from '@/components/sections';
import { applyLocalPostponements, getNextLevanteMatch, withLocalMatchIds } from '@/lib/levante-services';
import { levanteMatches, type LevanteMatchReport } from '@/lib/levante-data';
import { communityFetch } from '@/lib/community-client';
import type { CommunityHero, CommunityIdentity } from '@/lib/community-identity';
export function CommunityApp({ identity, hero }: { identity: CommunityIdentity; hero: CommunityHero | null }) {
  const [active, setActive] = useState<SectionId>('inicio');
  const [predictionOpen, setPredictionOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [predictionRevision, setPredictionRevision] = useState(0);
  const [user, setUser] = useState<CommunityUser | null>(null);
  const [currentPrediction, setCurrentPrediction] = useState<PredictionDraft | null>(null);
  const [footballData, setFootballData] = useState<FootballDataPayload | null>(null);
  const [myPredictions, setMyPredictions] = useState<CommunityPrediction[]>([]);
  const scheduleMatches = footballData?.matches.length ? withLocalMatchIds(footballData.matches) : levanteMatches;
  // Se recalcula cada segundo para que, al vencer el plazo, todo pase a apuntar al siguiente partido sin recargar.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const nextMatch = getNextLevanteMatch(scheduleMatches, now);
  const [mvpOverrides, setMvpOverrides] = useState<MvpOverride[] | null>(null);
  const [officialReports, setOfficialReports] = useState<Record<number, LevanteMatchReport>>({});
  useEffect(() => {
    const saved = myPredictions.find((prediction) => prediction.matchId === nextMatch?.id);
    setCurrentPrediction(saved ? {
      matchId: saved.matchId,
      predictedScore: { home: saved.homeScore, away: saved.awayScore },
      lineup: saved.lineup,
      scorers: saved.scorers,
      mvp: saved.mvp,
    } : null);
  }, [myPredictions, nextMatch?.id]);
  useEffect(() => {
    void communityFetch('/api/session')
      .then(
        async (response) =>
          (await response.json()) as { user: CommunityUser | null },
      )
      .then((result) => setUser(result.user))
      .catch(() => setUser(null));
    void communityFetch('/api/predictions?mine=1')
      .then(async (response) => (await response.json()) as { predictions?: CommunityPrediction[] })
      .then((result) => setMyPredictions(result.predictions ?? []))
      .catch(() => setMyPredictions([]));
    // Las horas de inicio fijadas desde el admin mandan sobre las del calendario oficial (y sobre las locales si la API no responde).
    const kickoffs = fetch('/api/kickoffs', { cache: 'no-store' })
      .then(async (response) => ((await response.json()) as { overrides?: KickoffOverrides }).overrides ?? {})
      .catch(() => ({}) as KickoffOverrides);
    void Promise.all([
      fetch('/api/football')
        .then(async (response) => {
          if (!response.ok) throw new Error('Football data unavailable');
          return (await response.json()) as FootballDataPayload;
        })
        .catch(() => null),
      kickoffs,
    ]).then(([data, overrides]) => {
      if (data) return setFootballData({ ...data, matches: applyKickoffOverrides(applyLocalPostponements(data.matches), overrides) });
      // Sin calendario oficial: si hay horas guardadas se aplican sobre el calendario local (sin clasificacion: la pantalla usa la suya).
      setFootballData(Object.keys(overrides).length ? { matches: applyKickoffOverrides(levanteMatches, overrides), standings: [], currentMatchday: null, updatedAt: new Date().toISOString() } : null);
    });
    void communityFetch('/api/mvp')
      .then(async (response) => (await response.json()) as { overrides?: MvpOverride[] })
      .then((result) => setMvpOverrides(result.overrides ?? []))
      .catch(() => setMvpOverrides([]));
    void communityFetch('/api/reports')
      .then(async (response) => (await response.json()) as { reports?: Array<{ matchday: number; report: LevanteMatchReport }> })
      .then((result) => setOfficialReports(Object.fromEntries((result.reports ?? []).map((item) => [item.matchday, item.report]))))
      .catch(() => setOfficialReports({}));
  }, []);
  const predict = () => setPredictionOpen(true);
  const navigate = (section: SectionId) => {
    setActive(section);
  };
  return (
    <>
    <AppShell
      active={active}
      identity={identity}
      navigate={navigate}
      user={user}
      onLogin={() => setLoginOpen(true)}
      onLogout={async () => {
        await communityFetch('/api/session', { method: 'DELETE' });
        setUser(null);
        setCurrentPrediction(null);
        setActive('inicio');
      }}
    >
      {active === 'inicio' && (
        <HomeSection
          predict={predict}
          hasPrediction={currentPrediction?.matchId === nextMatch?.id}
          openRules={() => setActive('reglas')}
          user={user}
          hero={hero}
          footballData={footballData}
          mvpOverrides={mvpOverrides}
        />
      )}{' '}
      {active === 'jornada' && (
        <MatchdaySection footballData={footballData} mvpOverrides={mvpOverrides} officialReports={officialReports} />
      )}{' '}
      {active === 'grada' && (
        <StandsSection
          key={predictionRevision}
          user={user}
          onEdit={(prediction) => {
            setCurrentPrediction(prediction);
            setPredictionOpen(true);
          }}
        />
      )}
      {active === 'clasificacion' && <CommunityRankingSection user={user} />}
      {active === 'reglas' && <GameRulesSection />}
      {active === 'perfil' && (
        <ProfileSection
          user={user}
          openSettings={() => setActive('ajustes')}
          onUserUpdated={setUser}
        />
      )}
      {active === 'ajustes' && (
        <SettingsSection
          user={user}
          onUserUpdated={setUser}
          onBack={() => setActive('perfil')}
          onLogout={async () => {
            await communityFetch('/api/session', { method: 'DELETE' });
            setUser(null);
            setCurrentPrediction(null);
            setActive('inicio');
          }}
        />
      )}
    </AppShell>
    <PredictionWizard
      match={nextMatch}
      open={predictionOpen}
      onOpenChange={setPredictionOpen}
      user={user}
      existingPrediction={currentPrediction}
      onRegistered={setUser}
      onSaved={(prediction) => {
        setCurrentPrediction(prediction);
        setPredictionRevision((revision) => revision + 1);
      }}
      onPublished={() => {
        setPredictionOpen(false);
        setActive('grada');
      }}
    />
    <Registration
      open={loginOpen}
      onOpenChange={setLoginOpen}
      onRegistered={(registeredUser) => {
        setUser(registeredUser);
        setLoginOpen(false);
      }}
    />
    </>
  );
}
