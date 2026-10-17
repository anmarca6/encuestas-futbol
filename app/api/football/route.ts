import { NextResponse } from 'next/server';
import type { FootballDataPayload } from '@/lib/football-data-types';
import type { LeagueStanding } from '@/lib/laliga-data';
import { applyLocalPostponements } from '@/lib/levante-services';
import { footballData, localTeamId, mapLevanteMatches, type ApiMatch, type ApiStanding } from '@/lib/football-schedule';

export async function GET() {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'FOOTBALL_DATA_API_KEY no está configurada.' },
      { status: 503 },
    );
  }

  try {
    const [matchData, standingData] = await Promise.all([
      footballData<{ matches: ApiMatch[] }>('/competitions/PD/matches', apiKey),
      footballData<{
        season?: { currentMatchday?: number | null };
        standings: Array<{ type: string; table: ApiStanding[] }>;
      }>('/competitions/PD/standings', apiKey),
    ]);

    const matches = mapLevanteMatches(matchData.matches);

    const total = standingData.standings.find((item) => item.type === 'TOTAL');
    const standings: LeagueStanding[] = (total?.table ?? [])
      .map((row) => ({
        position: row.position,
        teamId: localTeamId(row.team) ?? '',
        played: row.playedGames,
        won: row.won,
        drawn: row.draw,
        lost: row.lost,
        goalsFor: row.goalsFor,
        goalsAgainst: row.goalsAgainst,
        goalDifference: row.goalDifference,
        points: row.points,
      }))
      .filter((row) => row.teamId);

    const payload: FootballDataPayload = {
      matches: applyLocalPostponements(matches),
      standings,
      currentMatchday: standingData.season?.currentMatchday ?? null,
      updatedAt: new Date().toISOString(),
    };
    return NextResponse.json(payload, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=900' },
    });
  } catch (error) {
    console.error('No se pudieron actualizar los datos de football-data.org', error);
    return NextResponse.json(
      { error: 'No se pudieron actualizar los datos de LaLiga.' },
      { status: 502 },
    );
  }
}
