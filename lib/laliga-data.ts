import athleticCrest from '@/escudosLigaEAsports/Athletic Club Bilbao.png';
import atleticoCrest from '@/escudosLigaEAsports/Atlético de Madrid.webp';
import osasunaCrest from '@/escudosLigaEAsports/transparent/Club Atlético Osasuna.png';
import alavesCrest from '@/escudosLigaEAsports/Deportivo Alavés.png';
import elcheCrest from '@/escudosLigaEAsports/Elche CF.webp';
import barcelonaCrest from '@/escudosLigaEAsports/FC Barcelona.webp';
import getafeCrest from '@/escudosLigaEAsports/Getafe CF.webp';
import levanteCrest from '@/escudosLigaEAsports/Levante UD.png';
import malagaCrest from '@/escudosLigaEAsports/Málaga CF.webp';
import rayoCrest from '@/escudosLigaEAsports/transparent/Rayo Vallecano de Madrid.png';
import espanyolCrest from '@/escudosLigaEAsports/RCD Espanyol de Barcelona.webp';
import betisCrest from '@/escudosLigaEAsports/Real Betis Balompié.png';
import celtaCrest from '@/escudosLigaEAsports/Real Club Celta de Vigo.png';
import deportivoCrest from '@/escudosLigaEAsports/Real Club Deportivo de La Coruña.png';
import madridCrest from '@/escudosLigaEAsports/Real Madrid.svg';
import racingCrest from '@/escudosLigaEAsports/Real Racing Club de Santander.png';
import sociedadCrest from '@/escudosLigaEAsports/Real Sociedad de Fútbol.png';
import sevillaCrest from '@/escudosLigaEAsports/transparent/Sevilla FC.png';
import valenciaCrest from '@/escudosLigaEAsports/Valencia CF.png';
import villarrealCrest from '@/escudosLigaEAsports/Villarreal CF.webp';

export interface LeagueTeam {
  id: string;
  name: string;
  shortName: string;
  crest: string;
}

export const leagueTeams: LeagueTeam[] = [
  { id: 'fc-barcelona', name: 'FC Barcelona', shortName: 'Barcelona', crest: barcelonaCrest.src },
  { id: 'real-madrid', name: 'Real Madrid', shortName: 'R. Madrid', crest: madridCrest.src },
  { id: 'atletico-de-madrid', name: 'Atlético de Madrid', shortName: 'Atlético', crest: atleticoCrest.src },
  { id: 'deportivo-alaves', name: 'Deportivo Alavés', shortName: 'Alavés', crest: alavesCrest.src },
  { id: 'ca-osasuna', name: 'CA Osasuna', shortName: 'Osasuna', crest: osasunaCrest.src },
  { id: 'sevilla-fc', name: 'Sevilla FC', shortName: 'Sevilla', crest: sevillaCrest.src },
  { id: 'real-betis', name: 'Real Betis', shortName: 'Betis', crest: betisCrest.src },
  { id: 'rc-deportivo', name: 'RC Deportivo', shortName: 'Deportivo', crest: deportivoCrest.src },
  { id: 'levante-ud', name: 'Levante UD', shortName: 'Levante', crest: levanteCrest.src },
  { id: 'racing-de-santander', name: 'Racing de Santander', shortName: 'Racing', crest: racingCrest.src },
  { id: 'rcd-espanyol', name: 'RCD Espanyol', shortName: 'Espanyol', crest: espanyolCrest.src },
  { id: 'athletic-club', name: 'Athletic Club', shortName: 'Athletic', crest: athleticCrest.src },
  { id: 'real-sociedad', name: 'Real Sociedad', shortName: 'R. Sociedad', crest: sociedadCrest.src },
  { id: 'getafe-cf', name: 'Getafe CF', shortName: 'Getafe', crest: getafeCrest.src },
  { id: 'villarreal-cf', name: 'Villarreal CF', shortName: 'Villarreal', crest: villarrealCrest.src },
  { id: 'valencia-cf', name: 'Valencia CF', shortName: 'Valencia', crest: valenciaCrest.src },
  { id: 'celta', name: 'Celta', shortName: 'Celta', crest: celtaCrest.src },
  { id: 'rayo-vallecano', name: 'Rayo Vallecano', shortName: 'Rayo', crest: rayoCrest.src },
  { id: 'elche-cf', name: 'Elche CF', shortName: 'Elche', crest: elcheCrest.src },
  { id: 'malaga-cf', name: 'Málaga CF', shortName: 'Málaga', crest: malagaCrest.src },
];

export interface LeagueStanding {
  position: number;
  teamId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

type StandingSeed = [string, number, number, number, number, number, number, number];
const standingSeeds: StandingSeed[] = [
  ['fc-barcelona',9,3,3,0,0,12,2],['real-madrid',9,3,3,0,0,10,2],['atletico-de-madrid',7,3,2,1,0,7,3],['deportivo-alaves',7,3,2,1,0,5,1],['ca-osasuna',7,3,2,1,0,3,1],
  ['sevilla-fc',6,3,2,0,1,6,5],['real-betis',6,3,2,0,1,4,5],['rc-deportivo',5,3,1,2,0,5,3],['levante-ud',4,3,1,1,1,5,5],['racing-de-santander',4,3,1,1,1,5,5],
  ['rcd-espanyol',3,3,1,0,2,5,4],['athletic-club',3,3,1,0,2,3,5],['real-sociedad',3,3,1,0,2,3,6],['getafe-cf',3,3,1,0,2,1,4],['villarreal-cf',2,3,0,2,1,4,5],
  ['valencia-cf',1,3,0,1,2,1,4],['celta',1,3,0,1,2,1,4],['rayo-vallecano',1,3,0,1,2,4,8],['elche-cf',1,3,0,1,2,3,9],['malaga-cf',1,3,0,1,2,1,7],
];

export const realLeagueStandings: ReadonlyArray<Readonly<LeagueStanding>> = standingSeeds.map(([teamId,points,played,won,drawn,lost,goalsFor,goalsAgainst],index) => ({ position:index+1,teamId,played,won,drawn,lost,goalsFor,goalsAgainst,goalDifference:goalsFor-goalsAgainst,points }));

export const getLeagueTeamById = (teamId: string) => leagueTeams.find((team) => team.id === teamId);
export const getLeagueTeamByName = (name: string) => leagueTeams.find((team) => team.name === name);
export const getLevanteStanding = () => realLeagueStandings.find((standing) => standing.teamId === 'levante-ud');
export const cloneLeagueStandings = (): LeagueStanding[] => realLeagueStandings.map((standing) => ({ ...standing }));
