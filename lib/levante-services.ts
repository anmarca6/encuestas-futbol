import { LEVANTE_TEAM, levanteMatches, type LevanteMatch } from '@/lib/levante-data';
import { isPredictionClosed } from '@/lib/prediction-deadline';
const todayInMadrid = (now: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(now);
// "Pendiente" = aun se puede pronosticar: con hora de inicio conocida, el partido deja de ser el proximo en cuanto vence el plazo
// (2 horas antes del saque). Sin hora, se da un dia de margen por si la fecha local esta desfasada respecto a la oficial.
const hasEnded = (match: LevanteMatch, now: Date) => {
  if (match.status === 'FINISHED' || match.status === 'POSTPONED') return true;
  if (match.kickoffTime) return isPredictionClosed(match, now);
  return match.date < todayInMadrid(new Date(now.getTime() - 24 * 60 * 60 * 1000));
};
const byDate = (a: LevanteMatch, b: LevanteMatch) => a.date.localeCompare(b.date) || a.matchday - b.matchday;
const pendingByDate = (matches: LevanteMatch[], now: Date) => matches.filter((match)=>!hasEnded(match, now)).sort(byDate);
// Partidos aplazados cuya nueva fecha y hora ya conocemos: lo local manda sobre la API (que puede tardar en reflejarlo o dar una fecha provisional).
// Cuando la API ya devuelva la fecha correcta, se puede quitar la jornada de esta lista.
const RESCHEDULED_MATCHDAYS = new Set([6]);
// Un aplazamiento marcado en los datos locales (sin nueva fecha) tambien manda sobre lo que diga la API.
export const applyLocalPostponements = (matches: LevanteMatch[]): LevanteMatch[] => matches.map((match)=>{
  const local = levanteMatches.find((item)=>item.matchday===match.matchday);
  if (!local || match.status==='FINISHED') return match;
  if (RESCHEDULED_MATCHDAYS.has(match.matchday)) return {...match,date:local.date,kickoffTime:local.kickoffTime,status:'SCHEDULED' as const};
  return local.status==='POSTPONED' ? {...match,status:'POSTPONED' as const} : match;
});
export const getNextLevanteMatch = (matches=levanteMatches, now=new Date()): LevanteMatch | null => pendingByDate(matches, now)[0] ?? null;
// Los partidos jugados se ordenan por fecha (no por jornada): un partido aplazado se juega despues de jornadas posteriores.
const finishedByDate = (matches: LevanteMatch[]) => matches.filter((match)=>match.status==='FINISHED').sort(byDate);
export const getLastLevanteMatch = (matches=levanteMatches): LevanteMatch | null => finishedByDate(matches).slice(-1)[0] ?? null;
export const getRecentLevanteMatches = (limit=3,matches=levanteMatches): LevanteMatch[] => finishedByDate(matches).slice(-limit);
// Lista de "Próximos partidos": por fecha, e incluye los aplazados (pendientes de nueva fecha), que quedan en su posición original.
export const getUpcomingLevanteMatches = (limit=5,matches=levanteMatches,now=new Date()): LevanteMatch[] => matches.filter((match)=>match.status==='POSTPONED' || !hasEnded(match, now)).sort(byDate).slice(0,limit);
export const getMatchByMatchday = (matchday:number,matches=levanteMatches): LevanteMatch | null => matches.find((match)=>match.matchday===matchday) ?? null;
export function getLevanteSeasonStats(matches=levanteMatches){return matches.filter((match)=>match.status==='FINISHED').reduce((stats,match)=>{const home=match.homeTeam===LEVANTE_TEAM;const gf=home?match.homeScore!:match.awayScore!;const gc=home?match.awayScore!:match.homeScore!;stats.played++;stats.goalsFor+=gf;stats.goalsAgainst+=gc;if(gf>gc)stats.won++;else if(gf===gc)stats.drawn++;else stats.lost++;stats.goalDifference=stats.goalsFor-stats.goalsAgainst;stats.points=stats.won*3+stats.drawn;return stats},{played:0,won:0,drawn:0,lost:0,goalsFor:0,goalsAgainst:0,goalDifference:0,points:0})}

// Las predicciones se guardan con el id local de la jornada: se toma el calendario oficial (fecha y hora) de la API conservando ese id.
export const withLocalMatchIds = (matches: LevanteMatch[]): LevanteMatch[] => matches.map((match)=>{const local=levanteMatches.find((item)=>item.matchday===match.matchday);return local?{...match,id:local.id}:match});
