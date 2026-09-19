import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/admin-auth';
import { ensureCommunitySchema, getDatabase } from '@/lib/db';
import { findCommunity } from '@/lib/community';
import { hashPassword } from '@/lib/password';
import { ADMIN_USERNAME_PATTERN, MIN_ADMIN_PASSWORD_LENGTH, type AdminAccountInfo } from '@/lib/admin-shared';

// Gestión de cuentas de administración: solo para los super administradores.
export async function GET(request: NextRequest) {
  const admin = await requireSuperAdmin(request);
  if (admin instanceof NextResponse) return admin;

  await ensureCommunitySchema();
  const rows = await getDatabase()
    .prepare(`
      SELECT id, username, role, community_slug AS communitySlug, created_at AS createdAt
      FROM admin_accounts ORDER BY role ASC, created_at ASC
    `)
    .bind()
    .all<AdminAccountInfo>();
  return NextResponse.json({ admins: rows.results });
}

// Crea el administrador de una comunidad.
export async function POST(request: NextRequest) {
  const admin = await requireSuperAdmin(request);
  if (admin instanceof NextResponse) return admin;

  const body = (await request.json()) as { username?: string; password?: string; communitySlug?: string };
  const username = (body.username ?? '').trim().replace(/^@/, '').toLowerCase();
  const password = body.password ?? '';
  if (!ADMIN_USERNAME_PATTERN.test(username)) {
    return NextResponse.json(
      { error: 'El usuario debe tener entre 2 y 30 caracteres: minúsculas, números, punto, guion o guion bajo.' },
      { status: 400 },
    );
  }
  if (password.length < MIN_ADMIN_PASSWORD_LENGTH) {
    return NextResponse.json({ error: `La contraseña debe tener al menos ${MIN_ADMIN_PASSWORD_LENGTH} caracteres.` }, { status: 400 });
  }
  if (!body.communitySlug || !(await findCommunity(body.communitySlug))) {
    return NextResponse.json({ error: 'Elige una comunidad válida.' }, { status: 400 });
  }

  const db = getDatabase();
  if (await db.prepare('SELECT id FROM admin_accounts WHERE username = ? LIMIT 1').bind(username).first()) {
    return NextResponse.json({ error: `Ya existe un administrador con el usuario @${username}.` }, { status: 409 });
  }
  const account: AdminAccountInfo = {
    id: crypto.randomUUID(),
    username,
    role: 'community',
    communitySlug: body.communitySlug,
    createdAt: Date.now(),
  };
  try {
    await db
      .prepare('INSERT INTO admin_accounts (id, username, password_hash, role, community_slug, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(account.id, username, await hashPassword(password), account.role, account.communitySlug, account.createdAt)
      .run();
  } catch (error) {
    if (/unique/i.test(error instanceof Error ? error.message : String(error))) {
      return NextResponse.json({ error: `Ya existe un administrador con el usuario @${username}.` }, { status: 409 });
    }
    throw error;
  }
  return NextResponse.json({ admin: account }, { status: 201 });
}

// Restablece la contraseña de un administrador de comunidad (sus sesiones abiertas se cierran).
export async function PATCH(request: NextRequest) {
  const admin = await requireSuperAdmin(request);
  if (admin instanceof NextResponse) return admin;

  const body = (await request.json()) as { id?: string; password?: string };
  if ((body.password ?? '').length < MIN_ADMIN_PASSWORD_LENGTH) {
    return NextResponse.json({ error: `La contraseña debe tener al menos ${MIN_ADMIN_PASSWORD_LENGTH} caracteres.` }, { status: 400 });
  }
  const db = getDatabase();
  const target = await db.prepare('SELECT id, role FROM admin_accounts WHERE id = ? LIMIT 1').bind(body.id ?? '').first<{ id: string; role: string }>();
  if (!target) return NextResponse.json({ error: 'Este administrador no existe.' }, { status: 404 });
  if (target.role === 'super') {
    return NextResponse.json({ error: 'Los super administradores cambian su contraseña desde su propio panel.' }, { status: 403 });
  }
  await db.prepare('UPDATE admin_accounts SET password_hash = ? WHERE id = ?').bind(await hashPassword(body.password!), target.id).run();
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const admin = await requireSuperAdmin(request);
  if (admin instanceof NextResponse) return admin;

  const id = request.nextUrl.searchParams.get('id') ?? '';
  const db = getDatabase();
  const target = await db.prepare('SELECT id, role FROM admin_accounts WHERE id = ? LIMIT 1').bind(id).first<{ id: string; role: string }>();
  if (!target) return NextResponse.json({ error: 'Este administrador no existe.' }, { status: 404 });
  if (target.role === 'super') {
    return NextResponse.json({ error: 'No se puede eliminar a un super administrador.' }, { status: 403 });
  }
  await db.prepare('DELETE FROM admin_accounts WHERE id = ?').bind(id).run();
  return NextResponse.json({ ok: true });
}
