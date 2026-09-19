import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { ensureCommunitySchema, getDatabase } from '@/lib/db';
import { findCommunity } from '@/lib/community';
import { DEFAULT_COMMUNITY_SLUG } from '@/lib/community-shared';

export const ADMIN_COOKIE_NAME = 'granota_admin';
const SESSION_MS = 30 * 24 * 60 * 60 * 1000;

// super: acceso a todo (Leo y Angel). community: solo gestiona su propia comunidad.
export type AdminRole = 'super' | 'community';

export interface AdminSession {
  id: string;
  username: string;
  role: AdminRole;
  communitySlug: string | null;
}

interface AccountRow {
  id: string;
  username: string;
  passwordHash: string;
  role: AdminRole;
  communitySlug: string | null;
}

// La sesión es un token firmado (HMAC) con una clave que solo conoce el servidor.
function sessionSecret(): string | null {
  return process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD || null;
}

// Cambiar la contraseña invalida las sesiones abiertas de esa cuenta.
const fingerprint = (passwordHash: string) => createHash('sha256').update(passwordHash).digest('hex').slice(0, 16);
const sign = (payload: string, secret: string) => createHmac('sha256', secret).update(payload).digest('hex');

export function isAdminPanelConfigured(): boolean {
  return sessionSecret() !== null;
}

export function createAdminToken(account: { id: string; passwordHash: string }): string | null {
  const secret = sessionSecret();
  if (!secret) return null;
  const payload = `${account.id}.${Date.now() + SESSION_MS}.${fingerprint(account.passwordHash)}`;
  return `${payload}.${sign(payload, secret)}`;
}

export function setAdminCookie(response: NextResponse, request: NextRequest, token: string) {
  response.cookies.set(ADMIN_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: request.nextUrl.protocol === 'https:',
    path: '/',
    maxAge: SESSION_MS / 1000,
  });
}

export function clearAdminCookie(response: NextResponse, request: NextRequest) {
  response.cookies.set(ADMIN_COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: request.nextUrl.protocol === 'https:',
    path: '/',
    maxAge: 0,
  });
}

export async function getAdmin(request: NextRequest): Promise<AdminSession | null> {
  const secret = sessionSecret();
  const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
  if (!secret || !token) return null;
  const parts = token.split('.');
  if (parts.length !== 4) return null;
  const [id, expires, tokenFingerprint, signature] = parts;
  const expected = Buffer.from(sign(`${id}.${expires}.${tokenFingerprint}`, secret));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  if (!(Number(expires) > Date.now())) return null;

  await ensureCommunitySchema();
  const account = await getDatabase()
    .prepare('SELECT id, username, password_hash AS passwordHash, role, community_slug AS communitySlug FROM admin_accounts WHERE id = ? LIMIT 1')
    .bind(id)
    .first<AccountRow>();
  if (!account || fingerprint(account.passwordHash) !== tokenFingerprint) return null;
  return { id: account.id, username: account.username, role: account.role, communitySlug: account.communitySlug };
}

const unauthorized = () => NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
const forbidden = () => NextResponse.json({ error: 'No tienes permiso para esto.' }, { status: 403 });

// Cualquier administrador (super o de comunidad).
export async function requireAdmin(request: NextRequest): Promise<AdminSession | NextResponse> {
  return (await getAdmin(request)) ?? unauthorized();
}

// Solo los super administradores.
export async function requireSuperAdmin(request: NextRequest): Promise<AdminSession | NextResponse> {
  const admin = await getAdmin(request);
  if (!admin) return unauthorized();
  return admin.role === 'super' ? admin : forbidden();
}

// Comunidad sobre la que actúa el administrador: un administrador de comunidad solo puede actuar sobre la suya;
// un super administrador elige una (por defecto la principal).
export async function resolveAdminCommunity(admin: AdminSession, requested: string | null | undefined): Promise<string | NextResponse> {
  const slug = (requested ?? '').trim().toLowerCase();
  if (admin.role === 'community') {
    if (slug && slug !== admin.communitySlug) return forbidden();
    return admin.communitySlug ?? forbidden();
  }
  const target = slug || DEFAULT_COMMUNITY_SLUG;
  return (await findCommunity(target)) ? target : NextResponse.json({ error: 'Esta comunidad no existe.' }, { status: 404 });
}
