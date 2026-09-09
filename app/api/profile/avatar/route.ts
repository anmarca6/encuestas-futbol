import { NextRequest, NextResponse } from 'next/server';
import { ensureCommunitySchema, getDatabase } from '@/lib/db';

const COOKIE_NAME = 'granota_user_id';
const MAX_AVATAR_LENGTH = 180_000;

export async function POST(request: NextRequest) {
  const userId = request.cookies.get(COOKIE_NAME)?.value;
  if (!userId) return NextResponse.json({ error: 'Debes tener un perfil para añadir una foto.' }, { status: 401 });
  const body = await request.json() as { avatarUrl?: string };
  const avatarUrl = body.avatarUrl ?? '';
  if (!/^data:image\/(webp|jpeg);base64,[A-Za-z0-9+/=]+$/.test(avatarUrl) || avatarUrl.length > MAX_AVATAR_LENGTH) {
    return NextResponse.json({ error: 'La imagen no es válida o es demasiado grande.' }, { status: 400 });
  }
  await ensureCommunitySchema();
  await getDatabase().prepare('UPDATE users SET avatar_url = ? WHERE id = ?').bind(avatarUrl, userId).run();
  return NextResponse.json({ avatarUrl });
}
