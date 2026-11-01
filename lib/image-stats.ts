import { DEFAULT_SPEC, QUARTER_LABELS, type ImageSpec } from '@/lib/image-generator';

// Datos de cada partido de LaLiga ya jugado que alimentan las plantillas del generador de imagenes.
export interface MatchStats {
  matchday: number;
  rival: string;
  scored: number;
  conceded: number;
  // Minutos de los goles del Levante / del rival (solo los que tienen minuto).
  scoredMinutes: number[];
  concededMinutes: number[];
  // Ids de jugador de cada gol del Levante.
  scorers: string[];
}

export type ImageTemplateId = 'marca' | 'encaja' | 'libre';

export const IMAGE_TEMPLATES: Array<{ id: ImageTemplateId; label: string; name: string; description: string }> = [
  { id: 'marca', label: '¿Cuándo marca el Levante UD?', name: '¿Cuándo marca el Levante UD?', description: 'Goles a favor por tramos de 15 minutos, con el máximo goleador como protagonista.' },
  { id: 'encaja', label: '¿Cuándo encaja el Levante UD?', name: '¿Cuándo encaja el Levante UD?', description: 'Goles en contra por tramos de 15 minutos y porterías a cero.' },
  { id: 'libre', label: 'Añadir plantilla', name: 'Personalizada', description: 'Crea una plantilla nueva desde cero: escribe tú los datos, los títulos y las tarjetas.' },
];

export const isTemplateId = (value: unknown): value is ImageTemplateId => IMAGE_TEMPLATES.some((item) => item.id === value);

export interface TemplateResult {
  spec: Partial<ImageSpec>;
  warnings: string[];
}

const bucketOf = (minute: number) => (minute <= 15 ? 0 : minute <= 30 ? 1 : minute <= 45 ? 2 : minute <= 60 ? 3 : minute <= 75 ? 4 : minute <= 90 ? 5 : 6);

function histogram(minutes: number[]) {
  const counts = QUARTER_LABELS.map(() => 0);
  for (const minute of minutes) counts[bucketOf(minute)] += 1;
  return counts;
}

const joinLabels = (labels: string[]) => (labels.length <= 1 ? labels.join('') : `${labels.slice(0, -1).join(', ')} y ${labels[labels.length - 1]}`);
const plural = (count: number, one: string, many: string) => (count === 1 ? one : many);
const percent = (part: number, total: number) => (total > 0 ? `${Math.round((part / total) * 100)}%` : '0%');

// Elementos del ranking que empatan en el maximo (vacio si no hay ningun gol).
function peakLabels(counts: number[]) {
  const max = Math.max(0, ...counts);
  return max === 0 ? [] : QUARTER_LABELS.filter((_, index) => counts[index] === max);
}

function range(stats: MatchStats[]) {
  const days = stats.map((item) => item.matchday);
  return `J${Math.min(...days)}–J${Math.max(...days)}`;
}

const SOURCE = 'Fuente: https://encuestas-futbol.vercel.app/ismaelete';

// "¿Cuándo marca el Levante UD?": goles del Levante por tramo, con el maximo goleador como protagonista.
function buildScored(stats: MatchStats[], playerName: (id: string) => string | null): TemplateResult {
  const counts = histogram(stats.flatMap((item) => item.scoredMinutes));
  const known = counts.reduce((sum, count) => sum + count, 0);
  const totalGoals = stats.reduce((sum, item) => sum + item.scored, 0);
  const warnings: string[] = [];
  if (totalGoals > known) warnings.push(`Hay ${totalGoals - known} ${plural(totalGoals - known, 'gol del Levante UD sin minuto', 'goles del Levante UD sin minuto')}: no salen en el gráfico.`);
  const second = counts.slice(3).reduce((sum, count) => sum + count, 0);
  const late = counts[5] + counts[6];
  const tops = peakLabels(counts);

  const goalsByPlayer = new Map<string, number>();
  for (const id of stats.flatMap((item) => item.scorers)) goalsByPlayer.set(id, (goalsByPlayer.get(id) ?? 0) + 1);
  const best = [...goalsByPlayer.entries()].sort((a, b) => b[1] - a[1])[0];
  const bestName = best ? playerName(best[0]) : null;
  const tied = best ? [...goalsByPlayer.values()].filter((goals) => goals === best[1]).length > 1 : false;

  return {
    warnings,
    spec: {
      kicker: DEFAULT_SPEC.kicker,
      title: '¿Cuándo',
      titleAccent: 'marca el Levante UD?',
      subtitle: `${known} ${plural(known, 'gol', 'goles')} en ${stats.length} jornadas, por tramos de 15 minutos.${tops.length && tops.length <= 3 ? ` Más goles: ${joinLabels(tops)}.` : ''}`,
      layout: 'barras',
      rows: QUARTER_LABELS.map((label, index) => ({ label, value: counts[index] })),
      showPercent: true,
      dividerAfter: 3,
      dividerLabels: ['1ª PARTE', '2ª PARTE'],
      cards: [
        { value: percent(second, known), text: `de los goles llegan en la 2ª parte (${second} de ${known})` },
        { value: String(late), text: `${plural(late, 'gol', 'goles')} a partir del minuto 76` },
        { value: String(counts[0]), text: `${plural(counts[0], 'gol', 'goles')} en los primeros 15 minutos` },
      ],
      playerId: best && bestName ? best[0] : '',
      playerCaption: best && bestName ? `${bestName} · ${best[1]} ${plural(best[1], 'gol', 'goles')}` : '',
      playerSub: tied ? 'Uno de los máximos goleadores' : 'Máximo goleador del equipo',
      footer: `${SOURCE} · Goles del Levante UD en LaLiga (${range(stats)}); el tramo 90+ incluye el descuento.`,
    },
  };
}

