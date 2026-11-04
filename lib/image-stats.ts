import { CURRENT_SEASON_LABEL, PREVIOUS_SEASON_LABEL, previousSeasonMatches, teamKey } from '@/lib/previous-season';
import { DEFAULT_SPEC, MAX_DUELS, QUARTER_LABELS, type DuelOutcome, type ImageDuelSide, type ImageSpec } from '@/lib/image-generator';

// Datos de cada partido de LaLiga ya jugado que alimentan las plantillas del generador de imagenes.
export interface MatchStats {
  matchday: number;
  rival: string;
  // true si el Levante UD jugo en casa.
  home: boolean;
  scored: number;
  conceded: number;
  // Minutos de los goles del Levante / del rival (solo los que tienen minuto).
  scoredMinutes: number[];
  concededMinutes: number[];
  // Ids de jugador de cada gol del Levante.
  scorers: string[];
}

// Todo lo que la app sabe y que alimenta las plantillas; se pide de nuevo cada vez que se crea o se recarga una imagen,
// asi cada jornada nueva queda reflejada.
export interface ImageData {
  matches: MatchStats[];
  // MVP de cada jornada de Liga con MVP elegido (aunque su informe oficial aun no este completo).
  mvps: Array<{ matchday: number; playerId: string }>;
  // Los once de cada jornada de Liga con once oficial.
  lineups: Array<{ matchday: number; players: string[] }>;
  // Pronosticos de los usuarios de la comunidad por partido jugado, segun el resultado que dan al Levante.
  predictions: Array<{ matchday: number; win: number; draw: number; loss: number }>;
  // Clasificacion de LaLiga tras cada jornada (jornada -> puestos) de la temporada actual y de la pasada, para medir la dificultad de los rivales.
  standings: { current: Record<number, StandingRow[]>; previous: Record<number, StandingRow[]> };
}

export interface StandingRow {
  team: string;
  position: number;
}

export const EMPTY_IMAGE_DATA: ImageData = { matches: [], mvps: [], lineups: [], predictions: [], standings: { current: {}, previous: {} } };

export type ImageTemplateId = 'marca' | 'encaja' | 'mvp' | 'xi' | 'prono' | 'temporada' | 'libre';

export const IMAGE_TEMPLATES: Array<{ id: ImageTemplateId; label: string; name: string; description: string }> = [
  { id: 'marca', label: '¿Cuándo marca el Levante UD?', name: '¿Cuándo marca el Levante UD?', description: 'Goles a favor por tramos de 15 minutos, con el máximo goleador como protagonista.' },
  { id: 'encaja', label: '¿Cuándo encaja el Levante UD?', name: '¿Cuándo encaja el Levante UD?', description: 'Goles en contra por tramos de 15 minutos y porterías a cero.' },
  { id: 'mvp', label: 'Podio de MVP', name: 'Podio de MVP', description: 'Los jugadores con más MVP de la jornada hasta ahora, en un podio.' },
  { id: 'xi', label: 'Podio de titulares', name: 'Podio de titulares', description: 'Los futbolistas que más veces han estado en el once inicial, en un podio con su foto.' },
  { id: 'prono', label: 'Pronósticos vs realidad', name: 'Pronósticos vs realidad', description: 'Qué porcentaje de usuarios da victoria, empate o derrota al Levante UD, comparado con cómo han salido los partidos.' },
  { id: 'temporada', label: 'Esta temporada vs la pasada', name: 'Esta temporada vs la pasada', description: 'Las jornadas de LaLiga jugadas este año comparadas con las mismas de la pasada: puntos, goles, victorias y porterías a cero, y la lista de rivales con su resultado en cada temporada.' },
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

// Ordena (id -> veces) de mas a menos; a igualdad, quien aparece antes en la lista.
function rankCounts(ids: string[]): Array<[string, number]> {
  const counts = new Map<string, number>();
  for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || ids.indexOf(a[0]) - ids.indexOf(b[0]));
}

const podiumRows = (ranked: Array<[string, number]>, playerName: (id: string) => string | null) =>
  ranked.slice(0, 8).map(([id, count]) => ({ label: playerName(id) ?? id, value: count, playerId: id }));

