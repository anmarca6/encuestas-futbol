import type { SavedLineup } from '@/lib/formations';
import type { PredictionScoreBreakdown } from '@/lib/prediction-scoring';

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
  user: Pick<CommunityUser, 'id' | 'nickname' | 'avatarUrl'>;
}

export interface CommunityRankingEntry {
  userId: string;
  nickname: string;
  avatarUrl?: string | null;
  points: number;
  predictions: number;
  breakdown: PredictionScoreBreakdown;
}
