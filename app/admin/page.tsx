'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { Check, Copy, ImagePlus, Loader2, Pencil, Plus, Shield, Trash2 } from 'lucide-react';
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
import { CommunityHeroCard } from '@/components/community-hero';

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
  onSaved: () => Promise<void>;
  onCancel: () => void;
}) {
  const current = resolveCommunityIdentity(community.slug, community);
  const [title, setTitle] = useState(current.title);
  const [subtitle, setSubtitle] = useState(current.eyebrow);
  // undefined = sin cambios · '' = sin imagen · data URL = imagen nueva
  const [newImage, setNewImage] = useState<string | undefined>(undefined);
  const [color, setColor] = useState(current.color ?? DEFAULT_HEADER_COLOR);
  // Portada de Inicio. Título vacío = portada estándar.
  const [heroTitle, setHeroTitle] = useState(community.heroTitle ?? '');
  const [heroSubtitle, setHeroSubtitle] = useState(community.heroSubtitle ?? '');
  // undefined = sin cambios · '' = sin imagen · data URL = imagen nueva
  const [newHeroImage, setNewHeroImage] = useState<string | undefined>(undefined);
  const [processingHero, setProcessingHero] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const logoSrc = newImage === undefined ? current.logoSrc : newImage || undefined;
  const colorReadable = isReadableHeaderColor(color);
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
    return { ...base, imageUrl: newHeroImage === undefined ? base.imageUrl : newHeroImage || undefined };
  })();
  const canSave =
    title.trim().length > 0 && subtitle.trim().length > 0 && colorReadable && !heroTooLong &&
    !processing && !processingHero && !saving;

  const chooseImage = async (file: File | undefined) => {
    if (!file) return;
    setProcessing(true);
    setError('');
    try {
      setNewImage(await resizeImageToDataUrl(file));
    } catch {
      setError('No se pudo procesar la imagen. Prueba con otra (JPG, PNG o WebP).');
    } finally {
      setProcessing(false);
    }
  };

  const chooseHeroImage = async (file: File | undefined) => {
    if (!file) return;
    setProcessingHero(true);
    setError('');
    try {
      setNewHeroImage(await fitImageToDataUrl(file));
    } catch {
      setError('No se pudo procesar la imagen de la portada. Prueba con otra (JPG, PNG o WebP).');
    } finally {
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
          ...(newHeroImage === undefined ? {} : { heroImage: newHeroImage }),
          ...(newImage === undefined ? {} : { headerImage: newImage }),
        }),
      });
      if (!response.ok) {
        const result = (await response.json()) as { error?: string };
        setError(result.error ?? 'No se pudieron guardar los cambios.');
        return;
      }
      await onSaved();
    } catch {
      setError('No se pudo conectar. Inténtalo de nuevo.');
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
        {heroPreview && (
          <div className="pointer-events-none select-none" aria-hidden="true">
            <CommunityHeroCard hero={heroPreview} onPredict={() => undefined} onRules={() => undefined} />
          </div>
        )}
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
      </div>
      {error && <p className="text-sm font-bold text-[#a91d43]">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={!canSave} className="bg-[#a91d43] font-black text-white hover:bg-[#8f1738]">
          {saving && <Loader2 className="size-4 animate-spin" />}
          Guardar cambios
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

function CommunitiesPanel() {
  const [communities, setCommunities] = useState<AdminCommunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
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
               {editing === community.slug && (
                <CommunityHeaderEditor
                  community={community}
                  onCancel={() => setEditing(null)}
                  onSaved={async () => {
                    await load();
                    setEditing(null);
                  }}
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