// "Podio de MVP": quien ha sido MVP mas veces. El MVP de la ultima jornada puede cambiar, asi que se avisa.
function buildMvp(mvps: ImageData['mvps'], playerName: (id: string) => string | null): TemplateResult {
  const valid = mvps.filter((item) => playerName(item.playerId)).sort((a, b) => a.matchday - b.matchday);
  const ranked = rankCounts(valid.map((item) => item.playerId));
  if (ranked.length === 0) return { spec: {}, warnings: ['Todavía no hay ningún MVP elegido.'] };
  const last = valid[valid.length - 1];
  const [topId, topCount] = ranked[0];
  const tiedTop = ranked.filter(([, count]) => count === topCount).length;
  const days = `J${valid[0].matchday}–J${last.matchday}`;

  return {
    warnings: [`El MVP de la J${last.matchday} (${playerName(last.playerId)}) puede no ser el definitivo: revisa el podio antes de publicar.`],
    spec: {
      kicker: DEFAULT_SPEC.kicker,
      title: 'Podio de',
      titleAccent: 'MVP del Levante UD',
      subtitle: `${valid.length} ${plural(valid.length, 'jornada', 'jornadas')} con MVP (${days}) y ${ranked.length} ${plural(ranked.length, 'jugador distinto', 'jugadores distintos')}.${tiedTop > 1 ? ' Hay empate en lo más alto.' : ''}`,
      layout: 'podio',
      unit: ['MVP', 'MVPs'],
      rows: podiumRows(ranked, playerName),
      showPercent: false,
      dividerAfter: 0,
      cards: [
        { value: String(topCount), text: `${plural(topCount, 'MVP', 'MVPs')} para ${playerName(topId) ?? topId}${tiedTop > 1 ? ' (y empata)' : ''}` },
        { value: String(valid.length), text: `${plural(valid.length, 'jornada', 'jornadas')} con MVP elegido` },
        { value: String(ranked.length), text: `${plural(ranked.length, 'jugador ha sido', 'jugadores han sido')} MVP` },
      ],
      playerId: '',
      playerCaption: '',
      playerSub: '',
      footer: `${SOURCE} · MVP de cada jornada de LaLiga elegido en la comunidad (${days}).`,
    },
  };
}

// "Podio de titulares": quien ha estado mas veces en el once inicial oficial.
function buildStarters(lineups: ImageData['lineups'], playerName: (id: string) => string | null): TemplateResult {
  const valid = lineups.filter((item) => item.players.length > 0).sort((a, b) => a.matchday - b.matchday);
  const ranked = rankCounts(valid.flatMap((item) => item.players.filter((id) => playerName(id))));
  if (ranked.length === 0) return { spec: {}, warnings: ['Todavía no hay ningún once oficial guardado.'] };
  const [topId, topCount] = ranked[0];
  const tiedTop = ranked.filter(([, count]) => count === topCount).length;
  const everPresent = ranked.filter(([, count]) => count === valid.length).length;
  const days = `J${valid[0].matchday}–J${valid[valid.length - 1].matchday}`;

  return {
    warnings: [],
    spec: {
      kicker: DEFAULT_SPEC.kicker,
      title: 'Podio de',
      titleAccent: 'titulares del Levante UD',
      subtitle: `Quién ha estado más veces en el once inicial en ${valid.length} ${plural(valid.length, 'jornada', 'jornadas')} de LaLiga.${tiedTop > 1 ? ' Hay empate en lo más alto.' : ''}`,
      layout: 'podio',
      unit: ['vez en el XI', 'veces en el XI'],
      rows: podiumRows(ranked, playerName),
      showPercent: false,
      dividerAfter: 0,
      cards: [
        { value: String(topCount), text: `${plural(topCount, 'vez', 'veces')} en el XI de ${playerName(topId) ?? topId}${tiedTop > 1 ? ' (y empata)' : ''}` },
        { value: String(valid.length), text: plural(valid.length, 'once analizado', 'onces analizados') },
        { value: String(everPresent), text: `${plural(everPresent, 'jugador no se ha perdido', 'jugadores no se han perdido')} ninguno` },
      ],
      playerId: '',
      playerCaption: '',
      playerSub: '',
      footer: `${SOURCE} · Once inicial oficial de cada jornada de LaLiga (${days}).`,
    },
  };
}

