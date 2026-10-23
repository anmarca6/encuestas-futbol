import { ensureCommunitySchema, getDatabase } from '@/lib/db';
import type { KickoffOverrides } from '@/lib/kickoff-shared';

export async function loadKickoffOverrides(): Promise<KickoffOverrides> {
  await ensureCommunitySchema();
  const rows = await getDatabase().prepare('SELECT matchday, kickoff_time AS kickoffTime FROM match_kickoffs').bind().all<{ matchday: number; kickoffTime: string }>();
  return Object.fromEntries(rows.results.map((row) => [row.matchday, row.kickoffTime]));
}
