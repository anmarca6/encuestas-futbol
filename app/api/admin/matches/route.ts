import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { ensureCommunitySchema, getDatabase } from '@/lib/db';
import { formations, type SavedLineup } from '@/lib/formations';
import { levantePlayers } from '@/lib/levante-data';

interface MatchReportRow {
  matchday: number;
  homeScore: number;
  awayScore: number;
  formation: string;
  lineup: string;
  scorers: string;
  mvp: string | null;
  reason: string;
}

function ensureLineup(value: unknown): SavedLineup | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<SavedLineup> & { players?: unknown };
  const players = Array.isArray(candidate.players) ? candidate.players : [];
  if (!candidate.formation || typeof candidate.formation !== 'string') return null;
  if (!(candidate.formation in formations)) return null;
  if (players.length !== 11 || new Set(players).size !== 11) return null;
  if (!players.every((playerId) => typeof playerId === 'string' && levantePlayers.some((player) => player.id === playerId))) {
    return null;
  }
  return { formation: candidate.formation as SavedLineup['formation'], players: players as string[] };
}

function normalizeScorerList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string' && levantePlayers.some((player) => player.id === entry));
}

export async function GET(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  const matchday = Number(request.nextUrl.searchParams.get('matchday'));
  await ensureCommunitySchema();
  if (Number.isInteger(matchday) && matchday > 0) {
    const row = await getDatabase().prepare(`
      SELECT matchday, home_score AS homeScore, away_score AS awayScore,
        formation, lineup, scorers, mvp, reason
      FROM official_match_reports WHERE matchday = ? LIMIT 1
    `).bind(matchday).first<MatchReportRow>();
    if (!row) {
      return NextResponse.json({ report: null });
    }
    return NextResponse.json({
      report: {
        matchday: row.matchday,
        homeScore: row.homeScore,
        awayScore: row.awayScore,
        formation: row.formation,
        lineup: JSON.parse(row.lineup) as SavedLineup,
        scorers: JSON.parse(row.scorers) as string[],
        mvp: row.mvp,
        reason: row.reason,
      },
    });
  }

  const rows = await getDatabase().prepare(`
    SELECT matchday, home_score AS homeScore, away_score AS awayScore,
      formation, lineup, scorers, mvp, reason
    FROM official_match_reports ORDER BY matchday ASC
  `).bind().all<MatchReportRow>();

  return NextResponse.json({
    reports: rows.results.map((row) => ({
      matchday: row.matchday,
      homeScore: row.homeScore,
      awayScore: row.awayScore,
      formation: row.formation,
      lineup: JSON.parse(row.lineup) as SavedLineup,
      scorers: JSON.parse(row.scorers) as string[],
      mvp: row.mvp,
      reason: row.reason,
    })),
  });
}

export async function POST(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  const body = (await request.json()) as {
    matchday?: number;
    homeScore?: number;
    awayScore?: number;
    formation?: string;
    lineup?: SavedLineup | null;
    scorers?: string[];
    mvp?: string | null;
    reason?: string;
  };

  const matchday = Number(body.matchday);
  const homeScore = Number(body.homeScore);
  const awayScore = Number(body.awayScore);
  const formation = body.formation?.trim() ?? '';
  const lineup = ensureLineup(body.lineup ?? null);
  const scorers = normalizeScorerList(body.scorers ?? []);
  const mvp = body.mvp?.trim() ?? '';
  const reason = body.reason?.trim() ?? '';

  if (!Number.isInteger(matchday) || matchday < 1) {
    return NextResponse.json({ error: 'Jornada no válida.' }, { status: 400 });
  }
  if (!Number.isInteger(homeScore) || !Number.isInteger(awayScore) || homeScore < 0 || awayScore < 0 || homeScore > 20 || awayScore > 20) {
    return NextResponse.json({ error: 'El resultado debe ser un número válido.' }, { status: 400 });
  }
  if (!formation || !(formation in formations)) {
    return NextResponse.json({ error: 'Forma no válida.' }, { status: 400 });
  }
  if (!lineup || lineup.formation !== formation) {
    return NextResponse.json({ error: 'Completa el once titular con la formación correcta.' }, { status: 400 });
  }
  if (!mvp || !levantePlayers.some((player) => player.id === mvp)) {
    return NextResponse.json({ error: 'Selecciona un MVP válido.' }, { status: 400 });
  }

  await ensureCommunitySchema();
  await getDatabase().prepare(`
    INSERT INTO official_match_reports (
      matchday, home_score, away_score, formation, lineup, scorers, mvp, reason, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(matchday) DO UPDATE SET
      home_score = excluded.home_score,
      away_score = excluded.away_score,
      formation = excluded.formation,
      lineup = excluded.lineup,
      scorers = excluded.scorers,
      mvp = excluded.mvp,
      reason = excluded.reason,
      updated_at = excluded.updated_at
  `).bind(
    matchday,
    homeScore,
    awayScore,
    formation,
    JSON.stringify(lineup),
    JSON.stringify(scorers),
    mvp,
    reason,
    Date.now(),
  ).run();

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  const matchday = Number(request.nextUrl.searchParams.get('matchday'));
  if (!Number.isInteger(matchday) || matchday < 1) {
    return NextResponse.json({ error: 'Jornada no válida.' }, { status: 400 });
  }

  await ensureCommunitySchema();
  await getDatabase().prepare('DELETE FROM official_match_reports WHERE matchday = ?').bind(matchday).run();
  return NextResponse.json({ ok: true });
}
