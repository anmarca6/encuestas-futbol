import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, resolveAdminCommunity } from '@/lib/admin-auth';
import { ensureCommunitySchema, getDatabase } from '@/lib/db';
import { CUP_MATCHDAY_OFFSET, LEVANTE_TEAM, levanteMatchReports, levanteMatches, levantePlayers } from '@/lib/levante-data';
import { loadMvpOverrides, loadOfficialReports } from '@/lib/official-data';
import { loadRivalGoals } from '@/lib/rival-goals';
import { footballData, type ApiMatch } from '@/lib/football-schedule';
import { standingsByMatchday } from '@/lib/standings-by-matchday';
import type { ImageScope } from '@/lib/image-generator';
import type { ImageData, MatchStats, StandingRow } from '@/lib/image-stats';

const parseList = <T,>(value: string | undefined): T[] => {
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
};

// Clasificacion de LaLiga tras cada jornada de una temporada (por el ano en que empieza; sin ano, la actual), calculada con sus resultados. Sin clave o
// si la API falla, queda vacia y la plantilla simplemente no marca la dificultad de los rivales.
async function loadStandings(season?: number): Promise<Record<number, StandingRow[]>> {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY;
  if (!apiKey) return {};
  try {
    const data = await footballData<{ matches: ApiMatch[] }>(`/competitions/PD/matches${season ? `?season=${season}` : ''}`, apiKey);
    return standingsByMatchday(data.matches);
  } catch (error) {
    console.error('No se pudo leer la clasificacion para el generador de imagenes', error);
    return {};
  }
}

