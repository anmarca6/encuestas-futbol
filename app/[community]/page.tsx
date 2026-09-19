import { notFound } from 'next/navigation';
import { CommunityApp } from '@/components/community-app';
import { findCommunityWithHeader } from '@/lib/community';
import { resolveCommunityHero, resolveCommunityIdentity } from '@/lib/community-identity';

// Los datos de la comunidad (cabecera, portada) los edita el admin: no se cachea la página.
export const dynamic = 'force-dynamic';

export default async function CommunityPage({ params }: { params: Promise<{ community: string }> }) {
  const { community: slug } = await params;
  const community = await findCommunityWithHeader(decodeURIComponent(slug).toLowerCase());
  if (!community) notFound();
  return (
    <CommunityApp
      identity={resolveCommunityIdentity(community.slug, community)}
      hero={resolveCommunityHero(community, community)}
    />
  );
}
