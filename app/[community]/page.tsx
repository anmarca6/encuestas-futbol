import { notFound } from 'next/navigation';
import { CommunityApp } from '@/components/community-app';
import { findCommunity } from '@/lib/community';

export default async function CommunityPage({ params }: { params: Promise<{ community: string }> }) {
  const { community: slug } = await params;
  const community = await findCommunity(decodeURIComponent(slug).toLowerCase());
  if (!community) notFound();
  return <CommunityApp />;
}
