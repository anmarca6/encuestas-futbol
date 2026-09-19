import { DEFAULT_COMMUNITY_SLUG } from '@/lib/community-shared';

// Identidad visible de cada comunidad en la cabecera. Sin logoSrc se muestra el escudo del Levante.
export interface CommunityIdentity {
  eyebrow: string;
  title: string;
  logoSrc?: string;
}

const defaultIdentity: CommunityIdentity = { eyebrow: 'Levante UD', title: 'Granota App' };

// Las imágenes viven en /public.
const identities: Record<string, CommunityIdentity> = {
  [DEFAULT_COMMUNITY_SLUG]: defaultIdentity,
  ismaelete: {
    eyebrow: 'La porra',
    title: 'Ismael Algarra Sancho',
    logoSrc: '/ismaelete_profile.jpg',
  },
};

export function getCommunityIdentity(slug: string): CommunityIdentity {
  return identities[slug] ?? defaultIdentity;
}
