import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, resolveAdminCommunity } from '@/lib/admin-auth';
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
  communitySlug: string;
}

export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;
  const community = await resolveAdminCommunity(admin, request.nextUrl.searchParams.get('community'));
  if (community instanceof NextResponse) return community;

  await ensureCommunitySchema();
  const rows = await getDatabase()
    .prepare(`
      SELECT p.id, p.user_id AS userId, p.match_id AS matchId,
        p.home_score AS homeScore, p.away_score AS awayScore,
        p.published_at AS publishedAt, u.nickname, u.avatar_url AS avatarUrl,
        u.community_slug AS communitySlug
      FROM predictions p JOIN users u ON u.id = p.user_id
      WHERE u.community_slug = ?
      ORDER BY p.published_at DESC
      LIMIT 300
    `)
    .bind(community)
    .all<AdminPredictionRow>();

  return NextResponse.json({ predictions: rows.results });
}

export async function DELETE(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;
  const community = await resolveAdminCommunity(admin, request.nextUrl.searchParams.get('community'));
  if (community instanceof NextResponse) return community;

  const id = request.nextUrl.searchParams.get('id');
  const userId = request.nextUrl.searchParams.get('userId');
  if (!id && !userId) {
    return NextResponse.json({ error: 'Falta id o userId.' }, { status: 400 });
  }

  await ensureCommunitySchema();
  const db = getDatabase();
  // Solo se borra lo que pertenece a la comunidad indicada (un administrador de comunidad no puede tocar otras).
  if (id) {
    await db.prepare('DELETE FROM predictions WHERE id = ? AND user_id IN (SELECT id FROM users WHERE community_slug = ?)').bind(id, community).run();
  } else {
    await db.prepare('DELETE FROM predictions WHERE user_id = ? AND user_id IN (SELECT id FROM users WHERE community_slug = ?)').bind(userId, community).run();
  }

  return NextResponse.json({ ok: true });
}
