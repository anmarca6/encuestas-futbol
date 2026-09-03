import type { SavedLineup } from '@/lib/formations';

export interface PredictionDraft {
  matchId: string;
  predictedScore: { home: number; away: number } | null;
  lineup: SavedLineup | null;
  scorers: string[];
  mvp: string | null;
}