// Reparte 100 entre las partes sin que la suma se desvie por los redondeos.
function percents(parts: number[]) {
  const total = parts.reduce((sum, part) => sum + part, 0);
  if (total === 0) return parts.map(() => 0);
  const exact = parts.map((part) => (part / total) * 100);
  const floors = exact.map(Math.floor);
  let missing = 100 - floors.reduce((sum, value) => sum + value, 0);
  const order = exact.map((value, index) => ({ index, remainder: value - Math.floor(value) })).sort((a, b) => b.remainder - a.remainder);
  for (const item of order) {
    if (missing <= 0) break;
    floors[item.index] += 1;
    missing -= 1;
  }
  return floors;
}

// "Pronosticos vs realidad": resultado que dan los usuarios al Levante frente a como han salido los partidos.
function buildPredictions(data: ImageData): TemplateResult {
  const played = new Map(data.matches.map((item) => [item.matchday, item]));
  const rated = data.predictions.filter((item) => played.has(item.matchday) && item.win + item.draw + item.loss > 0);
  if (rated.length === 0) return { spec: {}, warnings: ['Todavía no hay pronósticos de partidos ya jugados.'] };
  const users = [rated.reduce((sum, item) => sum + item.win, 0), rated.reduce((sum, item) => sum + item.draw, 0), rated.reduce((sum, item) => sum + item.loss, 0)];
  const real = [0, 0, 0];
  for (const item of rated) {
    const match = played.get(item.matchday)!;
    real[match.scored > match.conceded ? 0 : match.scored === match.conceded ? 1 : 2] += 1;
  }
  const total = users[0] + users[1] + users[2];
  const userPct = percents(users);
  const realPct = percents(real);
  const names = ['Gana el Levante UD', 'Empate', 'Pierde el Levante UD'];
  const short = ['victoria', 'empate', 'derrota'];
  const topUser = userPct.indexOf(Math.max(...userPct));
  const topReal = realPct.indexOf(Math.max(...realPct));
  const days = `J${Math.min(...rated.map((item) => item.matchday))}–J${Math.max(...rated.map((item) => item.matchday))}`;

  return {
    warnings: [],
    spec: {
      kicker: DEFAULT_SPEC.kicker,
      title: 'Pronósticos',
      titleAccent: 'contra la realidad',
      subtitle: `${total} pronósticos en ${rated.length} ${plural(rated.length, 'partido jugado', 'partidos jugados')}: ${userPct[0]}% da victoria al Levante UD, ${userPct[1]}% empate y ${userPct[2]}% derrota.`,
      layout: 'comparar',
      logo: 'ismaelete',
      unit: DEFAULT_SPEC.unit,
      rows: names.flatMap((name, index) => [{ label: name, value: userPct[index] }, { label: name, value: realPct[index] }]),
      showPercent: false,
      dividerAfter: 0,
      dividerLabels: ['Lo que pronostican', 'Lo que ha pasado'],
      cards: [
        { value: `${userPct[topUser]}%`, text: `de los usuarios apuestan por ${short[topUser]}` },
        { value: `${realPct[topReal]}%`, text: `de los partidos han acabado en ${short[topReal]}` },
        { value: String(total), text: `pronósticos analizados (${rated.length} ${plural(rated.length, 'partido', 'partidos')})` },
      ],
      playerId: '',
      playerCaption: '',
      playerSub: '',
      footer: `${SOURCE} · Pronósticos de la comunidad en partidos de LaLiga ya jugados (${days}) frente a su resultado real.`,
    },
  };
}

interface SeasonTotals {
  points: number;
  scored: number;
  conceded: number;
  wins: number;
  cleanSheets: number;
}

