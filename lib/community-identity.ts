import { DEFAULT_COMMUNITY_SLUG } from '@/lib/community-shared';

// Identidad visible de cada comunidad en la cabecera. Sin logoSrc se muestra el escudo del Levante.
export interface CommunityIdentity {
  eyebrow: string;
  title: string;
  logoSrc?: string;
  // Color de fondo de la cabecera (#rrggbb). Sin definir se usa el azul marino de siempre.
  color?: string;
}

// Lo que el admin guarda en la base de datos. null = sin definir (se usa el valor por defecto);
// una imagen vacía ('') significa "sin imagen", es decir, el escudo del Levante.
export interface CommunityHeaderFields {
  headerTitle: string | null;
  headerSubtitle: string | null;
  headerImage: string | null;
  // null o '' = color por defecto
  headerColor: string | null;
}

export const HEADER_TITLE_MAX = 40;
export const HEADER_SUBTITLE_MAX = 30;
export const HEADER_IMAGE_MAX_LENGTH = 150_000;
export const DEFAULT_HEADER_COLOR = '#071527';
// Colores sugeridos en el editor; todos permiten texto blanco legible.
export const HEADER_COLOR_PRESETS = [
  DEFAULT_HEADER_COLOR, '#a91d43', '#153e72', '#0f5132', '#4c1d95', '#7c2d12', '#1f2937', '#0f766e',
] as const;
const HEADER_COLOR_PATTERN = /^#[0-9a-f]{6}$/;
const MIN_HEADER_CONTRAST = 4.5;

function relativeLuminance(hex: string): number {
  const [r, g, b] = [1, 3, 5]
    .map((index) => parseInt(hex.slice(index, index + 2), 16) / 255)
    .map((value) => (value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// El texto de la cabecera es blanco: el fondo debe ser lo bastante oscuro para leerse bien.
export function isReadableHeaderColor(hex: string): boolean {
  return HEADER_COLOR_PATTERN.test(hex) && 1.05 / (relativeLuminance(hex) + 0.05) >= MIN_HEADER_CONTRAST;
}

export function headerColorWithAlpha(hex: string, alpha: number): string {
  const [r, g, b] = [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

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
    color: header?.headerColor && isReadableHeaderColor(header.headerColor) ? header.headerColor : undefined,
  };
}
