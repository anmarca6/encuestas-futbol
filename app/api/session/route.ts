import { NextRequest, NextResponse } from 'next/server';
import { ensureCommunitySchema, getDatabase } from '@/lib/db';
import { hashPassword, verifyPassword } from '@/lib/password';
import type { CommunityUser } from '@/lib/community-types';

const COOKIE_NAME = 'granota_user_id';

async function findUser(id: string | undefined): Promise<CommunityUser | null> {
  if (!id) return null;
  await ensureCommunitySchema();
  return getDatabase()
    .prepare(
      'SELECT id, nickname, created_at AS createdAt, avatar_url AS avatarUrl FROM users WHERE id = ? LIMIT 1',
    )
    .bind(id)
    .first<CommunityUser>();
}

function setSessionCookie(response: NextResponse, request: NextRequest, userId: string) {
  response.cookies.set(COOKIE_NAME, userId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: request.nextUrl.protocol === 'https:',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });
}

export async function GET(request: NextRequest) {
  const user = await findUser(request.cookies.get(COOKIE_NAME)?.value);
  return NextResponse.json({ user });
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { nickname?: string; password?: string };
  const nickname = body.nickname?.trim().replace(/^@/, '').slice(0, 30) ?? '';
  const password = body.password ?? '';
  if (nickname.length < 2 || !/^[\p{L}\p{N}_.-]+$/u.test(nickname)) {
    return NextResponse.json(
      {
        error:
          'El apodo debe tener al menos 2 caracteres y no puede contener espacios.',
      },
      { status: 400 },
    );
  }
  if (password.length < 4) {
    return NextResponse.json(
      { error: 'La contraseña debe tener al menos 4 caracteres.' },
      { status: 400 },
    );
  }
  await ensureCommunitySchema();
  const db = getDatabase();

  const existing = await db
    .prepare(
      'SELECT id, nickname, created_at AS createdAt, avatar_url AS avatarUrl, password_hash AS passwordHash FROM users WHERE nickname = ? LIMIT 1',
    )
    .bind(nickname)
    .first<CommunityUser & { passwordHash: string | null }>();

  if (existing) {
    if (existing.passwordHash) {
      const valid = await verifyPassword(password, existing.passwordHash);
      if (!valid) {
        return NextResponse.json(
          { error: 'Esa contraseña no es correcta.' },
          { status: 401 },
        );
      }
    } else {
      // Cuenta creada antes de tener contraseña: la reclamamos con la
      // contraseña indicada ahora, en lugar de dejarla inaccesible.
      const passwordHash = await hashPassword(password);
      await db
        .prepare('UPDATE users SET password_hash = ? WHERE id = ?')
        .bind(passwordHash, existing.id)
        .run();
    }
    const { passwordHash: _passwordHash, ...user } = existing;
    const response = NextResponse.json({ user });
    setSessionCookie(response, request, existing.id);
    return response;
  }

  const id = crypto.randomUUID();
  const user = { id, nickname, createdAt: Date.now(), avatarUrl: null };
  try {
    const passwordHash = await hashPassword(password);
    const columns = await db
      .prepare('PRAGMA table_info(users)')
      .bind()
      .all<{ name: string }>();
    const legacyColumns = new Set(columns.results.map((column) => column.name));
    if (legacyColumns.has('name') && legacyColumns.has('email')) {
      await db
        .prepare(
          'INSERT INTO users (id, name, nickname, email, created_at, password_hash) VALUES (?, ?, ?, ?, ?, ?)',
        )
        .bind(
          user.id,
          user.nickname,
          user.nickname,
          `${user.id}@granota-app.invalid`,
          user.createdAt,
          passwordHash,
        )
        .run();
    } else {
      await db
        .prepare(
          'INSERT INTO users (id, nickname, created_at, password_hash) VALUES (?, ?, ?, ?)',
        )
        .bind(user.id, user.nickname, user.createdAt, passwordHash)
        .run();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/unique constraint|unique index|idx_users_nickname/i.test(message)) {
      return NextResponse.json(
        { error: 'Ese apodo ya está en uso. Prueba con otro.' },
        { status: 409 },
      );
    }
    console.error('No se pudo guardar el apodo en la base de datos', error);
    return NextResponse.json(
      { error: 'No se pudo guardar el apodo. Inténtalo de nuevo.' },
      { status: 500 },
    );
  }
  const response = NextResponse.json({ user });
  setSessionCookie(response, request, user.id);
  return response;
}

export async function DELETE(request: NextRequest) {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: request.nextUrl.protocol === 'https:',
    path: '/',
    maxAge: 0,
  });
  return response;
}

export async function PATCH(request: NextRequest) {
  const userId = request.cookies.get(COOKIE_NAME)?.value;
  if (!userId) {
    return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 });
  }
  const body = (await request.json()) as {
    currentPassword?: string;
    newPassword?: string;
  };
  const currentPassword = body.currentPassword ?? '';
  const newPassword = body.newPassword ?? '';
  if (newPassword.length < 4) {
    return NextResponse.json(
      { error: 'La nueva contraseña debe tener al menos 4 caracteres.' },
      { status: 400 },
    );
  }
  await ensureCommunitySchema();
  const db = getDatabase();
  const existing = await db
    .prepare('SELECT password_hash AS passwordHash FROM users WHERE id = ? LIMIT 1')
    .bind(userId)
    .first<{ passwordHash: string | null }>();
  if (!existing?.passwordHash || !(await verifyPassword(currentPassword, existing.passwordHash))) {
    return NextResponse.json({ error: 'La contraseña actual no es correcta.' }, { status: 401 });
  }
  const passwordHash = await hashPassword(newPassword);
  await db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(passwordHash, userId).run();
  return NextResponse.json({ ok: true });
}
