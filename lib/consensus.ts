import { formations, type FormationId, type SavedLineup } from '@/lib/formations';
import { LEVANTE_TEAM, levanteMatches } from '@/lib/levante-data';

// "Modo IA": una prediccion completa construida con lo mas comun entre las predicciones ya publicadas en la comunidad.
export interface ConsensusRow {
  matchId: string;
  homeScore: number;
  awayScore: number;
  lineup: SavedLineup | null;
  scorers: string[];
  mvp: string | null;
}

export interface Consensus {
  // Predicciones usadas en total, de cuantos partidos distintos vienen y cuantas son de este mismo partido.
  sample: number;
  matches: number;
  currentMatchSample: number;
  formation: FormationId;
  lineup: SavedLineup;
  homeScore: number;
  awayScore: number;
  scorers: string[];
  mvp: string | null;
}

function tally<T extends string>(values: T[]): Array<[T, number]> {
  const counts = new Map<T, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  // Mayor frecuencia primero; en empate, el orden en que aparecieron.
  return [...counts].sort((a, b) => b[1] - a[1]);
}

export const MIN_CONSENSUS_SAMPLE = 3;

export function buildConsensus(rows: ConsensusRow[], target: { id: string; homeTeam: string }): Consensus | null {
  if (rows.length < MIN_CONSENSUS_SAMPLE) return null;
  const levanteIsHome = target.homeTeam === LEVANTE_TEAM;

  // Formacion mas usada.
  const formationId = tally(rows.flatMap((row) => (row.lineup ? [row.lineup.formation] : [])))[0]?.[0] as FormationId | undefined;
  if (!formationId || !(formationId in formations)) return null;
  const slots = formations[formationId].slots;

  // XI: para cada puesto de la formacion, el jugador mas repetido en ese puesto (y, si no hay, el mas repetido en general).
  const overall = tally(rows.flatMap((row) => row.lineup?.players ?? []));
  const bySlotLabel = new Map<string, string[]>();
  for (const row of rows) {
    const rowSlots = row.lineup ? formations[row.lineup.formation]?.slots ?? [] : [];
    row.lineup?.players.forEach((playerId, index) => {
      const label = rowSlots[index]?.label;
      if (label) bySlotLabel.set(label, [...(bySlotLabel.get(label) ?? []), playerId]);
    });
  }
  const used = new Set<string>();
  const players = slots.map((slot) => {
    const candidates = [...tally(bySlotLabel.get(slot.label) ?? []).map(([id]) => id), ...overall.map(([id]) => id)];
    const pick = candidates.find((id) => !used.has(id)) ?? '';
    used.add(pick);
    return pick;
  });
  if (players.some((id) => !id)) return null;

  // Resultado: el marcador mas repetido visto desde el Levante (asi vale aunque jugara en casa o fuera).
  const scorelines = rows.flatMap((row) => {
    const match = levanteMatches.find((item) => item.id === row.matchId);
    if (!match) return [];
    const levante = match.homeTeam === LEVANTE_TEAM ? row.homeScore : row.awayScore;
    const rival = match.homeTeam === LEVANTE_TEAM ? row.awayScore : row.homeScore;
    return [`${levante}-${rival}`];
  });
  const [levanteGoals, rivalGoals] = (tally(scorelines)[0]?.[0] ?? '1-1').split('-').map(Number);

  // Goleadores: los mas citados, tantos como goles del Levante tenga el marcador (si faltan jugadores distintos, repite al primero).
  const mentioned = tally(rows.flatMap((row) => row.scorers)).map(([id]) => id);
  const scorers = Array.from({ length: levanteGoals }, (_, index) => mentioned[index] ?? mentioned[0]).filter(Boolean) as string[];
  if (scorers.length !== levanteGoals) return null;

  return {
    sample: rows.length,
    matches: new Set(rows.map((row) => row.matchId)).size,
    currentMatchSample: rows.filter((row) => row.matchId === target.id).length,
    formation: formationId,
    lineup: { formation: formationId, players },
    homeScore: levanteIsHome ? levanteGoals : rivalGoals,
    awayScore: levanteIsHome ? rivalGoals : levanteGoals,
    scorers,
    mvp: tally(rows.flatMap((row) => (row.mvp ? [row.mvp] : [])))[0]?.[0] ?? null,
  };
}
