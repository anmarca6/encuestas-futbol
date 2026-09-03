import type { PlayerPosition } from '@/lib/levante-data';

export type FormationId = '4-3-3' | '4-4-2' | '3-5-2' | '4-2-3-1';

export interface FormationSlot {
  id: string;
  label: string;
  position: PlayerPosition;
  left: number;
  top: number;
}

export interface Formation {
  id: FormationId;
  name: FormationId;
  slots: FormationSlot[];
}

export interface SavedLineup {
  formation: FormationId;
  players: string[];
}

export const DEFAULT_FORMATION: FormationId = '4-3-3';

export const formations: Record<FormationId, Formation> = {
  '4-3-3': {
    id: '4-3-3',
    name: '4-3-3',
    slots: [
      { id: '433-gk', label: 'POR', position: 'GOALKEEPER', left: 50, top: 88 },
      { id: '433-lb', label: 'LI', position: 'DEFENDER', left: 14, top: 68 },
      { id: '433-lcb', label: 'DFC', position: 'DEFENDER', left: 38, top: 72 },
      { id: '433-rcb', label: 'DFC', position: 'DEFENDER', left: 62, top: 72 },
      { id: '433-rb', label: 'LD', position: 'DEFENDER', left: 86, top: 68 },
      { id: '433-lm', label: 'MC', position: 'MIDFIELDER', left: 22, top: 46 },
      { id: '433-cm', label: 'MC', position: 'MIDFIELDER', left: 50, top: 51 },
      { id: '433-rm', label: 'MC', position: 'MIDFIELDER', left: 78, top: 46 },
      { id: '433-lw', label: 'EI', position: 'FORWARD', left: 20, top: 20 },
      { id: '433-st', label: 'DC', position: 'FORWARD', left: 50, top: 14 },
      { id: '433-rw', label: 'ED', position: 'FORWARD', left: 80, top: 20 },
    ],
  },
  '4-4-2': {
    id: '4-4-2',
    name: '4-4-2',
    slots: [
      { id: '442-gk', label: 'POR', position: 'GOALKEEPER', left: 50, top: 88 },
      { id: '442-lb', label: 'LI', position: 'DEFENDER', left: 14, top: 69 },
      { id: '442-lcb', label: 'DFC', position: 'DEFENDER', left: 38, top: 72 },
      { id: '442-rcb', label: 'DFC', position: 'DEFENDER', left: 62, top: 72 },
      { id: '442-rb', label: 'LD', position: 'DEFENDER', left: 86, top: 69 },
      { id: '442-lm', label: 'MI', position: 'MIDFIELDER', left: 14, top: 45 },
      { id: '442-lcm', label: 'MC', position: 'MIDFIELDER', left: 38, top: 49 },
      { id: '442-rcm', label: 'MC', position: 'MIDFIELDER', left: 62, top: 49 },
      { id: '442-rm', label: 'MD', position: 'MIDFIELDER', left: 86, top: 45 },
      { id: '442-lst', label: 'DC', position: 'FORWARD', left: 34, top: 18 },
      { id: '442-rst', label: 'DC', position: 'FORWARD', left: 66, top: 18 },
    ],
  },
  '3-5-2': {
    id: '3-5-2',
    name: '3-5-2',
    slots: [
      { id: '352-gk', label: 'POR', position: 'GOALKEEPER', left: 50, top: 88 },
      { id: '352-lcb', label: 'DFC', position: 'DEFENDER', left: 22, top: 70 },
      { id: '352-cb', label: 'DFC', position: 'DEFENDER', left: 50, top: 74 },
      { id: '352-rcb', label: 'DFC', position: 'DEFENDER', left: 78, top: 70 },
      { id: '352-lm', label: 'MI', position: 'MIDFIELDER', left: 10, top: 45 },
      { id: '352-lcm', label: 'MC', position: 'MIDFIELDER', left: 30, top: 50 },
      { id: '352-cm', label: 'MC', position: 'MIDFIELDER', left: 50, top: 42 },
      { id: '352-rcm', label: 'MC', position: 'MIDFIELDER', left: 70, top: 50 },
      { id: '352-rm', label: 'MD', position: 'MIDFIELDER', left: 90, top: 45 },
      { id: '352-lst', label: 'DC', position: 'FORWARD', left: 34, top: 17 },
      { id: '352-rst', label: 'DC', position: 'FORWARD', left: 66, top: 17 },
    ],
  },
  '4-2-3-1': {
    id: '4-2-3-1',
    name: '4-2-3-1',
    slots: [
      {
        id: '4231-gk',
        label: 'POR',
        position: 'GOALKEEPER',
        left: 50,
        top: 88,
      },
      { id: '4231-lb', label: 'LI', position: 'DEFENDER', left: 14, top: 70 },
      { id: '4231-lcb', label: 'DFC', position: 'DEFENDER', left: 38, top: 73 },
      { id: '4231-rcb', label: 'DFC', position: 'DEFENDER', left: 62, top: 73 },
      { id: '4231-rb', label: 'LD', position: 'DEFENDER', left: 86, top: 70 },
      {
        id: '4231-ldm',
        label: 'MCD',
        position: 'MIDFIELDER',
        left: 36,
        top: 54,
      },
      {
        id: '4231-rdm',
        label: 'MCD',
        position: 'MIDFIELDER',
        left: 64,
        top: 54,
      },
      {
        id: '4231-lam',
        label: 'EI',
        position: 'MIDFIELDER',
        left: 18,
        top: 34,
      },
      {
        id: '4231-am',
        label: 'MCO',
        position: 'MIDFIELDER',
        left: 50,
        top: 38,
      },
      {
        id: '4231-ram',
        label: 'ED',
        position: 'MIDFIELDER',
        left: 82,
        top: 34,
      },
      { id: '4231-st', label: 'DC', position: 'FORWARD', left: 50, top: 14 },
    ],
  },
};

export const formationOptions = Object.keys(formations) as FormationId[];
