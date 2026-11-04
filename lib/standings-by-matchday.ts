import type { ApiMatch } from '@/lib/football-schedule';
import type { StandingRow } from '@/lib/image-stats';

// Clasificacion de LaLiga tras cada jornada, calculada con los resultados de los partidos ya jugados (puntos, diferencia de goles y goles a favor;
// no aplica el desempate por enfrentamiento directo). Un partido aplazado cuenta desde la jornada a la que pertenece.
export function standingsByMatchday(matches: ApiMatch[]): Record<number, StandingRow[]> {
  const finished = matches.filter((match) => match.status === 'FINISHED' && match.matchday !== null && match.score.fullTime.home !== null && match.score.fullTime.away !== null);
  const last = Math.max(0, ...finished.map((match) => match.matchday as number));
  const teams = new Map<string, { team: string; points: number; goalsFor: number; goalsAgainst: number }>();
  const entry = (name: string) => {
    if (!teams.has(name)) teams.set(name, { team: name, points: 0, goalsFor: 0, goalsAgainst: 0 });
    return teams.get(name)!;
  };
  const result: Record<number, StandingRow[]> = {};
  for (let day = 1; day <= last; day += 1) {
    for (const match of finished.filter((item) => item.matchday === day)) {
      const home = entry(match.homeTeam.name);
      const away = entry(match.awayTeam.name);
      const homeGoals = match.score.fullTime.home as number;
      const awayGoals = match.score.fullTime.away as number;
      home.goalsFor += homeGoals;
      home.goalsAgainst += awayGoals;
      away.goalsFor += awayGoals;
      away.goalsAgainst += homeGoals;
      if (homeGoals > awayGoals) home.points += 3;
      else if (homeGoals < awayGoals) away.points += 3;
      else {
        home.points += 1;
        away.points += 1;
      }
    }
    result[day] = [...teams.values()]
      .sort((a, b) => b.points - a.points || b.goalsFor - b.goalsAgainst - (a.goalsFor - a.goalsAgainst) || b.goalsFor - a.goalsFor || a.team.localeCompare(b.team))
      .map((row, index) => ({ team: row.team, position: index + 1 }));
  }
  return result;
}