function seasonTotals(matches: Array<{ scored: number; conceded: number }>): SeasonTotals {
  const totals: SeasonTotals = { points: 0, scored: 0, conceded: 0, wins: 0, cleanSheets: 0 };
  for (const item of matches) {
    totals.scored += item.scored;
    totals.conceded += item.conceded;
    if (item.scored > item.conceded) {
      totals.wins += 1;
      totals.points += 3;
    } else if (item.scored === item.conceded) {
      totals.points += 1;
    }
    if (item.conceded === 0) totals.cleanSheets += 1;
  }
  return totals;
}

const signed = (value: number) => (value > 0 ? `+${value}` : String(value));

const shortRival = (name: string) => name.replace(/^(FC|CA|RCD|CD) /, '').replace(/ (CF|FC)$/, '').replace(/^Deportivo (?=Alav)/, '');
const outcomeOf = (scored: number, conceded: number): DuelOutcome => (scored > conceded ? 'w' : scored === conceded ? 'd' : 'l');
// El marcador se escribe como en el partido: primero el equipo local. El color sigue siendo el del resultado del Levante UD.
const duelSide = (rival: string, home: boolean, scored: number, conceded: number, rank?: number): ImageDuelSide => ({
  rival: `${shortRival(rival)} (${home ? 'C' : 'F'})`,
  score: home ? `${scored}-${conceded}` : `${conceded}-${scored}`,
  outcome: outcomeOf(scored, conceded),
  ...(rank ? { rank } : {}),
});

const rankOf = (tables: Record<number, StandingRow[]>, matchday: number, rival: string) => {
  const key = teamKey(rival);
  return key ? tables[matchday]?.find((row) => teamKey(row.team) === key)?.position : undefined;
};

// Puestos de Champions: los equipos que acabaron ahi la temporada pasada o que estan ahi ahora (ultima jornada con clasificacion).
const CHAMPIONS_PLACES = 5;
function championTeams(standings: ImageData['standings']): Set<string> {
  const keys = new Set<string>();
  for (const tables of [standings.previous, standings.current]) {
    const days = Object.keys(tables).map(Number);
    if (days.length === 0) continue;
    for (const row of tables[Math.max(...days)]) {
      const key = teamKey(row.team);
      if (key && row.position <= CHAMPIONS_PLACES) keys.add(key);
    }
  }
  return keys;
}

