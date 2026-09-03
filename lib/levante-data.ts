import pabloCamposImage from '@/JugadoresDelLevante2627/PabloCampos.webp';
import mathewRyanImage from '@/JugadoresDelLevante2627/MathewRyan.webp';
import alexPrimoImage from '@/JugadoresDelLevante2627/AlexPrimo.webp';
import aissaMandiImage from '@/JugadoresDelLevante2627/AÏssaMandi.webp';
import ndukweImage from '@/JugadoresDelLevante2627/Ndukwe.webp';
import delaImage from '@/JugadoresDelLevante2627/Dela.webp';
import cabelloImage from '@/JugadoresDelLevante2627/Cabello.webp';
import victorGarciaImage from '@/JugadoresDelLevante2627/VíctorGarcía.webp';
import jeremyToljanImage from '@/JugadoresDelLevante2627/JeremyToljan.webp';
import manuSanchezImage from '@/JugadoresDelLevante2627/ManuSánchez.webp';
import nachoPerezImage from '@/JugadoresDelLevante2627/NachoPérez.webp';
import marcSantosImage from '@/JugadoresDelLevante2627/MarcSantos.webp';
import xaviGrandeImage from '@/JugadoresDelLevante2627/XaviGrande.webp';
import axelTapeImage from '@/JugadoresDelLevante2627/AxelTape.webp';
import hugoSoteloImage from '@/JugadoresDelLevante2627/HugoSotelo.webp';
import daniRequenaImage from '@/JugadoresDelLevante2627/DaniRequena.webp';
import olasagastiImage from '@/JugadoresDelLevante2627/Olasagasti.webp';
import carlosAlvarezImage from '@/JugadoresDelLevante2627/CarlosÁlvarez.webp';
import enzoBardeliImage from '@/JugadoresDelLevante2627/EnzoBardeli.webp';
import thiagoFernandezImage from '@/JugadoresDelLevante2627/ThiagoFernández.webp';
import pacoCortesImage from '@/JugadoresDelLevante2627/PacoCortés.webp';
import ratkovImage from '@/JugadoresDelLevante2627/Ratkov.webp';
import rogerBrugueImage from '@/JugadoresDelLevante2627/RogerBrugué.webp';
import ivanRomeroImage from '@/JugadoresDelLevante2627/IvánRomero.webp';
import musuayiImage from '@/JugadoresDelLevante2627/Musuayi.webp';
import ettaEyongImage from '@/JugadoresDelLevante2627/EttaEyong.webp';
import oriolReyImage from '@/JugadoresDelLevante2627/OriolRey.webp';

export const LEVANTE_TEAM = 'Levante UD' as const;
export const LEVANTE_SEASON = '2026/2027' as const;
export const LEVANTE_COMPETITION = 'LaLiga' as const;

export type MatchStatus = 'FINISHED' | 'SCHEDULED';
export interface MatchGoal {
  playerName: string;
  team: string;
  minute: number;
}
export interface LevanteMatch {
  id: string;
  season: typeof LEVANTE_SEASON;
  competition: typeof LEVANTE_COMPETITION;
  matchday: number;
  date: string;
  kickoffTime: string | null;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  status: MatchStatus;
  goals: MatchGoal[];
  tags: string[];
}
type MatchSeed = [
  number,
  string,
  string,
  string,
  number | null,
  number | null,
  MatchStatus,
  MatchGoal[]?,
];

