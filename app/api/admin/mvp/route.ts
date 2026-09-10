import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { ensureCommunitySchema, getDatabase } from '@/lib/db';
import { levantePlayers } from '@/lib/levante-data';

export async function POST(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  const body = (await request.json()) as {
    matchday?: number;
    playerId?: string;
    reason?: string;
  };
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
      INSERT INTO matchday_mvps (matchday, player_id, reason, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(matchday) DO UPDATE SET
        player_id = excluded.player_id, reason = excluded.reason, updated_at = excluded.updated_at
    `)
    .bind(matchday, playerId, reason, Date.now())
    .run();

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  const matchday = Number(request.nextUrl.searchParams.get('matchday'));
  if (!Number.isInteger(matchday) || matchday < 1) {
    return NextResponse.json({ error: 'Jornada no válida.' }, { status: 400 });
  }

  await ensureCommunitySchema();
  await getDatabase()
    .prepare('DELETE FROM matchday_mvps WHERE matchday = ?')
    .bind(matchday)
    .run();

  return NextResponse.json({ ok: true });
}
