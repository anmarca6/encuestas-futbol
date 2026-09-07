import { NextResponse } from 'next/server';
import type { FootballDataPayload } from '@/lib/football-data-types';
import type { LeagueStanding } from '@/lib/laliga-data';
import {
  LEVANTE_COMPETITION,
  LEVANTE_SEASON,
  type LevanteMatch,
  type MatchGoal,
} from '@/lib/levante-data';

const API_ROOT = 'https://api.football-data.org/v4';

interface ApiTeam {
  id: number;
  name: string;
  shortName: string;
}

interface ApiMatch {
  id: number;
  utcDate: string;
  status: string;
  matchday: number | null;
  homeTeam: ApiTeam;
  awayTeam: ApiTeam;
  score: { fullTime: { home: number | null; away: number | null } };
  goals?: Array<{ minute: number; team: ApiTeam; scorer: { name: string } }>;
}

interface ApiStanding {
  position: number;
  team: ApiTeam;
  playedGames: number;
  won: number;
  draw: number;
  lost: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
}

const teamAliases: Record<string, string> = {
  'athletic club': 'athletic-club',
  'atletico de madrid': 'atletico-de-madrid',
  'club atletico de madrid': 'atletico-de-madrid',
  'ca osasuna': 'ca-osasuna',
  'deportivo alaves': 'deportivo-alaves',
  'elche cf': 'elche-cf',
  'fc barcelona': 'fc-barcelona',
  'getafe cf': 'getafe-cf',
  'levante ud': 'levante-ud',
  'malaga cf': 'malaga-cf',
  'racing de santander': 'racing-de-santander',
  'rayo vallecano de madrid': 'rayo-vallecano',
  'rc celta de vigo': 'celta',
  'rc deportivo la coruna': 'rc-deportivo',
  'rcd espanyol de barcelona': 'rcd-espanyol',
  'real betis balompie': 'real-betis',
  'real madrid cf': 'real-madrid',
  'real sociedad de futbol': 'real-sociedad',
  'sevilla fc': 'sevilla-fc',
  'valencia cf': 'valencia-cf',
  'villarreal cf': 'villarreal-cf',
};

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function localTeamId(team: ApiTeam) {
  return teamAliases[normalize(team.name)] ?? teamAliases[normalize(team.shortName)];
}

function displayName(team: ApiTeam) {
  const teamId = localTeamId(team);
  const names: Record<string, string> = {
    'athletic-club': 'Athletic Club',
    'atletico-de-madrid': 'Atlético de Madrid',
    'ca-osasuna': 'CA Osasuna',
    'deportivo-alaves': 'Deportivo Alavés',
    'elche-cf': 'Elche CF',
    'fc-barcelona': 'FC Barcelona',
    'getafe-cf': 'Getafe CF',
    'levante-ud': 'Levante UD',
    'malaga-cf': 'Málaga CF',
    'racing-de-santander': 'Racing de Santander',
    'rayo-vallecano': 'Rayo Vallecano',
    celta: 'Celta',
    'rc-deportivo': 'RC Deportivo',
    'rcd-espanyol': 'RCD Espanyol',
    'real-betis': 'Real Betis',
    'real-madrid': 'Real Madrid',
    'real-sociedad': 'Real Sociedad',
    'sevilla-fc': 'Sevilla FC',
    'valencia-cf': 'Valencia CF',
    'villarreal-cf': 'Villarreal CF',
  };
  return (teamId && names[teamId]) || team.shortName || team.name;
}

function madridDateParts(utcDate: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(utcDate));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? '';
  return {
    date: `${part('year')}-${part('month')}-${part('day')}`,
    kickoffTime: `${part('hour')}:${part('minute')}`,
  };
}

async function footballData<T>(path: string, apiKey: string): Promise<T> {
  const response = await fetch(`${API_ROOT}${path}`, {
    headers: { 'X-Auth-Token': apiKey, 'X-Unfold-Goals': 'true' },
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`football-data.org respondió ${response.status}`);
  return (await response.json()) as T;
}

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

    const matches: LevanteMatch[] = matchData.matches
      .filter(
        (match) =>
          localTeamId(match.homeTeam) === 'levante-ud' ||
          localTeamId(match.awayTeam) === 'levante-ud',
      )
      .filter((match) => match.matchday !== null)
      .map((match) => {
        const { date, kickoffTime } = madridDateParts(match.utcDate);
        const homeTeam = displayName(match.homeTeam);
        const awayTeam = displayName(match.awayTeam);
        const goals: MatchGoal[] = (match.goals ?? []).map((goal) => ({
          playerName: goal.scorer.name,
          team: displayName(goal.team),
          minute: goal.minute,
        }));
        return {
          id: `football-data-${match.id}`,
          season: LEVANTE_SEASON,
          competition: LEVANTE_COMPETITION,
          matchday: match.matchday!,
          date,
          kickoffTime,
          homeTeam,
          awayTeam,
          homeScore: match.score.fullTime.home,
          awayScore: match.score.fullTime.away,
          status:
            match.status === 'FINISHED'
              ? ('FINISHED' as const)
              : ('SCHEDULED' as const),
          goals,
          tags:
            homeTeam === 'Valencia CF' || awayTeam === 'Valencia CF'
              ? ['DERBY']
              : [],
        };
      })
      .sort((a, b) => a.matchday - b.matchday);

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
      matches,
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
