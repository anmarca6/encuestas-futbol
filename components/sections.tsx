'use client';

import { useEffect, useState } from 'react';
import {
  Award,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Crown,
  Goal,
  MessageCircleMore,
  Minus,
  Plus,
  Pencil,
  Send,
  Settings,
  Shirt,
  Trophy,
  UserRound,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Registration } from '@/components/registration';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Heading, TeamCrest, TeamIdentity } from '@/components/shared';
import {
  LineupBuilder,
  LineupSummary,
  PlayerPhoto,
} from '@/components/lineup-builder';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import {
  LEVANTE_TEAM,
  levanteMatchReports,
  levanteMatches,
  levantePlayers,
  type LevanteMatch,
} from '@/lib/levante-data';
import {
  getLastLevanteMatch,
  getLevanteSeasonStats,
  getNextLevanteMatch,
  getRecentLevanteMatches,
  getUpcomingLevanteMatches,
} from '@/lib/levante-services';
import {
  getLeagueTeamById,
  getLevanteStanding,
  realLeagueStandings,
  type LeagueStanding,
} from '@/lib/laliga-data';
import type { FootballDataPayload } from '@/lib/football-data-types';
import type { PredictionDraft } from '@/lib/prediction-types';
import type { SavedLineup } from '@/lib/formations';
import { MAX_POINTS_PER_MATCH, predictionPoints } from '@/lib/scoring-rules';
import type {
  CommunityPrediction,
  CommunityRankingEntry,
  CommunityUser,
} from '@/lib/community-types';
import {
  formatPredictionDeadline,
  getPredictionDeadline,
  isPredictionClosed,
} from '@/lib/prediction-deadline';

const longDate = new Intl.DateTimeFormat('es-ES', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});
const shortDate = new Intl.DateTimeFormat('es-ES', {
  day: '2-digit',
  month: 'short',
  timeZone: 'UTC',
});
const formatDate = (date: string, short = false) =>
  (short ? shortDate : longDate)
    .format(new Date(`${date}T00:00:00Z`))
    .replace('.', '')
    .toUpperCase();
const signed = (value: number) => (value > 0 ? `+${value}` : `${value}`);

function usePredictionCountdown(match: LevanteMatch | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const deadline = match ? getPredictionDeadline(match) : null;
  const remaining = deadline ? Math.max(0, deadline.getTime() - now) : null;
  if (remaining === null) return { closed: false, label: 'Horario de cierre pendiente' };
  const seconds = Math.floor(remaining / 1000);
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return {
    closed: remaining === 0,
    label: days > 0
      ? `${days}d ${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s`
      : `${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s`,
  };
}

function CompactMatch({ match }: { match: LevanteMatch }) {
  return (
    <div className="grid grid-cols-[2.25rem_1fr_auto] items-center gap-3 rounded-2xl bg-slate-50 p-3 text-sm">
      <span className="font-black text-slate-400">J{match.matchday}</span>
      <div className="min-w-0 space-y-1.5">
        <TeamIdentity teamName={match.homeTeam} size="sm" shortOnMobile />
        <TeamIdentity teamName={match.awayTeam} size="sm" shortOnMobile />
        <small className="block text-slate-400">
          {formatDate(match.date, true)}
        </small>
      </div>
      <strong className="whitespace-nowrap rounded-lg bg-white px-2 py-1 text-[#071527] shadow-sm">
        {match.status === 'FINISHED'
          ? `${match.homeScore}-${match.awayScore}`
          : ''}
      </strong>
    </div>
  );
}