// "¿Cuándo encaja el Levante UD?": goles del rival por tramo y porterias a cero.
function buildConceded(stats: MatchStats[]): TemplateResult {
  const counts = histogram(stats.flatMap((item) => item.concededMinutes));
  const known = counts.reduce((sum, count) => sum + count, 0);
  const totalConceded = stats.reduce((sum, item) => sum + item.conceded, 0);
  const cleanSheets = stats.filter((item) => item.conceded === 0).length;
  const missing = stats.filter((item) => item.conceded > item.concededMinutes.length);
  const warnings: string[] = [];
  if (missing.length) {
    warnings.push(
      `Faltan los minutos de goles del rival en ${missing.map((item) => `J${item.matchday} (${item.conceded - item.concededMinutes.length})`).join(', ')}: añádelos en "Formación, resultado y goles" (Goles del rival) y vuelve a cargar los datos.`,
    );
  }
  const second = counts.slice(3).reduce((sum, count) => sum + count, 0);
  const late = counts[5] + counts[6];
  const tops = peakLabels(counts);
  const subtitle = `${known} ${plural(known, 'gol encajado', 'goles encajados')} en ${stats.length} jornadas, por tramos de 15 minutos.${tops.length && tops.length <= 3 ? ` Más peligro: ${joinLabels(tops)}.` : ''} Porterías a cero: ${cleanSheets} de ${stats.length}.`;

  return {
    warnings,
    spec: {
      kicker: DEFAULT_SPEC.kicker,
      title: '¿Cuándo',
      titleAccent: 'encaja el Levante UD?',
      subtitle: subtitle.slice(0, 220),
      layout: 'barras',
      rows: QUARTER_LABELS.map((label, index) => ({ label, value: counts[index] })),
      showPercent: true,
      dividerAfter: 3,
      dividerLabels: ['1ª PARTE', '2ª PARTE'],
      cards: [
        { value: String(cleanSheets), text: `${plural(cleanSheets, 'portería a cero', 'porterías a cero')} en ${stats.length} partidos` },
        { value: percent(second, known), text: `de los goles encajados llegan en la 2ª parte (${second} de ${known})` },
        { value: String(late), text: `${plural(late, 'gol encajado', 'goles encajados')} a partir del minuto 76` },
      ],
      playerId: 'mathew-ryan',
      playerCaption: 'Mathew Ryan',
      playerSub: 'Portero del Levante UD',
      footer: `${SOURCE} · Goles encajados por el Levante UD en LaLiga (${range(stats)}); el tramo 90+ incluye el descuento.${totalConceded > known ? ` Hay ${totalConceded - known} sin minuto.` : ''}`,
    },
  };
}

// Plantilla en blanco: ranking de ejemplo para sustituir por los datos propios.
function buildBlank(): TemplateResult {
  return {
    warnings: [],
    spec: {
      kicker: DEFAULT_SPEC.kicker,
      title: 'Título',
      titleAccent: 'de la imagen',
      subtitle: 'Explica aquí qué muestran los datos.',
      layout: 'ranking',
      rows: [
        { label: 'Dato 1', value: 4 },
        { label: 'Dato 2', value: 3 },
        { label: 'Dato 3', value: 2 },
        { label: 'Dato 4', value: 1 },
      ],
      showPercent: false,
      dividerAfter: 0,
      cards: [],
      playerId: '',
      playerCaption: '',
      playerSub: '',
      footer: SOURCE,
    },
  };
}

export function buildTemplate(id: ImageTemplateId, stats: MatchStats[], playerName: (id: string) => string | null): TemplateResult {
  if (id === 'libre') return buildBlank();
  if (stats.length === 0) return { spec: {}, warnings: ['Todavía no hay partidos jugados con datos.'] };
  return id === 'marca' ? buildScored(stats, playerName) : buildConceded(stats);
}
