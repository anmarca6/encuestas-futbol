import type { SavedLineup } from '@/lib/formations';

export interface CommunityUser {
  id: string;
  name: string;
  nickname: string;
  email: string;
  createdAt: number;
}

export interface CommunityPrediction {
  id: string;
  matchId: string;
  homeScore: number;
  awayScore: number;
  lineup: SavedLineup | null;
  scorers: string[];
  mvp: string | null;
  publishedAt: number;
  user: Pick<CommunityUser, 'name' | 'nickname'>;
}
