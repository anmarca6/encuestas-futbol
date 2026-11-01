import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { requireAdmin, resolveAdminCommunity } from '@/lib/admin-auth';
import { ensureCommunitySchema, getDatabase } from '@/lib/db';
import { sanitizeSpec } from '@/lib/image-generator';
import { isTemplateId } from '@/lib/image-stats';

// Historial del generador de imagenes: cada administrador ve solo las suyas.
const MAX_IMAGES_PER_ADMIN = 100;
const MAX_SPEC_LENGTH = 30_000;
const MAX_THUMB_LENGTH = 150_000;

interface ImageRow {
  id: string;
  title: string;
  template: string;
  communitySlug: string;
  spec: string;
  thumb: string;
  updatedAt: number;
}

const titleOf = (value: unknown, fallback: string) => (typeof value === 'string' && value.trim() ? value.trim().slice(0, 80) : fallback);
const thumbOf = (value: unknown) => (typeof value === 'string' && value.startsWith('data:image/jpeg;base64,') && value.length <= MAX_THUMB_LENGTH ? value : null);

// Sin id: la lista (con miniaturas). Con id: la ficha completa de esa imagen.
export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;
  await ensureCommunitySchema();
  const db = getDatabase();
  const id = request.nextUrl.searchParams.get('id');
  if (id) {
    const row = await db.prepare(
      'SELECT id, title, template, community_slug AS communitySlug, spec, thumb, updated_at AS updatedAt FROM generated_images WHERE id = ? AND admin_id = ?',
    ).bind(id, admin.id).first<ImageRow>();
    if (!row) return NextResponse.json({ error: 'Esta imagen ya no existe.' }, { status: 404 });
    let spec;
    try {
      spec = sanitizeSpec(JSON.parse(row.spec));
    } catch {
      spec = sanitizeSpec(null);
    }
    return NextResponse.json({ image: { id: row.id, title: row.title, template: row.template, communitySlug: row.communitySlug, spec, updatedAt: row.updatedAt } }, { headers: { 'Cache-Control': 'no-store' } });
  }
  const rows = await db.prepare(
    'SELECT id, title, template, thumb, updated_at AS updatedAt FROM generated_images WHERE admin_id = ? ORDER BY updated_at DESC',
  ).bind(admin.id).all<Pick<ImageRow, 'id' | 'title' | 'template' | 'thumb' | 'updatedAt'>>();
  return NextResponse.json({ images: rows.results }, { headers: { 'Cache-Control': 'no-store' } });
}

// Crea una imagen nueva en el historial.
export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;
  const body = (await request.json().catch(() => null)) as { community?: string; template?: string; spec?: unknown; title?: string } | null;
  const community = await resolveAdminCommunity(admin, body?.community);
  if (community instanceof NextResponse) return community;
  if (!isTemplateId(body?.template)) return NextResponse.json({ error: 'Plantilla no válida.' }, { status: 400 });
  const spec = sanitizeSpec(body?.spec);
  await ensureCommunitySchema();
  const db = getDatabase();
  const count = await db.prepare('SELECT COUNT(*) AS total FROM generated_images WHERE admin_id = ?').bind(admin.id).first<{ total: number }>();
  if ((count?.total ?? 0) >= MAX_IMAGES_PER_ADMIN) {
    return NextResponse.json({ error: `Has llegado al máximo de ${MAX_IMAGES_PER_ADMIN} imágenes guardadas. Borra alguna para crear otra.` }, { status: 409 });
  }
  const id = randomUUID();
  const now = Date.now();
  await db.prepare(
    'INSERT INTO generated_images (id, admin_id, community_slug, template, title, spec, thumb, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
  ).bind(id, admin.id, community, body!.template, titleOf(body?.title, `${spec.title} ${spec.titleAccent}`.trim() || 'Imagen sin título'), JSON.stringify(spec), '', now, now).run();
  return NextResponse.json({ id, updatedAt: now });
}

// Guarda los cambios de una imagen (ficha, miniatura y titulo).
export async function PUT(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;
  const body = (await request.json().catch(() => null)) as { id?: string; spec?: unknown; thumb?: string; title?: string } | null;
  if (!body?.id || typeof body.id !== 'string') return NextResponse.json({ error: 'Imagen no válida.' }, { status: 400 });
  const spec = sanitizeSpec(body.spec);
  const json = JSON.stringify(spec);
  if (json.length > MAX_SPEC_LENGTH) return NextResponse.json({ error: 'La imagen es demasiado grande.' }, { status: 413 });
  await ensureCommunitySchema();
  const db = getDatabase();
  const existing = await db.prepare('SELECT id, thumb FROM generated_images WHERE id = ? AND admin_id = ?').bind(body.id, admin.id).first<{ id: string; thumb: string }>();
  if (!existing) return NextResponse.json({ error: 'Esta imagen ya no existe.' }, { status: 404 });
  const now = Date.now();
  await db.prepare('UPDATE generated_images SET spec = ?, thumb = ?, title = ?, updated_at = ? WHERE id = ? AND admin_id = ?')
    .bind(json, thumbOf(body.thumb) ?? existing.thumb, titleOf(body.title, `${spec.title} ${spec.titleAccent}`.trim() || 'Imagen sin título'), now, body.id, admin.id).run();
  return NextResponse.json({ ok: true, updatedAt: now });
}

export async function DELETE(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;
  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Imagen no válida.' }, { status: 400 });
  await ensureCommunitySchema();
  await getDatabase().prepare('DELETE FROM generated_images WHERE id = ? AND admin_id = ?').bind(id, admin.id).run();
  return NextResponse.json({ ok: true });
}
