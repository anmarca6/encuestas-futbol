import { NextRequest, NextResponse } from 'next/server';
import { ensureCommunitySchema, getDatabase } from '@/lib/db';
import { resolveCommunity } from '@/lib/community';
import { buildConsensus, type ConsensusRow } from '@/lib/consensus';
import { levanteMatches } from '@/lib/levante-data';

// Prediccion "Modo IA" para un partido: lo mas comun en las predicciones ya publicadas en la comunidad.
export async function GET(request: NextRequest) {
  await ensureCommunitySchema();
  const community = await resolveCommunity(request);
  if (!community) return NextResponse.json({ consensus: null });
  const match = levanteMatches.find((item) => item.id === request.nextUrl.searchParams.get('matchId'));
  if (!match) return NextResponse.json({ consensus: null });
  const result = await getDatabase().prepare(`
    SELECT p.match_id AS matchId, p.home_score AS homeScore, p.away_score AS awayScore,
      p.lineup, p.scorers, p.mvp
    FROM predictions p JOIN users u ON u.id = p.user_id
    WHERE u.community_slug = ?
    ORDER BY p.published_at DESC LIMIT 5000
  `).bind(community.slug).all<{ matchId: string; homeScore: number; awayScore: number; lineup: string | null; scorers: string; mvp: string | null }>();
  const rows: ConsensusRow[] = result.results.map((row) => ({
    matchId: row.matchId,
    homeScore: row.homeScore,
    awayScore: row.awayScore,
    lineup: row.lineup ? JSON.parse(row.lineup) : null,
    scorers: JSON.parse(row.scorers),
    mvp: row.mvp,
  }));
  return NextResponse.json({ consensus: buildConsensus(rows, match) });
}
