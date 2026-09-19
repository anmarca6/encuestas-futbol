import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/admin-auth';
import { ensureCommunitySchema, getDatabase } from '@/lib/db';
import { findCommunity } from '@/lib/community';
import type { AdminCommunity } from '@/lib/community-types';
import { isValidCommunitySlug, slugifyCommunityName } from '@/lib/community-shared';
import {
  HEADER_IMAGE_MAX_LENGTH,
  HEADER_IMAGE_PATTERN,
  HEADER_SUBTITLE_MAX,
  HEADER_TITLE_MAX,
  HERO_IMAGE_MAX_LENGTH,
  HERO_SUBTITLE_MAX,
  HERO_TITLE_MAX,
  heroImageVersionOf,
  isReadableHeaderColor,
} from '@/lib/community-identity';
import { MAX_COMMUNITY_LINKS, getSocialNetwork, normalizeSocialUrl } from '@/lib/social-networks';

export async function GET(request: NextRequest) {
  const admin = await requireSuperAdmin(request);
  if (admin instanceof NextResponse) return admin;

  await ensureCommunitySchema();
  const rows = await getDatabase()
    .prepare(`
      SELECT c.slug, c.name, c.created_at AS createdAt,
        c.header_title AS headerTitle, c.header_subtitle AS headerSubtitle, c.header_image AS headerImage,
        c.header_color AS headerColor, c.hero_title AS heroTitle, c.hero_subtitle AS heroSubtitle,
        c.hero_image_version AS heroImageVersion, c.hero_links AS heroLinks,
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
  const admin = await requireSuperAdmin(request);
  if (admin instanceof NextResponse) return admin;

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
    headerTitle: null, headerSubtitle: null, headerImage: null, headerColor: null,
    heroTitle: null, heroSubtitle: null, heroImageVersion: null, heroLinks: null,
  };
  await getDatabase()
    .prepare('INSERT INTO communities (slug, name, created_at) VALUES (?, ?, ?)')
    .bind(community.slug, community.name, community.createdAt)
    .run();
  return NextResponse.json({ community }, { status: 201 });
}

// Edita la cabecera de una comunidad. headerImage / headerColor: omitido = sin cambios, '' = por defecto
// (escudo del Levante / azul marino). Portada: heroTitle omitido = sin cambios, '' = portada estándar (borra todo);
// heroImage omitido = sin cambios, '' = sin imagen. heroLinks (Follow me): omitido = sin cambios, [] = ninguno.
async function updateCommunity(request: NextRequest) {
  const admin = await requireSuperAdmin(request);
  if (admin instanceof NextResponse) return admin;

  const body = (await request.json()) as {
    slug?: string;
    headerTitle?: string;
    headerSubtitle?: string;
    headerImage?: string;
    headerColor?: string;
    heroTitle?: string;
    heroSubtitle?: string;
    heroImage?: string;
    heroLinks?: Array<{ network?: string; url?: string }>;
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

  const color = body.headerColor?.toLowerCase();
  if (color !== undefined && color !== '' && !isReadableHeaderColor(color)) {
    return NextResponse.json({ error: 'El color no es válido o es demasiado claro para el texto blanco de la cabecera.' }, { status: 400 });
  }

  // Portada de Inicio
  let heroTitle: string | null | undefined;
  let heroSubtitle: string | null = null;
  if (body.heroTitle !== undefined) {
    const lines = body.heroTitle.split('\n').map((line) => line.trim().replace(/\s+/g, ' ')).filter(Boolean);
    heroTitle = lines.join('\n') || null;
    heroSubtitle = body.heroSubtitle?.trim().replace(/\s+/g, ' ') || null;
    if (heroTitle && (lines.length > 2 || heroTitle.length > HERO_TITLE_MAX)) {
      return NextResponse.json({ error: `El título de la portada admite hasta 2 líneas y ${HERO_TITLE_MAX} caracteres.` }, { status: 400 });
    }
    if (heroSubtitle && heroSubtitle.length > HERO_SUBTITLE_MAX) {
      return NextResponse.json({ error: `El subtítulo de la portada admite hasta ${HERO_SUBTITLE_MAX} caracteres.` }, { status: 400 });
    }
  }
  const heroImage = body.heroImage;
  if (heroImage !== undefined && heroImage !== '' && (!HEADER_IMAGE_PATTERN.test(heroImage) || heroImage.length > HERO_IMAGE_MAX_LENGTH)) {
    return NextResponse.json({ error: 'La imagen de la portada no es válida o es demasiado grande.' }, { status: 400 });
  }

  // Enlaces "Follow me": hasta 3, cada uno con una red y una URL válida de esa red.
  let heroLinks: string | null | undefined;
  if (body.heroLinks !== undefined) {
    const entries = Array.isArray(body.heroLinks) ? body.heroLinks.filter((item) => item?.url?.trim()) : null;
    if (!entries || entries.length > MAX_COMMUNITY_LINKS) {
      return NextResponse.json({ error: `Puedes añadir hasta ${MAX_COMMUNITY_LINKS} enlaces.` }, { status: 400 });
    }
    const links = [];
    for (const item of entries) {
      const network = getSocialNetwork(item.network ?? '');
      const url = network && normalizeSocialUrl(network.id, item.url ?? '');
      if (!network || !url) {
        const domain = network?.domains[0] ?? 'la red elegida';
        return NextResponse.json(
          { error: `El enlace de ${network?.label ?? 'la red'} no es válido: debe ser una dirección de ${domain} o un @usuario.` },
          { status: 400 },
        );
      }
      links.push({ network: network.id, url });
    }
    heroLinks = links.length ? JSON.stringify(links) : null;
  }

  await ensureCommunitySchema();
  if (!body.slug || !(await findCommunity(body.slug))) {
    return NextResponse.json({ error: 'Esta comunidad no existe.' }, { status: 404 });
  }
  const assignments = ['header_title = ?', 'header_subtitle = ?'];
  const values: unknown[] = [title, subtitle];
  if (image !== undefined) {
    assignments.push('header_image = ?');
    values.push(image);
  }
  if (color !== undefined) {
    assignments.push('header_color = ?');
    values.push(color || null);
  }
  if (heroTitle === null) {
    // Sin título de portada se vuelve a la portada estándar y se descarta lo demás.
    assignments.push('hero_title = NULL', 'hero_subtitle = NULL', 'hero_image = NULL', 'hero_image_version = NULL', 'hero_links = NULL');
  } else if (heroTitle !== undefined) {
    assignments.push('hero_title = ?', 'hero_subtitle = ?');
    values.push(heroTitle, heroSubtitle);
    if (heroLinks !== undefined) {
      assignments.push('hero_links = ?');
      values.push(heroLinks);
    }
    if (heroImage !== undefined) {
      assignments.push('hero_image = ?', 'hero_image_version = ?');
      values.push(heroImage || null, heroImage ? heroImageVersionOf(heroImage) : null);
    }
  }
  await getDatabase()
    .prepare(`UPDATE communities SET ${assignments.join(', ')} WHERE slug = ?`)
    .bind(...values, body.slug)
    .run();
  return NextResponse.json({ ok: true });
}

export async function PATCH(request: NextRequest) {
  try {
    return await updateCommunity(request);
  } catch (error) {
    console.error('No se pudo guardar la comunidad', error);
    const detail = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `No se pudo guardar en la base de datos: ${detail}` }, { status: 500 });
  }
}
