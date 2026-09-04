import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';

const TEST_USER_IDS = [
  '4837b8c1-c1a0-460d-8500-1be1d6895941',
  '89bda8c6-077c-42dd-b3e4-b603fe19470e',
] as const;

export async function POST(request: NextRequest) {
  const suppliedToken = request.headers.get('authorization');
  const expectedToken = process.env.ADMIN_CLEANUP_TOKEN;
  if (!expectedToken || suppliedToken !== `Bearer ${expectedToken}`) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }

  const db = getDatabase();
  for (const userId of TEST_USER_IDS) {
    await db.prepare('DELETE FROM predictions WHERE user_id = ?').bind(userId).run();
    await db.prepare('DELETE FROM users WHERE id = ?').bind(userId).run();
  }

  return NextResponse.json({ ok: true });
}
