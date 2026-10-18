import type { SavedLineup } from '@/lib/formations';
import type { CommunityHeaderFields, CommunityHeroFields } from '@/lib/community-identity';
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

export interface RankingMatchBreakdown {
  matchday: number;
  homeTeam: string;
  awayTeam: string;
  points: number;
  breakdown: PredictionScoreBreakdown;
}

export interface CommunityRankingEntry {
  userId: string;
  nickname: string;
  avatarUrl?: string | null;
  points: number;
  predictions: number;
  breakdown: PredictionScoreBreakdown;
  matchBreakdowns: RankingMatchBreakdown[];
}

// Perfil publico de un usuario de la comunidad. Las predicciones del partido aun abierto llegan ocultas (hidden) para los demas.
export interface PlayerProfilePrediction {
  id: string;
  matchId: string;
  hidden: boolean;
  homeScore: number | null;
  awayScore: number | null;
  lineup: SavedLineup | null;
  scorers: string[];
  mvp: string | null;
  publishedAt: number;
  // Puntos de esa predicion (solo si el partido ya tiene datos oficiales).
  scored: { points: number; breakdown: PredictionScoreBreakdown } | null;
}

export interface PlayerProfile {
  user: Pick<CommunityUser, 'id' | 'nickname' | 'avatarUrl'>;
  isSelf: boolean;
  position: number | null;
  rankedUsers: number;
  points: number;
  predictions: PlayerProfilePrediction[];
}

export interface AdminCommunity extends CommunityHeaderFields, CommunityHeroFields {
  slug: string;
  name: string;
  createdAt: number;
  users: number;
  predictions: number;
}
