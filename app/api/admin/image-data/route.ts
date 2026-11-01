import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, resolveAdminCommunity } from '@/lib/admin-auth';
import { ensureCommunitySchema, getDatabase } from '@/lib/db';
import { CUP_MATCHDAY_OFFSET, LEVANTE_TEAM, levanteMatchReports, levanteMatches, levantePlayers } from '@/lib/levante-data';
import { loadMvpOverrides, loadOfficialReports } from '@/lib/official-data';
import { loadRivalGoals } from '@/lib/rival-goals';
import type { ImageData, MatchStats } from '@/lib/image-stats';

const parseList = <T,>(value: string | undefined): T[] => {
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
};

// Datos de la app para las plantillas del generador de imagenes. Se leen de nuevo cada vez, asi que una imagen creada (o recargada)
// despues de una jornada nueva ya la incluye: resultado oficial de la comunidad (o el del calendario local), goles y minutos del
// Levante, goles del rival (los que ha anotado el admin o, si no, los del calendario), MVP, onces y pronosticos de los usuarios.
export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;
  const community = await resolveAdminCommunity(admin, request.nextUrl.searchParams.get('community'));
  if (community instanceof NextResponse) return community;

  const reports = await loadOfficialReports(community);
  const rivalGoals = await loadRivalGoals();
  const idByName = new Map(levantePlayers.map((player) => [player.displayName, player.id]));
  const isLeague = (matchday: number) => matchday >= 1 && matchday <= CUP_MATCHDAY_OFFSET;

  const matches: MatchStats[] = [];
  const levanteIsHomeByMatchday = new Map<number, boolean>();
  for (const match of levanteMatches.filter((item) => item.id.startsWith('laliga-'))) {
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
  const mvps = [...mvpByMatchday.entries()].filter(([matchday]) => isLeague(matchday)).map(([matchday, playerId]) => ({ matchday, playerId }));

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
  const lineups = [...lineupByMatchday.entries()].filter(([matchday]) => isLeague(matchday)).map(([matchday, players]) => ({ matchday, players }));

  // Pronosticos de los usuarios de la comunidad en partidos de Liga ya jugados, segun el resultado que dan al Levante.
  await ensureCommunitySchema();
  const rows = await getDatabase().prepare(`
    SELECT p.match_id AS matchId, p.home_score AS homeScore, p.away_score AS awayScore
    FROM predictions p
    JOIN users u ON u.id = p.user_id
    WHERE u.community_slug = ? AND p.match_id LIKE 'laliga-%'
  `).bind(community).all<{ matchId: string; homeScore: number; awayScore: number }>();
  const tally = new Map<number, { matchday: number; win: number; draw: number; loss: number }>();
  for (const row of rows.results) {
    const matchday = Number(/-j(\d+)$/.exec(row.matchId)?.[1]);
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

  const data: ImageData = { matches, mvps, lineups, predictions: [...tally.values()] };
  return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
}
