import { LEVANTE_TEAM, levanteMatches, type LevanteMatch } from '@/lib/levante-data';
export const getNextLevanteMatch = (): LevanteMatch | null => levanteMatches.find((match)=>match.status==='SCHEDULED') ?? null;
export const getLastLevanteMatch = (): LevanteMatch | null => [...levanteMatches].reverse().find((match)=>match.status==='FINISHED') ?? null;
export const getRecentLevanteMatches = (limit=3): LevanteMatch[] => levanteMatches.filter((match)=>match.status==='FINISHED').slice(-limit);
export const getUpcomingLevanteMatches = (limit=5): LevanteMatch[] => levanteMatches.filter((match)=>match.status==='SCHEDULED').slice(0,limit);
export const getMatchByMatchday = (matchday:number): LevanteMatch | null => levanteMatches.find((match)=>match.matchday===matchday) ?? null;
export function getLevanteSeasonStats(){return levanteMatches.filter((match)=>match.status==='FINISHED').reduce((stats,match)=>{const home=match.homeTeam===LEVANTE_TEAM;const gf=home?match.homeScore!:match.awayScore!;const gc=home?match.awayScore!:match.homeScore!;stats.played++;stats.goalsFor+=gf;stats.goalsAgainst+=gc;if(gf>gc)stats.won++;else if(gf===gc)stats.drawn++;else stats.lost++;stats.goalDifference=stats.goalsFor-stats.goalsAgainst;stats.points=stats.won*3+stats.drawn;return stats},{played:0,won:0,drawn:0,lost:0,goalsFor:0,goalsAgainst:0,goalDifference:0,points:0})}
