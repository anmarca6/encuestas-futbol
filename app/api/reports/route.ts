import { NextRequest, NextResponse } from 'next/server';
import { resolveCommunity } from '@/lib/community';
import { loadOfficialReports } from '@/lib/official-data';
import { formations, type SavedLineup } from '@/lib/formations';
import { levantePlayers, type LevanteMatchReport } from '@/lib/levante-data';

const nameOf = (playerId: string) => levantePlayers.find((player) => player.id === playerId)?.displayName ?? playerId;

// Resumen público de los partidos jugados (formación, once y goleadores) con los datos oficiales de la comunidad.
export async function GET(request: NextRequest) {
  const community = await resolveCommunity(request);
  if (!community) return NextResponse.json({ reports: [] });
  const rows = await loadOfficialReports(community.slug);
  const reports = rows.map((row) => {
    const lineup = JSON.parse(row.lineup) as SavedLineup;
    const slots = formations[row.formation as keyof typeof formations]?.slots ?? [];
    const byPosition = (position: string) =>
      lineup.players.filter((_, index) => slots[index]?.position === position).map(nameOf);
    const goalCounts = new Map<string, number>();
    for (const playerId of JSON.parse(row.scorers) as string[]) goalCounts.set(playerId, (goalCounts.get(playerId) ?? 0) + 1);
    // Los datos oficiales no incluyen el minuto: se indican tantos minutos 0 como goles (la pantalla los muestra como "sin minuto").
    const report: LevanteMatchReport = {
      formation: row.formation,
      lineup: {
        goalkeeper: byPosition('GOALKEEPER'),
        defenders: byPosition('DEFENDER'),
        midfielders: byPosition('MIDFIELDER'),
        attackers: byPosition('FORWARD'),
      },
      levanteGoals: [...goalCounts].map(([playerId, count]) => ({ playerName: nameOf(playerId), minutes: Array(count).fill(0) as number[] })),
      mvp: { playerName: nameOf(row.mvp), reason: row.reason },
    };
    return { matchday: row.matchday, report };
  });
  return NextResponse.json({ reports });
}
