import { LEVANTE_TEAM, levanteMatches, type LevanteMatch } from '@/lib/levante-data';
import { madridDateTimeToUtc } from '@/lib/prediction-deadline';
const todayInMadrid = (now: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(now);
// Con hora de inicio conocida, un partido sigue vigente hasta 3 horas despues del saque (asi el dia del partido nunca salta al siguiente
// antes de tiempo). Sin hora, se da un dia de margen por si la fecha local esta desfasada respecto a la oficial.
const MATCH_DURATION_MS = 3 * 60 * 60 * 1000;
const hasEnded = (match: LevanteMatch, now: Date) => {
  if (match.status === 'FINISHED' || match.status === 'POSTPONED') return true;
  if (match.kickoffTime) return now.getTime() >= madridDateTimeToUtc(match.date, match.kickoffTime).getTime() + MATCH_DURATION_MS;
  return match.date < todayInMadrid(new Date(now.getTime() - 24 * 60 * 60 * 1000));
};
const byDate = (a: LevanteMatch, b: LevanteMatch) => a.date.localeCompare(b.date) || a.matchday - b.matchday;
const pendingByDate = (matches: LevanteMatch[], now: Date) => matches.filter((match)=>!hasEnded(match, now)).sort(byDate);
// Un aplazamiento marcado en los datos locales manda sobre lo que diga la API (que puede tardar en reflejarlo o dar una fecha provisional).
export const applyLocalPostponements = (matches: LevanteMatch[]): LevanteMatch[] => matches.map((match)=>match.status!=='FINISHED' && levanteMatches.some((local)=>local.matchday===match.matchday && local.status==='POSTPONED') ? {...match,status:'POSTPONED' as const} : match);
export const getNextLevanteMatch = (matches=levanteMatches, now=new Date()): LevanteMatch | null => pendingByDate(matches, now)[0] ?? null;
export const getLastLevanteMatch = (matches=levanteMatches): LevanteMatch | null => [...matches].reverse().find((match)=>match.status==='FINISHED') ?? null;
export const getRecentLevanteMatches = (limit=3,matches=levanteMatches): LevanteMatch[] => matches.filter((match)=>match.status==='FINISHED').slice(-limit);
// Lista de "Próximos partidos": por fecha, e incluye los aplazados (pendientes de nueva fecha), que quedan en su posición original.
export const getUpcomingLevanteMatches = (limit=5,matches=levanteMatches,now=new Date()): LevanteMatch[] => matches.filter((match)=>match.status==='POSTPONED' || !hasEnded(match, now)).sort(byDate).slice(0,limit);
export const getMatchByMatchday = (matchday:number,matches=levanteMatches): LevanteMatch | null => matches.find((match)=>match.matchday===matchday) ?? null;
export function getLevanteSeasonStats(matches=levanteMatches){return matches.filter((match)=>match.status==='FINISHED').reduce((stats,match)=>{const home=match.homeTeam===LEVANTE_TEAM;const gf=home?match.homeScore!:match.awayScore!;const gc=home?match.awayScore!:match.homeScore!;stats.played++;stats.goalsFor+=gf;stats.goalsAgainst+=gc;if(gf>gc)stats.won++;else if(gf===gc)stats.drawn++;else stats.lost++;stats.goalDifference=stats.goalsFor-stats.goalsAgainst;stats.points=stats.won*3+stats.drawn;return stats},{played:0,won:0,drawn:0,lost:0,goalsFor:0,goalsAgainst:0,goalDifference:0,points:0})}

// Las predicciones se guardan con el id local de la jornada: se toma el calendario oficial (fecha y hora) de la API conservando ese id.
export const withLocalMatchIds = (matches: LevanteMatch[]): LevanteMatch[] => matches.map((match)=>{const local=levanteMatches.find((item)=>item.matchday===match.matchday);return local?{...match,id:local.id}:match});
