import { NextRequest, NextResponse } from 'next/server';
import { ensureCommunitySchema, getDatabase } from '@/lib/db';
import { SLUG_PATTERN } from '@/lib/community-shared';

// Sirve la imagen de portada de una comunidad. La URL lleva la versión de la imagen (?v=...),
// así que puede cachearse sin caducidad: al cambiar la imagen cambia la URL.
export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get('slug') ?? '';
  if (!SLUG_PATTERN.test(slug)) return new NextResponse(null, { status: 404 });

  await ensureCommunitySchema();
  const row = await getDatabase()
    .prepare('SELECT hero_image AS image FROM communities WHERE slug = ? LIMIT 1')
    .bind(slug)
    .first<{ image: string | null }>();
  const match = row?.image?.match(/^data:(image\/(?:webp|jpeg|png));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return new NextResponse(null, { status: 404 });

  return new NextResponse(Buffer.from(match[2], 'base64'), {
    headers: {
      'content-type': match[1],
      'cache-control': 'public, max-age=31536000, immutable',
    },
  });
}
