'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { Loader2, Shield, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import { levanteMatches, levantePlayers } from '@/lib/levante-data';
import { resolveMvp, type MvpOverride } from '@/components/sections';
import type { FootballDataPayload } from '@/lib/football-data-types';

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
  const finished = useMemo(
    () => matches.filter((match) => match.status === 'FINISHED').sort((a, b) => b.matchday - a.matchday),
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
      {finished.length === 0 && (
        <p className="text-sm text-slate-500">Todavía no hay jornadas jugadas.</p>
      )}
      {finished.map((match) => {
        const draft = draftFor(match.matchday);
        return (
          <Card key={match.id} className="border-0 shadow-sm ring-slate-200">
            <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="w-full sm:w-48 sm:shrink-0">
                <strong className="block text-sm text-[#071527]">
                  Jornada {match.matchday}
                </strong>
                <p className="text-xs text-slate-500">
                  {match.homeTeam} {match.homeScore}-{match.awayScore} {match.awayTeam}
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
    const byUser = new Map<string, { nickname: string; avatarUrl: string | null; predictions: AdminPrediction[] }>();
    for (const prediction of predictions) {
      const entry = byUser.get(prediction.userId) ?? {
        nickname: prediction.nickname,
        avatarUrl: prediction.avatarUrl,
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
              <CardTitle className="font-black text-[#071527]">Moderación de La Grada</CardTitle>
              <p className="text-sm text-slate-500">
                Predicciones publicadas por los usuarios. Borra una predicción o
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
