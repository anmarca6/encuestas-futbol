import { NextResponse } from 'next/server';
import { ensureCommunitySchema, getDatabase } from '@/lib/db';
import { scorePredictionBreakdown } from '@/lib/prediction-scoring';
import { levanteMatches } from '@/lib/levante-data';
import type { CommunityRankingEntry } from '@/lib/community-types';
import type { SavedLineup } from '@/lib/formations';

interface RankingPredictionRow {
  userId: string;
  nickname: string;
  avatarUrl: string | null;
  matchId: string;
  homeScore: number;
  awayScore: number;
  lineup: string | null;
  scorers: string;
  mvp: string | null;
}

export async function GET() {
  await ensureCommunitySchema();
  const rows = await getDatabase().prepare(`
    SELECT u.id AS userId, u.nickname, u.avatar_url AS avatarUrl, p.match_id AS matchId,
      p.home_score AS homeScore, p.away_score AS awayScore,
      p.lineup, p.scorers, p.mvp
    FROM predictions p
    JOIN users u ON u.id = p.user_id
    ORDER BY u.nickname COLLATE NOCASE ASC
  `).bind().all<RankingPredictionRow>();

  const entries = new Map<string, CommunityRankingEntry>();
  for (const row of rows.results) {
    const current = entries.get(row.userId) ?? {
      userId: row.userId,
      nickname: row.nickname,
      avatarUrl: row.avatarUrl,
      points: 0,
      predictions: 0,
      breakdown: { formation: 0, lineup: 0, result: 0, scorers: 0, mvp: 0 },
      matchBreakdowns: [],
    };
    current.predictions += 1;
    const breakdown = scorePredictionBreakdown({
      matchId: row.matchId,
      predictedScore: { home: row.homeScore, away: row.awayScore },
      lineup: row.lineup ? JSON.parse(row.lineup) as SavedLineup : null,
      scorers: JSON.parse(row.scorers) as string[],
      mvp: row.mvp,
    });
    current.points += breakdown.formation + breakdown.lineup + breakdown.result + breakdown.scorers + breakdown.mvp;
    current.breakdown.formation += breakdown.formation;
    current.breakdown.lineup += breakdown.lineup;
    current.breakdown.result += breakdown.result;
    current.breakdown.scorers += breakdown.scorers;
    current.breakdown.mvp += breakdown.mvp;
    const match = levanteMatches.find((item) => item.id === row.matchId);
    if (match) {
      current.matchBreakdowns.push({
        matchday: match.matchday,
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
        points: breakdown.formation + breakdown.lineup + breakdown.result + breakdown.scorers + breakdown.mvp,
        breakdown,
      });
    }
    entries.set(row.userId, current);
  }

  const ranking = [...entries.values()].sort(
    (a, b) => b.points - a.points || a.nickname.localeCompare(b.nickname, 'es', { sensitivity: 'base' }),
  );
  return NextResponse.json({ ranking });
}
