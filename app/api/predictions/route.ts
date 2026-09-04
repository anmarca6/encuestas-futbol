import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';
import { getNextLevanteMatch } from '@/lib/levante-services';
import { isPredictionClosed } from '@/lib/prediction-deadline';
import type { CommunityPrediction, CommunityUser } from '@/lib/community-types';
import type { PredictionDraft } from '@/lib/prediction-types';

const COOKIE_NAME = 'granota_user_id';

async function currentUser(request: NextRequest) {
  const id = request.cookies.get(COOKIE_NAME)?.value;
  if (!id) return null;
  return getDatabase().prepare(
    'SELECT id, nickname, created_at AS createdAt FROM users WHERE id = ? LIMIT 1',
  ).bind(id).first<CommunityUser>();
}

export async function GET() {
  const match = getNextLevanteMatch();
  if (!match) return NextResponse.json({ predictions: [] });
  interface PredictionRow {
    id: string; matchId: string; homeScore: number; awayScore: number;
    lineup: string | null; scorers: string; mvp: string | null;
    publishedAt: number; nickname: string;
  }
  const rows = await getDatabase().prepare(`
    SELECT p.id, p.match_id AS matchId, p.home_score AS homeScore,
      p.away_score AS awayScore, p.lineup, p.scorers, p.mvp,
      p.published_at AS publishedAt, u.nickname
    FROM predictions p JOIN users u ON u.id = p.user_id
    WHERE p.match_id = ? ORDER BY p.published_at DESC LIMIT 100
  `).bind(match.id).all<PredictionRow>();
  const predictions: CommunityPrediction[] = rows.results.map((row) => ({
    id: row.id, matchId: row.matchId,
    homeScore: row.homeScore, awayScore: row.awayScore,
    lineup: row.lineup ? JSON.parse(row.lineup) : null,
    scorers: JSON.parse(row.scorers), mvp: row.mvp,
    publishedAt: row.publishedAt,
    user: { nickname: row.nickname },
  }));
  return NextResponse.json({ predictions });
}

export async function POST(request: NextRequest) {
  const user = await currentUser(request);
  if (!user) return NextResponse.json({ error: 'Debes registrarte antes de publicar.' }, { status: 401 });
  const match = getNextLevanteMatch();
  if (!match) return NextResponse.json({ error: 'No hay un próximo partido disponible.' }, { status: 409 });
  if (isPredictionClosed(match)) {
    return NextResponse.json({ error: 'Las predicciones para este partido ya están cerradas.' }, { status: 409 });
  }
  const body = await request.json() as PredictionDraft;
  const homeScore = body.predictedScore?.home;
  const awayScore = body.predictedScore?.away;
  if (body.matchId !== match.id || !Number.isInteger(homeScore) || !Number.isInteger(awayScore) || homeScore! < 0 || awayScore! < 0 || homeScore! > 20 || awayScore! > 20) {
    return NextResponse.json({ error: 'La predicción no es válida.' }, { status: 400 });
  }
  const db = getDatabase();
  const id = crypto.randomUUID();
  const publishedAt = Date.now();
  await db.prepare(`
    INSERT INTO predictions (id, user_id, match_id, home_score, away_score, lineup, scorers, mvp, published_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, match_id) DO UPDATE SET
      home_score = excluded.home_score, away_score = excluded.away_score,
      lineup = excluded.lineup, scorers = excluded.scorers,
      mvp = excluded.mvp, published_at = excluded.published_at
  `).bind(
    id, user.id, match.id, homeScore, awayScore,
    body.lineup ? JSON.stringify(body.lineup) : null,
    JSON.stringify(body.scorers ?? []), body.mvp ?? null, publishedAt,
  ).run();
  return NextResponse.json({ ok: true });
}
