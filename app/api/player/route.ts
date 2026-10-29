import { NextRequest, NextResponse } from 'next/server';
import { ensureCommunitySchema, getDatabase } from '@/lib/db';
import { resolveCommunity } from '@/lib/community';
import { computeCommunityRanking } from '@/lib/ranking';
import { currentUser, unrevealedMatchIds } from '@/lib/prediction-state';
import { loadOfficialReports } from '@/lib/official-data';
import { levanteMatchReports, levanteMatches } from '@/lib/levante-data';
import type { PlayerProfile, PlayerProfilePrediction } from '@/lib/community-types';

// Perfil de otro usuario de la comunidad con sus predicciones. Las de partidos aun sin jugar y con plazo abierto no se revelan a los demas.
export async function GET(request: NextRequest) {
  await ensureCommunitySchema();
  const community = await resolveCommunity(request);
  if (!community) return NextResponse.json({ error: 'Comunidad no encontrada.' }, { status: 404 });
  const userId = request.nextUrl.searchParams.get('id');
  if (!userId) return NextResponse.json({ error: 'Falta el usuario.' }, { status: 400 });
  const target = await getDatabase().prepare(
    'SELECT id, nickname, avatar_url AS avatarUrl FROM users WHERE id = ? AND community_slug = ? LIMIT 1',
  ).bind(userId, community.slug).first<{ id: string; nickname: string; avatarUrl: string | null }>();
  if (!target) return NextResponse.json({ error: 'Usuario no encontrado.' }, { status: 404 });

  const viewer = await currentUser(request, community.slug);
  const isSelf = viewer?.id === target.id;
  const [ranking, unrevealed, officialReports, rows] = await Promise.all([
    computeCommunityRanking(community.slug),
    unrevealedMatchIds(community.slug),
    loadOfficialReports(community.slug),
    getDatabase().prepare(`
      SELECT id, match_id AS matchId, home_score AS homeScore, away_score AS awayScore,
        lineup, scorers, mvp, published_at AS publishedAt
      FROM predictions WHERE user_id = ? ORDER BY published_at DESC LIMIT 200
    `).bind(target.id).all<{
      id: string; matchId: string; homeScore: number; awayScore: number;
      lineup: string | null; scorers: string; mvp: string | null; publishedAt: number;
    }>(),
  ]);
  // Solo se muestran puntos de los partidos que ya tienen datos oficiales (los demas cuentan 0 y confundirian).
  const scoredMatchdays = new Set([...officialReports.map((report) => report.matchday), ...Object.keys(levanteMatchReports).map(Number)]);
  const index = ranking.findIndex((entry) => entry.userId === target.id);
  const entry = index >= 0 ? ranking[index] : null;

  const predictions: PlayerProfilePrediction[] = rows.results.map((row) => {
    // Los partidos sin jugar y con plazo abierto (el proximo, o uno aplazado con pronosticos ya hechos) siguen siendo secretos para el resto.
    const hidden = !isSelf && unrevealed.has(row.matchId);
    const match = levanteMatches.find((item) => item.id === row.matchId);
    const scored = entry?.matchBreakdowns.find((item) => item.matchday === match?.matchday);
    return {
      id: row.id,
      matchId: row.matchId,
      hidden,
      homeScore: hidden ? null : row.homeScore,
      awayScore: hidden ? null : row.awayScore,
      lineup: hidden || !row.lineup ? null : JSON.parse(row.lineup),
      scorers: hidden ? [] : JSON.parse(row.scorers),
      mvp: hidden ? null : row.mvp,
      publishedAt: row.publishedAt,
      scored: scored && match && scoredMatchdays.has(match.matchday) ? { points: scored.points, breakdown: scored.breakdown } : null,
    };
  });
  const profile: PlayerProfile = {
    user: { id: target.id, nickname: target.nickname, avatarUrl: target.avatarUrl },
    isSelf,
    position: entry ? index + 1 : null,
    rankedUsers: ranking.length,
    points: entry?.points ?? 0,
    predictions,
  };
  return NextResponse.json({ profile });
}
