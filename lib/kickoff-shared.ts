// Hora de inicio de cada partido fijada a mano desde el panel de admin (jornada -> "HH:MM", hora de Madrid).
// Manda sobre la hora que traiga el calendario oficial o los datos locales. Se aplica igual en el servidor y en la pantalla.
export type KickoffOverrides = Record<number, string>;

export const KICKOFF_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export function applyKickoffOverrides<T extends { matchday: number; kickoffTime: string | null }>(matches: T[], overrides: KickoffOverrides): T[] {
  return matches.map((match) => (overrides[match.matchday] ? { ...match, kickoffTime: overrides[match.matchday] } : match));
}
