import type { SavedLineup } from '@/lib/formations';

export interface CommunityUser {
  id: string;
  nickname: string;
  createdAt: number;
  avatarUrl?: string | null;
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
  user: Pick<CommunityUser, 'nickname' | 'avatarUrl'>;
}

export interface CommunityRankingEntry {
  userId: string;
  nickname: string;
  avatarUrl?: string | null;
  points: number;
  predictions: number;
}