// "Esta temporada vs la pasada": todas las jornadas jugadas este año frente a las mismas de la temporada pasada, con el rival y el
// resultado de cada una. Cada vez que avanza la liga, la imagen incluye una jornada mas.
function buildSeasonComparison(stats: MatchStats[], standings: ImageData['standings']): TemplateResult {
  const current = [...stats].sort((a, b) => a.matchday - b.matchday);
  if (current.length === 0) return { spec: {}, warnings: ['Todavía no hay partidos jugados con datos.'] };
  const days = new Set(current.map((item) => item.matchday));
  const previous = previousSeasonMatches.filter((item) => days.has(item.matchday));
  const last = current[current.length - 1].matchday;
  const now = seasonTotals(current);
  const before = seasonTotals(previous);
  const warnings: string[] = [];
  if (previous.length !== current.length) warnings.push('Faltan datos de alguna jornada de la temporada pasada: la comparación no es exacta.');
  if (current.length > MAX_DUELS) warnings.push(`La lista de rivales muestra solo las últimas ${MAX_DUELS} jornadas; las columnas suman las ${current.length}.`);
  const range = `J1–J${last}`;
  const diffPoints = now.points - before.points;
  const baseSubtitle = diffPoints === 0
    ? `Tras ${range}, el Levante UD suma los mismos puntos que el año pasado (${now.points}).`
    : `Tras ${range}, el Levante UD suma ${now.points} puntos: ${Math.abs(diffPoints)} ${diffPoints > 0 ? 'más' : 'menos'} que el año pasado (${before.points}).`;
  const groups: Array<[string, number, number]> = [
    ['Puntos', before.points, now.points],
    ['Goles a favor', before.scored, now.scored],
    ['Goles en contra', before.conceded, now.conceded],
    ['Victorias', before.wins, now.wins],
    ['Porterías a cero', before.cleanSheets, now.cleanSheets],
  ];
  const champions = championTeams(standings);
  const isChampions = (rival: string) => champions.has(teamKey(rival) ?? '');
  const duels = current.slice(-MAX_DUELS).map((item) => {
    const old = previous.find((entry) => entry.matchday === item.matchday);
    const left = old ? duelSide(old.rival, old.home, old.scored, old.conceded, rankOf(standings.previous, old.matchday, old.rival)) : null;
    const right = duelSide(item.rival, item.home, item.scored, item.conceded, rankOf(standings.current, item.matchday, item.rival));
    // Rival destacado: equipo de Champions la temporada pasada o esta.
    if (left && isChampions(old!.rival)) left.harder = true;
    if (isChampions(item.rival)) right.harder = true;
    return { day: `J${item.matchday}`, left, right };
  });

  let difficulty = '';
  if (champions.size > 0) {
    const nowCount = current.filter((item) => isChampions(item.rival)).length;
    const beforeCount = previous.filter((item) => isChampions(item.rival)).length;
    difficulty = ` Rivales de Champions: ${nowCount} este año y ${beforeCount} el año pasado.`;
  } else {
    warnings.push('No hay clasificación disponible (football-data.org): no se pueden destacar los rivales de Champions.');
  }

  return {
    warnings,
    spec: {
      kicker: DEFAULT_SPEC.kicker,
      title: 'Esta temporada',
      titleAccent: 'contra la pasada',
      subtitle: `${baseSubtitle}${difficulty}`.slice(0, 220),
      layout: 'comparar',
      compareSuffix: '',
      rows: groups.flatMap(([label, beforeValue, nowValue]) => [{ label, value: beforeValue }, { label, value: nowValue }]),
      showPercent: false,
      dividerAfter: 0,
      dividerLabels: [PREVIOUS_SEASON_LABEL, CURRENT_SEASON_LABEL],
      duels,
      duelsNote: champions.size ? `★ Rival de Champions: acabó entre los ${CHAMPIONS_PLACES} primeros en ${PREVIOUS_SEASON_LABEL} o está ahí en ${CURRENT_SEASON_LABEL}` : '',
      cards: [
        { value: signed(diffPoints), text: `${plural(Math.abs(diffPoints), 'punto', 'puntos')} frente al año pasado en las mismas jornadas` },
        { value: signed(now.scored - before.scored), text: `${plural(Math.abs(now.scored - before.scored), 'gol', 'goles')} a favor respecto al año pasado (${now.scored} frente a ${before.scored})` },
        { value: signed(now.conceded - before.conceded), text: `${plural(Math.abs(now.conceded - before.conceded), 'gol', 'goles')} en contra respecto al año pasado (${now.conceded} frente a ${before.conceded})` },
      ],
      playerId: '',
      playerCaption: '',
      playerSub: '',
      footer: `${SOURCE} · Levante UD en LaLiga, ${range}: ${PREVIOUS_SEASON_LABEL} (azul) vs ${CURRENT_SEASON_LABEL} (rojo). C = casa, F = fuera. Puesto = tras esa jornada. ★ = equipo de Champions (top ${CHAMPIONS_PLACES}) en ${PREVIOUS_SEASON_LABEL} o ahora.`,
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

export function buildTemplate(id: ImageTemplateId, data: ImageData, playerName: (id: string) => string | null): TemplateResult {
  const stats = data.matches;
  if (id === 'libre') return buildBlank();
  if (id === 'mvp') return buildMvp(data.mvps, playerName);
  if (id === 'xi') return buildStarters(data.lineups, playerName);
  if (stats.length === 0) return { spec: {}, warnings: ['Todavía no hay partidos jugados con datos.'] };
  if (id === 'prono') return buildPredictions(data);
  if (id === 'temporada') return buildSeasonComparison(stats, data.standings ?? EMPTY_IMAGE_DATA.standings);
  return id === 'marca' ? buildScored(stats, playerName) : buildConceded(stats);
}
