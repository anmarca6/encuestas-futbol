import { NextResponse } from 'next/server';
import { ensureCommunitySchema, getDatabase } from '@/lib/db';

interface MvpOverrideRow {
  matchday: number;
  playerId: string;
  reason: string;
}

export async function GET() {
  await ensureCommunitySchema();
  const rows = await getDatabase()
    .prepare('SELECT matchday, player_id AS playerId, reason FROM matchday_mvps')
    .bind()
    .all<MvpOverrideRow>();
  return NextResponse.json({ overrides: rows.results });
}
