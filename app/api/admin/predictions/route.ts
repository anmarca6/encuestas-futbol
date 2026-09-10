import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { ensureCommunitySchema, getDatabase } from '@/lib/db';

interface AdminPredictionRow {
  id: string;
  userId: string;
  matchId: string;
  homeScore: number;
  awayScore: number;
  publishedAt: number;
  nickname: string;
  avatarUrl: string | null;
}

export async function GET(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  await ensureCommunitySchema();
  const rows = await getDatabase()
    .prepare(`
      SELECT p.id, p.user_id AS userId, p.match_id AS matchId,
        p.home_score AS homeScore, p.away_score AS awayScore,
        p.published_at AS publishedAt, u.nickname, u.avatar_url AS avatarUrl
      FROM predictions p JOIN users u ON u.id = p.user_id
      ORDER BY p.published_at DESC
      LIMIT 300
    `)
    .bind()
    .all<AdminPredictionRow>();

  return NextResponse.json({ predictions: rows.results });
}

export async function DELETE(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  const id = request.nextUrl.searchParams.get('id');
  const userId = request.nextUrl.searchParams.get('userId');
  if (!id && !userId) {
    return NextResponse.json({ error: 'Falta id o userId.' }, { status: 400 });
  }

  await ensureCommunitySchema();
  const db = getDatabase();
  if (id) {
    await db.prepare('DELETE FROM predictions WHERE id = ?').bind(id).run();
  } else {
    await db.prepare('DELETE FROM predictions WHERE user_id = ?').bind(userId).run();
  }

  return NextResponse.json({ ok: true });
}
