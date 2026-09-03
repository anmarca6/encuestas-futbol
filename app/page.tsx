'use client';
import { useEffect, useState } from 'react';
import { AppShell, type SectionId } from '@/components/app-shell';
import { Registration } from '@/components/registration';
import {
  HomeSection,
  MatchdaySection,
  PredictSection,
  StandsSection,
  ProfileSection,
} from '@/components/sections';
import type { CommunityUser } from '@/lib/community-types';
export default function Home() {
  const [active, setActive] = useState<SectionId>('inicio');
  const [user, setUser] = useState<CommunityUser | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    void fetch('/api/session')
      .then(async (response) => (await response.json()) as { user: CommunityUser | null })
      .then((result) => setUser(result.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);
  const predict = () => setActive('predice');
  if (loading)
    return <div className="grid min-h-screen place-items-center bg-[#071527] font-black text-white">Cargando Granota App…</div>;
  if (!user) return <Registration onRegistered={setUser} />;
  return (
    <AppShell active={active} navigate={setActive}>
      {active === 'inicio' && <HomeSection predict={predict} />}{' '}
      {active === 'jornada' && <MatchdaySection predict={predict} />}{' '}
      {active === 'predice' && <PredictSection />}
      {active === 'grada' && <StandsSection />}
      {active === 'perfil' && <ProfileSection user={user} />}
    </AppShell>
  );
}
