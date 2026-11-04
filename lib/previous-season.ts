// Resultados del Levante UD en LaLiga 2025/26, jornada a jornada (resumen de datasets/levante_2025_26_jornadas_1_38.json).
// Sirven de referencia para la plantilla que compara esta temporada con la pasada con rival y resultado de cada jornada.
export const PREVIOUS_SEASON_LABEL = '2025/26';
export const CURRENT_SEASON_LABEL = '2026/27';

export interface PreviousMatch {
  matchday: number;
  rival: string;
  // true si el Levante UD jugaba en casa.
  home: boolean;
  scored: number;
  conceded: number;
}

export const previousSeasonMatches: PreviousMatch[] = [
  { matchday: 1, rival: "Alavés", home: false, scored: 1, conceded: 2 },
  { matchday: 2, rival: "Barcelona", home: true, scored: 2, conceded: 3 },
  { matchday: 3, rival: "Elche", home: false, scored: 0, conceded: 2 },
  { matchday: 4, rival: "Betis", home: true, scored: 2, conceded: 2 },
  { matchday: 5, rival: "Girona", home: false, scored: 4, conceded: 0 },
  { matchday: 6, rival: "Real Madrid", home: true, scored: 1, conceded: 4 },
  { matchday: 7, rival: "Getafe", home: false, scored: 1, conceded: 1 },
  { matchday: 8, rival: "Oviedo", home: false, scored: 2, conceded: 0 },
  { matchday: 9, rival: "Rayo Vallecano", home: true, scored: 0, conceded: 3 },
  { matchday: 10, rival: "Mallorca", home: false, scored: 1, conceded: 1 },
  { matchday: 11, rival: "Celta", home: true, scored: 1, conceded: 2 },
  { matchday: 12, rival: "Atlético de Madrid", home: false, scored: 1, conceded: 3 },
  { matchday: 13, rival: "Valencia", home: false, scored: 0, conceded: 1 },
  { matchday: 14, rival: "Athletic Club", home: true, scored: 0, conceded: 2 },
  { matchday: 15, rival: "Osasuna", home: false, scored: 0, conceded: 2 },
  { matchday: 16, rival: "Villarreal", home: true, scored: 0, conceded: 1 },
  { matchday: 17, rival: "Real Sociedad", home: true, scored: 1, conceded: 1 },
  { matchday: 18, rival: "Sevilla", home: false, scored: 3, conceded: 0 },
  { matchday: 19, rival: "Espanyol", home: true, scored: 1, conceded: 1 },
  { matchday: 20, rival: "Real Madrid", home: false, scored: 0, conceded: 2 },
  { matchday: 21, rival: "Elche", home: true, scored: 3, conceded: 2 },
  { matchday: 22, rival: "Atlético de Madrid", home: true, scored: 0, conceded: 0 },
  { matchday: 23, rival: "Athletic Club", home: false, scored: 2, conceded: 4 },
  { matchday: 24, rival: "Valencia", home: true, scored: 0, conceded: 2 },
  { matchday: 25, rival: "Barcelona", home: false, scored: 0, conceded: 3 },
  { matchday: 26, rival: "Alavés", home: true, scored: 2, conceded: 0 },
  { matchday: 27, rival: "Girona", home: true, scored: 1, conceded: 1 },
  { matchday: 28, rival: "Rayo Vallecano", home: false, scored: 1, conceded: 1 },
  { matchday: 29, rival: "Oviedo", home: true, scored: 4, conceded: 2 },
  { matchday: 30, rival: "Real Sociedad", home: false, scored: 0, conceded: 2 },
  { matchday: 31, rival: "Getafe", home: true, scored: 1, conceded: 0 },
  { matchday: 32, rival: "Espanyol", home: false, scored: 0, conceded: 0 },
  { matchday: 33, rival: "Sevilla", home: true, scored: 2, conceded: 0 },
  { matchday: 34, rival: "Villarreal", home: false, scored: 1, conceded: 5 },
  { matchday: 35, rival: "Osasuna", home: true, scored: 3, conceded: 2 },
  { matchday: 36, rival: "Celta", home: false, scored: 3, conceded: 2 },
  { matchday: 37, rival: "Mallorca", home: true, scored: 2, conceded: 0 },
  { matchday: 38, rival: "Betis", home: false, scored: 1, conceded: 2 },
];

// Identificador comun de un equipo porque el calendario, el dataset y la API lo escriben distinto ("Villarreal CF" / "Villarreal" / "Real Betis Balompié").
// El orden importa: "Espanyol de Barcelona" y "Deportivo Alavés" no deben caer en Barcelona ni en Deportivo.
const TEAM_KEYS = ['real madrid', 'atletico', 'real sociedad', 'athletic', 'alaves', 'espanyol', 'barcelona', 'betis', 'celta', 'elche', 'getafe', 'girona', 'mallorca', 'osasuna', 'oviedo', 'rayo', 'sevilla', 'valencia', 'villarreal', 'levante', 'malaga', 'racing', 'deportivo', 'tarancon'];

export function teamKey(name: string): string | null {
  const plain = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return TEAM_KEYS.find((key) => plain.includes(key)) ?? null;
}
