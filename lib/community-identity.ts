import { DEFAULT_COMMUNITY_SLUG } from '@/lib/community-shared';

// Identidad visible de cada comunidad en la cabecera. Sin logoSrc se muestra el escudo del Levante.
export interface CommunityIdentity {
  eyebrow: string;
  title: string;
  logoSrc?: string;
}

// Lo que el admin guarda en la base de datos. null = sin definir (se usa el valor por defecto);
// una imagen vacía ('') significa "sin imagen", es decir, el escudo del Levante.
export interface CommunityHeaderFields {
  headerTitle: string | null;
  headerSubtitle: string | null;
  headerImage: string | null;
}

export const HEADER_TITLE_MAX = 40;
export const HEADER_SUBTITLE_MAX = 30;
export const HEADER_IMAGE_MAX_LENGTH = 150_000;
export const HEADER_IMAGE_PATTERN = /^data:image\/(webp|jpeg|png);base64,[A-Za-z0-9+/=]+$/;

const defaultIdentity: CommunityIdentity = { eyebrow: 'Levante UD', title: 'Granota App' };

// Valores por defecto de comunidades anteriores al editor del admin. Las imágenes viven en /public.
const defaultIdentities: Record<string, CommunityIdentity> = {
  [DEFAULT_COMMUNITY_SLUG]: defaultIdentity,
  ismaelete: {
    eyebrow: 'La porra',
    title: 'Ismael Algarra Sancho',
    logoSrc: '/ismaelete_profile.jpg',
  },
};

export function resolveCommunityIdentity(
  slug: string,
  header?: Partial<CommunityHeaderFields>,
): CommunityIdentity {
  const base = defaultIdentities[slug] ?? defaultIdentity;
  const image = header?.headerImage;
  return {
    eyebrow: header?.headerSubtitle || base.eyebrow,
    title: header?.headerTitle || base.title,
    logoSrc: image == null ? base.logoSrc : image || undefined,
  };
}
