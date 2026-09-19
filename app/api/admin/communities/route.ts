import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { ensureCommunitySchema, getDatabase } from '@/lib/db';
import { findCommunity } from '@/lib/community';
import type { AdminCommunity } from '@/lib/community-types';
import { isValidCommunitySlug, slugifyCommunityName } from '@/lib/community-shared';

export async function GET(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  await ensureCommunitySchema();
  const rows = await getDatabase()
    .prepare(`
      SELECT c.slug, c.name, c.created_at AS createdAt,
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
  const community = { slug, name, createdAt: Date.now(), users: 0, predictions: 0 };
  await getDatabase()
    .prepare('INSERT INTO communities (slug, name, created_at) VALUES (?, ?, ?)')
    .bind(community.slug, community.name, community.createdAt)
    .run();
  return NextResponse.json({ community }, { status: 201 });
}
