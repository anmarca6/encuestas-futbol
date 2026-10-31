'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { Bell, Check, ChevronDown, ClipboardList, Copy, Globe, ImagePlus, KeyRound, Loader2, MessageSquare, Minus, Pencil, Plus, Search, Shield, Star, Trash2, UserCog, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import { LEVANTE_TEAM, matchdayLongLabel, matchdayShortLabel, levanteMatchReports, levanteMatches, levantePlayers } from '@/lib/levante-data';
import { formations, formationOptions, type SavedLineup } from '@/lib/formations';
import { resolveMvp, type MvpOverride } from '@/components/sections';
import type { FootballDataPayload } from '@/lib/football-data-types';
import { KICKOFF_TIME_PATTERN, type KickoffOverrides } from '@/lib/kickoff-shared';
import { formatPredictionDeadline } from '@/lib/prediction-deadline';
import type { AdminCommunity } from '@/lib/community-types';
import { ADMIN_USERNAME_PATTERN, MIN_ADMIN_PASSWORD_LENGTH, type AdminAccountInfo, type AdminSessionInfo } from '@/lib/admin-shared';
import { DEFAULT_COMMUNITY_SLUG, isValidCommunitySlug, slugifyCommunityName } from '@/lib/community-shared';
import {
  DEFAULT_HEADER_COLOR,
  HEADER_COLOR_PRESETS,
  HEADER_SUBTITLE_MAX,
  HEADER_TITLE_MAX,
  HERO_SUBTITLE_MAX,
  HERO_TITLE_MAX,
  headerColorWithAlpha,
  isReadableHeaderColor,
  resolveCommunityHero,
  resolveCommunityIdentity,
  type CommunityIdentity,
} from '@/lib/community-identity';
import { fitImageToDataUrl, resizeImageToDataUrl } from '@/lib/image-resize';
import { CommunityHeroCard, StandardHeroCard } from '@/components/community-hero';
import {
  DEFAULT_SOCIAL_NETWORKS,
  MAX_COMMUNITY_LINKS,
  SOCIAL_NETWORKS,
  getSocialNetwork,
  normalizeSocialUrl,
  parseCommunityLinks,
  type CommunityLink,
} from '@/lib/social-networks';

const dateFormatter = new Intl.DateTimeFormat('es-ES', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

interface AdminPrediction {
  id: string;
  userId: string;
  matchId: string;
  homeScore: number;
  awayScore: number;
  publishedAt: number;
  nickname: string;
  avatarUrl: string | null;
  communitySlug: string;
}

function LoginGate({ onAuthenticated }: { onAuthenticated: () => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(result?.error ?? 'No se pudo entrar.');
        return;
      }
      onAuthenticated();
    } catch {
      setError('No se pudo conectar. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#071527] px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl"
      >
        <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-rose-50 text-[#a91d43]">
          <Shield className="size-6" />
        </div>
        <h1 className="mt-4 text-center text-xl font-black text-[#071527]">
          Panel de administración
        </h1>
        <p className="mt-1 text-center text-sm text-slate-500">
          Acceso solo para administradores.
        </p>
        <Input
          autoFocus
          autoComplete="username"
          value={username}
          onChange={(event) => {
            setUsername(event.target.value);
            setError('');
          }}
          placeholder="Usuario"
          className="mt-6 h-12"
        />
        <Input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
            setError('');
          }}
          placeholder="Contraseña"
          className="mt-3 h-12"
        />
        {error && (
          <p role="alert" className="mt-3 rounded-xl bg-rose-50 p-3 text-sm font-bold text-[#a91d43]">
            {error}
          </p>
        )}
        <Button
          type="submit"
          disabled={loading || username.trim().length === 0 || password.length === 0}
          className="mt-4 h-12 w-full bg-[#a91d43] font-black text-white"
        >
          {loading ? <Loader2 className="animate-spin" /> : 'Entrar'}
        </Button>
      </form>
    </div>
  );
}

// Un partido está jugado si terminó, o si su fecha ya pasó y no se ha aplazado.
function isMatchPlayed(match: { status: string; date: string }): boolean {
  return match.status === 'FINISHED' || (match.status !== 'POSTPONED' && match.date <= new Date().toISOString().slice(0, 10));
}

// Jornada más reciente ya jugada (o la primera si aún no hay ninguna).
function latestPlayedMatchday(): number {
  const played = levanteMatches.filter(isMatchPlayed);
  return played.length ? Math.max(...played.map((match) => match.matchday)) : 1;
}

// Tira de jornadas: se edita una sola cada vez, en lugar de una lista larguísima.
// marks: 'own' = guardada en esta comunidad · 'inherited' = viene de la comunidad principal.
function MatchdayPicker({
  matchdays,
  selected,
  onSelect,
  marks,
}: {
  matchdays: Array<{ matchday: number; played: boolean }>;
  selected: number;
  onSelect: (matchday: number) => void;
  marks: Record<number, 'own' | 'inherited'>;
}) {
  return (
    <div>
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-2 sm:flex-wrap sm:overflow-visible" role="group" aria-label="Jornada">
        {matchdays.map(({ matchday, played }) => {
          const active = matchday === selected;
          const mark = marks[matchday];
          return (
            <button
              key={matchday}
              type="button"
              aria-pressed={active}
              aria-label={`${matchdayLongLabel(matchday)}${mark === 'own' ? ' (guardada)' : mark === 'inherited' ? ' (heredada)' : ''}`}
              onClick={() => onSelect(matchday)}
              className={`relative h-9 min-w-11 shrink-0 rounded-lg px-2.5 text-sm font-black transition ${
                active
                  ? 'bg-[#071527] text-white shadow-sm'
                  : played
                    ? 'bg-white text-[#071527] ring-1 ring-slate-200 hover:bg-slate-100'
                    : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
              }`}
            >
              {matchdayShortLabel(matchday)}
              {mark && (
                <span
                  aria-hidden="true"
                  className={`absolute -right-0.5 -top-0.5 size-2.5 rounded-full ring-2 ${active ? 'ring-[#071527]' : 'ring-white'} ${mark === 'own' ? 'bg-emerald-500' : 'bg-sky-400'}`}
                />
              )}
            </button>
          );
        })}
      </div>
      <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-400">
        <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-emerald-500" /> Guardada aquí</span>
        {Object.values(marks).includes('inherited') && (
          <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-sky-400" /> Heredada de la principal</span>
        )}
        <span>Las jornadas en gris aún no se han jugado.</span>
      </p>
    </div>
  );
}