// Con scope=ligaCopa tambien entran los partidos de Copa del Rey del Levante (jornadas 101 en adelante).
// Datos de la app para las plantillas del generador de imagenes. Se leen de nuevo cada vez, asi que una imagen creada (o recargada)
// despues de una jornada nueva ya la incluye: resultado oficial de la comunidad (o el del calendario local), goles y minutos del
// Levante, goles del rival (los que ha anotado el admin o, si no, los del calendario), MVP, onces y pronosticos de los usuarios.
export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;
  const community = await resolveAdminCommunity(admin, request.nextUrl.searchParams.get('community'));
  if (community instanceof NextResponse) return community;

  const scope: ImageScope = request.nextUrl.searchParams.get('scope') === 'ligaCopa' ? 'ligaCopa' : 'liga';
  const reports = await loadOfficialReports(community);
  const rivalGoals = await loadRivalGoals();
  const idByName = new Map(levantePlayers.map((player) => [player.displayName, player.id]));
  const included = (matchday: number) => matchday >= 1 && (scope === 'ligaCopa' || matchday <= CUP_MATCHDAY_OFFSET);
  const includedMatchId = (id: string) => id.startsWith('laliga-') || (scope === 'ligaCopa' && id.startsWith('copa-'));

  const matches: MatchStats[] = [];
  const levanteIsHomeByMatchday = new Map<number, boolean>();
  for (const match of levanteMatches.filter((item) => includedMatchId(item.id))) {
    const report = reports.find((item) => item.matchday === match.matchday);
    if (!report && match.status !== 'FINISHED') continue;
    const levanteIsHome = match.homeTeam === LEVANTE_TEAM;
    levanteIsHomeByMatchday.set(match.matchday, levanteIsHome);
    const homeScore = report ? report.homeScore : match.homeScore ?? 0;
    const awayScore = report ? report.awayScore : match.awayScore ?? 0;
    const levanteGoals = match.goals.filter((goal) => goal.team === LEVANTE_TEAM);
    const rival = rivalGoals[match.matchday] ?? match.goals.filter((goal) => goal.team !== LEVANTE_TEAM).map((goal) => ({ minute: goal.minute }));

    let scorers: string[];
    let scoredMinutes: number[];
    if (report) {
      scorers = parseList<string>(report.scorers);
      scoredMinutes = parseList<number>(report.goalMinutes).filter((minute) => minute > 0);
    } else {
      scorers = levanteGoals.map((goal) => idByName.get(goal.playerName) ?? '').filter(Boolean);
      scoredMinutes = levanteGoals.map((goal) => goal.minute).filter((minute) => minute > 0);
    }
    matches.push({
      matchday: match.matchday,
      rival: levanteIsHome ? match.awayTeam : match.homeTeam,
      home: levanteIsHome,
      scored: levanteIsHome ? homeScore : awayScore,
      conceded: levanteIsHome ? awayScore : homeScore,
      scoredMinutes,
      concededMinutes: rival.map((goal) => goal.minute).filter((minute) => minute > 0),
      scorers,
    });
  }

  // MVP de cada jornada, con la misma prioridad que el ranking: el de su pestaña propia, luego el del informe oficial y, si no,
  // el del calendario local. No depende de que el partido tenga ya resultado guardado.
  const mvpByMatchday = new Map<number, string>();
  for (const [matchday, report] of Object.entries(levanteMatchReports)) {
    const id = idByName.get(report.mvp.playerName);
    if (id) mvpByMatchday.set(Number(matchday), id);
  }
  for (const report of reports) if (report.mvp) mvpByMatchday.set(report.matchday, report.mvp);
  for (const override of await loadMvpOverrides(community)) if (override.playerId) mvpByMatchday.set(override.matchday, override.playerId);
  const mvps = [...mvpByMatchday.entries()].filter(([matchday]) => included(matchday)).map(([matchday, playerId]) => ({ matchday, playerId }));

  // Onces: los oficiales de la comunidad mandan sobre los del calendario local.
  const lineupByMatchday = new Map<number, string[]>();
  for (const [matchday, report] of Object.entries(levanteMatchReports)) {
    const names = [...report.lineup.goalkeeper, ...report.lineup.defenders, ...report.lineup.midfielders, ...report.lineup.attackers];
    lineupByMatchday.set(Number(matchday), names.map((name) => idByName.get(name) ?? '').filter(Boolean));
  }
  for (const report of reports) {
    try {
      const players = (JSON.parse(report.lineup) as { players?: string[] }).players;
      if (Array.isArray(players) && players.length) lineupByMatchday.set(report.matchday, players.filter((id) => typeof id === 'string'));
    } catch {
      // Un once mal guardado simplemente no cuenta.
    }
  }
  const lineups = [...lineupByMatchday.entries()].filter(([matchday]) => included(matchday)).map(([matchday, players]) => ({ matchday, players }));

  // Pronosticos de los usuarios de la comunidad en partidos de Liga ya jugados, segun el resultado que dan al Levante.
  await ensureCommunitySchema();
  const rows = await getDatabase().prepare(`
    SELECT p.match_id AS matchId, p.home_score AS homeScore, p.away_score AS awayScore
    FROM predictions p
    JOIN users u ON u.id = p.user_id
    WHERE u.community_slug = ? AND (p.match_id LIKE 'laliga-%' OR p.match_id LIKE 'copa-%')
  `).bind(community).all<{ matchId: string; homeScore: number; awayScore: number }>();
  const tally = new Map<number, { matchday: number; win: number; draw: number; loss: number }>();
  for (const row of rows.results) {
    // Liga: ...-j12; Copa: ...-r1 (ronda 1 = jornada 101).
    const parsed = /-([jr])(\d+)$/.exec(row.matchId);
    const matchday = parsed ? Number(parsed[2]) + (parsed[1] === 'r' ? CUP_MATCHDAY_OFFSET : 0) : NaN;
    const levanteIsHome = levanteIsHomeByMatchday.get(matchday);
    if (levanteIsHome === undefined) continue;
    const entry = tally.get(matchday) ?? { matchday, win: 0, draw: 0, loss: 0 };
    const own = levanteIsHome ? row.homeScore : row.awayScore;
    const other = levanteIsHome ? row.awayScore : row.homeScore;
    if (own > other) entry.win += 1;
    else if (own === other) entry.draw += 1;
    else entry.loss += 1;
    tally.set(matchday, entry);
  }

  const [current, previous] = await Promise.all([loadStandings(), loadStandings(2025)]);
  const data: ImageData = { scope, matches, mvps, lineups, predictions: [...tally.values()], standings: { current, previous } };
  return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
}
