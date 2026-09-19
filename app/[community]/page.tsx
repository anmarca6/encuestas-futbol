import { notFound } from 'next/navigation';
import { CommunityApp } from '@/components/community-app';
import { findCommunityWithHeader } from '@/lib/community';
import { resolveCommunityHero, resolveCommunityIdentity } from '@/lib/community-identity';

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
