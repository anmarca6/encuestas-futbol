import type { LeagueStanding } from '@/lib/laliga-data';
import type { LevanteMatch } from '@/lib/levante-data';

export interface FootballDataPayload {
  matches: LevanteMatch[];
  standings: LeagueStanding[];
  currentMatchday: number | null;
  updatedAt: string;
}
