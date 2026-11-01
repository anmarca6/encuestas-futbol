import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, resolveAdminCommunity } from '@/lib/admin-auth';
import { LEVANTE_TEAM, levanteMatchReports, levanteMatches, levantePlayers } from '@/lib/levante-data';
import { loadMvpOverrides, loadOfficialReports } from '@/lib/official-data';
import { loadRivalGoals } from '@/lib/rival-goals';
import type { MatchStats } from '@/lib/image-stats';

const parseList = <T,>(value: string | undefined): T[] => {
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
};

// Datos de los partidos de LaLiga ya jugados para las plantillas del generador de imagenes: resultado oficial de la comunidad
// (o el del calendario local), goles y minutos del Levante y goles del rival (los que ha anotado el admin o, si no, los del calendario).
export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;
  const community = await resolveAdminCommunity(admin, request.nextUrl.searchParams.get('community'));
  if (community instanceof NextResponse) return community;

  const reports = await loadOfficialReports(community);
  const rivalGoals = await loadRivalGoals();
  const idByName = new Map(levantePlayers.map((player) => [player.displayName, player.id]));
  // Igual que en el ranking: el MVP de la pestaña propia manda; si no hay, el del informe oficial o el del calendario local.
  const mvpOverrides = new Map((await loadMvpOverrides(community)).map((item) => [item.matchday, item.playerId]));

  const matches: MatchStats[] = [];
  for (const match of levanteMatches.filter((item) => item.id.startsWith('laliga-'))) {
    const report = reports.find((item) => item.matchday === match.matchday);
    if (!report && match.status !== 'FINISHED') continue;
    const levanteIsHome = match.homeTeam === LEVANTE_TEAM;
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
      mvp: mvpOverrides.get(match.matchday) || (report ? report.mvp : idByName.get(levanteMatchReports[match.matchday]?.mvp.playerName ?? '')) || '',
    });
  }
  return NextResponse.json({ matches }, { headers: { 'Cache-Control': 'no-store' } });
}
