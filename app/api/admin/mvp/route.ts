import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, resolveAdminCommunity } from '@/lib/admin-auth';
import { ensureCommunitySchema, getDatabase } from '@/lib/db';
import { levantePlayers } from '@/lib/levante-data';

// MVP de cada jornada de una comunidad. Un administrador de comunidad solo puede tocar la suya.
export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;

  const body = (await request.json()) as {
    community?: string;
    matchday?: number;
    playerId?: string;
    reason?: string;
  };
  const community = await resolveAdminCommunity(admin, body.community);
  if (community instanceof NextResponse) return community;
  const matchday = Number(body.matchday);
  const playerId = body.playerId?.trim() ?? '';
  const reason = body.reason?.trim() ?? '';
  if (!Number.isInteger(matchday) || matchday < 1) {
    return NextResponse.json({ error: 'Jornada no válida.' }, { status: 400 });
  }
  if (!levantePlayers.some((player) => player.id === playerId)) {
    return NextResponse.json({ error: 'Selecciona un jugador válido.' }, { status: 400 });
  }

  await ensureCommunitySchema();
  await getDatabase()
    .prepare(`
      INSERT INTO community_mvps (community_slug, matchday, player_id, reason, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(community_slug, matchday) DO UPDATE SET
        player_id = excluded.player_id, reason = excluded.reason, updated_at = excluded.updated_at
    `)
    .bind(community, matchday, playerId, reason, Date.now())
    .run();

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;

  const community = await resolveAdminCommunity(admin, request.nextUrl.searchParams.get('community'));
  if (community instanceof NextResponse) return community;
  const matchday = Number(request.nextUrl.searchParams.get('matchday'));
  if (!Number.isInteger(matchday) || matchday < 1) {
    return NextResponse.json({ error: 'Jornada no válida.' }, { status: 400 });
  }

  await ensureCommunitySchema();
  await getDatabase()
    .prepare('DELETE FROM community_mvps WHERE community_slug = ? AND matchday = ?')
    .bind(community, matchday)
    .run();

  return NextResponse.json({ ok: true });
}
