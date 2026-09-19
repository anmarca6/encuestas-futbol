import { NextRequest, NextResponse } from 'next/server';
import { createAdminToken, requireAdmin, setAdminCookie } from '@/lib/admin-auth';
import { ensureCommunitySchema, getDatabase } from '@/lib/db';
import { hashPassword, verifyPassword } from '@/lib/password';
import { MIN_ADMIN_PASSWORD_LENGTH } from '@/lib/admin-shared';

// Cada administrador cambia su propia contraseña. Las demás sesiones de esa cuenta se cierran.
export async function PATCH(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;

  const body = (await request.json()) as { currentPassword?: string; newPassword?: string };
  const newPassword = body.newPassword ?? '';
  if (newPassword.length < MIN_ADMIN_PASSWORD_LENGTH) {
    return NextResponse.json({ error: `La nueva contraseña debe tener al menos ${MIN_ADMIN_PASSWORD_LENGTH} caracteres.` }, { status: 400 });
  }

  await ensureCommunitySchema();
  const db = getDatabase();
  const account = await db
    .prepare('SELECT password_hash AS passwordHash FROM admin_accounts WHERE id = ? LIMIT 1')
    .bind(admin.id)
    .first<{ passwordHash: string }>();
  if (!account || !(await verifyPassword(body.currentPassword ?? '', account.passwordHash))) {
    return NextResponse.json({ error: 'La contraseña actual no es correcta.' }, { status: 401 });
  }

  const passwordHash = await hashPassword(newPassword);
  await db.prepare('UPDATE admin_accounts SET password_hash = ? WHERE id = ?').bind(passwordHash, admin.id).run();
  const response = NextResponse.json({ ok: true });
  const token = createAdminToken({ id: admin.id, passwordHash });
  if (token) setAdminCookie(response, request, token);
  return response;
}
