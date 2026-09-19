'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { Check, Copy, Loader2, Plus, Shield, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import { levanteMatchReports, levanteMatches, levantePlayers } from '@/lib/levante-data';
import { formations, formationOptions, type SavedLineup } from '@/lib/formations';
import { resolveMvp, type MvpOverride } from '@/components/sections';
import type { FootballDataPayload } from '@/lib/football-data-types';
import type { AdminCommunity } from '@/lib/community-types';
import { DEFAULT_COMMUNITY_SLUG, isValidCommunitySlug, slugifyCommunityName } from '@/lib/community-shared';

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
        body: JSON.stringify({ password }),
      });
      if (!response.ok) {
        const result = (await response.json()) as { error?: string };
        setError(result.error ?? 'No se pudo entrar.');
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
          Acceso solo para el equipo de Granota App.
        </p>
        <Input
          type="password"
          autoFocus
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
            setError('');
          }}
          placeholder="Contraseña de administrador"
          className="mt-6 h-12"
        />
        {error && (
          <p role="alert" className="mt-3 rounded-xl bg-rose-50 p-3 text-sm font-bold text-[#a91d43]">
            {error}
          </p>
        )}
        <Button
          type="submit"
          disabled={loading || password.length === 0}
          className="mt-4 h-12 w-full bg-[#a91d43] font-black text-white"
        >
          {loading ? <Loader2 className="animate-spin" /> : 'Entrar'}
        </Button>
      </form>
    </div>
  );
}

