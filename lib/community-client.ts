import { COMMUNITY_HEADER, DEFAULT_COMMUNITY_SLUG } from '@/lib/community-shared';

// La comunidad es el primer tramo de la URL (/ismaelete). Solo se usa desde el navegador.
export function currentCommunitySlug(): string {
  const segment = window.location.pathname.split('/')[1] ?? '';
  return segment ? decodeURIComponent(segment).toLowerCase() : DEFAULT_COMMUNITY_SLUG;
}

export function communityFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set(COMMUNITY_HEADER, currentCommunitySlug());
  return fetch(input, { ...init, headers });
}
