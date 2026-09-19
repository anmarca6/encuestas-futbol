// Constantes y utilidades de comunidades sin dependencias de servidor (válidas también en el navegador).
export const DEFAULT_COMMUNITY_SLUG = 'granota';
export const COMMUNITY_HEADER = 'x-community';

export const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,28}[a-z0-9])$/;
// Rutas de la app que no pueden ser el nombre de una comunidad.
const RESERVED_SLUGS = new Set(['admin', 'api', '_next', '_vercel', 'favicon', 'robots', 'sitemap', 'static', 'public', 'assets']);

export function slugifyCommunityName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30)
    .replace(/-+$/g, '');
}

export function isValidCommunitySlug(slug: string): boolean {
  return SLUG_PATTERN.test(slug) && !RESERVED_SLUGS.has(slug);
}

// La comunidad principal conserva la cookie original para no cerrar sesiones existentes.
export function sessionCookieName(slug: string): string {
  return slug === DEFAULT_COMMUNITY_SLUG ? 'granota_user_id' : `granota_user_id_${slug}`;
}
