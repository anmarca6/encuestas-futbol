import { NextRequest, NextResponse } from 'next/server';
import { resolveCommunity } from '@/lib/community';
import { computeCommunityRanking } from '@/lib/ranking';

export async function GET(request: NextRequest) {
  const community = await resolveCommunity(request);
  if (!community) return NextResponse.json({ ranking: [] });
  return NextResponse.json({ ranking: await computeCommunityRanking(community.slug) });
}
