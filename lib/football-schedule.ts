import { applyLocalPostponements } from '@/lib/levante-services';
import {
  LEVANTE_COMPETITION,
  LEVANTE_SEASON,
  type LevanteMatch,
  type MatchGoal,
  type MatchStatus,
} from '@/lib/levante-data';

const API_ROOT = 'https://api.football-data.org/v4';

export interface ApiTeam {
  id: number;
  name: string;
  shortName: string;
}

export interface ApiMatch {
  id: number;
  utcDate: string;
  status: string;
  matchday: number | null;
  homeTeam: ApiTeam;
  awayTeam: ApiTeam;
  score: { fullTime: { home: number | null; away: number | null } };
  goals?: Array<{ minute: number; team: ApiTeam; scorer: { name: string } }>;
}

export interface ApiStanding {
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
  'real racing club de santander': 'racing-de-santander',
  'real racing club': 'racing-de-santander',
  'racing santander': 'racing-de-santander',
  'real racing club santander': 'racing-de-santander',
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

export function localTeamId(team: ApiTeam) {
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
    'racing-de-santander': 'Real Racing Club de Santander',
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

const postponedStatuses = ['POSTPONED', 'SUSPENDED', 'CANCELLED'];
function matchStatus(match: ApiMatch): MatchStatus {
  if (match.status === 'FINISHED') return 'FINISHED';
  return postponedStatuses.includes(match.status) ? 'POSTPONED' : 'SCHEDULED';
}

export async function footballData<T>(path: string, apiKey: string): Promise<T> {
  const response = await fetch(`${API_ROOT}${path}`, {
    headers: { 'X-Auth-Token': apiKey, 'X-Unfold-Goals': 'true' },
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`football-data.org respondió ${response.status}`);
  return (await response.json()) as T;
}


// Partidos de Liga del Levante a partir de lo que devuelve football-data.org.
export function mapLevanteMatches(apiMatches: ApiMatch[]): LevanteMatch[] {
  return apiMatches
    .filter(
      (match) =>
        localTeamId(match.homeTeam) === 'levante-ud' ||
        localTeamId(match.awayTeam) === 'levante-ud',
    )
    .filter((match) => match.matchday !== null)
    .map((match) => {
      const { date, kickoffTime } = madridDateParts(match.utcDate);
      const matchday = match.matchday!;
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
        matchday,
        date,
        kickoffTime,
        homeTeam,
        awayTeam,
        homeScore: match.score.fullTime.home,
        awayScore: match.score.fullTime.away,
        status: matchStatus(match),
        goals,
        tags:
          homeTeam === 'Valencia CF' || awayTeam === 'Valencia CF'
            ? ['DERBY']
            : [],
      };
    })
    .sort((a, b) => a.matchday - b.matchday);
}

// Calendario oficial para el servidor (el mismo que ve la pantalla). Se guarda 5 minutos; si la API falla, devuelve null.
let scheduleCache: { at: number; matches: LevanteMatch[] } | null = null;
export async function loadScheduleMatches(): Promise<LevanteMatch[] | null> {
  if (scheduleCache && Date.now() - scheduleCache.at < 5 * 60 * 1000) return scheduleCache.matches;
  const apiKey = process.env.FOOTBALL_DATA_API_KEY;
  if (!apiKey) return null;
  try {
    const data = await footballData<{ matches: ApiMatch[] }>('/competitions/PD/matches', apiKey);
    const matches = applyLocalPostponements(mapLevanteMatches(data.matches));
    scheduleCache = { at: Date.now(), matches };
    return matches;
  } catch {
    return scheduleCache?.matches ?? null;
  }
}
