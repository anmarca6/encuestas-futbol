import { NextRequest, NextResponse } from 'next/server';
import { ensureCommunitySchema, getDatabase } from '@/lib/db';
import { resolveCommunity } from '@/lib/community';
import { sessionCookieName } from '@/lib/community-shared';

const MAX_AVATAR_LENGTH = 180_000;

export async function POST(request: NextRequest) {
  const community = await resolveCommunity(request);
  if (!community) return NextResponse.json({ error: 'Esta comunidad no existe.' }, { status: 404 });
  const userId = request.cookies.get(sessionCookieName(community.slug))?.value;
  if (!userId) return NextResponse.json({ error: 'Debes tener un perfil para añadir una foto.' }, { status: 401 });
  const body = await request.json() as { avatarUrl?: string };
  const avatarUrl = body.avatarUrl ?? '';
  if (!/^data:image\/(webp|jpeg);base64,[A-Za-z0-9+/=]+$/.test(avatarUrl) || avatarUrl.length > MAX_AVATAR_LENGTH) {
    return NextResponse.json({ error: 'La imagen no es válida o es demasiado grande.' }, { status: 400 });
  }
  await ensureCommunitySchema();
  await getDatabase().prepare('UPDATE users SET avatar_url = ? WHERE id = ? AND community_slug = ?').bind(avatarUrl, userId, community.slug).run();
  return NextResponse.json({ avatarUrl });
}
