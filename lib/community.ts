import type { NextRequest } from 'next/server';
import { ensureCommunitySchema, getDatabase } from '@/lib/db';
import { COMMUNITY_HEADER, DEFAULT_COMMUNITY_SLUG, SLUG_PATTERN } from '@/lib/community-shared';

export interface Community {
  slug: string;
  name: string;
  createdAt: number;
}

export async function findCommunity(slug: string): Promise<Community | null> {
  if (!SLUG_PATTERN.test(slug)) return null;
  await ensureCommunitySchema();
  return getDatabase()
    .prepare('SELECT slug, name, created_at AS createdAt FROM communities WHERE slug = ? LIMIT 1')
    .bind(slug)
    .first<Community>();
}

// La comunidad la indica el cliente con una cabecera (la toma de la URL). Sin cabecera
// (clientes antiguos) se usa la comunidad principal.
export async function resolveCommunity(request: NextRequest): Promise<Community | null> {
  const slug = (request.headers.get(COMMUNITY_HEADER) ?? DEFAULT_COMMUNITY_SLUG).trim().toLowerCase();
  return findCommunity(slug);
}
