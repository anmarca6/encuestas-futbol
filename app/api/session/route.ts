import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';
import type { CommunityUser } from '@/lib/community-types';

const COOKIE_NAME = 'granota_user_id';

async function findUser(id: string | undefined): Promise<CommunityUser | null> {
  if (!id) return null;
  return getDatabase()
    .prepare(
      'SELECT id, name, nickname, email, created_at AS createdAt FROM users WHERE id = ? LIMIT 1',
    )
    .bind(id)
    .first<CommunityUser>();
}

export async function GET(request: NextRequest) {
  const user = await findUser(request.cookies.get(COOKIE_NAME)?.value);
  return NextResponse.json({ user });
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { nickname?: string };
  const nickname = body.nickname?.trim().replace(/^@/, '').slice(0, 30) ?? '';
  if (nickname.length < 2 || !/^[\p{L}\p{N}_.-]+$/u.test(nickname)) {
    return NextResponse.json(
      {
        error:
          'El apodo debe tener al menos 2 caracteres y no puede contener espacios.',
      },
      { status: 400 },
    );
  }
  const db = getDatabase();
  const id = crypto.randomUUID();
  const user = {
    id,
    name: nickname,
    nickname,
    email: `${id}@granota.invalid`,
    createdAt: Date.now(),
  };
  try {
    await db
      .prepare(
        'INSERT INTO users (id, name, nickname, email, created_at) VALUES (?, ?, ?, ?, ?)',
      )
      .bind(user.id, user.name, user.nickname, user.email, user.createdAt)
      .run();
  } catch {
    return NextResponse.json(
      { error: 'Ese apodo ya está en uso. Prueba con otro.' },
      { status: 409 },
    );
  }
  const response = NextResponse.json({ user });
  response.cookies.set(COOKIE_NAME, user.id, {
    httpOnly: true,
    sameSite: 'lax',
    secure: request.nextUrl.protocol === 'https:',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}
