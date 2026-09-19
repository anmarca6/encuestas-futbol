import { NextRequest, NextResponse } from 'next/server';
import { clearAdminCookie, createAdminToken, getAdmin, isAdminPanelConfigured, setAdminCookie } from '@/lib/admin-auth';
import { ensureCommunitySchema, getDatabase } from '@/lib/db';
import { findCommunity } from '@/lib/community';
import { verifyPassword } from '@/lib/password';

interface AccountRow {
  id: string;
  username: string;
  passwordHash: string;
}

// Freno básico contra adivinar contraseñas: 5 fallos por usuario y dirección en 15 minutos.
// Vive en la memoria de la instancia, así que es una ayuda y no una garantía.
const attempts = new Map<string, { count: number; since: number }>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;

function throttleKey(request: NextRequest, username: string) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  return `${username}|${ip}`;
}

function isThrottled(key: string): boolean {
  const entry = attempts.get(key);
  if (!entry) return false;
  if (Date.now() - entry.since > WINDOW_MS) {
    attempts.delete(key);
    return false;
  }
  return entry.count >= MAX_FAILURES;
}

function registerFailure(key: string) {
  const entry = attempts.get(key);
  if (!entry || Date.now() - entry.since > WINDOW_MS) attempts.set(key, { count: 1, since: Date.now() });
  else entry.count += 1;
}

export async function GET(request: NextRequest) {
  const admin = await getAdmin(request);
  if (!admin) return NextResponse.json({ authenticated: false });
  const community = admin.communitySlug ? await findCommunity(admin.communitySlug) : null;
  return NextResponse.json({
    authenticated: true,
    admin: {
      username: admin.username,
      role: admin.role,
      communitySlug: admin.communitySlug,
      communityName: community?.name ?? null,
    },
  });
}

export async function POST(request: NextRequest) {
  if (!isAdminPanelConfigured()) {
    return NextResponse.json({ error: 'El panel no está configurado (falta ADMIN_PASSWORD en el servidor).' }, { status: 503 });
  }
  const body = (await request.json()) as { username?: string; password?: string };
  const username = (body.username ?? '').trim().replace(/^@/, '').toLowerCase();
  const password = body.password ?? '';
  if (!username || !password) {
    return NextResponse.json({ error: 'Escribe tu usuario y tu contraseña.' }, { status: 400 });
  }
  const key = throttleKey(request, username);
  if (isThrottled(key)) {
    return NextResponse.json({ error: 'Demasiados intentos fallidos. Espera unos minutos y vuelve a probar.' }, { status: 429 });
  }

  await ensureCommunitySchema();
  const account = await getDatabase()
    .prepare('SELECT id, username, password_hash AS passwordHash FROM admin_accounts WHERE username = ? LIMIT 1')
    .bind(username)
    .first<AccountRow>();
  // Se calcula el hash aunque el usuario no exista para que el tiempo de respuesta no lo delate.
  const valid = await verifyPassword(password, account?.passwordHash ?? 'aa:bb');
  if (!account || !valid) {
    registerFailure(key);
    return NextResponse.json({ error: 'Usuario o contraseña incorrectos.' }, { status: 401 });
  }

  attempts.delete(key);
  const token = createAdminToken(account);
  if (!token) return NextResponse.json({ error: 'No se pudo iniciar la sesión.' }, { status: 500 });
  const response = NextResponse.json({ ok: true });
  setAdminCookie(response, request, token);
  return response;
}

export async function DELETE(request: NextRequest) {
  const response = NextResponse.json({ ok: true });
  clearAdminCookie(response, request);
  return response;
}
