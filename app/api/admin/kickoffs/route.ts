import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { ensureCommunitySchema, getDatabase } from '@/lib/db';
import { KICKOFF_TIME_PATTERN } from '@/lib/kickoff-shared';
import { loadKickoffOverrides } from '@/lib/kickoffs';

export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;
  return NextResponse.json({ overrides: await loadKickoffOverrides() }, { headers: { 'Cache-Control': 'no-store' } });
}

// Guarda la hora de inicio de un partido (hora de Madrid, "HH:MM"). Es la misma para todas las comunidades: el partido es uno solo.
export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;
  const body = (await request.json().catch(() => null)) as { matchday?: number; time?: string } | null;
  const matchday = Number(body?.matchday);
  const time = body?.time?.trim() ?? '';
  if (!Number.isInteger(matchday) || matchday < 1) return NextResponse.json({ error: 'Jornada no válida.' }, { status: 400 });
  if (!KICKOFF_TIME_PATTERN.test(time)) return NextResponse.json({ error: 'La hora debe tener el formato HH:MM.' }, { status: 400 });
  await ensureCommunitySchema();
  await getDatabase().prepare(`
    INSERT INTO match_kickoffs (matchday, kickoff_time, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(matchday) DO UPDATE SET kickoff_time = excluded.kickoff_time, updated_at = excluded.updated_at
  `).bind(matchday, time, Date.now()).run();
  return NextResponse.json({ ok: true });
}

// Quita la hora guardada: el partido vuelve a usar la del calendario oficial.
export async function DELETE(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;
  const matchday = Number(request.nextUrl.searchParams.get('matchday'));
  if (!Number.isInteger(matchday) || matchday < 1) return NextResponse.json({ error: 'Jornada no válida.' }, { status: 400 });
  await ensureCommunitySchema();
  await getDatabase().prepare('DELETE FROM match_kickoffs WHERE matchday = ?').bind(matchday).run();
  return NextResponse.json({ ok: true });
}