function MvpEditor({ communitySlug, matchday, onMatchdayChange }: { communitySlug: string; matchday: number; onMatchdayChange: (matchday: number) => void }) {
  const [footballData, setFootballData] = useState<FootballDataPayload | null>(null);
  const [overrides, setOverrides] = useState<MvpOverride[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Record<number, { playerId: string; reason: string }>>({});
  const [savingMatchday, setSavingMatchday] = useState<number | null>(null);
  const [savedMatchday, setSavedMatchday] = useState<number | null>(null);

  const loadOverrides = () =>
    fetch('/api/mvp', { headers: { 'x-community': communitySlug } })
      .then(async (response) => (await response.json()) as { overrides?: MvpOverride[] })
      .then((result) => setOverrides(result.overrides ?? []));

  useEffect(() => {
    void Promise.all([
      fetch('/api/football')
        .then(async (response) => (response.ok ? ((await response.json()) as FootballDataPayload) : null))
        .then(setFootballData)
        .catch(() => setFootballData(null)),
      loadOverrides().catch(() => setOverrides([])),
    ]).finally(() => setLoading(false));
  }, []);

  const matches = footballData?.matches.length ? footballData.matches : levanteMatches;
  const sortedMatches = useMemo(
    () => [...matches].sort((a, b) => b.matchday - a.matchday),
    [matches],
  );

  const draftFor = (matchday: number) => {
    if (drafts[matchday]) return drafts[matchday];
    const resolved = resolveMvp(matchday, overrides);
    return { playerId: resolved?.player?.id ?? '', reason: resolved?.reason ?? '' };
  };

  const save = async (matchday: number) => {
    const draft = draftFor(matchday);
    if (!draft.playerId) return;
    setSavingMatchday(matchday);
    try {
      const response = await fetch('/api/admin/mvp', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ community: communitySlug, matchday, playerId: draft.playerId, reason: draft.reason }),
      });
      if (response.ok) {
        await loadOverrides();
        setSavedMatchday(matchday);
        window.setTimeout(() => setSavedMatchday((current) => (current === matchday ? null : current)), 2000);
      }
    } finally {
      setSavingMatchday(null);
    }
  };

  if (loading) {
    return <p className="text-sm font-bold text-slate-400">Cargando jornadas…</p>;
  }

  return (
    <div className="space-y-4">
      {sortedMatches.length === 0 && (
        <p className="text-sm text-slate-500">Todavía no hay jornadas disponibles.</p>
      )}
      <MatchdayPicker
        matchdays={[...matches].sort((a, b) => a.matchday - b.matchday).map((match) => ({
          matchday: match.matchday,
          played: isMatchPlayed(match),
        }))}
        selected={matchday}
        onSelect={onMatchdayChange}
        marks={Object.fromEntries((overrides ?? []).map((item) => [item.matchday, 'own' as const]))}
      />
      {sortedMatches.filter((match) => match.matchday === matchday).map((match) => {
        const draft = draftFor(match.matchday);
        const isFinished = match.status === 'FINISHED';
        return (
          <Card key={match.id} className="border-0 shadow-sm ring-slate-200">
            <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="w-full sm:w-48 sm:shrink-0">
                <strong className="block text-sm text-[#071527]">
                  {matchdayLongLabel(match.matchday)}
                </strong>
                <p className="text-xs text-slate-500">
                  {match.homeTeam} {isFinished ? `${match.homeScore}-${match.awayScore}` : 'vs'} {match.awayTeam}
                </p>
              </div>
              <NativeSelect
                value={draft.playerId}
                onChange={(event) =>
                  setDrafts((current) => ({
                    ...current,
                    [match.matchday]: { ...draftFor(match.matchday), playerId: event.target.value },
                  }))
                }
                className="w-full sm:w-56"
              >
                <NativeSelectOption value="">Elige jugador…</NativeSelectOption>
                {levantePlayers.map((player) => (
                  <NativeSelectOption key={player.id} value={player.id}>
                    {player.displayName}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <Textarea
                value={draft.reason}
                onChange={(event) =>
                  setDrafts((current) => ({
                    ...current,
                    [match.matchday]: { ...draftFor(match.matchday), reason: event.target.value },
                  }))
                }
                placeholder="Motivo (opcional)"
                className="min-h-11 flex-1"
                rows={1}
              />
              <Button
                onClick={() => void save(match.matchday)}
                disabled={!draft.playerId || savingMatchday === match.matchday}
                className="shrink-0 bg-[#a91d43] font-black text-white sm:w-32"
              >
                {savingMatchday === match.matchday ? (
                  <Loader2 className="animate-spin" />
                ) : savedMatchday === match.matchday ? (
                  'Guardado ✓'
                ) : (
                  'Guardar'
                )}
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function MatchReportEditor({ communitySlug, matchday, onMatchdayChange }: { communitySlug: string; matchday: number; onMatchdayChange: (matchday: number) => void }) {
  type MatchReportDraft = {
    homeScore: number;
    awayScore: number;
    formation: SavedLineup['formation'];
    lineup: SavedLineup;
    scorers: string[];
    // Minuto de cada gol, en la misma posicion que `scorers` (0 = sin minuto). Solo informativo para el calendario.
    minutes: number[];
    mvp: string;
    reason: string;
  };

  const [reports, setReports] = useState<Record<number, MatchReportDraft>>({});
  // Partidos que la comunidad aún no ha definido y hereda de la comunidad principal
  const [inherited, setInherited] = useState<Record<number, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [savingMatchday, setSavingMatchday] = useState<number | null>(null);
  const [savedMatchday, setSavedMatchday] = useState<number | null>(null);
  // Hora de inicio guardada por jornada (global: es la misma para todas las comunidades) y la que se esta escribiendo.
  const [kickoffs, setKickoffs] = useState<KickoffOverrides>({});
  const [kickoffDrafts, setKickoffDrafts] = useState<Record<number, string>>({});
  const [kickoffBusy, setKickoffBusy] = useState<number | null>(null);
  const [kickoffError, setKickoffError] = useState('');

  const loadKickoffs = () =>
    fetch('/api/admin/kickoffs')
      .then(async (response) => ((await response.json()) as { overrides?: KickoffOverrides }).overrides ?? {})
      .then(setKickoffs)
      .catch(() => setKickoffs({}));

  const saveKickoff = async (matchday: number, time: string | null) => {
    setKickoffBusy(matchday);
    setKickoffError('');
    try {
      const response = await fetch(time === null ? `/api/admin/kickoffs?matchday=${matchday}` : '/api/admin/kickoffs', time === null
        ? { method: 'DELETE' }
        : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ matchday, time }) });
      if (!response.ok) throw new Error(((await response.json().catch(() => ({}))) as { error?: string }).error ?? 'No se pudo guardar la hora.');
      setKickoffDrafts((current) => {
        const { [matchday]: _removed, ...rest } = current;
        return rest;
      });
      await loadKickoffs();
    } catch (failure) {
      setKickoffError(failure instanceof Error ? failure.message : 'No se pudo guardar la hora.');
    } finally {
      setKickoffBusy(null);
    }
  };

  const loadReports = async () => {
    const response = await fetch(`/api/admin/matches?community=${encodeURIComponent(communitySlug)}`);
    const result = (await response.json()) as { reports?: Array<{ inherited?: boolean; matchday: number; homeScore: number; awayScore: number; formation: SavedLineup['formation']; lineup: SavedLineup; scorers: string[]; goalMinutes?: number[]; mvp: string | null; reason: string }> };
    const next: Record<number, MatchReportDraft> = {};
    const nextInherited: Record<number, boolean> = {};
    for (const item of result.reports ?? []) {
      nextInherited[item.matchday] = item.inherited === true;
      next[item.matchday] = {
        homeScore: item.homeScore,
        awayScore: item.awayScore,
        formation: item.formation,
        lineup: item.lineup ?? { formation: '4-3-3', players: Array(11).fill('') },
        scorers: item.scorers ?? [],
        minutes: (item.scorers ?? []).map((_, index) => item.goalMinutes?.[index] ?? 0),
        mvp: item.mvp ?? '',
        reason: item.reason ?? '',
      };
    }
    setReports(next);
    setInherited(nextInherited);
  };

  useEffect(() => {
    void Promise.all([loadReports(), loadKickoffs()]).finally(() => setLoading(false));
  }, []);

  const draftFromStaticReport = (matchday: number): MatchReportDraft | null => {
    const match = levanteMatches.find((item) => item.matchday === matchday);
    const report = levanteMatchReports[matchday];
    if (!match || match.status !== 'FINISHED' || !report) return null;

    const playerIdForName = (name: string) =>
      levantePlayers.find((player) => player.displayName === name)?.id ?? '';
    const players = [
      ...report.lineup.goalkeeper,
      ...report.lineup.defenders,
      ...report.lineup.midfielders,
      ...report.lineup.attackers,
    ].map(playerIdForName);
    const formation = report.formation as SavedLineup['formation'];

    return {
      homeScore: match.homeScore ?? 0,
      awayScore: match.awayScore ?? 0,
      formation,
      lineup: { formation, players },
      scorers: report.levanteGoals.flatMap((goal) => Array(goal.minutes.length).fill(playerIdForName(goal.playerName)) as string[]).filter(Boolean),
      minutes: report.levanteGoals.flatMap((goal) => (playerIdForName(goal.playerName) ? goal.minutes : [])),
      mvp: playerIdForName(report.mvp.playerName),
      reason: report.mvp.reason,
    };
  };

  const draftFor = (matchday: number) => {
    const match = levanteMatches.find((item) => item.matchday === matchday);
    const baseFormation: SavedLineup['formation'] = match?.status === 'FINISHED' ? '4-4-2' : '4-3-3';
    const current = reports[matchday];
    if (current) return current;
    const staticReport = draftFromStaticReport(matchday);
    if (staticReport) return staticReport;
    const fallbackDraft: MatchReportDraft = {
      homeScore: match?.homeScore ?? 0,
      awayScore: match?.awayScore ?? 0,
      formation: baseFormation,
      lineup: { formation: baseFormation, players: Array(11).fill('') },
      scorers: [],
      minutes: [],
      mvp: '',
      reason: '',
    };
    return fallbackDraft;
  };

  const save = async (matchday: number) => {
    const draft = draftFor(matchday);
    if (!draft.formation || draft.lineup.players.length !== 11) return;
    setSavingMatchday(matchday);
    try {
      const response = await fetch('/api/admin/matches', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          community: communitySlug,
          matchday,
          homeScore: draft.homeScore,
          awayScore: draft.awayScore,
          formation: draft.formation,
          lineup: draft.lineup,
          scorers: draft.scorers,
          goalMinutes: draft.minutes,
        }),
      });
      if (response.ok) {
        await loadReports();
        setSavedMatchday(matchday);
        window.setTimeout(() => setSavedMatchday((current) => (current === matchday ? null : current)), 2000);
      }
    } finally {
      setSavingMatchday(null);
    }
  };

  if (loading) {
    return <p className="text-sm font-bold text-slate-400">Cargando informes oficiales…</p>;
  }

  return (
    <div className="space-y-4">
      <MatchdayPicker
        matchdays={levanteMatches.map((match) => ({
          matchday: match.matchday,
          played: isMatchPlayed(match),
        }))}
        selected={matchday}
        onSelect={onMatchdayChange}
        marks={Object.fromEntries(
          Object.keys(reports).map((key) => [Number(key), inherited[Number(key)] && communitySlug !== DEFAULT_COMMUNITY_SLUG ? ('inherited' as const) : ('own' as const)]),
        )}
      />
      {levanteMatches.filter((match) => match.matchday === matchday).map((match) => {
        const draft = draftFor(match.matchday);
        const slots = formations[draft.formation as keyof typeof formations]?.slots ?? formations['4-3-3'].slots;
        return (
          <Card key={match.id} className="border-0 shadow-sm ring-slate-200">
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <strong className="block text-[#071527]">{matchdayLongLabel(match.matchday)}</strong>
                  <span className="text-sm text-slate-500">{match.homeTeam} vs {match.awayTeam}</span>
                  {inherited[match.matchday] && communitySlug !== DEFAULT_COMMUNITY_SLUG && (
                    <span className="mt-1 block text-xs font-bold text-[#153e72]">
                      Datos de la comunidad principal: guarda para personalizarlos en esta comunidad.
                    </span>
                  )}
                </div>
                <Button
                  onClick={() => void save(match.matchday)}
                  disabled={savingMatchday === match.matchday}
                  className="bg-[#a91d43] font-black text-white"
                >
                  {savingMatchday === match.matchday ? <Loader2 className="animate-spin" /> : savedMatchday === match.matchday ? 'Guardado ✓' : 'Guardar'}
                </Button>
              </div>
              {(() => {
                const saved = kickoffs[match.matchday];
                const value = kickoffDrafts[match.matchday] ?? saved ?? match.kickoffTime ?? '';
                const valid = KICKOFF_TIME_PATTERN.test(value);
                return (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <label htmlFor={`kickoff-${match.matchday}`} className="mb-1 block text-xs font-black uppercase text-slate-400">Hora de inicio del partido (hora de Madrid)</label>
                    <div className="flex flex-wrap items-center gap-2">
                      <Input
                        id={`kickoff-${match.matchday}`}
                        type="time"
                        value={value}
                        onChange={(event) => setKickoffDrafts((current) => ({ ...current, [match.matchday]: event.target.value }))}
                        className="h-11 w-36"
                      />
                      <Button
                        type="button"
                        onClick={() => void saveKickoff(match.matchday, value)}
                        disabled={!valid || kickoffBusy === match.matchday || value === saved}
                        className="bg-[#153e72] font-black text-white"
                      >
                        {kickoffBusy === match.matchday ? <Loader2 className="animate-spin" /> : 'Guardar hora'}
                      </Button>
                      {saved && (
                        <Button type="button" variant="outline" onClick={() => void saveKickoff(match.matchday, null)} disabled={kickoffBusy === match.matchday}>
                          Quitar hora guardada
                        </Button>
                      )}
                    </div>
                    <p className="mt-2 text-xs text-slate-500">
                      {saved
                        ? `Hora guardada (${saved}). Las predicciones cierran el ${formatPredictionDeadline({ ...match, kickoffTime: saved })}. Se aplica a todas las comunidades.`
                        : match.kickoffTime
                          ? `Ahora se usa la hora del calendario (${match.kickoffTime}). Guarda una hora para fijarla a mano en todas las comunidades.`
                          : 'Este partido no tiene hora: la app muestra "Horario de cierre pendiente" y no envía avisos de cierre hasta que la guardes.'}
                    </p>
                    {kickoffError && kickoffBusy === null && <p role="alert" className="mt-1 text-xs font-bold text-[#a91d43]">{kickoffError}</p>}
                  </div>
                );
              })()}
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-black uppercase text-slate-400">Resultado local</label>
                  <Input type="number" min={0} max={20} value={draft.homeScore} onChange={(event) => setReports((current) => ({ ...current, [match.matchday]: { ...draftFor(match.matchday), homeScore: Number(event.target.value) } }))} className="h-11" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-black uppercase text-slate-400">Resultado visitante</label>
                  <Input type="number" min={0} max={20} value={draft.awayScore} onChange={(event) => setReports((current) => ({ ...current, [match.matchday]: { ...draftFor(match.matchday), awayScore: Number(event.target.value) } }))} className="h-11" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-black uppercase text-slate-400">Formación</label>
                  <NativeSelect value={draft.formation} onChange={(event) => {
                    const formation = event.target.value as SavedLineup['formation'];
                    const nextPlayers = Array(11).fill('');
                    const slotIds = formations[formation as keyof typeof formations]?.slots ?? formations['4-3-3'].slots;
                    const existing = draft.lineup?.players ?? [];
                    slotIds.forEach((slot, index) => {
                      nextPlayers[index] = existing[index] ?? '';
                    });
                    const nextLineup: SavedLineup = { formation, players: nextPlayers };
                    setReports((current) => ({ ...current, [match.matchday]: { ...draftFor(match.matchday), formation, lineup: nextLineup } }));
                  }} className="h-11 w-full">
                    {formationOptions.map((option) => (
                      <NativeSelectOption key={option} value={option}>{option}</NativeSelectOption>
                    ))}
                  </NativeSelect>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-black uppercase tracking-wider text-[#a91d43]">Once titular</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {slots.map((slot, index) => (
                  <div key={`${match.matchday}-${slot.id}`}>
                    <label className="mb-1 block text-xs font-black uppercase text-slate-400">{slot.label}</label>
                    <NativeSelect value={draft.lineup.players[index] ?? ''} onChange={(event) => {
                      const players = [...draft.lineup.players];
                      players[index] = event.target.value;
                      const nextLineup: SavedLineup = { formation: draft.formation, players };
                      setReports((current) => ({ ...current, [match.matchday]: { ...draftFor(match.matchday), lineup: nextLineup } }));
                    }} className="h-11 w-full">
                      <NativeSelectOption value="">Sin elegir</NativeSelectOption>
                      {levantePlayers.map((player) => (
                        <NativeSelectOption key={player.id} value={player.id}>{player.displayName}</NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </div>
                ))}
              </div>
              </div>
              <div>
                <p className="mb-1 text-xs font-black uppercase tracking-wider text-[#a91d43]">Goleadores</p>
                {(() => {
                  const levanteGoals = match.homeTeam === LEVANTE_TEAM ? draft.homeScore : draft.awayScore;
                  const registered = draft.scorers.length;
                  return (
                    <p className={`mb-2 text-xs font-bold ${registered === levanteGoals ? 'text-emerald-600' : 'text-slate-500'}`}>
                      Goles del Levante: {levanteGoals} · goles asignados: {registered}. Usa + y − para indicar cuántos goles ha marcado cada jugador.
                    </p>
                  );
                })()}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                  {levantePlayers.map((player) => {
                    const goals = draft.scorers.filter((id) => id === player.id).length;
                    const setScorers = (scorers: string[], minutes: number[]) => setReports((current) => ({ ...current, [match.matchday]: { ...draftFor(match.matchday), scorers, minutes } }));
                    return (
                      <div key={`${match.matchday}-scorer-${player.id}`} className={`flex items-center justify-between gap-2 rounded-xl border px-2 py-2 text-sm ${goals > 0 ? 'border-[#a91d43]/40 bg-rose-50' : 'border-slate-200 bg-slate-50'}`}>
                        <span className="min-w-0 truncate">{player.displayName}</span>
                        <span className="flex shrink-0 items-center gap-1">
                          <button type="button" aria-label={`Quitar un gol a ${player.displayName}`} disabled={goals === 0} onClick={() => {
                            const index = draft.scorers.lastIndexOf(player.id);
                            setScorers(draft.scorers.filter((_, position) => position !== index), draft.minutes.filter((_, position) => position !== index));
                          }} className="grid size-6 place-items-center rounded-full border border-slate-300 bg-white disabled:opacity-40">
                            <Minus className="size-3" />
                          </button>
                          <b className="w-4 text-center">{goals}</b>
                          <button type="button" aria-label={`Añadir un gol a ${player.displayName}`} onClick={() => setScorers([...draft.scorers, player.id], [...draft.minutes, 0])} className="grid size-6 place-items-center rounded-full border border-slate-300 bg-white">
                            <Plus className="size-3" />
                          </button>
                        </span>
                      </div>
                    );
                  })}
                </div>
                {draft.scorers.length > 0 && (
                  <div className="mt-4">
                    <p className="mb-2 text-xs font-black uppercase tracking-wider text-slate-500">Minuto de cada gol (opcional, solo para el calendario)</p>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {draft.scorers.map((playerId, index) => (
                        <label key={`${match.matchday}-goal-${index}`} className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                          <span className="min-w-0 truncate">⚽ {levantePlayers.find((player) => player.id === playerId)?.displayName ?? playerId}</span>
                          <span className="flex shrink-0 items-center gap-1">
                            <Input
                              type="number"
                              min={1}
                              max={130}
                              inputMode="numeric"
                              placeholder="min"
                              aria-label={`Minuto del gol ${index + 1}`}
                              value={draft.minutes[index] ? draft.minutes[index] : ''}
                              onChange={(event) => {
                                const minutes = draft.scorers.map((_, position) => draft.minutes[position] ?? 0);
                                minutes[index] = Math.max(0, Math.min(130, Math.floor(Number(event.target.value) || 0)));
                                setReports((current) => ({ ...current, [match.matchday]: { ...draftFor(match.matchday), minutes } }));
                              }}
                              className="h-9 w-20"
                            />
                            <span className="text-slate-400">&apos;</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// Vista previa de la cabecera tal como la verán los usuarios de la comunidad.
function HeaderPreview({ identity }: { identity: CommunityIdentity }) {
  return (
    <div
      className="flex h-18 items-center gap-3 rounded-xl px-4 text-white"
      style={{ backgroundColor: identity.color ?? DEFAULT_HEADER_COLOR }}
    >
      {identity.logoSrc ? (
        <Image unoptimized src={identity.logoSrc} width={96} height={96} alt="" className="size-12 shrink-0 rounded-full object-cover ring-2 ring-white/20" />
      ) : (
        <span className="grid size-12 shrink-0 place-items-center rounded-full bg-white/95 text-[10px] font-black text-slate-500">Levante</span>
      )}
      <span className="min-w-0 text-left">
        <small className={`block truncate text-[10px] font-bold uppercase tracking-[.22em] ${identity.color ? 'text-white/80' : 'text-sky-300'}`}>{identity.eyebrow}</small>
        <strong className="block truncate text-lg font-black">{identity.title}</strong>
      </span>
    </div>
  );
}

function CommunityHeaderEditor({
  community,
  onSaved,
  onCancel,
}: {
  community: AdminCommunity;
  onSaved: () => Promise<unknown>;
  onCancel: () => void;
}) {
  const current = resolveCommunityIdentity(community.slug, community);
  const [title, setTitle] = useState(current.title);
  const [subtitle, setSubtitle] = useState(current.eyebrow);
  // undefined = sin cambios · '' = sin imagen · data URL = imagen nueva (se sigue mostrando tras guardar)
  const [newImage, setNewImage] = useState<string | undefined>(undefined);
  const [sentImage, setSentImage] = useState<string | undefined>(undefined);
  // Vista previa inmediata mientras la imagen elegida se procesa
  const [pendingLogo, setPendingLogo] = useState<string | null>(null);
  const [color, setColor] = useState(current.color ?? DEFAULT_HEADER_COLOR);
  // Portada de Inicio. Título vacío = portada estándar.
  const [heroTitle, setHeroTitle] = useState(community.heroTitle ?? '');
  const [heroSubtitle, setHeroSubtitle] = useState(community.heroSubtitle ?? '');
  const [newHeroImage, setNewHeroImage] = useState<string | undefined>(undefined);
  const [sentHeroImage, setSentHeroImage] = useState<string | undefined>(undefined);
  const [pendingHero, setPendingHero] = useState<string | null>(null);
  // Follow me: siempre 3 filas (red + URL); las que tienen la URL vacía no se guardan.
  const [links, setLinks] = useState<CommunityLink[]>(() => {
    const saved = parseCommunityLinks(community.heroLinks);
    return Array.from({ length: MAX_COMMUNITY_LINKS }, (_, index) => saved[index] ?? { network: DEFAULT_SOCIAL_NETWORKS[index], url: '' });
  });
  const [processingHero, setProcessingHero] = useState(false);
  const [savedSnapshot, setSavedSnapshot] = useState<unknown[] | null>(null);
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const logoSrc = pendingLogo ?? (newImage === undefined ? current.logoSrc : newImage || undefined);
  const colorReadable = isReadableHeaderColor(color);
  // El aviso de guardado desaparece en cuanto se vuelve a editar algo.
  const snapshot = [title, subtitle, color, heroTitle, heroSubtitle, newImage, newHeroImage, JSON.stringify(links)];
  const saved = savedSnapshot !== null && savedSnapshot.every((value, index) => value === snapshot[index]);
  // Cada fila con URL debe ser válida para su red; las válidas se ven ya en la vista previa.
  const linkChecks = links.map((link) => ({ link, url: link.url.trim() ? normalizeSocialUrl(link.network, link.url) : null }));
  const linksValid = linkChecks.every((check) => !check.link.url.trim() || check.url !== null);
  const previewLinks = linkChecks.flatMap((check) => (check.url ? [{ network: check.link.network, url: check.url }] : []));
  const heroLines = heroTitle.split('\n').map((line) => line.trim()).filter(Boolean);
  const heroTooLong = heroLines.length > 2 || heroLines.join('\n').length > HERO_TITLE_MAX;
  const heroPreview = (() => {
    const base = resolveCommunityHero(community, {
      heroTitle: heroLines.join('\n') || null,
      heroSubtitle: heroSubtitle.trim(),
      heroImageVersion: community.heroImageVersion,
      headerColor: colorReadable && color !== DEFAULT_HEADER_COLOR ? color : null,
    });
    if (!base) return null;
    return { ...base, links: previewLinks, imageUrl: pendingHero ?? (newHeroImage === undefined ? base.imageUrl : newHeroImage || undefined) };
  })();
  const canSave =
    title.trim().length > 0 && subtitle.trim().length > 0 && colorReadable && !heroTooLong && linksValid &&
    !processing && !processingHero && !saving;

  const chooseImage = async (file: File | undefined) => {
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    setPendingLogo(previewUrl);
    setProcessing(true);
    setError('');
    try {
      setNewImage(await resizeImageToDataUrl(file));
    } catch {
      setError('No se pudo procesar la imagen. Prueba con otra (JPG, PNG o WebP).');
    } finally {
      setPendingLogo(null);
      URL.revokeObjectURL(previewUrl);
      setProcessing(false);
    }
  };

  const chooseHeroImage = async (file: File | undefined) => {
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    setPendingHero(previewUrl);
    setProcessingHero(true);
    setError('');
    try {
      setNewHeroImage(await fitImageToDataUrl(file));
    } catch {
      setError('No se pudo procesar la imagen de la portada. Prueba con otra (JPG, PNG o WebP).');
    } finally {
      setPendingHero(null);
      URL.revokeObjectURL(previewUrl);
      setProcessingHero(false);
    }
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const response = await fetch('/api/admin/communities', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          slug: community.slug,
          headerTitle: title,
          headerSubtitle: subtitle,
          headerColor: color === DEFAULT_HEADER_COLOR ? '' : color,
          heroTitle,
          heroSubtitle,
          heroLinks: links.filter((link) => link.url.trim()),
          ...(newHeroImage === undefined || newHeroImage === sentHeroImage ? {} : { heroImage: newHeroImage }),
          ...(newImage === undefined || newImage === sentImage ? {} : { headerImage: newImage }),
        }),
      });
      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(result?.error ?? `No se pudieron guardar los cambios (error ${response.status} del servidor).`);
        return;
      }
      await onSaved();
      // Las imágenes guardadas se siguen mostrando tal cual (sin recargarlas del servidor) y no se reenvían.
      setSentImage(newImage);
      setSentHeroImage(newHeroImage);
      setSavedSnapshot(snapshot);
    } catch {
      setError('No se pudo conectar con el servidor. Comprueba tu conexión e inténtalo de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={(event) => void save(event)} className="space-y-4 border-t border-slate-100 pt-4">
      <p className="text-xs font-black uppercase tracking-wider text-[#a91d43]">Cabecera</p>
      <HeaderPreview identity={{ eyebrow: subtitle.trim() || current.eyebrow, title: title.trim() || current.title, logoSrc, color: colorReadable ? color : undefined }} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-black uppercase text-slate-400">Título</label>
          <Input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={HEADER_TITLE_MAX} placeholder="Texto grande de la cabecera" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-black uppercase text-slate-400">Subtítulo</label>
          <Input value={subtitle} onChange={(event) => setSubtitle(event.target.value)} maxLength={HEADER_SUBTITLE_MAX} placeholder="Texto pequeño sobre el título" />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs font-black uppercase text-slate-400">Imagen</label>
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 hover:bg-slate-50">
            {processing ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
            {logoSrc ? 'Cambiar imagen' : 'Añadir imagen'}
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(event) => {
                void chooseImage(event.target.files?.[0]);
                event.target.value = '';
              }}
            />
          </label>
          {logoSrc && (
            <Button type="button" variant="outline" onClick={() => setNewImage('')}>
              Quitar imagen
            </Button>
          )}
          <span className="text-xs text-slate-400">Se recorta en cuadrado. Sin imagen se muestra el escudo del Levante.</span>
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs font-black uppercase text-slate-400">Color de la cabecera</label>
        <div className="flex flex-wrap items-center gap-2">
          {HEADER_COLOR_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              aria-label={preset === DEFAULT_HEADER_COLOR ? 'Color por defecto (azul marino)' : `Color ${preset}`}
              aria-pressed={color === preset}
              onClick={() => setColor(preset)}
              style={{ backgroundColor: preset }}
              className={`grid size-8 place-items-center rounded-full ring-offset-2 transition ${color === preset ? 'ring-2 ring-[#a91d43]' : 'ring-1 ring-slate-200 hover:ring-slate-400'}`}
            >
              {color === preset && <Check className="size-4 text-white" />}
            </button>
          ))}
          <label className="ml-1 inline-flex h-8 cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold text-slate-600 hover:bg-slate-50">
            <input
              type="color"
              value={/^#[0-9a-f]{6}$/i.test(color) ? color : DEFAULT_HEADER_COLOR}
              onChange={(event) => setColor(event.target.value.toLowerCase())}
              className="size-5 cursor-pointer rounded border-0 bg-transparent p-0"
              aria-label="Elegir otro color"
            />
            Otro color · {color}
          </label>
        </div>
        {!colorReadable && (
          <p className="mt-1 text-xs font-bold text-[#a91d43]">
            Ese color es demasiado claro: el texto blanco de la cabecera no se leería bien. Elige uno más oscuro.
          </p>
        )}
      </div>
      <div className="space-y-4 border-t border-slate-100 pt-4">
        <div>
          <p className="text-xs font-black uppercase tracking-wider text-[#a91d43]">Portada de Inicio</p>
          <p className="text-xs text-slate-500">
            Bloque de bienvenida de la comunidad. Deja el título vacío para usar la portada estándar.
          </p>
        </div>
        <div className="z-10 bg-white pb-1 lg:sticky lg:top-2">
          <p className="mb-2 text-[11px] font-black uppercase tracking-wider text-slate-400">
            Así se verá en Inicio{heroPreview ? '' : ' (portada estándar: escribe un título para personalizarla)'}
          </p>
          <div className="relative">
            <div className="pointer-events-none select-none" aria-hidden="true">
              {heroPreview ? (
                <CommunityHeroCard hero={heroPreview} onRules={() => undefined} />
              ) : (
                <StandardHeroCard onRules={() => undefined} />
              )}
            </div>
            {processingHero && (
              <span className="absolute right-3 top-3 inline-flex items-center gap-2 rounded-full bg-[#071527]/85 px-3 py-1.5 text-xs font-bold text-white">
                <Loader2 className="size-3.5 animate-spin" /> Optimizando imagen…
              </span>
            )}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-black uppercase text-slate-400">Título</label>
            <Textarea
              value={heroTitle}
              onChange={(event) => setHeroTitle(event.target.value)}
              rows={2}
              placeholder={'La porra de\nIsmaelete13'}
            />
            <p className="mt-1 text-xs text-slate-400">
              Hasta 2 líneas. La segunda sale destacada con el color de la comunidad.
            </p>
            {heroTooLong && (
              <p className="mt-1 text-xs font-bold text-[#a91d43]">
                El título admite como máximo 2 líneas y {HERO_TITLE_MAX} caracteres.
              </p>
            )}
          </div>
          <div>
            <label className="mb-1 block text-xs font-black uppercase text-slate-400">Subtítulo</label>
            <Textarea
              value={heroSubtitle}
              onChange={(event) => setHeroSubtitle(event.target.value)}
              maxLength={HERO_SUBTITLE_MAX}
              rows={2}
              placeholder="Haz tu pronóstico en cada partido del Levante y suma puntos durante toda la temporada."
            />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-black uppercase text-slate-400">Imagen (a la derecha)</label>
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 hover:bg-slate-50">
              {processingHero ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
              {heroPreview?.imageUrl ? 'Cambiar imagen' : 'Añadir imagen'}
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(event) => {
                  void chooseHeroImage(event.target.files?.[0]);
                  event.target.value = '';
                }}
              />
            </label>
            {heroPreview?.imageUrl && (
              <Button type="button" variant="outline" onClick={() => setNewHeroImage('')}>
                Quitar imagen
              </Button>
            )}
            <span className="text-xs text-slate-400">
              Se reduce sin recortarla. Necesita un título para mostrarse.
            </span>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-black uppercase text-slate-400">Follow me (hasta {MAX_COMMUNITY_LINKS} redes)</label>
          <p className="mb-2 text-xs text-slate-400">
            Aparecen como botones en la portada. Pega la dirección de tu perfil o escribe solo tu @usuario. Deja vacías las filas que no uses.
          </p>
          <div className="space-y-2">
            {linkChecks.map(({ link, url }, index) => {
              const network = getSocialNetwork(link.network);
              const invalid = link.url.trim() !== '' && url === null;
              return (
                <div key={index}>
                  <div className="grid gap-2 sm:grid-cols-[12rem_1fr]">
                    <NativeSelect
                      value={link.network}
                      aria-label={`Red social ${index + 1}`}
                      onChange={(event) =>
                        setLinks((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, network: event.target.value } : item)))
                      }
                    >
                      {SOCIAL_NETWORKS.map((option) => (
                        <NativeSelectOption key={option.id} value={option.id}>
                          {option.label}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                    <Input
                      value={link.url}
                      aria-label={`Enlace de ${network?.label ?? 'la red'}`}
                      aria-invalid={invalid}
                      maxLength={200}
                      placeholder={network ? `https://${network.domains[0]}/tu-perfil  o  @usuario` : 'https://…'}
                      onChange={(event) =>
                        setLinks((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, url: event.target.value } : item)))
                      }
                    />
                  </div>
                  {invalid && (
                    <p className="mt-1 text-xs font-bold text-[#a91d43]">
                      Enlace no válido: usa una dirección de {network?.domains[0] ?? 'la red elegida'} o un @usuario.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {error && <p className="text-sm font-bold text-[#a91d43]">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={!canSave} className="bg-[#a91d43] font-black text-white hover:bg-[#8f1738]">
          {saving && <Loader2 className="size-4 animate-spin" />}
          Guardar cambios
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cerrar
        </Button>
      </div>
      {saved && (
        <p className="text-sm font-bold text-emerald-700">
          <Check className="mr-1 inline size-4" />
          Cambios guardados.{' '}
          <a href={`/${community.slug}`} target="_blank" rel="noopener noreferrer" className="underline">
            Ver /{community.slug}
          </a>
        </p>
      )}
    </form>
  );
}

// Petición JSON al servidor devolviendo si fue bien o el mensaje de error.
async function adminRequest(method: string, url: string, body?: unknown): Promise<{ ok: boolean; error?: string }> {
  try {
    const response = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (response.ok) return { ok: true };
    const result = (await response.json().catch(() => null)) as { error?: string } | null;
    return { ok: false, error: result?.error ?? `Error ${response.status} del servidor.` };
  } catch {
    return { ok: false, error: 'No se pudo conectar. Inténtalo de nuevo.' };
  }
}

// Administrador(es) de una comunidad: el super administrador crea aquí su usuario y contraseña.
function CommunityAdminRow({
  community,
  admins,
  reloadAdmins,
}: {
  community: AdminCommunity;
  admins: AdminAccountInfo[] | null;
  reloadAdmins: () => Promise<void>;
}) {
  const [creating, setCreating] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  const own = (admins ?? []).filter((account) => account.role === 'community' && account.communitySlug === community.slug);
  const cleanUsername = username.trim().replace(/^@/, '').toLowerCase();
  const usernameValid = ADMIN_USERNAME_PATTERN.test(cleanUsername);
  const canCreate = usernameValid && password.length >= MIN_ADMIN_PASSWORD_LENGTH && busy === null;

  const run = async (key: string, action: () => Promise<{ ok: boolean; error?: string }>, onDone: () => void) => {
    setBusy(key);
    setError('');
    const result = await action();
    if (!result.ok) setError(result.error ?? 'No se pudo completar la acción.');
    else {
      onDone();
      await reloadAdmins();
    }
    setBusy(null);
  };

  return (
    <div className="space-y-2 rounded-xl bg-slate-50 p-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="text-xs font-black uppercase tracking-wider text-slate-400">Administrador</span>
        {admins === null ? (
          <span className="text-sm text-slate-400">Cargando…</span>
        ) : own.length === 0 ? (
          <span className="text-sm text-slate-500">Sin asignar</span>
        ) : (
          own.map((account) => (
            <span key={account.id} className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-sm font-black text-[#071527] ring-1 ring-slate-200">
              @{account.username}
              <button
                type="button"
                aria-label={`Cambiar la contraseña de @${account.username}`}
                title="Cambiar contraseña"
                onClick={() => {
                  setResettingId((current) => (current === account.id ? null : account.id));
                  setNewPassword('');
                }}
                className="grid size-5 place-items-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-[#071527]"
              >
                <KeyRound className="size-3" />
              </button>
              <button
                type="button"
                aria-label={`Eliminar a @${account.username}`}
                title="Eliminar administrador"
                disabled={busy === account.id}
                onClick={() => {
                  if (!window.confirm(`¿Eliminar al administrador @${account.username}? Perderá el acceso al panel.`)) return;
                  void run(account.id, () => adminRequest('DELETE', `/api/admin/admins?id=${encodeURIComponent(account.id)}`), () => undefined);
                }}
                className="grid size-5 place-items-center rounded-full text-slate-400 hover:bg-rose-50 hover:text-[#a91d43]"
              >
                {busy === account.id ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3" />}
              </button>
            </span>
          ))
        )}
        <Button type="button" variant="outline" size="sm" onClick={() => setCreating((current) => !current)} aria-expanded={creating}>
          <UserPlus className="size-3.5" />
          {own.length === 0 ? 'Crear administrador' : 'Añadir otro'}
        </Button>
      </div>
      {resettingId && (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            type="text"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            autoComplete="off"
            placeholder={`Nueva contraseña (mín. ${MIN_ADMIN_PASSWORD_LENGTH})`}
            aria-label="Nueva contraseña del administrador"
          />
          <Button
            type="button"
            disabled={newPassword.length < MIN_ADMIN_PASSWORD_LENGTH || busy === resettingId}
            onClick={() => void run(resettingId, () => adminRequest('PATCH', '/api/admin/admins', { id: resettingId, password: newPassword }), () => {
              setResettingId(null);
              setNewPassword('');
            })}
            className="bg-[#a91d43] font-black text-white hover:bg-[#8f1738]"
          >
            Guardar contraseña
          </Button>
        </div>
      )}
      {creating && (
        <div className="space-y-2">
          <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <Input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="off"
              maxLength={31}
              placeholder={`@usuario (p. ej. @${community.slug})`}
              aria-label={`Usuario del administrador de ${community.name}`}
            />
            <Input
              type="text"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="off"
              placeholder={`Contraseña (mín. ${MIN_ADMIN_PASSWORD_LENGTH})`}
              aria-label={`Contraseña del administrador de ${community.name}`}
            />
            <Button
              type="button"
              disabled={!canCreate}
              onClick={() => void run('create', () => adminRequest('POST', '/api/admin/admins', { username: cleanUsername, password, communitySlug: community.slug }), () => {
                setUsername('');
                setPassword('');
                setCreating(false);
              })}
              className="bg-[#a91d43] font-black text-white hover:bg-[#8f1738]"
            >
              {busy === 'create' ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              Crear
            </Button>
          </div>
          <p className="text-xs text-slate-500">
            {username.trim() && !usernameValid
              ? 'Usuario no válido: 2-30 caracteres, minúsculas, números, punto, guion o guion bajo.'
              : 'Con este usuario y contraseña entrará en /admin y solo verá esta comunidad. Pásale la contraseña por un canal privado.'}
          </p>
        </div>
      )}
      {error && <p className="text-sm font-bold text-[#a91d43]">{error}</p>}
    </div>
  );
}

function CommunitiesPanel({
  communities,
  reload,
  admins,
  reloadAdmins,
}: {
  communities: AdminCommunity[] | null;
  reload: () => Promise<void>;
  admins: AdminAccountInfo[] | null;
  reloadAdmins: () => Promise<void>;
}) {
  const [name, setName] = useState('');
  // Administrador opcional que se crea a la vez que la comunidad
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [origin, setOrigin] = useState('');

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const slug = slugifyCommunityName(name);
  const preview = name.trim() && isValidCommunitySlug(slug) ? `${origin}/${slug}` : null;
  const newAdminUsername = adminUsername.trim().replace(/^@/, '').toLowerCase();
  const wantsAdmin = newAdminUsername !== '' || adminPassword !== '';
  const newAdminValid = !wantsAdmin || (ADMIN_USERNAME_PATTERN.test(newAdminUsername) && adminPassword.length >= MIN_ADMIN_PASSWORD_LENGTH);

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    setCreating(true);
    setError('');
    try {
      const response = await fetch('/api/admin/communities', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const result = (await response.json()) as { error?: string; community?: { slug: string } };
      if (!response.ok || !result.community) {
        setError(result.error ?? 'No se pudo crear la comunidad.');
        return;
      }
      setName('');
      if (wantsAdmin) {
        const created = await adminRequest('POST', '/api/admin/admins', {
          username: newAdminUsername,
          password: adminPassword,
          communitySlug: result.community.slug,
        });
        if (created.ok) {
          setAdminUsername('');
          setAdminPassword('');
        } else {
          setError(`La comunidad se creó, pero no se pudo crear su administrador: ${created.error} Créalo desde su tarjeta.`);
        }
        await reloadAdmins();
      }
      await reload();
    } catch {
      setError('No se pudo conectar. Inténtalo de nuevo.');
    } finally {
      setCreating(false);
    }
  };

  const copy = async (communitySlug: string) => {
    try {
      await navigator.clipboard.writeText(`${origin}/${communitySlug}`);
      setCopied(communitySlug);
      window.setTimeout(() => setCopied((current) => (current === communitySlug ? null : current)), 1800);
    } catch {
      setError('No se pudo copiar el enlace.');
    }
  };

  return (
    <div className="space-y-4">
      <Card className="border-0 shadow-sm ring-slate-200">
        <CardContent>
          <form onSubmit={(event) => void create(event)} className="space-y-3">
            <label className="block text-xs font-black uppercase text-slate-400">Nombre de la nueva comunidad</label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={40}
                placeholder="Por ejemplo: Ismaelete"
              />
              <Button type="submit" disabled={creating || !preview || !newAdminValid} className="bg-[#a91d43] font-black text-white hover:bg-[#8f1738]">
                {creating ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                Crear comunidad
              </Button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Input
                value={adminUsername}
                onChange={(event) => setAdminUsername(event.target.value)}
                autoComplete="off"
                maxLength={31}
                placeholder="Administrador (opcional): @usuario"
                aria-label="Usuario del administrador de la nueva comunidad"
              />
              <Input
                type="text"
                value={adminPassword}
                onChange={(event) => setAdminPassword(event.target.value)}
                autoComplete="off"
                placeholder={`Contraseña del administrador (mín. ${MIN_ADMIN_PASSWORD_LENGTH})`}
                aria-label="Contraseña del administrador de la nueva comunidad"
              />
            </div>
            {wantsAdmin && !newAdminValid && (
              <p className="text-xs font-bold text-[#a91d43]">
                Para crear también el administrador indica un usuario válido (2-30 caracteres, minúsculas, números, punto, guion o guion bajo) y una contraseña de al menos {MIN_ADMIN_PASSWORD_LENGTH} caracteres.
              </p>
            )}
            <p className="text-xs text-slate-500">
              {preview ? (
                <>La dirección será <b className="text-[#071527]">{preview}</b></>
              ) : name.trim() ? (
                'Ese nombre no genera una dirección válida.'
              ) : (
                'La dirección se genera a partir del nombre, en minúsculas y sin espacios ni tildes.'
              )}
            </p>
            {error && <p className="text-sm font-bold text-[#a91d43]">{error}</p>}
          </form>
        </CardContent>
      </Card>
      {communities === null ? (
        <p className="text-sm font-bold text-slate-400">Cargando comunidades…</p>
      ) : (
        <div className="space-y-2">
          {communities.map((community) => (
            <Card key={community.slug} className="overflow-visible border-0 shadow-sm ring-slate-200">
              <CardContent className="space-y-4">
               <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <strong className="text-[#071527]">{community.name}</strong>
                  {community.slug === DEFAULT_COMMUNITY_SLUG && (
                    <span className="ml-2 rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-[#153e72]">
                      Principal
                    </span>
                  )}
                  <p className="truncate text-sm text-slate-500">
                    <a href={`/${community.slug}`} target="_blank" rel="noopener noreferrer" className="underline decoration-slate-300 hover:text-[#a91d43]">
                      {origin}/{community.slug}
                    </a>
                  </p>
                  <p className="text-xs text-slate-400">
                    {community.users} {community.users === 1 ? 'usuario' : 'usuarios'} · {community.predictions}{' '}
                    {community.predictions === 1 ? 'predicción' : 'predicciones'} · creada el{' '}
                    {dateFormatter.format(new Date(community.createdAt))}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button variant="outline" onClick={() => void copy(community.slug)}>
                    {copied === community.slug ? <Check className="size-4" /> : <Copy className="size-4" />}
                    {copied === community.slug ? 'Copiado' : 'Copiar enlace'}
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label={`Editar la comunidad ${community.name}`}
                    aria-expanded={editing === community.slug}
                    onClick={() => setEditing((current) => (current === community.slug ? null : community.slug))}
                  >
                    <Pencil className="size-4" />
                  </Button>
                </div>
               </div>
               <CommunityAdminRow community={community} admins={admins} reloadAdmins={reloadAdmins} />
               {editing === community.slug && (
                <CommunityHeaderEditor
                  community={community}
                  onCancel={() => setEditing(null)}
                  onSaved={reload}
                />
               )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function PredictionsModeration({ communitySlug }: { communitySlug: string }) {
  const [predictions, setPredictions] = useState<AdminPrediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [openUserId, setOpenUserId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const load = () =>
    fetch(`/api/admin/predictions?community=${encodeURIComponent(communitySlug)}`)
      .then(async (response) => (await response.json()) as { predictions?: AdminPrediction[] })
      .then((result) => setPredictions(result.predictions ?? []))
      .catch(() => setPredictions([]));

  useEffect(() => {
    void load().finally(() => setLoading(false));
  }, []);

  const deleteOne = async (id: string) => {
    if (!window.confirm('¿Eliminar esta predicción?')) return;
    setBusyId(id);
    try {
      await fetch(`/api/admin/predictions?id=${encodeURIComponent(id)}&community=${encodeURIComponent(communitySlug)}`, { method: 'DELETE' });
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const deleteAllForUser = async (userId: string, nickname: string) => {
    if (!window.confirm(`¿Eliminar TODAS las predicciones de @${nickname}?`)) return;
    setBusyId(userId);
    try {
      await fetch(`/api/admin/predictions?userId=${encodeURIComponent(userId)}&community=${encodeURIComponent(communitySlug)}`, { method: 'DELETE' });
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const grouped = useMemo(() => {
    const byUser = new Map<string, { nickname: string; avatarUrl: string | null; communitySlug: string; predictions: AdminPrediction[] }>();
    for (const prediction of predictions) {
      const entry = byUser.get(prediction.userId) ?? {
        nickname: prediction.nickname,
        avatarUrl: prediction.avatarUrl,
        communitySlug: prediction.communitySlug,
        predictions: [],
      };
      entry.predictions.push(prediction);
      byUser.set(prediction.userId, entry);
    }
    return Array.from(byUser.entries());
  }, [predictions]);

  if (loading) {
    return <p className="text-sm font-bold text-slate-400">Cargando predicciones…</p>;
  }

  if (grouped.length === 0) {
    return <p className="text-sm text-slate-500">Todavía no hay predicciones publicadas.</p>;
  }

  const visibleGroups = grouped.filter(([, group]) => group.nickname.toLowerCase().includes(search.trim().replace(/^@/, '').toLowerCase()));

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-bold text-slate-500">
          {grouped.length} {grouped.length === 1 ? 'usuario' : 'usuarios'} · {predictions.length} {predictions.length === 1 ? 'predicción' : 'predicciones'}
        </p>
        <div className="relative sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar usuario" aria-label="Buscar usuario" className="pl-9" />
        </div>
      </div>
      {visibleGroups.length === 0 && <p className="text-sm text-slate-500">Ningún usuario coincide con la búsqueda.</p>}
      {visibleGroups.map(([userId, group]) => (
        <Card key={userId} className="border-0 py-0 shadow-sm ring-slate-200">
          <CardContent className="px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                aria-expanded={openUserId === userId}
                onClick={() => setOpenUserId((current) => (current === userId ? null : userId))}
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
              >
                <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-full bg-rose-100 text-sm font-black text-[#a91d43]">
                  {group.avatarUrl ? (
                    <Image unoptimized src={group.avatarUrl} width={80} height={80} alt="" className="h-full w-full object-cover" />
                  ) : (
                    group.nickname.slice(0, 2).toUpperCase()
                  )}
                </span>
                <strong className="text-[#071527]">@{group.nickname}</strong>
                <span className="text-xs font-bold text-slate-400">
                  {group.predictions.length} {group.predictions.length === 1 ? 'predicción' : 'predicciones'}
                </span>
                <ChevronDown className={`ml-auto size-4 shrink-0 text-slate-400 transition ${openUserId === userId ? 'rotate-180' : ''}`} />
              </button>
              <Button
                variant="outline"
                disabled={busyId === userId}
                onClick={() => void deleteAllForUser(userId, group.nickname)}
                className="border-rose-200 text-[#a91d43] hover:bg-rose-50"
              >
                <Trash2 className="size-4" /> Eliminar todas
              </Button>
            </div>
            {openUserId === userId && (
            <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
              {group.predictions.map((prediction) => {
                const match = levanteMatches.find((item) => item.id === prediction.matchId);
                return (
                  <div
                    key={prediction.id}
                    className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-bold text-[#071527]">
                        {match ? `${matchdayShortLabel(match.matchday)} · ${match.homeTeam} vs ${match.awayTeam}` : prediction.matchId}
                      </p>
                      <p className="text-xs text-slate-400">
                        {prediction.homeScore}-{prediction.awayScore} · {dateFormatter.format(new Date(prediction.publishedAt))}
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-label="Eliminar esta predicción"
                      disabled={busyId === prediction.id}
                      onClick={() => void deleteOne(prediction.id)}
                      className="grid size-8 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-[#a91d43]"
                    >
                      {busyId === prediction.id ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                    </button>
                  </div>
                );
              })}
            </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// Administradores de comunidad: solo los gestionan los super administradores.
function AdminsPanel({
  communities,
  admins,
  reload,
}: {
  communities: AdminCommunity[] | null;
  admins: AdminAccountInfo[] | null;
  reload: () => Promise<void>;
}) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [communitySlug, setCommunitySlug] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const cleanUsername = username.trim().replace(/^@/, '').toLowerCase();
  const usernameValid = ADMIN_USERNAME_PATTERN.test(cleanUsername);
  const chosenCommunity = communitySlug || communities?.find((community) => community.slug !== DEFAULT_COMMUNITY_SLUG)?.slug || communities?.[0]?.slug || '';
  const canCreate = usernameValid && password.length >= MIN_ADMIN_PASSWORD_LENGTH && chosenCommunity !== '' && !creating;
  const communityName = (slug: string | null) => communities?.find((community) => community.slug === slug)?.name ?? slug ?? '';

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    setCreating(true);
    setError('');
    try {
      const response = await fetch('/api/admin/admins', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username: cleanUsername, password, communitySlug: chosenCommunity }),
      });
      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setError(result?.error ?? `No se pudo crear el administrador (error ${response.status}).`);
        return;
      }
      setUsername('');
      setPassword('');
      await reload();
    } catch {
      setError('No se pudo conectar. Inténtalo de nuevo.');
    } finally {
      setCreating(false);
    }
  };

  const resetPassword = async (id: string) => {
    setBusyId(id);
    setError('');
    try {
      const response = await fetch('/api/admin/admins', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, password: newPassword }),
      });
      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setError(result?.error ?? `No se pudo cambiar la contraseña (error ${response.status}).`);
        return;
      }
      setResettingId(null);
      setNewPassword('');
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (account: AdminAccountInfo) => {
    if (!window.confirm(`¿Eliminar al administrador @${account.username}? Perderá el acceso al panel.`)) return;
    setBusyId(account.id);
    setError('');
    try {
      const response = await fetch(`/api/admin/admins?id=${encodeURIComponent(account.id)}`, { method: 'DELETE' });
      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(result?.error ?? `No se pudo eliminar (error ${response.status}).`);
        return;
      }
      await reload();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="border-0 shadow-sm ring-slate-200">
        <CardContent>
          <form onSubmit={(event) => void create(event)} className="space-y-3">
            <label className="block text-xs font-black uppercase text-slate-400">Nuevo administrador de comunidad</label>
            <div className="grid gap-2 sm:grid-cols-[1fr_1fr_12rem]">
              <Input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="off"
                maxLength={31}
                placeholder="@usuario"
                aria-label="Usuario del administrador"
              />
              <Input
                type="text"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="off"
                placeholder={`Contraseña (mín. ${MIN_ADMIN_PASSWORD_LENGTH})`}
                aria-label="Contraseña del administrador"
              />
              <NativeSelect value={chosenCommunity} onChange={(event) => setCommunitySlug(event.target.value)} aria-label="Comunidad que administra">
                {(communities ?? []).map((community) => (
                  <NativeSelectOption key={community.slug} value={community.slug}>
                    {community.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={!canCreate} className="bg-[#a91d43] font-black text-white hover:bg-[#8f1738]">
                {creating ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                Crear administrador
              </Button>
              <span className="text-xs text-slate-500">
                {username.trim() && !usernameValid
                  ? 'Usuario no válido: 2-30 caracteres, minúsculas, números, punto, guion o guion bajo.'
                  : 'Solo verá y podrá editar su comunidad: MVP, once, goleadores y los comentarios de su grada. Pásale la contraseña por un canal privado.'}
              </span>
            </div>
            {error && <p className="text-sm font-bold text-[#a91d43]">{error}</p>}
          </form>
        </CardContent>
      </Card>
      {admins === null ? (
        <p className="text-sm font-bold text-slate-400">Cargando administradores…</p>
      ) : (
        <div className="space-y-2">
          {admins.map((account) => (
            <Card key={account.id} className="border-0 shadow-sm ring-slate-200">
              <CardContent className="space-y-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <strong className="text-[#071527]">@{account.username}</strong>
                    <span
                      className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${account.role === 'super' ? 'bg-rose-50 text-[#a91d43]' : 'bg-sky-50 text-[#153e72]'}`}
                    >
                      {account.role === 'super' ? 'Super administrador' : `Admin de ${communityName(account.communitySlug)}`}
                    </span>
                    <p className="text-xs text-slate-400">Creado el {dateFormatter.format(new Date(account.createdAt))}</p>
                  </div>
                  {account.role === 'community' && (
                    <div className="flex shrink-0 items-center gap-2">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setResettingId((current) => (current === account.id ? null : account.id));
                          setNewPassword('');
                        }}
                      >
                        Cambiar contraseña
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        aria-label={`Eliminar a @${account.username}`}
                        disabled={busyId === account.id}
                        onClick={() => void remove(account)}
                        className="border-rose-200 text-[#a91d43] hover:bg-rose-50"
                      >
                        {busyId === account.id ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                      </Button>
                    </div>
                  )}
                </div>
                {resettingId === account.id && (
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      type="text"
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                      autoComplete="off"
                      placeholder={`Nueva contraseña (mín. ${MIN_ADMIN_PASSWORD_LENGTH})`}
                      aria-label={`Nueva contraseña de @${account.username}`}
                    />
                    <Button
                      disabled={newPassword.length < MIN_ADMIN_PASSWORD_LENGTH || busyId === account.id}
                      onClick={() => void resetPassword(account.id)}
                      className="bg-[#a91d43] font-black text-white hover:bg-[#8f1738]"
                    >
                      Guardar contraseña
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// Cada administrador cambia su propia contraseña.
function PasswordPanel() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch('/api/admin/password', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setMessage({ ok: false, text: result?.error ?? `No se pudo cambiar la contraseña (error ${response.status}).` });
        return;
      }
      setCurrentPassword('');
      setNewPassword('');
      setMessage({ ok: true, text: 'Contraseña cambiada.' });
    } catch {
      setMessage({ ok: false, text: 'No se pudo conectar. Inténtalo de nuevo.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border-0 shadow-sm ring-slate-200">
      <CardContent>
        <form onSubmit={(event) => void save(event)} className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <Input
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              autoComplete="current-password"
              placeholder="Contraseña actual"
              aria-label="Contraseña actual"
            />
            <Input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete="new-password"
              placeholder={`Nueva contraseña (mín. ${MIN_ADMIN_PASSWORD_LENGTH})`}
              aria-label="Nueva contraseña"
            />
          </div>
          <div className="flex items-center gap-3">
            <Button
              type="submit"
              disabled={saving || !currentPassword || newPassword.length < MIN_ADMIN_PASSWORD_LENGTH}
              className="bg-[#a91d43] font-black text-white hover:bg-[#8f1738]"
            >
              {saving && <Loader2 className="size-4 animate-spin" />}
              Cambiar contraseña
            </Button>
            {message && (
              <span className={`text-sm font-bold ${message.ok ? 'text-emerald-700' : 'text-[#a91d43]'}`}>{message.text}</span>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// Título de una pestaña: compacto, sin tarjeta, para dejar sitio al contenido.
// Aviso push manual a los usuarios de la comunidad que tienen los avisos activados en su dispositivo.
function PushSender({ communitySlug, communityName }: { communitySlug: string; communityName: string }) {
  const MAX_TITLE = 60;
  const MAX_BODY = 180;
  type Audience = { configured: boolean; devices: number; users: number; match: string | null; pendingDevices: number; pendingUsers: number };
  type SendResult = { match: string | null; devices: number; sent: number; failed: number; removed: number; errors: Array<{ service: string; status: number | null; count: number; message: string }> };
  const [audience, setAudience] = useState<Audience | null>(null);
  const [title, setTitle] = useState('Granota App');
  const [message, setMessage] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<SendResult | null>(null);
  const [error, setError] = useState('');

  const loadAudience = () =>
    fetch(`/api/admin/push?community=${encodeURIComponent(communitySlug)}`)
      .then(async (response) => (response.ok ? ((await response.json()) as Audience) : null))
      .then(setAudience)
      .catch(() => setAudience(null));
  useEffect(() => {
    void loadAudience();
  }, []);

  const send = async () => {
    setSending(true);
    setError('');
    setResult(null);
    try {
      const response = await fetch('/api/admin/push', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ community: communitySlug, title, message }),
      });
      const body = (await response.json().catch(() => ({}))) as SendResult & { error?: string };
      if (!response.ok) throw new Error(body.error ?? 'No se pudo enviar el aviso.');
      setResult(body);
      setMessage('');
      void loadAudience();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'No se pudo enviar el aviso.');
    } finally {
      setSending(false);
      setConfirming(false);
    }
  };

  const devices = audience?.pendingDevices ?? 0;
  const canSend = Boolean(message.trim()) && devices > 0 && !sending && audience?.configured !== false;
  return (
    <Card className="border-0 shadow-sm ring-slate-200">
      <CardContent className="space-y-4">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
          {audience === null ? (
            'Comprobando cuántos usuarios tienen los avisos activados…'
          ) : audience.configured === false ? (
            <span className="font-bold text-[#a91d43]">Los avisos no están configurados en el servidor (faltan las claves VAPID).</span>
          ) : (
            <>
              <strong className="text-[#071527]">{audience.pendingUsers} {audience.pendingUsers === 1 ? 'usuario' : 'usuarios'}</strong> de {communityName} {audience.pendingUsers === 1 ? 'recibiría' : 'recibirían'} el aviso ({audience.pendingDevices} {audience.pendingDevices === 1 ? 'dispositivo' : 'dispositivos'}): los que aún no han publicado su previa{audience.match ? ` de ${audience.match}` : ''}.
              {' '}En total hay {audience.users} {audience.users === 1 ? 'usuario' : 'usuarios'} con los avisos activados ({audience.devices} {audience.devices === 1 ? 'dispositivo' : 'dispositivos'}). Los avisos vienen activados por defecto: cada usuario solo tiene que aceptar el permiso del navegador; en iPhone, además, con la web añadida a la pantalla de inicio.
            </>
          )}
        </div>
        <div>
          <label htmlFor="push-title" className="mb-1 block text-xs font-black uppercase text-slate-400">Título</label>
          <Input id="push-title" value={title} maxLength={MAX_TITLE} onChange={(event) => { setTitle(event.target.value); setConfirming(false); }} className="h-11" />
        </div>
        <div>
          <label htmlFor="push-message" className="mb-1 flex items-center justify-between text-xs font-black uppercase text-slate-400">
            <span>Mensaje</span>
            <span className={message.length > MAX_BODY - 20 ? 'text-[#a91d43]' : ''}>{message.length}/{MAX_BODY}</span>
          </label>
          <Textarea id="push-message" value={message} maxLength={MAX_BODY} rows={3} placeholder="Ej.: Esta tarde cierra la porra del Levante-Atlético. ¡Publica tu previa!" onChange={(event) => { setMessage(event.target.value); setConfirming(false); }} />
        </div>
        {message.trim() && (
          <div className="rounded-2xl bg-[#071527] p-4 text-white">
            <p className="text-[10px] font-black uppercase tracking-widest text-sky-200">Así se verá en el móvil</p>
            <strong className="mt-1 block">{title.trim() || 'Granota App'}</strong>
            <p className="text-sm text-slate-200">{message.trim()}</p>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          {confirming ? (
            <>
              <Button onClick={() => void send()} disabled={sending} className="bg-[#a91d43] font-black text-white">
                {sending ? <Loader2 className="animate-spin" /> : `Sí, enviar a ${devices} ${devices === 1 ? 'dispositivo' : 'dispositivos'}`}
              </Button>
              <Button variant="outline" onClick={() => setConfirming(false)} disabled={sending}>Cancelar</Button>
            </>
          ) : (
            <Button onClick={() => setConfirming(true)} disabled={!canSend} className="bg-[#153e72] font-black text-white">
              <Bell className="size-4" /> Enviar aviso
            </Button>
          )}
          {devices === 0 && audience?.configured !== false && audience !== null && <span className="text-xs font-bold text-amber-700">{audience.devices === 0 ? 'Nadie tiene los avisos activados todavía.' : 'Todos los que tienen los avisos ya han publicado su previa.'}</span>}
        </div>
        {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm font-bold text-[#a91d43]">{error}</p>}
        {result && (
          <div role="status" className={`rounded-xl p-3 text-sm ${result.failed ? 'bg-amber-50 text-amber-900' : 'bg-emerald-50 text-emerald-900'}`}>
            <strong className="block">Enviado a {result.sent} de {result.devices} {result.devices === 1 ? 'dispositivo' : 'dispositivos'} (usuarios sin previa{result.match ? ` de ${result.match}` : ''}).</strong>
            <span className="block text-xs">Que el servicio de Apple o Google lo acepte no garantiza que se muestre: depende de que el móvil lo reciba.</span>
            {result.removed > 0 && <span className="mt-1 block text-xs">{result.removed} {result.removed === 1 ? 'dispositivo ya no existía' : 'dispositivos ya no existían'} (app desinstalada o permiso retirado) y se {result.removed === 1 ? 'ha borrado' : 'han borrado'} de la lista.</span>}
            {result.errors.map((item) => (
              <span key={`${item.service}-${item.status}`} className="mt-1 block text-xs font-bold">
                {item.count} {item.count === 1 ? 'fallo' : 'fallos'} con {item.service} (código {item.status ?? 'sin respuesta'}){item.message ? `: ${item.message}` : ''}
              </span>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SectionHeading({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h2 className="text-lg font-black text-[#071527]">{title}</h2>
      <p className="text-sm text-slate-500">{description}</p>
    </div>
  );
}

type AdminTab = 'comunidades' | 'administradores' | 'mvp' | 'partidos' | 'moderacion' | 'avisos' | 'contrasena';

export default function AdminPage() {
  // undefined = comprobando sesión · null = sin sesión
  const [admin, setAdmin] = useState<AdminSessionInfo | null | undefined>(undefined);
  const [communities, setCommunities] = useState<AdminCommunity[] | null>(null);
  const [admins, setAdmins] = useState<AdminAccountInfo[] | null>(null);
  const [selectedSlug, setSelectedSlug] = useState(DEFAULT_COMMUNITY_SLUG);
  const [tab, setTab] = useState<AdminTab | null>(null);
  // Jornada que se está editando (la comparten "MVP" y "Partidos oficiales")
  const [matchday, setMatchday] = useState(latestPlayedMatchday);

  const loadSession = () =>
    fetch('/api/admin/login')
      .then(async (response) => (await response.json()) as { authenticated: boolean; admin?: AdminSessionInfo })
      .then((result) => setAdmin(result.authenticated && result.admin ? result.admin : null))
      .catch(() => setAdmin(null));

  const loadCommunities = () =>
    fetch('/api/admin/communities')
      .then(async (response) => (await response.json()) as { communities?: AdminCommunity[] })
      .then((result) => setCommunities(result.communities ?? []))
      .catch(() => setCommunities([]));

  const loadAdmins = () =>
    fetch('/api/admin/admins')
      .then(async (response) => (await response.json()) as { admins?: AdminAccountInfo[] })
      .then((result) => setAdmins(result.admins ?? []))
      .catch(() => setAdmins([]));

  useEffect(() => {
    void loadSession();
  }, []);

  const isSuper = admin?.role === 'super';
  useEffect(() => {
    if (isSuper) {
      void loadCommunities();
      void loadAdmins();
    }
  }, [isSuper]);

  const tabs: Array<{ id: AdminTab; label: string; icon: typeof Globe; superOnly?: boolean }> = [
    { id: 'comunidades', label: 'Comunidades', icon: Globe, superOnly: true },
    { id: 'administradores', label: 'Administradores', icon: UserCog, superOnly: true },
    { id: 'mvp', label: 'MVP', icon: Star },
    { id: 'partidos', label: 'Formación, resultado y goles', icon: ClipboardList },
    { id: 'moderacion', label: 'Moderación', icon: MessageSquare },
    { id: 'avisos', label: 'Avisos', icon: Bell },
    { id: 'contrasena', label: 'Mi contraseña', icon: KeyRound },
  ];
  const availableTabs = tabs.filter((item) => isSuper || !item.superOnly);
  const activeTab: AdminTab | null = admin ? (availableTabs.find((item) => item.id === tab)?.id ?? availableTabs[0].id) : null;
  useEffect(() => {
    if (!admin) return;
    const fromHash = window.location.hash.replace('#', '') as AdminTab;
    if (availableTabs.some((item) => item.id === fromHash)) setTab(fromHash);
  }, [admin]);
  const selectTab = (next: AdminTab) => {
    setTab(next);
    window.history.replaceState(null, '', `#${next}`);
  };

  const logout = async () => {
    await fetch('/api/admin/login', { method: 'DELETE' });
    setCommunities(null);
    setAdmins(null);
    setAdmin(null);
  };

  if (admin === undefined) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#071527]">
        <Loader2 className="size-8 animate-spin text-white/60" />
      </div>
    );
  }

  if (admin === null) {
    return <LoginGate onAuthenticated={() => void loadSession()} />;
  }

  // Comunidad sobre la que se editan MVP, once, goleadores y comentarios.
  const managedSlug = isSuper ? selectedSlug : admin.communitySlug ?? DEFAULT_COMMUNITY_SLUG;
  const managedName = isSuper
    ? communities?.find((community) => community.slug === managedSlug)?.name ?? managedSlug
    : admin.communityName ?? managedSlug;

  const communityTabs: AdminTab[] = ['mvp', 'partidos', 'moderacion'];

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      <header className="bg-[#071527] px-4 pt-5 text-white sm:px-8">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 pb-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/10">
              <Shield className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs font-black uppercase tracking-widest text-sky-300">
                {isSuper ? 'Super administrador' : `Administrador de ${admin.communityName ?? admin.communitySlug}`} · @{admin.username}
              </p>
              <strong className="text-lg font-black">Panel de administración</strong>
            </div>
          </div>
          <Button variant="outline" onClick={() => void logout()} className="shrink-0 border-white/20 bg-transparent text-white hover:bg-white/10">
            Cerrar sesión
          </Button>
        </div>
        <nav className="mx-auto flex max-w-5xl gap-1 overflow-x-auto" role="tablist" aria-label="Secciones del panel">
          {availableTabs.map((item) => {
            const Icon = item.icon;
            const active = item.id === activeTab;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => selectTab(item.id)}
                className={`inline-flex shrink-0 items-center gap-2 rounded-t-xl px-4 py-2.5 text-sm font-black transition ${
                  active ? 'bg-slate-50 text-[#071527]' : 'text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon className="size-4" />
                {item.label}
              </button>
            );
          })}
        </nav>
      </header>
      <main className="mx-auto max-w-5xl space-y-5 px-4 py-6 sm:px-8">
        {isSuper && activeTab !== null && communityTabs.includes(activeTab) && (
          <div className="flex flex-col gap-2 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200 sm:flex-row sm:items-center sm:justify-between">
            <label htmlFor="managed-community" className="text-xs font-black uppercase tracking-wider text-slate-400">
              Comunidad que gestionas
            </label>
            <NativeSelect
              id="managed-community"
              value={selectedSlug}
              onChange={(event) => setSelectedSlug(event.target.value)}
              className="w-full sm:w-72"
            >
              {(communities ?? [{ slug: DEFAULT_COMMUNITY_SLUG, name: 'Granota App' }]).map((community) => (
                <NativeSelectOption key={community.slug} value={community.slug}>
                  {community.name} (/{community.slug})
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
        )}
        {activeTab === 'comunidades' && (
          <section className="space-y-4" role="tabpanel">
            <SectionHeading
              title="Comunidades"
              description="Cada comunidad tiene su propia dirección, con los mismos partidos y funciones, pero sus propios usuarios, predicciones y clasificación."
            />
            <CommunitiesPanel communities={communities} reload={loadCommunities} admins={admins} reloadAdmins={loadAdmins} />
          </section>
        )}
        {activeTab === 'administradores' && (
          <section className="space-y-4" role="tabpanel">
            <SectionHeading
              title="Administradores"
              description="Los super administradores tienen acceso a todo. Cada comunidad puede tener su propio administrador, que solo gestiona esa comunidad."
            />
            <AdminsPanel communities={communities} admins={admins} reload={loadAdmins} />
          </section>
        )}
        {activeTab === 'mvp' && (
          <section className="space-y-4" role="tabpanel">
            <SectionHeading
              title="MVP por jornada"
              description={`Elige la jornada y el MVP de ${managedName}. Se muestra en Inicio y en el detalle de Jornada de esa comunidad.`}
            />
            <MvpEditor key={managedSlug} communitySlug={managedSlug} matchday={matchday} onMatchdayChange={setMatchday} />
          </section>
        )}
        {activeTab === 'partidos' && (
          <section className="space-y-4" role="tabpanel">
            <SectionHeading
              title="Formación, resultado y goles"
              description={`Elige la jornada e introduce el resultado, la formación, el once y los goleadores (el MVP se elige en su pestaña). Al guardar, la clasificación de La Grada de ${managedName} usa esos datos.`}
            />
            <MatchReportEditor key={managedSlug} communitySlug={managedSlug} matchday={matchday} onMatchdayChange={setMatchday} />
          </section>
        )}
        {activeTab === 'moderacion' && (
          <section className="space-y-4" role="tabpanel">
            <SectionHeading
              title="Moderación de La Grada"
              description={`Predicciones publicadas por los usuarios de ${managedName}. Abre un usuario para ver sus predicciones y borra una o todas si el apodo falta al respeto.`}
            />
            <PredictionsModeration key={managedSlug} communitySlug={managedSlug} />
          </section>
        )}
        {activeTab === 'avisos' && (
          <section className="space-y-4" role="tabpanel">
            <SectionHeading
              title="Avisos a los usuarios"
              description={`Envía una notificación al móvil de los usuarios de ${managedName} que tengan los avisos activados.`}
            />
            <PushSender key={managedSlug} communitySlug={managedSlug} communityName={managedName} />
          </section>
        )}
        {activeTab === 'contrasena' && (
          <section className="space-y-4" role="tabpanel">
            <SectionHeading title="Mi contraseña" description="Cambia la contraseña con la que entras a este panel." />
            <PasswordPanel />
          </section>
        )}
      </main>
    </div>
  );
}
