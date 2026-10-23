import type { NextRequest } from 'next/server';
import { ensureCommunitySchema, getDatabase } from '@/lib/db';
import { sessionCookieName } from '@/lib/community-shared';
import { getNextLevanteMatch, withLocalMatchIds } from '@/lib/levante-services';
import { loadScheduleMatches } from '@/lib/football-schedule';
import { applyKickoffOverrides } from '@/lib/kickoff-shared';
import { loadKickoffOverrides } from '@/lib/kickoffs';
import { levanteMatches } from '@/lib/levante-data';
import { loadOfficialReports } from '@/lib/official-data';
import type { CommunityUser } from '@/lib/community-types';

// Proximo partido pronosticable: el primero pendiente que aun no tiene datos oficiales. Si la fecha local de un partido ya jugado
// esta desfasada, tener su informe oficial basta para saber que ya no se puede pronosticar.
export async function nextOpenMatch(communitySlug: string) {
  const played = new Set((await loadOfficialReports(communitySlug)).map((report) => report.matchday));
  // Mismo calendario que ve la pantalla (fechas y horas oficiales de la API); si no esta disponible, el local.
  const schedule = await loadScheduleMatches();
  const matches = applyKickoffOverrides(schedule ? withLocalMatchIds(schedule) : levanteMatches, await loadKickoffOverrides());
  return getNextLevanteMatch(matches.filter((match) => !played.has(match.matchday)));
}

export async function currentUser(request: NextRequest, communitySlug: string) {
  const id = request.cookies.get(sessionCookieName(communitySlug))?.value;
  if (!id) return null;
  await ensureCommunitySchema();
  return getDatabase().prepare(
    'SELECT id, nickname, created_at AS createdAt FROM users WHERE id = ? AND community_slug = ? LIMIT 1',
  ).bind(id, communitySlug).first<CommunityUser>();
}

