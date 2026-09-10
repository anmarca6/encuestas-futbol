import { createHash, timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

export const ADMIN_COOKIE_NAME = 'granota_admin';

export function adminSecretHash(): string {
  return createHash('sha256').update(process.env.ADMIN_PASSWORD ?? '').digest('hex');
}

export function isValidAdminCookie(value: string | undefined): boolean {
  if (!value || !process.env.ADMIN_PASSWORD) return false;
  const expected = Buffer.from(adminSecretHash());
  const actual = Buffer.from(value);
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

export function requireAdmin(request: NextRequest): NextResponse | null {
  const cookie = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
  if (!isValidAdminCookie(cookie)) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }
  return null;
}