const matchSeeds: MatchSeed[] = [
  [
    1,
    '2026-08-16',
    'RCD Espanyol',
    LEVANTE_TEAM,
    3,
    0,
    'FINISHED',
    [
      { playerName: 'Roberto Fernández', team: 'RCD Espanyol', minute: 5 },
      { playerName: 'Roberto Fernández', team: 'RCD Espanyol', minute: 40 },
      { playerName: 'Tyrhys Dolan', team: 'RCD Espanyol', minute: 80 },
    ],
  ],
  [2, '2026-08-24', 'CA Osasuna', LEVANTE_TEAM, 0, 0, 'FINISHED', []],
  [
    3,
    '2026-08-29',
    LEVANTE_TEAM,
    'Real Betis',
    5,
    2,
    'FINISHED',
    [
      { playerName: 'Dela', team: LEVANTE_TEAM, minute: 24 },
      { playerName: 'Bartra', team: 'Real Betis', minute: 34 },
      { playerName: 'Enzo Bardeli', team: LEVANTE_TEAM, minute: 46 },
      { playerName: 'Riquelme', team: 'Real Betis', minute: 49 },
      { playerName: 'Roger Brugué', team: LEVANTE_TEAM, minute: 56 },
      { playerName: 'Roger Brugué', team: LEVANTE_TEAM, minute: 70 },
      { playerName: 'Olasagasti', team: LEVANTE_TEAM, minute: 95 },
    ],
  ],
  [4, '2026-09-06', 'Málaga CF', LEVANTE_TEAM, null, null, 'SCHEDULED'],
  [5, '2026-09-13', LEVANTE_TEAM, 'FC Barcelona', null, null, 'SCHEDULED'],
  [6, '2026-09-16', LEVANTE_TEAM, 'Athletic Club', null, null, 'SCHEDULED'],
  [7, '2026-09-20', 'Villarreal CF', LEVANTE_TEAM, null, null, 'SCHEDULED'],
  [8, '2026-10-11', LEVANTE_TEAM, 'Sevilla FC', null, null, 'SCHEDULED'],
  [9, '2026-10-18', 'RC Deportivo', LEVANTE_TEAM, null, null, 'SCHEDULED'],
  [10, '2026-10-25', 'Real Sociedad', LEVANTE_TEAM, null, null, 'SCHEDULED'],
  [
    11,
    '2026-11-01',
    LEVANTE_TEAM,
    'Atlético de Madrid',
    null,
    null,
    'SCHEDULED',
  ],
  [12, '2026-11-08', 'Celta', LEVANTE_TEAM, null, null, 'SCHEDULED'],
  [13, '2026-11-22', LEVANTE_TEAM, 'Elche CF', null, null, 'SCHEDULED'],
  [
    14,
    '2026-11-29',
    LEVANTE_TEAM,
    'Racing de Santander',
    null,
    null,
    'SCHEDULED',
  ],
  [15, '2026-12-06', 'Rayo Vallecano', LEVANTE_TEAM, null, null, 'SCHEDULED'],
  [16, '2026-12-13', LEVANTE_TEAM, 'Deportivo Alavés', null, null, 'SCHEDULED'],
  [17, '2026-12-20', 'Getafe CF', LEVANTE_TEAM, null, null, 'SCHEDULED'],
  [18, '2027-01-03', LEVANTE_TEAM, 'Valencia CF', null, null, 'SCHEDULED'],
  [19, '2027-01-10', 'Real Madrid', LEVANTE_TEAM, null, null, 'SCHEDULED'],
  [20, '2027-01-17', LEVANTE_TEAM, 'RCD Espanyol', null, null, 'SCHEDULED'],
  [21, '2027-01-24', 'Athletic Club', LEVANTE_TEAM, null, null, 'SCHEDULED'],
  [22, '2027-01-31', LEVANTE_TEAM, 'Real Sociedad', null, null, 'SCHEDULED'],
  [23, '2027-02-07', 'Elche CF', LEVANTE_TEAM, null, null, 'SCHEDULED'],
  [24, '2027-02-14', LEVANTE_TEAM, 'Málaga CF', null, null, 'SCHEDULED'],
  [25, '2027-02-21', 'FC Barcelona', LEVANTE_TEAM, null, null, 'SCHEDULED'],
  [26, '2027-02-28', LEVANTE_TEAM, 'RC Deportivo', null, null, 'SCHEDULED'],
  [27, '2027-03-07', 'Valencia CF', LEVANTE_TEAM, null, null, 'SCHEDULED'],
  [28, '2027-03-14', 'Real Betis', LEVANTE_TEAM, null, null, 'SCHEDULED'],
  [29, '2027-03-21', LEVANTE_TEAM, 'CA Osasuna', null, null, 'SCHEDULED'],
  [30, '2027-04-04', LEVANTE_TEAM, 'Rayo Vallecano', null, null, 'SCHEDULED'],
  [
    31,
    '2027-04-11',
    'Atlético de Madrid',
    LEVANTE_TEAM,
    null,
    null,
    'SCHEDULED',
  ],
  [32, '2027-04-18', LEVANTE_TEAM, 'Villarreal CF', null, null, 'SCHEDULED'],
  [33, '2027-04-21', 'Sevilla FC', LEVANTE_TEAM, null, null, 'SCHEDULED'],
  [34, '2027-05-02', LEVANTE_TEAM, 'Real Madrid', null, null, 'SCHEDULED'],
  [35, '2027-05-09', 'Deportivo Alavés', LEVANTE_TEAM, null, null, 'SCHEDULED'],
  [36, '2027-05-16', LEVANTE_TEAM, 'Getafe CF', null, null, 'SCHEDULED'],
  [
    37,
    '2027-05-23',
    'Racing de Santander',
    LEVANTE_TEAM,
    null,
    null,
    'SCHEDULED',
  ],
  [38, '2027-05-30', LEVANTE_TEAM, 'Celta', null, null, 'SCHEDULED'],
];