function MvpEditor() {
  const [footballData, setFootballData] = useState<FootballDataPayload | null>(null);
  const [overrides, setOverrides] = useState<MvpOverride[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Record<number, { playerId: string; reason: string }>>({});
  const [savingMatchday, setSavingMatchday] = useState<number | null>(null);
  const [savedMatchday, setSavedMatchday] = useState<number | null>(null);

  const loadOverrides = () =>
    fetch('/api/mvp')
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
        body: JSON.stringify({ matchday, playerId: draft.playerId, reason: draft.reason }),
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
    <div className="space-y-3">
      {sortedMatches.length === 0 && (
        <p className="text-sm text-slate-500">Todavía no hay jornadas disponibles.</p>
      )}
      {sortedMatches.map((match) => {
        const draft = draftFor(match.matchday);
        const isFinished = match.status === 'FINISHED';
        return (
          <Card key={match.id} className="border-0 shadow-sm ring-slate-200">
            <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="w-full sm:w-48 sm:shrink-0">
                <strong className="block text-sm text-[#071527]">
                  Jornada {match.matchday}
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

function MatchReportEditor() {
  type MatchReportDraft = {
    homeScore: number;
    awayScore: number;
    formation: SavedLineup['formation'];
    lineup: SavedLineup;
    scorers: string[];
    mvp: string;
    reason: string;
  };

  const [reports, setReports] = useState<Record<number, MatchReportDraft>>({});
  const [loading, setLoading] = useState(true);
  const [savingMatchday, setSavingMatchday] = useState<number | null>(null);
  const [savedMatchday, setSavedMatchday] = useState<number | null>(null);

  const loadReports = async () => {
    const response = await fetch('/api/admin/matches');
    const result = (await response.json()) as { reports?: Array<{ matchday: number; homeScore: number; awayScore: number; formation: SavedLineup['formation']; lineup: SavedLineup; scorers: string[]; mvp: string | null; reason: string }> };
    const next: Record<number, MatchReportDraft> = {};
    for (const item of result.reports ?? []) {
      next[item.matchday] = {
        homeScore: item.homeScore,
        awayScore: item.awayScore,
        formation: item.formation,
        lineup: item.lineup ?? { formation: '4-3-3', players: Array(11).fill('') },
        scorers: item.scorers ?? [],
        mvp: item.mvp ?? '',
        reason: item.reason ?? '',
      };
    }
    setReports(next);
  };

  useEffect(() => {
    void loadReports().finally(() => setLoading(false));
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
      scorers: report.levanteGoals.map((goal) => playerIdForName(goal.playerName)).filter(Boolean),
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
      mvp: '',
      reason: '',
    };
    return fallbackDraft;
  };

  const save = async (matchday: number) => {
    const draft = draftFor(matchday);
    if (!draft.formation || draft.lineup.players.length !== 11 || !draft.mvp) return;
    setSavingMatchday(matchday);
    try {
      const response = await fetch('/api/admin/matches', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          matchday,
          homeScore: draft.homeScore,
          awayScore: draft.awayScore,
          formation: draft.formation,
          lineup: draft.lineup,
          scorers: draft.scorers,
          mvp: draft.mvp,
          reason: draft.reason,
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
      {levanteMatches.map((match) => {
        const draft = draftFor(match.matchday);
        const slots = formations[draft.formation as keyof typeof formations]?.slots ?? formations['4-3-3'].slots;
        return (
          <Card key={match.id} className="border-0 shadow-sm ring-slate-200">
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <strong className="block text-[#071527]">Jornada {match.matchday}</strong>
                  <span className="text-sm text-slate-500">{match.homeTeam} vs {match.awayTeam}</span>
                </div>
                <Button
                  onClick={() => void save(match.matchday)}
                  disabled={savingMatchday === match.matchday || !draft.mvp}
                  className="bg-[#a91d43] font-black text-white"
                >
                  {savingMatchday === match.matchday ? <Loader2 className="animate-spin" /> : savedMatchday === match.matchday ? 'Guardado ✓' : 'Guardar'}
                </Button>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
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
                  }} className="h-11">
                    {formationOptions.map((option) => (
                      <NativeSelectOption key={option} value={option}>{option}</NativeSelectOption>
                    ))}
                  </NativeSelect>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {slots.map((slot, index) => (
                  <div key={`${match.matchday}-${slot.id}`}>
                    <label className="mb-1 block text-xs font-black uppercase text-slate-400">{slot.label}</label>
                    <NativeSelect value={draft.lineup.players[index] ?? ''} onChange={(event) => {
                      const players = [...draft.lineup.players];
                      players[index] = event.target.value;
                      const nextLineup: SavedLineup = { formation: draft.formation, players };
                      setReports((current) => ({ ...current, [match.matchday]: { ...draftFor(match.matchday), lineup: nextLineup } }));
                    }} className="h-11">
                      <NativeSelectOption value="">Sin elegir</NativeSelectOption>
                      {levantePlayers.map((player) => (
                        <NativeSelectOption key={player.id} value={player.id}>{player.displayName}</NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </div>
                ))}
              </div>
              <div>
                <label className="mb-2 block text-xs font-black uppercase text-slate-400">Goleadores</label>
                <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                  {levantePlayers.map((player) => (
                    <label key={`${match.matchday}-scorer-${player.id}`} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-2 py-2 text-sm">
                      <input type="checkbox" checked={draft.scorers.includes(player.id)} onChange={() => {
                        const scorers = draft.scorers.includes(player.id)
                          ? draft.scorers.filter((id) => id !== player.id)
                          : [...draft.scorers, player.id];
                        setReports((current) => ({ ...current, [match.matchday]: { ...draftFor(match.matchday), scorers } }));
                      }} />
                      {player.displayName}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-black uppercase text-slate-400">MVP</label>
                <NativeSelect value={draft.mvp} onChange={(event) => setReports((current) => ({ ...current, [match.matchday]: { ...draftFor(match.matchday), mvp: event.target.value } }))} className="h-11">
                  <NativeSelectOption value="">Elige MVP</NativeSelectOption>
                  {levantePlayers.map((player) => (
                    <NativeSelectOption key={`${match.matchday}-mvp-${player.id}`} value={player.id}>{player.displayName}</NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>
              <div>
                <label className="mb-1 block text-xs font-black uppercase text-slate-400">Nota / motivo</label>
                <Textarea value={draft.reason} onChange={(event) => setReports((current) => ({ ...current, [match.matchday]: { ...draftFor(match.matchday), reason: event.target.value } }))} rows={2} placeholder="Motivo del MVP o nota del partido" />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function CommunitiesPanel() {
  const [communities, setCommunities] = useState<AdminCommunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const [origin, setOrigin] = useState('');

  const load = () =>
    fetch('/api/admin/communities')
      .then(async (response) => (await response.json()) as { communities?: AdminCommunity[] })
      .then((result) => setCommunities(result.communities ?? []))
      .catch(() => setCommunities([]));

  useEffect(() => {
    setOrigin(window.location.origin);
    void load().finally(() => setLoading(false));
  }, []);

  const slug = slugifyCommunityName(name);
  const preview = name.trim() && isValidCommunitySlug(slug) ? `${origin}/${slug}` : null;

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
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(result.error ?? 'No se pudo crear la comunidad.');
        return;
      }
      setName('');
      await load();
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
              <Button type="submit" disabled={creating || !preview} className="bg-[#a91d43] font-black text-white hover:bg-[#8f1738]">
                {creating ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                Crear comunidad
              </Button>
            </div>
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
      {loading ? (
        <p className="text-sm font-bold text-slate-400">Cargando comunidades…</p>
      ) : (
        <div className="space-y-2">
          {communities.map((community) => (
            <Card key={community.slug} className="border-0 shadow-sm ring-slate-200">
              <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
                <Button variant="outline" onClick={() => void copy(community.slug)} className="shrink-0">
                  {copied === community.slug ? <Check className="size-4" /> : <Copy className="size-4" />}
                  {copied === community.slug ? 'Copiado' : 'Copiar enlace'}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function PredictionsModeration() {
  const [predictions, setPredictions] = useState<AdminPrediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = () =>
    fetch('/api/admin/predictions')
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
      await fetch(`/api/admin/predictions?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const deleteAllForUser = async (userId: string, nickname: string) => {
    if (!window.confirm(`¿Eliminar TODAS las predicciones de @${nickname}?`)) return;
    setBusyId(userId);
    try {
      await fetch(`/api/admin/predictions?userId=${encodeURIComponent(userId)}`, { method: 'DELETE' });
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

  return (
    <div className="space-y-4">
      {grouped.map(([userId, group]) => (
        <Card key={userId} className="border-0 shadow-sm ring-slate-200">
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-full bg-rose-100 text-sm font-black text-[#a91d43]">
                  {group.avatarUrl ? (
                    <Image unoptimized src={group.avatarUrl} width={80} height={80} alt="" className="h-full w-full object-cover" />
                  ) : (
                    group.nickname.slice(0, 2).toUpperCase()
                  )}
                </span>
                <strong className="text-[#071527]">@{group.nickname}</strong>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-slate-500">
                  /{group.communitySlug}
                </span>
                <span className="text-xs font-bold text-slate-400">
                  {group.predictions.length} {group.predictions.length === 1 ? 'predicción' : 'predicciones'}
                </span>
              </div>
              <Button
                variant="outline"
                disabled={busyId === userId}
                onClick={() => void deleteAllForUser(userId, group.nickname)}
                className="border-rose-200 text-[#a91d43] hover:bg-rose-50"
              >
                <Trash2 className="size-4" /> Eliminar todas
              </Button>
            </div>
            <div className="space-y-2">
              {group.predictions.map((prediction) => {
                const match = levanteMatches.find((item) => item.id === prediction.matchId);
                return (
                  <div
                    key={prediction.id}
                    className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-bold text-[#071527]">
                        {match ? `J${match.matchday} · ${match.homeTeam} vs ${match.awayTeam}` : prediction.matchId}
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
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    void fetch('/api/admin/login')
      .then(async (response) => (await response.json()) as { authenticated: boolean })
      .then((result) => setAuthenticated(result.authenticated))
      .catch(() => setAuthenticated(false));
  }, []);

  const logout = async () => {
    await fetch('/api/admin/login', { method: 'DELETE' });
    setAuthenticated(false);
  };

  if (authenticated === null) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#071527]">
        <Loader2 className="size-8 animate-spin text-white/60" />
      </div>
    );
  }

  if (!authenticated) {
    return <LoginGate onAuthenticated={() => setAuthenticated(true)} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      <header className="border-b border-white/10 bg-[#071527] px-4 py-5 text-white sm:px-8">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-white/10">
              <Shield className="size-5" />
            </span>
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-sky-300">
                Granota App
              </p>
              <strong className="text-lg font-black">Panel de administración</strong>
            </div>
          </div>
          <Button variant="outline" onClick={() => void logout()} className="border-white/20 bg-transparent text-white hover:bg-white/10">
            Cerrar sesión
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-5xl space-y-10 px-4 py-8 sm:px-8">
        <section>
          <Card className="border-0 shadow-sm ring-slate-200">
            <CardHeader>
              <CardTitle className="font-black text-[#071527]">Comunidades</CardTitle>
              <p className="text-sm text-slate-500">
                Cada comunidad tiene su propia dirección, con los mismos partidos y funciones, pero sus
                propios usuarios, predicciones y clasificación.
              </p>
            </CardHeader>
          </Card>
          <div className="mt-4">
            <CommunitiesPanel />
          </div>
        </section>
        <section>
          <Card className="border-0 shadow-sm ring-slate-200">
            <CardHeader>
              <CardTitle className="font-black text-[#071527]">MVP por jornada</CardTitle>
              <p className="text-sm text-slate-500">
                Elige el MVP de cada jornada jugada. Se muestra en Inicio y en el
                detalle de Jornada.
              </p>
            </CardHeader>
          </Card>
          <div className="mt-4">
            <MvpEditor />
          </div>
        </section>
        <section>
          <Card className="border-0 shadow-sm ring-slate-200">
            <CardHeader>
              <CardTitle className="font-black text-[#071527]">Partidos oficiales</CardTitle>
              <p className="text-sm text-slate-500">
                Introduce el resultado, la formación, el once, los goleadores y el MVP de cada partido.
                Al guardar, la clasificación de la Grada usa esos datos oficiales.
              </p>
            </CardHeader>
          </Card>
          <div className="mt-4">
            <MatchReportEditor />
          </div>
        </section>
        <section>
          <Card className="border-0 shadow-sm ring-slate-200">
            <CardHeader>
              <CardTitle className="font-black text-[#071527]">Moderación de La Grada</CardTitle>
              <p className="text-sm text-slate-500">
                Predicciones publicadas por los usuarios de todas las comunidades. Borra una predicción o
                todas las de un usuario si el apodo falta al respeto.
              </p>
            </CardHeader>
          </Card>
          <div className="mt-4">
            <PredictionsModeration />
          </div>
        </section>
      </main>
    </div>
  );
}
