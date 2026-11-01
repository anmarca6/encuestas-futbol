import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { ensureCommunitySchema, getDatabase } from '@/lib/db';
import { loadRivalGoals, sanitizeRivalGoals } from '@/lib/rival-goals';

// Goles de los rivales por jornada. Solo para administradores: no hay ninguna ruta publica que los lea.
export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;
  return NextResponse.json({ goals: await loadRivalGoals() }, { headers: { 'Cache-Control': 'no-store' } });
}

// Guarda los goles del rival de una jornada (lista vacia = borra lo guardado).
export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;
  const body = (await request.json().catch(() => null)) as { matchday?: number; goals?: unknown } | null;
  const matchday = Number(body?.matchday);
  if (!Number.isInteger(matchday) || matchday < 1) return NextResponse.json({ error: 'Jornada no válida.' }, { status: 400 });
  const goals = sanitizeRivalGoals(body?.goals);
  await ensureCommunitySchema();
  const db = getDatabase();
  if (goals.length === 0) {
    await db.prepare('DELETE FROM rival_goals WHERE matchday = ?').bind(matchday).run();
  } else {
    await db.prepare(`
      INSERT INTO rival_goals (matchday, goals, updated_at) VALUES (?, ?, ?)
      ON CONFLICT(matchday) DO UPDATE SET goals = excluded.goals, updated_at = excluded.updated_at
    `).bind(matchday, JSON.stringify(goals), Date.now()).run();
  }
  return NextResponse.json({ ok: true });
}
