import { ensureCommunitySchema, getDatabase } from '@/lib/db';

// Goles del rival en cada partido (goleador y minuto). Solo los usa el generador de imagenes del panel de administracion:
// no se muestran en la app ni intervienen en puntos o clasificaciones. Son los mismos para todas las comunidades.
export interface RivalGoal {
  player: string;
  // 0 = minuto desconocido
  minute: number;
}

export const MAX_RIVAL_GOALS = 20;

export function sanitizeRivalGoals(value: unknown): RivalGoal[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const goal = (item ?? {}) as Record<string, unknown>;
      const minute = Number(goal.minute);
      return {
        player: typeof goal.player === 'string' ? goal.player.trim().slice(0, 40) : '',
        minute: Number.isInteger(minute) && minute >= 1 && minute <= 130 ? minute : 0,
      };
    })
    .slice(0, MAX_RIVAL_GOALS);
}

export async function loadRivalGoals(): Promise<Record<number, RivalGoal[]>> {
  await ensureCommunitySchema();
  const rows = await getDatabase().prepare('SELECT matchday, goals FROM rival_goals').bind().all<{ matchday: number; goals: string }>();
  const byMatchday: Record<number, RivalGoal[]> = {};
  for (const row of rows.results) {
    try {
      byMatchday[row.matchday] = sanitizeRivalGoals(JSON.parse(row.goals));
    } catch {
      // Fila corrupta: se ignora.
    }
  }
  return byMatchday;
}
