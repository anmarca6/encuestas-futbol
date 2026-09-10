import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_COOKIE_NAME, adminSecretHash, isValidAdminCookie } from '@/lib/admin-auth';

export async function GET(request: NextRequest) {
  const authenticated = isValidAdminCookie(request.cookies.get(ADMIN_COOKIE_NAME)?.value);
  return NextResponse.json({ authenticated });
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { password?: string };
  if (!process.env.ADMIN_PASSWORD || body.password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Contraseña incorrecta.' }, { status: 401 });
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE_NAME, adminSecretHash(), {
    httpOnly: true,
    sameSite: 'lax',
    secure: request.nextUrl.protocol === 'https:',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}

export async function DELETE(request: NextRequest) {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: request.nextUrl.protocol === 'https:',
    path: '/',
    maxAge: 0,
  });
  return response;
}
