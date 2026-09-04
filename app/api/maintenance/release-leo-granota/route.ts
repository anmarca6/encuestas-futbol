import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';

const AUTHORIZATION_HASH =
  'ace018b76cb866774e9fd297499ee45dd7d32638d4eee235d9a28de77b2ee228';

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function POST(request: Request) {
  const authorization = request.headers.get('authorization');
  const token = authorization?.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length)
    : '';

  if ((await sha256(token)) !== AUTHORIZATION_HASH) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }

  const db = getDatabase();
  const user = await db
    .prepare(
      "SELECT id FROM users WHERE nickname = 'Leo_Granota' COLLATE NOCASE LIMIT 1",
    )
    .first<{ id: string }>();

  if (!user) {
    return NextResponse.json({ released: true, deletedUsers: 0 });
  }

  await db.batch([
    db.prepare('DELETE FROM predictions WHERE user_id = ?').bind(user.id),
    db.prepare('DELETE FROM users WHERE id = ?').bind(user.id),
  ]);

  return NextResponse.json({ released: true, deletedUsers: 1 });
}
