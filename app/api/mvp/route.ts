import { NextRequest, NextResponse } from 'next/server';
import { resolveCommunity } from '@/lib/community';
import { loadMvpOverrides } from '@/lib/official-data';

export async function GET(request: NextRequest) {
  const community = await resolveCommunity(request);
  if (!community) return NextResponse.json({ overrides: [] });
  const rows = await loadMvpOverrides(community.slug);
  return NextResponse.json({ overrides: rows.map(({ matchday, playerId, reason }) => ({ matchday, playerId, reason })) });
}
