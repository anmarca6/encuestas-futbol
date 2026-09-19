import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { ensureCommunitySchema, getDatabase } from '@/lib/db';
import { findCommunity } from '@/lib/community';
import type { AdminCommunity } from '@/lib/community-types';
import { isValidCommunitySlug, slugifyCommunityName } from '@/lib/community-shared';
import {
  HEADER_IMAGE_MAX_LENGTH,
  HEADER_IMAGE_PATTERN,
  HEADER_SUBTITLE_MAX,
  HEADER_TITLE_MAX,
} from '@/lib/community-identity';

export async function GET(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  await ensureCommunitySchema();
  const rows = await getDatabase()
    .prepare(`
      SELECT c.slug, c.name, c.created_at AS createdAt,
        c.header_title AS headerTitle, c.header_subtitle AS headerSubtitle, c.header_image AS headerImage,
        (SELECT COUNT(*) FROM users u WHERE u.community_slug = c.slug) AS users,
        (SELECT COUNT(*) FROM predictions p JOIN users u ON u.id = p.user_id WHERE u.community_slug = c.slug) AS predictions
      FROM communities c
      ORDER BY c.created_at ASC
    `)
    .bind()
    .all<AdminCommunity>();
  return NextResponse.json({ communities: rows.results });
}

export async function POST(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  const body = (await request.json()) as { name?: string };
  const name = body.name?.trim().replace(/\s+/g, ' ').slice(0, 40) ?? '';
  const slug = slugifyCommunityName(name);
  if (name.length < 2 || !isValidCommunitySlug(slug)) {
    return NextResponse.json(
      { error: 'El nombre debe tener al menos 2 letras o números y no puede ser una ruta reservada.' },
      { status: 400 },
    );
  }

  await ensureCommunitySchema();
  if (await findCommunity(slug)) {
    return NextResponse.json({ error: `Ya existe una comunidad con la dirección /${slug}.` }, { status: 409 });
  }
  const community: AdminCommunity = {
    slug, name, createdAt: Date.now(), users: 0, predictions: 0,
    headerTitle: null, headerSubtitle: null, headerImage: null,
  };
  await getDatabase()
    .prepare('INSERT INTO communities (slug, name, created_at) VALUES (?, ?, ?)')
    .bind(community.slug, community.name, community.createdAt)
    .run();
  return NextResponse.json({ community }, { status: 201 });
}

// Edita la cabecera de una comunidad. headerImage: omitido = sin cambios, '' = sin imagen (escudo del Levante).
export async function PATCH(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  const body = (await request.json()) as {
    slug?: string;
    headerTitle?: string;
    headerSubtitle?: string;
    headerImage?: string;
  };
  const title = body.headerTitle?.trim().replace(/\s+/g, ' ') ?? '';
  const subtitle = body.headerSubtitle?.trim().replace(/\s+/g, ' ') ?? '';
  if (!title || title.length > HEADER_TITLE_MAX) {
    return NextResponse.json({ error: `El título es obligatorio y admite hasta ${HEADER_TITLE_MAX} caracteres.` }, { status: 400 });
  }
  if (!subtitle || subtitle.length > HEADER_SUBTITLE_MAX) {
    return NextResponse.json({ error: `El subtítulo es obligatorio y admite hasta ${HEADER_SUBTITLE_MAX} caracteres.` }, { status: 400 });
  }
  const image = body.headerImage;
  if (image !== undefined && image !== '' && (!HEADER_IMAGE_PATTERN.test(image) || image.length > HEADER_IMAGE_MAX_LENGTH)) {
    return NextResponse.json({ error: 'La imagen no es válida o es demasiado grande.' }, { status: 400 });
  }

  await ensureCommunitySchema();
  if (!body.slug || !(await findCommunity(body.slug))) {
    return NextResponse.json({ error: 'Esta comunidad no existe.' }, { status: 404 });
  }
  const db = getDatabase();
  if (image === undefined) {
    await db.prepare('UPDATE communities SET header_title = ?, header_subtitle = ? WHERE slug = ?')
      .bind(title, subtitle, body.slug).run();
  } else {
    await db.prepare('UPDATE communities SET header_title = ?, header_subtitle = ?, header_image = ? WHERE slug = ?')
      .bind(title, subtitle, image, body.slug).run();
  }
  return NextResponse.json({ ok: true });
}