export const levanteMatches: LevanteMatch[] = matchSeeds.map(
  ([
    matchday,
    date,
    homeTeam,
    awayTeam,
    homeScore,
    awayScore,
    status,
    goals = [],
  ]) => ({
    id: `laliga-2026-27-j${matchday}`,
    season: LEVANTE_SEASON,
    competition: LEVANTE_COMPETITION,
    matchday,
    date,
    kickoffTime: null,
    homeTeam,
    awayTeam,
    homeScore,
    awayScore,
    status,
    goals,
    tags:
      homeTeam === 'Valencia CF' || awayTeam === 'Valencia CF' ? ['DERBY'] : [],
  }),
);

export type PlayerPosition =
  | 'GOALKEEPER'
  | 'DEFENDER'
  | 'MIDFIELDER'
  | 'FORWARD';
export interface LevantePlayer {
  id: string;
  number: number | null;
  displayName: string;
  position: PlayerPosition;
  image: string | null;
  possibleDeparture: boolean;
}
export const levantePlayers: LevantePlayer[] = [
  {
    id: 'pablo-campos',
    number: 1,
    displayName: 'Pablo Campos',
    position: 'GOALKEEPER',
    image: pabloCamposImage.src,
    possibleDeparture: false,
  },
  {
    id: 'mathew-ryan',
    number: 13,
    displayName: 'Mathew Ryan',
    position: 'GOALKEEPER',
    image: mathewRyanImage.src,
    possibleDeparture: false,
  },
  {
    id: 'alex-primo',
    number: 32,
    displayName: 'Alex Primo',
    position: 'GOALKEEPER',
    image: alexPrimoImage.src,
    possibleDeparture: false,
  },
  {
    id: 'aissa-mandi',
    number: 2,
    displayName: 'Aïssa Mandi',
    position: 'DEFENDER',
    image: aissaMandiImage.src,
    possibleDeparture: false,
  },
  {
    id: 'ndukwe',
    number: 3,
    displayName: 'Ndukwe',
    position: 'DEFENDER',
    image: ndukweImage.src,
    possibleDeparture: false,
  },
  {
    id: 'dela',
    number: 4,
    displayName: 'Dela',
    position: 'DEFENDER',
    image: delaImage.src,
    possibleDeparture: false,
  },
  {
    id: 'cabello',
    number: 14,
    displayName: 'Cabello',
    position: 'DEFENDER',
    image: cabelloImage.src,
    possibleDeparture: false,
  },
  {
    id: 'victor-garcia',
    number: 17,
    displayName: 'Víctor García',
    position: 'DEFENDER',
    image: victorGarciaImage.src,
    possibleDeparture: false,
  },
  {
    id: 'jeremy-toljan',
    number: 22,
    displayName: 'Jeremy Toljan',
    position: 'DEFENDER',
    image: jeremyToljanImage.src,
    possibleDeparture: false,
  },
  {
    id: 'manu-sanchez',
    number: 23,
    displayName: 'Manu Sánchez',
    position: 'DEFENDER',
    image: manuSanchezImage.src,
    possibleDeparture: false,
  },
  {
    id: 'nacho-perez',
    number: 29,
    displayName: 'Nacho Pérez',
    position: 'DEFENDER',
    image: nachoPerezImage.src,
    possibleDeparture: false,
  },
  {
    id: 'marc-santos',
    number: 33,
    displayName: 'Marc Santos',
    position: 'DEFENDER',
    image: marcSantosImage.src,
    possibleDeparture: false,
  },
  {
    id: 'xavi-grande',
    number: null,
    displayName: 'Xavi Grande',
    position: 'DEFENDER',
    image: xaviGrandeImage.src,
    possibleDeparture: true,
  },
  {
    id: 'axel-tape',
    number: null,
    displayName: 'Axel Tape',
    position: 'MIDFIELDER',
    image: axelTapeImage.src,
    possibleDeparture: false,
  },
  {
    id: 'hugo-sotelo',
    number: 5,
    displayName: 'Hugo Sotelo',
    position: 'MIDFIELDER',
    image: hugoSoteloImage.src,
    possibleDeparture: false,
  },
  {
    id: 'dani-requena',
    number: 6,
    displayName: 'Dani Requena',
    position: 'MIDFIELDER',
    image: daniRequenaImage.src,
    possibleDeparture: false,
  },
  {
    id: 'olasagasti',
    number: 8,
    displayName: 'Olasagasti',
    position: 'MIDFIELDER',
    image: olasagastiImage.src,
    possibleDeparture: false,
  },
  {
    id: 'carlos-alvarez',
    number: 10,
    displayName: 'Carlos Álvarez',
    position: 'MIDFIELDER',
    image: carlosAlvarezImage.src,
    possibleDeparture: true,
  },
  {
    id: 'enzo-bardeli',
    number: 18,
    displayName: 'Enzo Bardeli',
    position: 'MIDFIELDER',
    image: enzoBardeliImage.src,
    possibleDeparture: false,
  },
  {
    id: 'oriol-rey',
    number: 20,
    displayName: 'Oriol Rey',
    position: 'MIDFIELDER',
    image: oriolReyImage.src,
    possibleDeparture: false,
  },
  {
    id: 'thiago-fernandez',
    number: 24,
    displayName: 'Thiago Fernández',
    position: 'MIDFIELDER',
    image: thiagoFernandezImage.src,
    possibleDeparture: false,
  },
  {
    id: 'paco-cortes',
    number: 27,
    displayName: 'Paco Cortés',
    position: 'MIDFIELDER',
    image: pacoCortesImage.src,
    possibleDeparture: false,
  },
  {
    id: 'ratkov',
    number: null,
    displayName: 'Ratkov',
    position: 'FORWARD',
    image: ratkovImage.src,
    possibleDeparture: false,
  },
  {
    id: 'roger-brugue',
    number: 7,
    displayName: 'Roger Brugué',
    position: 'FORWARD',
    image: rogerBrugueImage.src,
    possibleDeparture: false,
  },
  {
    id: 'ivan-romero',
    number: 9,
    displayName: 'Iván Romero',
    position: 'FORWARD',
    image: ivanRomeroImage.src,
    possibleDeparture: false,
  },
  {
    id: 'musuayi',
    number: 11,
    displayName: 'Musuayi',
    position: 'FORWARD',
    image: musuayiImage.src,
    possibleDeparture: false,
  },
  {
    id: 'etta-eyong',
    number: 21,
    displayName: 'Etta Eyong',
    position: 'FORWARD',
    image: ettaEyongImage.src,
    possibleDeparture: false,
  },
];
export const levanteCoachingStaff = {
  headCoach: {
    id: 'luis-castro',
    displayName: 'Luís Castro',
    role: 'HEAD_COACH' as const,
  },
  assistantCoach: {
    id: 'carlos-garcia',
    displayName: 'Carlos Garcia',
    role: 'ASSISTANT_COACH' as const,
  },
};
