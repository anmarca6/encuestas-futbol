import { LEVANTE_TEAM, levanteMatches, type LevanteMatch } from '@/lib/levante-data';
const todayInMadrid = (now: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(now);
const hasEnded = (match: LevanteMatch, now: Date) => match.status === 'FINISHED' || match.status === 'POSTPONED' || match.date < todayInMadrid(now);
const byDate = (a: LevanteMatch, b: LevanteMatch) => a.date.localeCompare(b.date) || a.matchday - b.matchday;
const pendingByDate = (matches: LevanteMatch[], now: Date) => matches.filter((match)=>!hasEnded(match, now)).sort(byDate);
// Un aplazamiento marcado en los datos locales manda sobre lo que diga la API (que puede tardar en reflejarlo o dar una fecha provisional).
export const applyLocalPostponements = (matches: LevanteMatch[]): LevanteMatch[] => matches.map((match)=>match.status!=='FINISHED' && levanteMatches.some((local)=>local.matchday===match.matchday && local.status==='POSTPONED') ? {...match,status:'POSTPONED' as const} : match);
export const getNextLevanteMatch = (matches=levanteMatches, now=new Date()): LevanteMatch | null => pendingByDate(matches, now)[0] ?? null;
export const getLastLevanteMatch = (matches=levanteMatches): LevanteMatch | null => [...matches].reverse().find((match)=>match.status==='FINISHED') ?? null;
export const getRecentLevanteMatches = (limit=3,matches=levanteMatches): LevanteMatch[] => matches.filter((match)=>match.status==='FINISHED').slice(-limit);
export const getUpcomingLevanteMatches = (limit=5,matches=levanteMatches,now=new Date()): LevanteMatch[] => pendingByDate(matches, now).slice(0,limit);
export const getMatchByMatchday = (matchday:number,matches=levanteMatches): LevanteMatch | null => matches.find((match)=>match.matchday===matchday) ?? null;
export function getLevanteSeasonStats(matches=levanteMatches){return matches.filter((match)=>match.status==='FINISHED').reduce((stats,match)=>{const home=match.homeTeam===LEVANTE_TEAM;const gf=home?match.homeScore!:match.awayScore!;const gc=home?match.awayScore!:match.homeScore!;stats.played++;stats.goalsFor+=gf;stats.goalsAgainst+=gc;if(gf>gc)stats.won++;else if(gf===gc)stats.drawn++;else stats.lost++;stats.goalDifference=stats.goalsFor-stats.goalsAgainst;stats.points=stats.won*3+stats.drawn;return stats},{played:0,won:0,drawn:0,lost:0,goalsFor:0,goalsAgainst:0,goalDifference:0,points:0})}
