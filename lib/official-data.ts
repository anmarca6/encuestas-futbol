import { ensureCommunitySchema, getDatabase } from '@/lib/db';
import { DEFAULT_COMMUNITY_SLUG } from '@/lib/community-shared';

// Datos "oficiales" de cada partido (once, goleadores, MVP) por comunidad. Una comunidad que no ha
// definido un partido hereda el de la comunidad principal; lo que defina la comunidad manda sobre eso.

export interface OfficialReportRow {
  matchday: number;
  homeScore: number;
  awayScore: number;
  formation: string;
  lineup: string;
  scorers: string;
  mvp: string;
  reason: string;
}

export interface MvpOverrideRow {
  matchday: number;
  playerId: string;
  reason: string;
}

async function rowsFor<T extends { matchday: number }>(sql: string, slug: string): Promise<T[]> {
  return (await getDatabase().prepare(sql).bind(slug).all<T>()).results;
}

function merge<T extends { matchday: number }>(base: T[], own: T[]): Array<T & { inherited: boolean }> {
  const byMatchday = new Map<number, T & { inherited: boolean }>();
  for (const row of base) byMatchday.set(row.matchday, { ...row, inherited: true });
  for (const row of own) byMatchday.set(row.matchday, { ...row, inherited: false });
  return [...byMatchday.values()].sort((a, b) => a.matchday - b.matchday);
}

const REPORTS_SQL = `
  SELECT matchday, home_score AS homeScore, away_score AS awayScore,
    formation, lineup, scorers, mvp, reason
  FROM community_reports WHERE community_slug = ?
`;
const MVPS_SQL = 'SELECT matchday, player_id AS playerId, reason FROM community_mvps WHERE community_slug = ?';

export async function loadOfficialReports(slug: string): Promise<Array<OfficialReportRow & { inherited: boolean }>> {
  await ensureCommunitySchema();
  const base = slug === DEFAULT_COMMUNITY_SLUG ? [] : await rowsFor<OfficialReportRow>(REPORTS_SQL, DEFAULT_COMMUNITY_SLUG);
  return merge(base, await rowsFor<OfficialReportRow>(REPORTS_SQL, slug));
}

export async function loadMvpOverrides(slug: string): Promise<Array<MvpOverrideRow & { inherited: boolean }>> {
  await ensureCommunitySchema();
  const base = slug === DEFAULT_COMMUNITY_SLUG ? [] : await rowsFor<MvpOverrideRow>(MVPS_SQL, DEFAULT_COMMUNITY_SLUG);
  return merge(base, await rowsFor<MvpOverrideRow>(MVPS_SQL, slug));
}
