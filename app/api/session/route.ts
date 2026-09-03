import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';
import type { CommunityUser } from '@/lib/community-types';

const COOKIE_NAME = 'granota_user_id';

async function findUser(id: string | undefined): Promise<CommunityUser | null> {
  if (!id) return null;
  return getDatabase().prepare(
    'SELECT id, name, nickname, email, created_at AS createdAt FROM users WHERE id = ? LIMIT 1',
  ).bind(id).first<CommunityUser>();
}

export async function GET(request: NextRequest) {
  const user = await findUser(request.cookies.get(COOKIE_NAME)?.value);
  return NextResponse.json({ user });
}

export async function POST(request: NextRequest) {
  const body = await request.json() as { name?: string; nickname?: string; email?: string };
  const name = body.name?.trim().slice(0, 80) ?? '';
  const nickname = body.nickname?.trim().replace(/^@/, '').slice(0, 30) ?? '';
  const email = body.email?.trim().toLowerCase().slice(0, 160) ?? '';
  if (name.length < 2 || nickname.length < 2 || !/^\S+@\S+\.\S+$/.test(email)) {
    return NextResponse.json({ error: 'Revisa el nombre, el apodo y el correo electrónico.' }, { status: 400 });
  }
  const db = getDatabase();
  const existing = await db.prepare(
    'SELECT id, name, nickname, email, created_at AS createdAt FROM users WHERE email = ? LIMIT 1',
  ).bind(email).first<CommunityUser>();
  const user = existing ?? { id: crypto.randomUUID(), name, nickname, email, createdAt: Date.now() };
  if (!existing) {
    try {
      await db.prepare(
        'INSERT INTO users (id, name, nickname, email, created_at) VALUES (?, ?, ?, ?, ?)',
      ).bind(user.id, user.name, user.nickname, user.email, user.createdAt).run();
    } catch {
      return NextResponse.json({ error: 'Ese apodo ya está en uso. Prueba con otro.' }, { status: 409 });
    }
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
