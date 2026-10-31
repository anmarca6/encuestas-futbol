import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, resolveAdminCommunity } from '@/lib/admin-auth';
import { communityPushAudience, sendPushToCommunity } from '@/lib/push';

const MAX_TITLE = 60;
const MAX_BODY = 180;

// Cuantos dispositivos de la comunidad tienen los avisos y cuantos recibirian el siguiente (los que aun no han hecho la previa).
export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;
  const community = await resolveAdminCommunity(admin, request.nextUrl.searchParams.get('community'));
  if (community instanceof NextResponse) return community;
  return NextResponse.json(await communityPushAudience(community), { headers: { 'Cache-Control': 'no-store' } });
}

// Envia un aviso a los usuarios de la comunidad que aun no han hecho su previa del proximo partido.
export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;
  const body = (await request.json().catch(() => null)) as { community?: string; title?: string; message?: string } | null;
  const community = await resolveAdminCommunity(admin, body?.community);
  if (community instanceof NextResponse) return community;
  const title = (body?.title ?? '').trim() || 'Granota App';
  const message = (body?.message ?? '').trim();
  if (!message) return NextResponse.json({ error: 'Escribe el mensaje del aviso.' }, { status: 400 });
  if (title.length > MAX_TITLE) return NextResponse.json({ error: `El título no puede pasar de ${MAX_TITLE} caracteres.` }, { status: 400 });
  if (message.length > MAX_BODY) return NextResponse.json({ error: `El mensaje no puede pasar de ${MAX_BODY} caracteres.` }, { status: 400 });
  const result = await sendPushToCommunity(community, { title, body: message });
  if (!result.configured) {
    return NextResponse.json({ error: 'Los avisos no están configurados en el servidor (faltan las claves VAPID).' }, { status: 503 });
  }
  return NextResponse.json(result);
}
