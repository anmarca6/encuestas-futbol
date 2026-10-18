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
    // Cada jugador va con el puesto en el que se alineo (LI, DFC, LD, MC, EI...), no solo con su linea.
    const byPosition = (position: string) =>
      lineup.players
        .map((playerId, index) => ({ playerId, slot: slots[index] }))
        .filter((item) => item.slot?.position === position)
        .map((item) => `${nameOf(item.playerId)} (${item.slot.label})`);
    // Goles agrupados por jugador con su minuto (0 = minuto desconocido), en orden cronologico.
    const scorerIds = JSON.parse(row.scorers) as string[];
    const goalMinutes = JSON.parse(row.goalMinutes || '[]') as number[];
    const minutesByPlayer = new Map<string, number[]>();
    scorerIds.forEach((playerId, index) => {
      minutesByPlayer.set(playerId, [...(minutesByPlayer.get(playerId) ?? []), goalMinutes[index] ?? 0]);
    });
    const firstMinute = (minutes: number[]) => Math.min(...minutes.map((minute) => (minute > 0 ? minute : 999)));
    const levanteGoals = [...minutesByPlayer]
      .map(([playerId, minutes]) => ({ playerName: nameOf(playerId), minutes: [...minutes].sort((a, b) => (a || 999) - (b || 999)) }))
      .sort((a, b) => firstMinute(a.minutes) - firstMinute(b.minutes));
    const report: LevanteMatchReport = {
      formation: row.formation,
      lineup: {
        goalkeeper: byPosition('GOALKEEPER'),
        defenders: byPosition('DEFENDER'),
        midfielders: byPosition('MIDFIELDER'),
        attackers: byPosition('FORWARD'),
      },
      levanteGoals,
      mvp: { playerName: nameOf(row.mvp), reason: row.reason },
    };
    return { matchday: row.matchday, report };
  });
  return NextResponse.json({ reports });
}
