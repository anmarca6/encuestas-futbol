import { NextRequest, NextResponse } from 'next/server';
import { ensureCommunitySchema, getDatabase } from '@/lib/db';
import { resolveCommunity } from '@/lib/community';
import { currentUser } from '@/lib/prediction-state';
import { vapidPublicKey } from '@/lib/push';

// Clave publica para que el navegador pueda suscribirse; null = los avisos no estan configurados en este servidor.
export async function GET() {
  return NextResponse.json({ publicKey: vapidPublicKey() });
}

// Guarda (o reasigna al usuario actual) la suscripcion push de este dispositivo.
export async function POST(request: NextRequest) {
  await ensureCommunitySchema();
  const community = await resolveCommunity(request);
  if (!community) return NextResponse.json({ error: 'Esta comunidad no existe.' }, { status: 404 });
  const user = await currentUser(request, community.slug);
  if (!user) return NextResponse.json({ error: 'Inicia sesión para activar los avisos.' }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { endpoint?: string; keys?: { p256dh?: string; auth?: string } } | null;
  const endpoint = body?.endpoint;
  const p256dh = body?.keys?.p256dh;
  const auth = body?.keys?.auth;
  if (!endpoint || !p256dh || !auth || !/^https:\/\//.test(endpoint) || endpoint.length > 1000) {
    return NextResponse.json({ error: 'La suscripción no es válida.' }, { status: 400 });
  }
  await getDatabase().prepare(`
    INSERT INTO push_subscriptions (endpoint, user_id, community_slug, p256dh, auth, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(endpoint) DO UPDATE SET user_id = excluded.user_id, community_slug = excluded.community_slug, p256dh = excluded.p256dh, auth = excluded.auth
  `).bind(endpoint, user.id, community.slug, p256dh, auth, Date.now()).run();
  return NextResponse.json({ ok: true });
}

// Quita la suscripcion de este dispositivo (solo si es del usuario con sesion).
export async function DELETE(request: NextRequest) {
  await ensureCommunitySchema();
  const community = await resolveCommunity(request);
  if (!community) return NextResponse.json({ error: 'Esta comunidad no existe.' }, { status: 404 });
  const user = await currentUser(request, community.slug);
  if (!user) return NextResponse.json({ error: 'Inicia sesión para gestionar los avisos.' }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { endpoint?: string } | null;
  if (!body?.endpoint) return NextResponse.json({ error: 'Falta el dispositivo.' }, { status: 400 });
  await getDatabase().prepare('DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?').bind(body.endpoint, user.id).run();
  return NextResponse.json({ ok: true });
}