export function HomeSection({
  predict,
  hasPrediction,
  openRules,
  footballData,
}: {
  predict: () => void;
  hasPrediction: boolean;
  openRules: () => void;
  footballData: FootballDataPayload | null;
}) {
  const matches = footballData?.matches.length
    ? footballData.matches
    : levanteMatches;
  const standings = footballData?.standings.length
    ? footballData.standings
    : realLeagueStandings;
  const next = getNextLevanteMatch(matches),
    last = getLastLevanteMatch(matches),
    stats = getLevanteSeasonStats(matches),
    standing =
      standings.find((item) => item.teamId === 'levante-ud') ??
      getLevanteStanding();
  const countdown = usePredictionCountdown(next);
  return (
    <>
      <section className="mb-8 overflow-hidden rounded-[2rem] border border-slate-200 bg-white px-5 py-7 shadow-sm sm:px-8 sm:py-9">
        <p className="text-xs font-black uppercase tracking-[.2em] text-[#a91d43]">
          En clave granota
        </p>
        <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <h1 className="max-w-3xl text-3xl font-black tracking-[-.04em] text-[#071527] sm:text-5xl">
            Todo el Levante. En un solo sitio.
          </h1>
          <span className="w-fit shrink-0 rounded-full bg-[#071527] px-4 py-2 text-xs font-black text-white">
            Temporada 2026/27
          </span>
        </div>
        <div className="mt-6 space-y-2 text-sm font-bold leading-6 text-slate-600 sm:text-base">
          <p>📅 Partidos · ⚽ Resultados · 👕 Alineaciones · ⭐ MVP</p>
          <p>🎯 Pronósticos · 🏆 Puntos para aficionados</p>
        </div>
        <p className="mt-6 text-lg font-black text-[#a91d43] sm:text-xl">
          Participa. Acierta. Suma
        </p>
        <button
          type="button"
          onClick={openRules}
          className="mt-3 inline-flex items-center gap-2 text-sm font-black uppercase tracking-[.16em] text-[#153e72] underline decoration-[#a91d43] decoration-2 underline-offset-4 transition hover:text-[#a91d43]"
        >
          Cómo se juega <span aria-hidden="true">→</span>
        </button>
      </section>
      {next && (
        <section className="relative overflow-hidden rounded-[2rem] bg-[#071527] p-6 text-white shadow-2xl sm:p-9">
          <div className="absolute -right-12 -top-20 size-56 rounded-full bg-[#a91d43]/35 blur-3xl" />
          <div className="relative grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <span className="rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-widest text-sky-200">
                Próximo partido
              </span>
              <p className="mt-5 text-sm font-bold uppercase tracking-wider text-slate-400">
                {formatDate(next.date, true)} · Jornada {next.matchday}
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-4 text-2xl font-black sm:text-4xl">
                <TeamIdentity teamName={next.homeTeam} size="xl" bareCrest />
                <span className="text-[#d04a68]">vs</span>
                <TeamIdentity teamName={next.awayTeam} size="xl" bareCrest />
              </div>
            </div>
            <div className="min-w-64 rounded-2xl bg-white/10 p-4 text-center ring-1 ring-white/10">
              {countdown.closed ? (
                <p className="text-sm font-bold leading-6 text-slate-200">
                  No pasa nada que no hayas podido participar. Podrás intentarlo de nuevo en la predicción de la jornada {next.matchday + 1}.
                </p>
              ) : (
                <>
                  <p className="text-[10px] font-black uppercase tracking-widest text-sky-200">
                    Cierre de predicciones en
                  </p>
                  <strong className="mt-2 block tabular-nums text-2xl font-black">
                    {countdown.label}
                  </strong>
                  <Button
                    onClick={predict}
                    className="mt-4 h-11 w-full bg-[#b51f46] px-5 font-black text-white"
                  >
                    {hasPrediction ? <><Pencil className="size-4" /> Modificar</> : 'Participa →'}
                  </Button>
                  {hasPrediction && (
                    <Button
                      disabled
                      variant="outline"
                      className="mt-2 h-auto min-h-11 w-full whitespace-normal border-white/15 bg-white/5 px-4 py-2 text-xs font-black text-slate-400 opacity-100"
                    >
                      Participa · Disponible de nuevo en la próxima jornada
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </section>
      )}
      <div className="mt-6 grid gap-6 lg:grid-cols-[1.15fr_.85fr]">
        <div className="space-y-6">
          {last && (
            <Card className="border-0 bg-gradient-to-br from-[#153e72] to-[#071527] text-white ring-0">
              <CardContent>
                <p className="text-xs font-black uppercase tracking-widest text-sky-200">
                  Último partido · J{last.matchday}
                </p>
                <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                  <TeamIdentity teamName={last.homeTeam} size="lg" />
                  <strong className="text-2xl">
                    {last.homeScore}-{last.awayScore}
                  </strong>
                  <TeamIdentity teamName={last.awayTeam} size="lg" reverse />
                </div>
                <p className="mt-3 text-xs text-slate-400">
                  {formatDate(last.date)}
                </p>
              </CardContent>
            </Card>
          )}
          <Card className="border-0 shadow-sm ring-slate-200">
            <CardContent>
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <TeamCrest teamName={LEVANTE_TEAM} size="lg" />
                  <div>
                    <h3 className="font-black text-[#071527]">
                      Situación actual
                    </h3>
                    <p className="text-sm text-slate-500">
                      LaLiga · tras {stats.played} jornadas
                    </p>
                  </div>
                </div>
                {standing && (
                  <div className="text-right">
                    <strong className="block text-3xl font-black text-[#071527]">
                      {standing.position}.º
                    </strong>
                    <span className="text-xs font-black text-[#a91d43]">
                      {standing.points} PTS
                    </span>
                  </div>
                )}
              </div>
              <div className="mt-5 grid grid-cols-4 gap-3 sm:grid-cols-7">
                {[
                  ['PJ', stats.played],
                  ['G', stats.won],
                  ['E', stats.drawn],
                  ['P', stats.lost],
                  ['GF', stats.goalsFor],
                  ['GC', stats.goalsAgainst],
                  ['DG', stats.goalDifference],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-xl bg-slate-50 p-3 text-center"
                  >
                    <small className="block text-[10px] font-black uppercase tracking-wider text-slate-400">
                      {label}
                    </small>
                    <strong className="mt-1 block text-xl">{value}</strong>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm ring-slate-200">
            <CardContent>
              <h3 className="mb-4 font-black text-[#071527]">
                Últimos resultados
              </h3>
              <div className="space-y-2">
                {getRecentLevanteMatches(3, matches).map((match) => (
                  <CompactMatch key={match.id} match={match} />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
        <Card className="h-fit border-0 shadow-sm ring-slate-200">
          <CardHeader>
            <CardTitle className="font-black text-[#071527]">
              Próximos partidos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {getUpcomingLevanteMatches(5, matches).map((match) => (
              <CompactMatch key={match.id} match={match} />
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

export function GameRulesSection() {
  return (
    <>
      <Heading
        eyebrow="Participa · Acierta · Suma"
        title="Cómo se juega"
        description="Haz tu predicción antes de cada partido y compite con toda la afición granota."
      />
      <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="text-2xl font-black text-[#071527]">
            Predice, acierta y suma puntos
          </h2>
          <span className="w-fit rounded-full bg-rose-50 px-3 py-1.5 text-xs font-black text-[#a91d43]">
            {MAX_POINTS_PER_MATCH} puntos por jornada
          </span>
        </div>
        <div className="mt-6 grid gap-3 md:grid-cols-3">
          {[
            ['1', 'Haz tu predicción', 'Elige formación, XI, resultado, goleadores y MVP.'],
            ['2', 'Publica a tiempo', 'Las predicciones cierran 2 horas antes del partido.'],
            ['3', 'Sube en la clasificación', 'Tus puntos se acumulan jornada tras jornada.'],
          ].map(([number, title, description]) => (
            <div key={number} className="rounded-2xl bg-slate-50 p-5">
              <span className="grid size-9 place-items-center rounded-xl bg-sky-100 font-black text-[#153e72]">
                {number}
              </span>
              <h3 className="mt-3 font-black text-[#071527]">{title}</h3>
              <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
            </div>
          ))}
        </div>
        <h2 className="mt-8 text-lg font-black text-[#071527]">Así se reparten los puntos</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {predictionPoints.map(([label, points]) => (
            <div key={label} className="rounded-2xl bg-[#071527] p-4 text-white">
              <strong className="block text-2xl font-black text-sky-200">+{points}</strong>
              <span className="mt-1 block text-xs leading-5 text-slate-300">{label}</span>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

type CalendarFilter = 'RESULTADOS' | 'PRÓXIMOS' | 'CALENDARIO';
function CalendarMatch({
  match,
}: {
  match: LevanteMatch;
}) {
  const [open, setOpen] = useState(false);
  const report = levanteMatchReports[match.matchday];
  const scoringTeams = [match.homeTeam, match.awayTeam].filter((team) =>
    match.goals.some((goal) => goal.team === team),
  );
  return (
    <Card
      className={`border-0 py-0 shadow-sm ring-1 ${match.status === 'FINISHED' ? 'ring-slate-200' : 'ring-sky-200/80'}`}
    >
      <CardContent className="px-3 py-4 sm:px-5">
        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2 sm:gap-4">
          <div className="text-center">
            <span className="block text-sm font-black text-[#a91d43]">
              J{match.matchday}
            </span>
            <small className="whitespace-nowrap text-[10px] font-bold text-slate-400">
              {formatDate(match.date, true)}
            </small>
          </div>
          <div className="grid min-w-0 grid-cols-[1fr_auto_1fr] items-center gap-2 text-sm">
            <TeamIdentity teamName={match.homeTeam} size="sm" shortOnMobile />
            {match.status === 'FINISHED' ? (
              <span className="rounded-lg bg-[#071527] px-2 py-1.5 text-center text-xs font-black text-white">
                {match.homeScore} — {match.awayScore}
              </span>
            ) : (
              <span className="rounded-lg bg-sky-50 px-2 py-1.5 text-center text-xs font-black text-[#153e72]">
                Programado
              </span>
            )}
            <TeamIdentity
              teamName={match.awayTeam}
              size="sm"
              reverse
              shortOnMobile
            />
          </div>
          {match.status === 'FINISHED' && (
            <button
              onClick={() => setOpen(!open)}
              aria-expanded={open}
              aria-label={`Ver estadísticas de la jornada ${match.matchday}`}
              className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100"
            >
              <ChevronDown
                className={`size-4 transition ${open ? 'rotate-180' : ''}`}
              />
            </button>
          )}
        </div>
        {open && (
          <div className="mt-4 border-t border-slate-100 pt-4 text-sm">
            {report ? (
              <div className="grid gap-5 lg:grid-cols-[1fr_1.4fr]">
                <div className="space-y-4">
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs font-black uppercase tracking-wider text-[#a91d43]">
                      ⚽ Goleadores Levante
                    </p>
                    {report.levanteGoals.length === 0 ? (
                      <p className="mt-2 font-bold text-slate-600">Ninguno</p>
                    ) : (
                      <div className="mt-2 space-y-1 text-slate-700">
                        {report.levanteGoals.map((goal) => (
                          <p key={goal.playerName}>
                            <b>{goal.playerName}</b>{' '}
                            {goal.minutes.length > 1 ? '⚽⚽' : '⚽'}{' '}
                            {goal.minutes.map((minute) => `${minute}'`).join(' y ')}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="rounded-2xl bg-[#071527] p-4 text-white">
                    <p className="text-xs font-black uppercase tracking-wider text-sky-200">
                      📐 Formación
                    </p>
                    <p className="mt-2 text-xl font-black">{report.formation}</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <p className="mb-3 text-xs font-black uppercase tracking-wider text-[#a91d43]">
                      📋 Alineación del Levante
                    </p>
                    <div className="space-y-2">
                      {[
                        ['POR', report.lineup.goalkeeper],
                        ['DEF', report.lineup.defenders],
                        ['MED', report.lineup.midfielders],
                        ['ATA', report.lineup.attackers],
                      ].map(([position, players]) => (
                        <p
                          key={position as string}
                          className="rounded-xl bg-slate-50 px-3 py-2 text-slate-600"
                        >
                          <b className="mr-2 text-[#153e72]">{position}:</b>
                          {(players as string[]).join(', ')}
                        </p>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
                    <p className="text-xs font-black uppercase tracking-wider text-amber-700">
                      ⭐ MVP Levante
                    </p>
                    <p className="mt-2 leading-6">
                      <b>{report.mvp.playerName}</b> — {report.mvp.reason}
                    </p>
                  </div>
                </div>
              </div>
            ) : match.goals.length === 0 ? (
              <p className="text-slate-500">Sin goles.</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {scoringTeams.map((team) => (
                  <div key={team}>
                    <p className="mb-2 text-xs font-black uppercase tracking-wider text-[#a91d43]">
                      {team}
                    </p>
                    {match.goals
                      .filter((goal) => goal.team === team)
                      .map((goal, index) => (
                        <p
                          key={`${goal.playerName}-${goal.minute}-${index}`}
                          className="py-0.5 text-slate-600"
                        >
                          {goal.playerName} <b>{goal.minute}&apos;</b>
                        </p>
                      ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StandingsTable({ standings }: { standings: ReadonlyArray<LeagueStanding> }) {
  return (
    <Card className="overflow-hidden border-0 shadow-sm ring-slate-200">
      <CardContent className="p-0">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b bg-slate-50 px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
          <span>
            <i className="mr-1.5 inline-block size-2 rounded-full bg-sky-500" />
            Europa
          </span>
          <span>
            <i className="mr-1.5 inline-block size-2 rounded-full bg-slate-300" />
            Zona media
          </span>
          <span>
            <i className="mr-1.5 inline-block size-2 rounded-full bg-rose-500" />
            Descenso
          </span>
        </div>
        <Table className="table-fixed">
          <TableHeader>
            <TableRow className="bg-white text-[10px] uppercase tracking-wider">
              <TableHead className="w-10 text-center">Pos</TableHead>
              <TableHead>Equipo</TableHead>
              <TableHead className="w-10 text-center">PJ</TableHead>
              <TableHead className="hidden w-10 text-center md:table-cell">
                PG
              </TableHead>
              <TableHead className="hidden w-10 text-center md:table-cell">
                PE
              </TableHead>
              <TableHead className="hidden w-10 text-center md:table-cell">
                PP
              </TableHead>
              <TableHead className="hidden w-10 text-center lg:table-cell">
                GF
              </TableHead>
              <TableHead className="hidden w-10 text-center lg:table-cell">
                GC
              </TableHead>
              <TableHead className="w-11 text-center">DG</TableHead>
              <TableHead className="w-11 text-center">PTS</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {standings.map((standing) => {
              const team = getLeagueTeamById(standing.teamId);
              const levante = standing.teamId === 'levante-ud';
              const relegation =
                standing.position >= 18 && standing.position <= 20;
              const zone =
                standing.position <= 6
                  ? 'border-l-sky-500'
                  : relegation
                    ? 'border-l-rose-500'
                    : 'border-l-slate-200';
              return (
                <TableRow
                  key={standing.teamId}
                  data-zone={relegation ? 'descenso' : undefined}
                  style={
                    relegation
                      ? { borderLeftColor: '#f43f5e', borderLeftWidth: '4px' }
                      : undefined
                  }
                  className={`border-l-4 ${zone} ${relegation ? 'bg-rose-50/70 hover:bg-rose-100/70' : ''} ${levante ? 'bg-gradient-to-r from-[#153e72]/10 to-[#a91d43]/10 font-black hover:bg-[#a91d43]/10' : ''}`}
                >
                  <TableCell className="text-center font-black">
                    {standing.position}
                  </TableCell>
                  <TableCell>
                    {team && (
                      <TeamIdentity
                        teamName={team.name}
                        size="sm"
                        shortOnMobile
                      />
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {standing.played}
                  </TableCell>
                  <TableCell className="hidden text-center md:table-cell">
                    {standing.won}
                  </TableCell>
                  <TableCell className="hidden text-center md:table-cell">
                    {standing.drawn}
                  </TableCell>
                  <TableCell className="hidden text-center md:table-cell">
                    {standing.lost}
                  </TableCell>
                  <TableCell className="hidden text-center lg:table-cell">
                    {standing.goalsFor}
                  </TableCell>
                  <TableCell className="hidden text-center lg:table-cell">
                    {standing.goalsAgainst}
                  </TableCell>
                  <TableCell className="text-center">
                    {signed(standing.goalDifference)}
                  </TableCell>
                  <TableCell className="text-center font-black">
                    {standing.points}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export function MatchdaySection({
  footballData,
}: {
  footballData: FootballDataPayload | null;
}) {
  const [view, setView] = useState<'PARTIDOS' | 'CLASIFICACIÓN'>('PARTIDOS');
  const [filter, setFilter] = useState<CalendarFilter>('CALENDARIO');
  const matches = footballData?.matches.length
    ? footballData.matches
    : levanteMatches;
  const standings = footballData?.standings.length
    ? footballData.standings
    : realLeagueStandings;
  const currentMatchday = getNextLevanteMatch(matches)?.matchday
    ?? Math.max(0, ...matches.filter((match) => match.status === 'FINISHED').map((match) => match.matchday));
  const visible = matches.filter(
    (match) =>
      filter === 'CALENDARIO' ||
      (filter === 'RESULTADOS'
        ? match.status === 'FINISHED'
        : match.status === 'SCHEDULED'),
  );
  return (
    <>
      <Heading
        eyebrow="LaLiga · Temporada 2026/2027"
        title="La jornada"
        description="Partidos y clasificación actual de LaLiga, siempre en clave granota."
        action={
          <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-xs font-black text-slate-500">
            <CalendarDays className="size-4" />
            Jornada {currentMatchday}
          </span>
        }
      />
      <div className="mb-6 grid grid-cols-2 rounded-2xl bg-slate-200/70 p-1">
        {(['PARTIDOS', 'CLASIFICACIÓN'] as const).map((option) => (
          <button
            key={option}
            onClick={() => setView(option)}
            className={`rounded-xl px-4 py-3 text-xs font-black transition ${view === option ? 'bg-white text-[#071527] shadow-sm' : 'text-slate-500'}`}
          >
            {option}
          </button>
        ))}
      </div>
      {view === 'PARTIDOS' ? (
        <>
          <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
            {(['RESULTADOS', 'PRÓXIMOS', 'CALENDARIO'] as const).map(
              (option) => (
                <button
                  key={option}
                  onClick={() => setFilter(option)}
                  className={`rounded-full px-4 py-2 text-xs font-black transition ${filter === option ? 'bg-[#071527] text-white' : 'bg-white text-slate-500 ring-1 ring-slate-200'}`}
                >
                  {option}
                </button>
              ),
            )}
          </div>
          <div className="space-y-3">
            {visible.map((match) => (
              <CalendarMatch key={match.id} match={match} />
            ))}
          </div>
        </>
      ) : (
        <StandingsTable standings={standings} />
      )}
    </>
  );
}

function Score({
  team,
  value,
  set,
}: {
  team: string;
  value: number;
  set: (n: number) => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <TeamCrest teamName={team} size="lg" />
      <b>{team}</b>
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="icon"
          aria-label={`Restar gol a ${team}`}
          onClick={() => set(Math.max(0, value - 1))}
        >
          <Minus />
        </Button>
        <strong className="w-10 text-center text-4xl">{value}</strong>
        <Button
          variant="outline"
          size="icon"
          aria-label={`Sumar gol a ${team}`}
          onClick={() => set(value + 1)}
        >
          <Plus />
        </Button>
      </div>
    </div>
  );
}

function SelectedPlayer({ playerId }: { playerId: string }) {
  const player = levantePlayers.find((item) => item.id === playerId);
  if (!player) return null;
  return (
    <span className="flex min-w-0 items-center gap-2 rounded-xl bg-slate-50 p-2">
      <PlayerPhoto player={player} size="sm" />
      <strong className="min-w-0 truncate text-sm text-[#071527]">
        {player.displayName}
      </strong>
    </span>
  );
}

function PredictionPointsCard() {
  return (
    <Card
      aria-label="Puntuación de la predicción"
      className="mb-6 overflow-hidden border-0 bg-[#071527] text-white ring-0"
    >
      <CardContent>
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[.18em] text-sky-200">
              ¿Cuántos puntos puedes conseguir?
            </p>
            <h2 className="mt-1 text-xl font-black">{MAX_POINTS_PER_MATCH} puntos en juego</h2>
          </div>
          <span className="shrink-0 rounded-full bg-[#a91d43] px-3 py-1.5 text-xs font-black">
            Máximo {MAX_POINTS_PER_MATCH}
          </span>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {predictionPoints.map(([label, points], index) => (
            <div
              key={label}
              className={`rounded-xl bg-white/10 p-3 ${index === predictionPoints.length - 1 ? 'col-span-2 sm:col-span-1' : ''}`}
            >
              <strong className="block text-xl font-black text-white">
                +{points}
              </strong>
              <span className="mt-1 block text-xs leading-4 text-slate-300">
                {label}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs leading-5 text-slate-400">
          Cada acierto suma por separado hasta alcanzar un total máximo de {MAX_POINTS_PER_MATCH}
          puntos.
        </p>
      </CardContent>
    </Card>
  );
}

export function PredictSection({
  user,
  onRegistered,
}: {
  user: CommunityUser | null;
  onRegistered: (user: CommunityUser) => void;
}) {
  const next = getNextLevanteMatch();
  const [home, setHome] = useState(0),
    [away, setAway] = useState(0),
    [published, setPublished] = useState(false),
    [publishing, setPublishing] = useState(false),
    [registrationOpen, setRegistrationOpen] = useState(false),
    [publishError, setPublishError] = useState(''),
    [editingLineup, setEditingLineup] = useState(false),
    [playerPicker, setPlayerPicker] = useState<'SCORERS' | 'MVP' | null>(null);
  const [prediction, setPrediction] = useState<PredictionDraft | null>(null);
  if (!next)
    return (
      <Heading
        eyebrow="Tu previa"
        title="Sin partido programado"
        description="Todavía no hay un próximo partido disponible."
      />
    );
  const saveLineup = (lineup: SavedLineup) => {
    setPrediction((current) => ({
      matchId: next.id,
      predictedScore: current?.predictedScore ?? null,
      lineup,
      scorers: current?.scorers ?? [],
      mvp: current?.mvp ?? null,
    }));
    setEditingLineup(false);
  };
  const toggleScorer = (playerId: string) => {
    setPrediction((current) => {
      if (!current) return current;
      const selected = current.scorers.includes(playerId);
      return {
        ...current,
        scorers: selected
          ? current.scorers.filter((id) => id !== playerId)
          : [...current.scorers, playerId],
      };
    });
  };
  const selectMvp = (playerId: string) => {
    setPrediction((current) =>
      current ? { ...current, mvp: playerId } : current,
    );
    setPlayerPicker(null);
  };
  if (editingLineup)
    return (
      <>
        <Heading
          eyebrow={`Predice · Jornada ${next.matchday}`}
          title="Crea tu XI"
          description="Elige la formación, toca cada posición y selecciona el titular que esperas para el próximo partido."
        />
        <LineupBuilder
          initialLineup={prediction?.lineup ?? null}
          onCancel={() => setEditingLineup(false)}
          onSave={saveLineup}
        />
      </>
    );
  const closed = isPredictionClosed(next);
  const publishPrediction = async (registered = Boolean(user)) => {
    if (!registered) {
      setRegistrationOpen(true);
      return;
    }
    setPublishing(true);
    setPublishError('');
    const response = await fetch('/api/predictions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        matchId: next.id,
        predictedScore: { home, away },
        lineup: prediction?.lineup ?? null,
        scorers: prediction?.scorers ?? [],
        mvp: prediction?.mvp ?? null,
      } satisfies PredictionDraft),
    });
    const result = (await response.json()) as { error?: string };
    setPublishing(false);
    if (!response.ok)
      return setPublishError(result.error ?? 'No se pudo publicar la previa.');
    setPublished(true);
  };
  const finishRegistration = async (registeredUser: CommunityUser) => {
    onRegistered(registeredUser);
    setRegistrationOpen(false);
    await publishPrediction(true);
  };
  return (
    <>
      <Registration
        open={registrationOpen}
        onOpenChange={setRegistrationOpen}
        onRegistered={finishRegistration}
      />
      <Heading
        eyebrow={`Jornada ${next.matchday} · ${formatDate(next.date)}`}
        title="¿Cómo quedamos?"
        description="Mójate antes del pitido inicial y prepara tu once para el próximo partido."
      />
      <div className="mb-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
        <Clock3 className="mt-0.5 size-5 shrink-0 text-amber-600" />
        <div>
          <strong className="block font-black">
            Las predicciones cierran 2 horas antes del partido
          </strong>
          <p className="mt-1 text-sm">
            Para esta jornada, el cierre es el {formatPredictionDeadline(next)}.
          </p>
        </div>
      </div>
      <PredictionPointsCard />
      <div className="grid gap-6 lg:grid-cols-[1.1fr_.9fr]">
        <div className="space-y-6">
          <Card className="border-0 shadow-lg ring-slate-200">
            <CardHeader>
              <CardTitle className="text-center font-black">
                {next.homeTeam} — {next.awayTeam}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-[1fr_auto_1fr] items-center">
              <Score team={next.homeTeam} value={home} set={setHome} />
              <b className="text-slate-300">:</b>
              <Score team={next.awayTeam} value={away} set={setAway} />
            </CardContent>
          </Card>
          <Button
            onClick={() => void publishPrediction()}
            disabled={closed || publishing}
            className="h-12 w-full bg-[#a91d43] font-black text-white"
          >
            <Send />
            {closed
              ? 'Predicciones cerradas'
              : publishing
                ? 'Publicando…'
                : published
                  ? '¡Previa publicada!'
                  : 'Publicar mi previa'}
          </Button>
          {publishError && (
            <p
              role="alert"
              className="rounded-xl bg-rose-50 p-3 text-sm font-bold text-[#a91d43]"
            >
              {publishError}
            </p>
          )}
        </div>
        <div className="space-y-4">
          {prediction?.lineup?.players.length === 11 ? (
            <>
              <LineupSummary
                lineup={prediction.lineup}
                onEdit={() => setEditingLineup(true)}
              />
              <Card className="border-0 shadow-sm ring-slate-200">
                <CardContent>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="flex items-center gap-2 font-black text-[#071527]">
                        <Goal className="size-4 text-[#a91d43]" /> Goleadores
                        previstos
                      </h3>
                      <p className="mt-1 text-xs text-slate-500">
                        Puedes elegir más de uno.
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => setPlayerPicker('SCORERS')}
                    >
                      {prediction.scorers.length ? 'Editar' : 'Elegir'}
                    </Button>
                  </div>
                  {prediction.scorers.length > 0 && (
                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      {prediction.scorers.map((playerId) => (
                        <SelectedPlayer key={playerId} playerId={playerId} />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm ring-slate-200">
                <CardContent>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="flex items-center gap-2 font-black text-[#071527]">
                        <Award className="size-4 text-amber-500" /> MVP del
                        partido
                      </h3>
                      <p className="mt-1 text-xs text-slate-500">
                        Selecciona un único jugador.
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => setPlayerPicker('MVP')}
                    >
                      {prediction.mvp ? 'Cambiar' : 'Elegir'}
                    </Button>
                  </div>
                  {prediction.mvp && (
                    <div className="mt-4">
                      <SelectedPlayer playerId={prediction.mvp} />
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <button
              onClick={() => setEditingLineup(true)}
              className="flex min-h-24 w-full items-center gap-4 rounded-2xl bg-white p-5 text-left shadow-sm ring-1 ring-slate-200 transition hover:ring-[#a91d43]/30"
            >
              <span className="grid size-12 place-items-center rounded-xl bg-sky-100 text-[#153e72]">
                <Shirt className="size-5" />
              </span>
              <span>
                <strong className="block font-black text-[#071527]">
                  Crear mi XI
                </strong>
                <span className="mt-1 block text-sm text-slate-500">
                  Selecciona tu sistema y crea el once ideal
                </span>
              </span>
              <span className="ml-auto text-xl">›</span>
            </button>
          )}
        </div>
      </div>
      <Drawer
        open={playerPicker !== null}
        onOpenChange={(open) => {
          if (!open) setPlayerPicker(null);
        }}
        showSwipeHandle
      >
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle className="text-lg font-black">
              {playerPicker === 'SCORERS'
                ? 'Goleadores previstos'
                : 'MVP del partido'}
            </DrawerTitle>
            <DrawerDescription>
              {playerPicker === 'SCORERS'
                ? 'Selecciona uno o varios jugadores del Levante UD.'
                : 'Elige un único jugador del Levante UD.'}
            </DrawerDescription>
          </DrawerHeader>
          <div className="grid max-h-[58dvh] gap-2 overflow-y-auto px-4 pb-3 sm:grid-cols-2 lg:grid-cols-3">
            {levantePlayers.map((player) => {
              const selected =
                playerPicker === 'SCORERS'
                  ? prediction?.scorers.includes(player.id)
                  : prediction?.mvp === player.id;
              return (
                <button
                  key={player.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() =>
                    playerPicker === 'SCORERS'
                      ? toggleScorer(player.id)
                      : selectMvp(player.id)
                  }
                  className={`flex min-h-18 items-center gap-3 rounded-2xl border p-3 text-left transition ${selected ? 'border-[#a91d43] bg-rose-50 ring-1 ring-[#a91d43]/30' : 'border-slate-200 bg-white hover:border-[#a91d43]/40'}`}
                >
                  <PlayerPhoto player={player} size="sm" />
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate text-[#071527]">
                      {player.displayName}
                    </strong>
                    <small className="text-slate-500">
                      {player.number === null
                        ? 'Sin dorsal'
                        : `Dorsal ${player.number}`}
                    </small>
                  </span>
                  {selected && (
                    <CheckCircle2 className="size-5 shrink-0 text-[#a91d43]" />
                  )}
                </button>
              );
            })}
          </div>
          {playerPicker === 'SCORERS' && (
            <div className="border-t border-slate-200 p-4">
              <Button
                className="h-11 w-full bg-[#a91d43] font-black text-white"
                onClick={() => setPlayerPicker(null)}
              >
                Listo · {prediction?.scorers.length ?? 0} seleccionados
              </Button>
            </div>
          )}
        </DrawerContent>
      </Drawer>
    </>
  );
}

export function StandsSection() {
  const [predictions, setPredictions] = useState<CommunityPrediction[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    void fetch('/api/predictions')
      .then(
        async (response) =>
          (await response.json()) as { predictions?: CommunityPrediction[] },
      )
      .then((result) => setPredictions(result.predictions ?? []))
      .catch(() => setPredictions([]))
      .finally(() => setLoading(false));
  }, []);
  const playerName = (id: string | null) =>
    id
      ? (levantePlayers.find((player) => player.id === id)?.displayName ?? id)
      : 'Sin elegir';
  return (
    <>
      <Heading
        eyebrow="La comunidad"
        title="La Grada"
        description="Predicciones reales publicadas por la afición para el próximo partido."
      />
      {!loading && predictions.length === 0 && (
        <Card className="border-0 shadow-sm ring-slate-200">
          <CardContent className="py-12 text-center">
            <MessageCircleMore className="mx-auto size-10 text-slate-300" />
            <h2 className="mt-4 text-xl font-black text-[#071527]">
              La grada está esperando su primera previa
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Cuando un usuario publique una predicción, aparecerá aquí.
            </p>
          </CardContent>
        </Card>
      )}
      {loading && (
        <p className="text-center text-sm font-bold text-slate-400">
          Cargando predicciones…
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {predictions.map((prediction) => (
          <Card
            key={prediction.id}
            className="border-0 shadow-sm ring-slate-200"
          >
            <CardContent>
              <div className="flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-full bg-rose-100 font-black text-[#a91d43]">
                  {prediction.user.nickname.slice(0, 2).toUpperCase()}
                </span>
                <div>
                  <b className="block">@{prediction.user.nickname}</b>
                  <small className="text-slate-400">Afición granota</small>
                </div>
              </div>
              <div className="my-5 rounded-2xl bg-[#071527] py-4 text-center text-3xl font-black text-white">
                {prediction.homeScore} — {prediction.awayScore}
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-slate-50 p-3">
                  <small className="flex gap-1 font-black uppercase text-slate-400">
                    <Goal className="size-3" />
                    Goleadores
                  </small>
                  <b>
                    {prediction.scorers.length
                      ? prediction.scorers.map(playerName).join(', ')
                      : 'Sin elegir'}
                  </b>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <small className="flex gap-1 font-black uppercase text-slate-400">
                    <Award className="size-3" />
                    MVP
                  </small>
                  <b>{playerName(prediction.mvp)}</b>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}

export function CommunityRankingSection() {
  const [ranking, setRanking] = useState<CommunityRankingEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetch('/api/ranking')
      .then(async (response) => {
        if (!response.ok) throw new Error('Ranking unavailable');
        return (await response.json()) as { ranking?: CommunityRankingEntry[] };
      })
      .then((result) => setRanking(result.ranking ?? []))
      .catch(() => setRanking([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <Heading
        eyebrow="Temporada 2026/27"
        title="Clasificación"
        description="Los puntos de cada jornada se acumulan durante toda la temporada. En caso de empate, la clasificación se ordena alfabéticamente."
      />
      <Card className="overflow-hidden border-0 shadow-lg ring-slate-200">
        <CardHeader className="bg-[#071527] text-white">
          <CardTitle className="flex items-center gap-3 font-black">
            <span className="grid size-10 place-items-center rounded-xl bg-[#a91d43]">
              <Trophy className="size-5" />
            </span>
            Clasificación granota
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <p className="py-12 text-center text-sm font-bold text-slate-400">
              Cargando clasificación…
            </p>
          ) : ranking.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <Trophy className="mx-auto size-10 text-slate-300" />
              <h2 className="mt-4 text-xl font-black text-[#071527]">
                La clasificación espera a sus primeros participantes
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                Los usuarios aparecerán aquí cuando publiquen su predicción para la nueva jornada.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16 text-center">Pos.</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead className="text-center">Predicciones</TableHead>
                  <TableHead className="text-right">Puntos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ranking.map((entry, index) => (
                  <TableRow
                    key={entry.userId}
                    className={index === 0 ? 'bg-amber-50/80 hover:bg-amber-100/80' : undefined}
                  >
                    <TableCell className={`text-center font-black ${index === 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                      {index + 1}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-rose-100 text-sm font-black text-[#a91d43]">
                          {entry.nickname.slice(0, 2).toUpperCase()}
                        </span>
                        <div>
                          <strong className="text-[#071527]">@{entry.nickname}</strong>
                          {index === 0 && (
                            <Crown className="ml-2 inline size-5 fill-amber-400 text-amber-600" aria-label="Líder" />
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center font-bold">{entry.predictions}</TableCell>
                    <TableCell className="text-right text-xl font-black text-[#a91d43]">
                      {entry.points}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <p className="mt-4 text-center text-xs text-slate-400">
        {MAX_POINTS_PER_MATCH} puntos disponibles por jornada: formación, XI, resultado, goleadores y MVP.
      </p>
    </>
  );
}

export function ProfileSection({ user, openSettings }: { user: CommunityUser | null; openSettings: () => void }) {
  const [predictions, setPredictions] = useState<CommunityPrediction[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!user) {
      setPredictions([]);
      return;
    }
    setLoading(true);
    void fetch('/api/predictions?mine=1')
      .then(
        async (response) =>
          (await response.json()) as { predictions?: CommunityPrediction[] },
      )
      .then((result) => setPredictions(result.predictions ?? []))
      .catch(() => setPredictions([]))
      .finally(() => setLoading(false));
  }, [user]);
  return (
    <>
      <Heading
        eyebrow="Tu espacio"
        title="Perfil granota"
        description="Tu actividad y tus números de esta temporada."
        action={
          <Button variant="outline" onClick={openSettings}>
            <Settings />
            Ajustes
          </Button>
        }
      />
      {!user ? (
        <Card className="border-0 bg-[#071527] text-white ring-0">
          <CardContent className="py-10 text-center">
            <UserRound className="mx-auto size-10 text-sky-300" />
            <h2 className="mt-4 text-xl font-black">
              Todavía no tienes perfil
            </h2>
            <p className="mt-2 text-sm text-slate-300">
              Podrás elegir tu apodo cuando publiques tu primera predicción en
              La Grada.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <Card className="border-0 bg-[#071527] text-white ring-0">
            <CardContent className="text-center">
              <div className="mx-auto grid size-24 place-items-center rounded-full bg-white text-2xl font-black text-[#a91d43]">
                {user.nickname.slice(0, 2).toUpperCase()}
              </div>
              <h2 className="mt-4 text-2xl font-black">@{user.nickname}</h2>
              <p className="mt-2 text-sm text-slate-300">
                {predictions.length} {predictions.length === 1 ? 'predicción publicada' : 'predicciones publicadas'}
              </p>
            </CardContent>
          </Card>
          <div>
            <h2 className="mb-4 text-xl font-black text-[#071527]">
              Mis predicciones
            </h2>
            {loading ? (
              <p className="text-sm font-bold text-slate-400">
                Cargando tus predicciones…
              </p>
            ) : predictions.length === 0 ? (
              <Card className="border-0 shadow-sm ring-slate-200">
                <CardContent className="py-8 text-center text-sm text-slate-500">
                  Aún no has publicado ninguna predicción.
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {predictions.map((prediction) => {
                  const match = levanteMatches.find(
                    (item) => item.id === prediction.matchId,
                  );
                  return (
                    <Card
                      key={prediction.id}
                      className="border-0 shadow-sm ring-slate-200"
                    >
                      <CardContent>
                        <small className="font-black uppercase tracking-wider text-[#a91d43]">
                          {match ? `Jornada ${match.matchday}` : 'Predicción'}
                        </small>
                        <p className="mt-2 font-bold text-[#071527]">
                          {match
                            ? `${match.homeTeam} — ${match.awayTeam}`
                            : prediction.matchId}
                        </p>
                        <strong className="mt-4 block rounded-2xl bg-slate-50 py-3 text-center text-2xl text-[#071527]">
                          {prediction.homeScore} — {prediction.awayScore}
                        </strong>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
