// Generador de imagenes estadisticas del panel de administracion. Todo se dibuja en el navegador con los datos que se escriben
// en el formulario: nada de esto se guarda en la base de datos ni afecta a la app.

export type ImageLayout = 'barras' | 'ranking' | 'podio' | 'comparar';
export type ImageBackground = 'nocturna' | 'interior' | 'ninguno';
export type ImageLogo = 'ninguno' | 'ismaelete';
// Partidos que alimentan la imagen: solo LaLiga o LaLiga y Copa del Rey.
export type ImageScope = 'liga' | 'ligaCopa';

export interface ImageRow {
  label: string;
  value: number;
  // Jugador de la fila (foto en el podio).
  playerId?: string;
}

// Fila de la lista de partidos de la comparativa: el partido de cada temporada en una jornada.
export type DuelOutcome = 'w' | 'd' | 'l';
export interface ImageDuelSide {
  rival: string;
  score: string;
  outcome: DuelOutcome;
  // Puesto del rival en la clasificacion de esa temporada y si es el mas dificil (mejor clasificado) de la jornada.
  rank?: number;
  harder?: boolean;
}
export interface ImageDuel {
  day: string;
  left: ImageDuelSide | null;
  right: ImageDuelSide | null;
}

export interface ImageCard {
  value: string;
  text: string;
}

export interface ImageSpec {
  kicker: string;
  title: string;
  titleAccent: string;
  subtitle: string;
  layout: ImageLayout;
  rows: ImageRow[];
  showPercent: boolean;
  // En el grafico de barras: linea discontinua tras esa columna (0 = sin linea), con sus dos etiquetas.
  dividerAfter: number;
  dividerLabels: [string, string];
  cards: ImageCard[];
  background: ImageBackground;
  playerId: string;
  playerCaption: string;
  playerSub: string;
  footer: string;
  // Unidad del valor en el podio: singular y plural ("MVP", "MVPs").
  unit: [string, string];
  // Sufijo del valor en la comparativa ("%" en los pronosticos, vacio al comparar cifras).
  compareSuffix: string;
  // Lista de partidos bajo las columnas de la comparativa (vacia = comparativa normal).
  duels: ImageDuel[];
  // Aclaracion bajo la lista de partidos (por que se destacan algunos rivales).
  duelsNote: string;
  // Logo de la comunidad en la esquina superior derecha.
  logo: ImageLogo;
  // Competiciones incluidas en los datos (se recuerda para recargar la imagen con el mismo criterio).
  competition: ImageScope;
}

export const IMAGE_WIDTH = 1080;
export const IMAGE_HEIGHT = 1350;
export const IMAGE_SCALE = 1.5;
export const MAX_ROWS = 12;
export const MAX_DUELS = 12;

export const BACKGROUNDS: Record<Exclude<ImageBackground, 'ninguno'>, { src: string; label: string; credit: string }> = {
  nocturna: { src: '/ciutat-nocturna.jpg', label: 'Ciutat de València (de noche)', credit: 'Foto del estadio: TaronjaSatsuma, CC BY-SA 4.0 (Wikimedia Commons).' },
  interior: { src: '/ciutat-interior.jpg', label: 'Ciutat de València (de día)', credit: 'Foto del estadio: Francesc Fort, CC BY-SA 4.0 (Wikimedia Commons).' },
};

export const LOGOS: Record<Exclude<ImageLogo, 'ninguno'>, { src: string; label: string }> = {
  ismaelete: { src: '/ismaelete_profile.jpg', label: 'Ismaelete' },
};

export const QUARTER_LABELS = ["1-15'", "16-30'", "31-45'", "46-60'", "61-75'", "76-90'", '90+'];

export const DEFAULT_SPEC: ImageSpec = {
  kicker: 'Estadística · LaLiga 2026/27',
  title: '¿Cuándo',
  titleAccent: 'marca el Levante UD?',
  subtitle: "16 goles en 11 jornadas, por tramos de 15 minutos. Más goles: 16-30' y 90+.",
  layout: 'barras',
  rows: [
    { label: QUARTER_LABELS[0], value: 0 },
    { label: QUARTER_LABELS[1], value: 4 },
    { label: QUARTER_LABELS[2], value: 1 },
    { label: QUARTER_LABELS[3], value: 3 },
    { label: QUARTER_LABELS[4], value: 1 },
    { label: QUARTER_LABELS[5], value: 3 },
    { label: QUARTER_LABELS[6], value: 4 },
  ],
  showPercent: true,
  dividerAfter: 3,
  dividerLabels: ['1ª PARTE', '2ª PARTE'],
  cards: [
    { value: '69%', text: 'de los goles llegan en la 2ª parte (11 de 16)' },
    { value: '7', text: 'goles a partir del minuto 76' },
    { value: '0', text: 'goles en los primeros 15 minutos' },
  ],
  background: 'nocturna',
  playerId: 'roger-brugue',
  playerCaption: 'Roger Brugué · 5 goles',
  playerSub: 'Máximo goleador del equipo',
  footer: 'Fuente: https://encuestas-futbol.vercel.app/ismaelete · Goles del Levante UD en LaLiga (J1–J11); el tramo 90+ incluye el descuento.',
  unit: ['MVP', 'MVPs'],
  compareSuffix: '%',
  duels: [],
  duelsNote: '',
  logo: 'ninguno',
  competition: 'liga',
};

// Tarjetas sugeridas a partir de los datos: el tramo mas alto, el total y los tramos sin ninguno.
export function suggestCards(rows: ImageRow[]): ImageCard[] {
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  if (!rows.length || total <= 0) return [];
  const top = rows.reduce((best, row) => (row.value > best.value ? row : best), rows[0]);
  const empty = rows.filter((row) => row.value === 0);
  const cards: ImageCard[] = [
    { value: `${Math.round((top.value / total) * 100)}%`, text: `del total se concentra en ${top.label}` },
    { value: String(total), text: 'en total' },
  ];
  cards.push(empty.length
    ? { value: String(empty.length), text: `${empty.length === 1 ? 'tramo' : 'tramos'} sin ninguno: ${empty.map((row) => row.label).join(', ')}` }
    : { value: String(top.value), text: `en el tramo más alto (${top.label})` });
  return cards;
}

export interface ImageAssets {
  background: HTMLImageElement | null;
  player: HTMLImageElement | null;
  // Fotos de los jugadores de las filas del podio, por id.
  rowPlayers: Record<string, HTMLImageElement>;
  logo: HTMLImageElement | null;
}

const HEAD_FONT = '"Barlow Condensed", Impact, "Arial Narrow", sans-serif';
const BODY_FONT = '"Barlow", "Segoe UI", Arial, sans-serif';
const RED = '#e11d48';
const RED_LIGHT = '#ff5a7a';
const BLUE_DARK = '#0b3d82';
const MUTE = '#b6c6e0';

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`No se pudo cargar ${src}`));
    image.src = src;
  });
}

let fontsPromise: Promise<void> | undefined;
// Barlow (la tipografia de la imagen) se pide a Google Fonts; sin conexion se dibuja con una tipografia del sistema.
export function ensureImageFonts(): Promise<void> {
  fontsPromise ??= (async () => {
    if (!document.getElementById('image-generator-fonts')) {
      const link = document.createElement('link');
      link.id = 'image-generator-fonts';
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;800;900&family=Barlow:wght@500;700&display=swap';
      // Hasta que la hoja de estilos no esta cargada, el navegador no sabe que fuentes pedir.
      await Promise.race([
        new Promise((resolve) => { link.onload = resolve; link.onerror = resolve; document.head.appendChild(link); }),
        new Promise((resolve) => setTimeout(resolve, 4000)),
      ]);
    }
    await Promise.race([
      Promise.all(['900 100px "Barlow Condensed"', '800 24px "Barlow Condensed"', '700 20px "Barlow"', '500 20px "Barlow"'].map((font) => document.fonts.load(font))),
      new Promise((resolve) => setTimeout(resolve, 4000)),
    ]).catch(() => undefined);
  })();
  return fontsPromise;
}

type Ctx = CanvasRenderingContext2D;

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function setSpacing(ctx: Ctx, px: number) {
  if ('letterSpacing' in ctx) (ctx as Ctx & { letterSpacing: string }).letterSpacing = `${px}px`;
}

function wrap(ctx: Ctx, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const test = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(test).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

// Reduce el tamano de la fuente hasta que el texto cabe en el ancho.
function fitFont(ctx: Ctx, text: string, weight: number, size: number, family: string, maxWidth: number, min = 28) {
  let current = size;
  ctx.font = `${weight} ${current}px ${family}`;
  while (current > min && ctx.measureText(text).width > maxWidth) {
    current -= 2;
    ctx.font = `${weight} ${current}px ${family}`;
  }
  return current;
}

const OUTCOME_COLORS: Record<DuelOutcome, string> = { w: '#5ee08a', d: '#ffd36b', l: RED_LIGHT };

// Lista de partidos bajo la comparativa: jornada, rival y resultado de cada temporada (azul = la pasada, rojo = la actual).
function drawDuels(ctx: Ctx, spec: ImageSpec, duels: ImageDuel[], sideColors: string[], px: number, py: number, pw: number, ph: number) {
  roundRect(ctx, px, py, pw, ph, 30);
  ctx.fillStyle = 'rgba(8,18,40,.78)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(160,190,240,.3)';
  ctx.lineWidth = 1;
  ctx.stroke();
  const left = px + 36;
  const right = px + pw - 36;
  const blockW = 340;
  const starts = [left + 90, right - blockW];
  const headY = py + 36;
  ctx.font = `800 20px ${HEAD_FONT}`;
  setSpacing(ctx, 2);
  ctx.fillStyle = '#9db4d8';
  ctx.fillText('J', left, headY);
  [0, 1].forEach((side) => {
    ctx.fillStyle = sideColors[side];
    ctx.fillText((spec.dividerLabels[side] || (side === 0 ? 'Antes' : 'Ahora')).toUpperCase(), starts[side], headY);
  });
  setSpacing(ctx, 0);
  if (duels.some((duel) => duel.left?.rank || duel.right?.rank)) {
    // Aclara que el puesto es el de la clasificacion tras esa jornada, no el actual ni el final.
    ctx.fillStyle = MUTE;
    ctx.font = `700 14px ${BODY_FONT}`;
    ctx.textAlign = 'right';
    starts.forEach((start) => ctx.fillText('PUESTO TRAS ESA JORNADA', start + blockW - 62, headY - 1));
    ctx.textAlign = 'left';
  }
  ctx.strokeStyle = 'rgba(160,190,240,.25)';
  ctx.beginPath();
  ctx.moveTo(left, headY + 10);
  ctx.lineTo(right, headY + 10);
  ctx.stroke();
  const top = headY + 14;
  const noteH = spec.duelsNote ? 26 : 0;
  const rowH = Math.min(30, (py + ph - 12 - noteH - top) / duels.length);
  const size = Math.min(21, rowH * 0.74);
  ctx.textBaseline = 'middle';
  duels.forEach((duel, index) => {
    const cy = top + index * rowH + rowH / 2;
    if (index % 2 === 0) {
      roundRect(ctx, left - 12, cy - rowH / 2, right - left + 24, rowH, 8);
      ctx.fillStyle = 'rgba(120,160,230,.08)';
      ctx.fill();
    }
    ctx.fillStyle = '#dbe6f8';
    ctx.font = `800 ${size}px ${HEAD_FONT}`;
    ctx.fillText(duel.day, left, cy);
    [duel.left, duel.right].forEach((side, sideIndex) => {
      if (!side) {
        ctx.fillStyle = '#6f86ad';
        ctx.font = `700 ${size}px ${BODY_FONT}`;
        ctx.fillText('—', starts[sideIndex], cy);
        return;
      }
      if (side.harder) {
        ctx.fillStyle = '#ffd36b';
        ctx.font = `900 ${size}px ${HEAD_FONT}`;
        ctx.fillText('★', starts[sideIndex] - size - 6, cy);
      }
      ctx.fillStyle = side.harder ? '#ffd36b' : '#fff';
      ctx.font = `700 ${size * 0.9}px ${BODY_FONT}`;
      ctx.fillText(side.rival, starts[sideIndex], cy, blockW - 130);
      if (side.rank) {
        ctx.fillStyle = MUTE;
        ctx.font = `700 ${size * 0.8}px ${BODY_FONT}`;
        ctx.textAlign = 'right';
        ctx.fillText(`${side.rank}º`, starts[sideIndex] + blockW - 72, cy);
        ctx.textAlign = 'left';
      }
      ctx.fillStyle = OUTCOME_COLORS[side.outcome];
      ctx.font = `900 ${size * 1.15}px ${HEAD_FONT}`;
      ctx.textAlign = 'right';
      ctx.fillText(side.score, starts[sideIndex] + blockW - 14, cy);
      ctx.textAlign = 'left';
    });
  });
  ctx.textBaseline = 'alphabetic';
  if (spec.duelsNote) {
    ctx.fillStyle = '#ffd36b';
    ctx.font = `700 15px ${BODY_FONT}`;
    ctx.fillText(spec.duelsNote, left, py + ph - 14, right - left);
  }
}

export function renderInfographic(canvas: HTMLCanvasElement, spec: ImageSpec, assets: ImageAssets) {
  canvas.width = IMAGE_WIDTH * IMAGE_SCALE;
  canvas.height = IMAGE_HEIGHT * IMAGE_SCALE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(IMAGE_SCALE, 0, 0, IMAGE_SCALE, 0, 0);
  const W = IMAGE_WIDTH;
  const H = IMAGE_HEIGHT;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';

  // Fondo
  ctx.fillStyle = '#050b18';
  ctx.fillRect(0, 0, W, H);
  if (assets.background) {
    const image = assets.background;
    const scale = 1250 / image.naturalHeight;
    const width = image.naturalWidth * scale;
    ctx.save();
    if ('filter' in ctx) ctx.filter = 'brightness(1.25) saturate(1.2)';
    ctx.drawImage(image, -(width - W) * 0.6, H - 1250, width, 1250);
    ctx.restore();
    const shade = ctx.createLinearGradient(0, 0, 0, H);
    shade.addColorStop(0, 'rgba(5,11,24,.55)');
    shade.addColorStop(0.4, 'rgba(5,11,24,.15)');
    shade.addColorStop(0.62, 'rgba(5,11,24,.25)');
    shade.addColorStop(1, 'rgba(5,11,24,.9)');
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, W, H);
  } else {
    const base = ctx.createLinearGradient(0, 0, 0, H);
    base.addColorStop(0, '#0b1a36');
    base.addColorStop(1, '#050b18');
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, W, H);
  }
  const glow = ctx.createRadialGradient(160, 120, 0, 160, 120, 560);
  glow.addColorStop(0, 'rgba(169,29,67,.35)');
  glow.addColorStop(1, 'rgba(169,29,67,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Jugador (recortado, con el borde inferior difuminado)
  const hasPlayer = Boolean(assets.player) && spec.layout !== 'podio';
  if (hasPlayer && assets.player) {
    const image = assets.player;
    const height = 400;
    const width = (image.naturalWidth / image.naturalHeight) * height;
    const layer = document.createElement('canvas');
    layer.width = Math.ceil(width * IMAGE_SCALE);
    layer.height = Math.ceil(height * IMAGE_SCALE);
    const layerCtx = layer.getContext('2d');
    if (layerCtx) {
      layerCtx.drawImage(image, 0, 0, layer.width, layer.height);
      layerCtx.globalCompositeOperation = 'destination-in';
      const mask = layerCtx.createLinearGradient(0, 0, 0, layer.height);
      mask.addColorStop(0, '#000');
      mask.addColorStop(0.7, '#000');
      mask.addColorStop(1, 'rgba(0,0,0,0)');
      layerCtx.fillStyle = mask;
      layerCtx.fillRect(0, 0, layer.width, layer.height);
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,.6)';
      ctx.shadowBlur = 40;
      ctx.shadowOffsetY = 20;
      ctx.drawImage(layer, W - 10 - width, 275, width, height);
      ctx.restore();
    }
  }

  // Logo de la comunidad: circulo con aro rojo arriba a la derecha
  if (spec.logo !== 'ninguno' && assets.logo) {
    const size = 124;
    const lx = W - 64 - size;
    const ly = 40;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.55)';
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 8;
    ctx.beginPath();
    ctx.arc(lx + size / 2, ly + size / 2, size / 2 + 6, 0, Math.PI * 2);
    ctx.fillStyle = RED;
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.beginPath();
    ctx.arc(lx + size / 2, ly + size / 2, size / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(assets.logo, lx, ly, size, size);
    ctx.restore();
  }

  // Cabecera
  const textWidth = hasPlayer ? 520 : 952;
  ctx.fillStyle = RED;
  ctx.fillRect(64, 54, 44, 4);
  ctx.fillStyle = RED_LIGHT;
  ctx.font = `800 22px ${HEAD_FONT}`;
  setSpacing(ctx, 4.4);
  ctx.fillText(spec.kicker.toUpperCase(), 124, 64);
  setSpacing(ctx, 0);

  ctx.shadowColor = 'rgba(0,0,0,.6)';
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 6;
  const titleFit = Math.min(
    fitFont(ctx, spec.title.toUpperCase(), 900, 104, HEAD_FONT, 952),
    fitFont(ctx, spec.titleAccent.toUpperCase(), 900, 104, HEAD_FONT, 952),
  );
  ctx.font = `900 ${titleFit}px ${HEAD_FONT}`;
  const lineHeight = titleFit * 0.9;
  let y = 96 + titleFit * 0.82;
  ctx.fillStyle = '#fff';
  if (spec.title) {
    ctx.fillText(spec.title.toUpperCase(), 64, y);
    y += lineHeight;
  }
  ctx.fillStyle = RED_LIGHT;
  if (spec.titleAccent) {
    ctx.fillText(spec.titleAccent.toUpperCase(), 64, y);
    y += lineHeight;
  }
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  y += 22;
  ctx.fillStyle = '#e4ecf9';
  ctx.font = `500 27px ${BODY_FONT}`;
  for (const line of wrap(ctx, spec.subtitle, textWidth).slice(0, 4)) {
    y += 35;
    ctx.fillText(line, 64, y);
  }

  if (hasPlayer && (spec.playerCaption || spec.playerSub)) {
    y = Math.max(y + 56, 470);
    ctx.fillStyle = '#fff';
    ctx.font = `900 34px ${HEAD_FONT}`;
    setSpacing(ctx, 1.4);
    ctx.fillText(spec.playerCaption.toUpperCase(), 64, y);
    setSpacing(ctx, 0);
    ctx.fillStyle = MUTE;
    ctx.font = `700 20px ${BODY_FONT}`;
    ctx.fillText(spec.playerSub, 64, y + 28);
  }

  // Panel del grafico
  const px = 44;
  const duels = spec.layout === 'comparar' ? spec.duels.slice(0, MAX_DUELS) : [];
  const py = spec.layout === 'podio' || duels.length ? 490 : 640;
  const pw = W - 88;
  const ph = spec.layout === 'podio' ? 620 : duels.length ? 230 : 470;
  const panel = ctx.createLinearGradient(0, py, 0, py + ph);
  panel.addColorStop(0, 'rgba(10,22,48,.66)');
  panel.addColorStop(1, 'rgba(6,14,30,.84)');
  roundRect(ctx, px, py, pw, ph, 30);
  ctx.fillStyle = panel;
  ctx.fill();
  ctx.strokeStyle = 'rgba(160,190,240,.3)';
  ctx.lineWidth = 1;
  ctx.stroke();

  const rows = spec.rows.slice(0, MAX_ROWS);
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  const max = Math.max(0, ...rows.map((row) => row.value));
  const label = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(1).replace('.', ','));
  const percent = (value: number) => (total > 0 ? `${Math.round((value / total) * 100)}%` : '');

  if (rows.length === 0) {
    ctx.fillStyle = MUTE;
    ctx.font = `700 26px ${BODY_FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('Añade datos para ver el gráfico', W / 2, py + ph / 2);
    ctx.textAlign = 'left';
  } else if (spec.layout === 'barras') {
    const left = px + 36;
    const inner = pw - 72;
    const gap = rows.length > 8 ? 8 : 14;
    const colW = (inner - gap * (rows.length - 1)) / rows.length;
    const baseline = 998;
    const barMax = 215;
    const valueSize = colW < 70 ? 38 : 50;
    ctx.textAlign = 'center';
    rows.forEach((row, index) => {
      const cx = left + index * (colW + gap) + colW / 2;
      const peak = max > 0 && row.value === max;
      const zero = row.value === 0;
      const barH = zero || max === 0 ? 6 : Math.max((row.value / max) * barMax, 6);
      const top = baseline - barH;
      ctx.save();
      if (peak) {
        ctx.shadowColor = 'rgba(255,90,122,.65)';
        ctx.shadowBlur = 36;
        const fill = ctx.createLinearGradient(0, top, 0, baseline);
        fill.addColorStop(0, RED_LIGHT);
        fill.addColorStop(1, '#a91d43');
        ctx.fillStyle = fill;
      } else if (zero) {
        ctx.fillStyle = 'rgba(120,170,255,.35)';
      } else {
        const fill = ctx.createLinearGradient(0, top, 0, baseline);
        fill.addColorStop(0, '#4b9bff');
        fill.addColorStop(1, BLUE_DARK);
        ctx.fillStyle = fill;
      }
      roundRect(ctx, cx - colW / 2, top, colW, barH, Math.min(14, barH / 2));
      ctx.fill();
      ctx.restore();
      let textY = top - 10;
      if (spec.showPercent) {
        ctx.fillStyle = MUTE;
        ctx.font = `700 ${colW < 70 ? 15 : 18}px ${BODY_FONT}`;
        ctx.fillText(zero ? '—' : percent(row.value), cx, textY);
        textY -= colW < 70 ? 22 : 26;
      } else {
        textY -= 4;
      }
      ctx.fillStyle = peak ? RED_LIGHT : zero ? '#6f86ad' : '#fff';
      ctx.font = `900 ${valueSize}px ${HEAD_FONT}`;
      ctx.fillText(label(row.value), cx, textY);
      ctx.fillStyle = '#dbe6f8';
      ctx.font = `800 ${colW < 70 ? 17 : 24}px ${HEAD_FONT}`;
      ctx.fillText(row.label, cx, 1040, colW + gap);
    });
    ctx.textAlign = 'left';
    ctx.strokeStyle = 'rgba(160,190,240,.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(left, baseline + 10);
    ctx.lineTo(left + inner, baseline + 10);
    ctx.stroke();
    const divider = Math.round(spec.dividerAfter);
    if (divider > 0 && divider < rows.length) {
      const dx = left + divider * (colW + gap) - gap / 2;
      ctx.save();
      ctx.setLineDash([6, 6]);
      ctx.strokeStyle = 'rgba(200,220,255,.45)';
      ctx.beginPath();
      ctx.moveTo(dx, 662);
      ctx.lineTo(dx, baseline + 6);
      ctx.stroke();
      ctx.restore();
      ctx.fillStyle = '#9db4d8';
      ctx.font = `800 15px ${HEAD_FONT}`;
      setSpacing(ctx, 2.4);
      ctx.textAlign = 'right';
      ctx.fillText(spec.dividerLabels[0], dx - 8, 686);
      ctx.textAlign = 'left';
      ctx.fillText(spec.dividerLabels[1], dx + 8, 686);
      setSpacing(ctx, 0);
    }
  } else if (spec.layout === 'podio') {
    // Podio: las tres primeras filas (de mayor a menor) en 2º - 1º - 3º, con la foto de cada jugador sobre su escalon;
    // el resto, en una linea arriba.
    const ranked = [...rows].sort((a, b) => b.value - a.value);
    const slots = [
      { place: 1, row: ranked[1], height: 140, color: ['#8fa3c4', '#4a5d80'] },
      { place: 0, row: ranked[0], height: 190, color: ['#ffd36b', '#b8800f'] },
      { place: 2, row: ranked[2], height: 100, color: ['#e0955a', '#8a4a1f'] },
    ];
    const baseline = 1020;
    const left = px + 36;
    const colW = (pw - 72 - 40) / 3;
    const unitOf = (value: number) => (value === 1 ? spec.unit[0] : spec.unit[1]);
    ctx.textAlign = 'center';
    slots.forEach((slot, index) => {
      if (!slot.row) return;
      const cx = left + index * (colW + 20) + colW / 2;
      const top = baseline - slot.height;
      const gold = slot.place === 0;
      const photo = slot.row.playerId ? assets.rowPlayers[slot.row.playerId] : undefined;
      if (photo) {
        const photoH = 250;
        const photoW = Math.min((photo.naturalWidth / photo.naturalHeight) * photoH, colW + 20);
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,.55)';
        ctx.shadowBlur = 26;
        ctx.shadowOffsetY = 10;
        ctx.drawImage(photo, cx - photoW / 2, top + 34 - photoH, photoW, photoH);
        ctx.restore();
      }
      ctx.save();
      if (gold) {
        ctx.shadowColor = 'rgba(255,211,107,.55)';
        ctx.shadowBlur = 34;
      }
      const fill = ctx.createLinearGradient(0, top, 0, baseline);
      fill.addColorStop(0, slot.color[0]);
      fill.addColorStop(1, slot.color[1]);
      ctx.fillStyle = fill;
      roundRect(ctx, cx - colW / 2, top, colW, slot.height, 18);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = gold ? '#4a3205' : '#0a1630';
      ctx.font = `900 ${gold ? 96 : 76}px ${HEAD_FONT}`;
      ctx.fillText(String(slot.place + 1), cx, top + (gold ? 92 : 72));
      ctx.fillStyle = '#fff';
      fitFont(ctx, slot.row.label.toUpperCase(), 900, 34, HEAD_FONT, colW, 20);
      ctx.fillText(slot.row.label.toUpperCase(), cx, baseline + 46);
      ctx.fillStyle = gold ? '#ffd36b' : MUTE;
      ctx.font = `800 24px ${HEAD_FONT}`;
      ctx.fillText(`${label(slot.row.value)} ${unitOf(slot.row.value)}`.trim().toUpperCase(), cx, baseline + 76);
    });
    ctx.strokeStyle = 'rgba(160,190,240,.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(left, baseline + 8);
    ctx.lineTo(left + pw - 72, baseline + 8);
    ctx.stroke();
    if (ranked.length > 3) {
      ctx.fillStyle = MUTE;
      ctx.font = `700 20px ${BODY_FONT}`;
      const rest = ranked.slice(3).map((row) => `${row.label} (${label(row.value)})`).join(' · ');
      wrap(ctx, `También: ${rest}`, pw - 72).slice(0, 2).forEach((line, index) => ctx.fillText(line, px + pw / 2, py + 34 + index * 25));
    }
    ctx.textAlign = 'left';
  } else if (spec.layout === 'comparar') {
    // Comparativa: filas de dos en dos (usuarios / realidad) como columnas juntas; la etiqueta del grupo es la de la primera.
    const left = px + 36;
    const inner = pw - 72;
    const groups = Math.floor(rows.length / 2);
    const groupGap = groups > 3 ? 24 : 40;
    const groupW = (inner - groupGap * Math.max(groups - 1, 0)) / Math.max(groups, 1);
    const barW = Math.min((groupW - 16) / 2, 140);
    const baseline = duels.length ? py + ph - 50 : 980;
    const barMax = duels.length ? 85 : 230;
    const colors = [['#4b9bff', BLUE_DARK], [RED_LIGHT, '#a91d43']];
    ctx.textAlign = 'center';
    for (let group = 0; group < groups; group += 1) {
      const gx = left + group * (groupW + groupGap) + groupW / 2;
      [0, 1].forEach((side) => {
        const row = rows[group * 2 + side];
        const cx = gx + (side === 0 ? -(barW / 2 + 4) : barW / 2 + 4);
        const barH = max > 0 ? Math.max((row.value / max) * barMax, 6) : 6;
        const top = baseline - barH;
        const fill = ctx.createLinearGradient(0, top, 0, baseline);
        fill.addColorStop(0, colors[side][0]);
        fill.addColorStop(1, colors[side][1]);
        ctx.save();
        if (side === 1) {
          ctx.shadowColor = 'rgba(255,90,122,.5)';
          ctx.shadowBlur = 24;
        }
        ctx.fillStyle = fill;
        roundRect(ctx, cx - barW / 2, top, barW, barH, Math.min(14, barH / 2));
        ctx.fill();
        ctx.restore();
        ctx.fillStyle = side === 1 ? RED_LIGHT : '#fff';
        ctx.font = `900 ${duels.length || barW < 90 ? 38 : 52}px ${HEAD_FONT}`;
        ctx.fillText(`${label(row.value)}${spec.compareSuffix}`, cx, top - 12, barW + 24);
      });
      ctx.fillStyle = '#dbe6f8';
      ctx.font = `800 ${groups > 3 ? 22 : 28}px ${HEAD_FONT}`;
      ctx.fillText(rows[group * 2].label.toUpperCase(), gx, baseline + 44, groupW + groupGap - 4);
    }
    ctx.strokeStyle = 'rgba(160,190,240,.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(left, baseline + 10);
    ctx.lineTo(left + inner, baseline + 10);
    ctx.stroke();
    // Leyenda arriba del panel: azul = usuarios, rojo = realidad (los nombres salen de las etiquetas del divisor).
    ctx.font = `800 20px ${HEAD_FONT}`;
    setSpacing(ctx, 2);
    ctx.textAlign = 'left';
    [0, 1].forEach((side) => {
      const lx = left + side * 250;
      ctx.fillStyle = colors[side][0];
      roundRect(ctx, lx, py + 28, 22, 22, 6);
      ctx.fill();
      ctx.fillStyle = '#dbe6f8';
      ctx.fillText((spec.dividerLabels[side] || (side === 0 ? 'Usuarios' : 'Realidad')).toUpperCase(), lx + 32, py + 46);
    });
    setSpacing(ctx, 0);
    if (duels.length) drawDuels(ctx, spec, duels, colors.map((color) => color[0]), px, py + ph + 12, pw, 1110 - (py + ph + 12));
  } else {
    // Ranking: una barra horizontal por fila.
    const top = py + 30;
    const rowH = Math.min(52, (ph - 60) / rows.length);
    const labelW = 270;
    const barLeft = px + 36 + labelW;
    const barMaxW = pw - 72 - labelW - 120;
    rows.forEach((row, index) => {
      const cy = top + index * rowH + rowH / 2;
      const peak = max > 0 && row.value === max;
      const barW = max > 0 ? Math.max((row.value / max) * barMaxW, 14) : 14;
      const barH = Math.min(30, rowH - 12);
      ctx.fillStyle = '#e8f0ff';
      ctx.font = `800 ${Math.min(28, rowH * 0.6)}px ${HEAD_FONT}`;
      ctx.textBaseline = 'middle';
      ctx.fillText(row.label, px + 36, cy, labelW - 14);
      ctx.save();
      if (peak) {
        ctx.shadowColor = 'rgba(255,90,122,.6)';
        ctx.shadowBlur = 24;
      }
      const fill = ctx.createLinearGradient(barLeft, 0, barLeft + barW, 0);
      fill.addColorStop(0, peak ? '#a91d43' : BLUE_DARK);
      fill.addColorStop(1, peak ? RED_LIGHT : '#4b9bff');
      ctx.fillStyle = fill;
      roundRect(ctx, barLeft, cy - barH / 2, barW, barH, Math.min(10, barH / 2));
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = peak ? RED_LIGHT : '#fff';
      ctx.font = `900 ${Math.min(36, rowH * 0.8)}px ${HEAD_FONT}`;
      ctx.fillText(`${label(row.value)}${spec.showPercent && total > 0 ? `  ·  ${percent(row.value)}` : ''}`, barLeft + barW + 12, cy);
    });
    ctx.textBaseline = 'alphabetic';
  }

  // Tarjetas resumen
  const cards = spec.cards.filter((card) => card.value.trim() || card.text.trim()).slice(0, 3);
  if (cards.length) {
    const gapC = 16;
    const cw = (pw - gapC * (cards.length - 1)) / cards.length;
    cards.forEach((card, index) => {
      const cx = px + index * (cw + gapC);
      const cy = 1126;
      const ch = 144;
      const red = index === 0;
      const fill = ctx.createLinearGradient(cx, cy, cx + cw, cy + ch);
      fill.addColorStop(0, red ? 'rgba(225,29,72,.92)' : 'rgba(28,108,214,.88)');
      fill.addColorStop(1, red ? 'rgba(130,15,45,.96)' : 'rgba(11,61,130,.94)');
      roundRect(ctx, cx, cy, cw, ch, 24);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.strokeStyle = red ? 'rgba(255,160,180,.45)' : 'rgba(160,200,255,.35)';
      ctx.stroke();
      ctx.fillStyle = '#fff';
      const valueSize = fitFont(ctx, card.value, 900, 66, HEAD_FONT, cw - 40, 30);
      ctx.font = `900 ${valueSize}px ${HEAD_FONT}`;
      ctx.fillText(card.value, cx + 20, cy + 16 + valueSize * 0.82);
      ctx.fillStyle = '#eaf1ff';
      ctx.font = `700 19px ${BODY_FONT}`;
      wrap(ctx, card.text, cw - 40).slice(0, 3).forEach((line, lineIndex) => ctx.fillText(line, cx + 20, cy + 106 + lineIndex * 23));
    });
  }

  // Pie: fuente y credito de la foto de fondo
  const credit = spec.background !== 'ninguno' ? BACKGROUNDS[spec.background].credit : '';
  const footer = [spec.footer.trim(), credit].filter(Boolean).join(' ');
  if (footer) {
    ctx.fillStyle = '#8aa0c4';
    ctx.font = `500 14.5px ${BODY_FONT}`;
    const lines = wrap(ctx, footer, 952).slice(0, 3);
    lines.forEach((line, index) => ctx.fillText(line, 64, H - 22 - (lines.length - 1 - index) * 19));
  }
}

// Ficha guardada o recibida del navegador -> especificacion valida: se descartan campos desconocidos y se acotan textos y cifras.
export function sanitizeSpec(raw: unknown): ImageSpec {
  const source = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const text = (value: unknown, max: number) => (typeof value === 'string' ? value.trim().slice(0, max) : undefined);
  const out: Partial<ImageSpec> = {};
  const assign = <K extends keyof ImageSpec>(key: K, value: ImageSpec[K] | undefined) => {
    if (value !== undefined) out[key] = value;
  };
  assign('kicker', text(source.kicker, 60));
  assign('title', text(source.title, 40));
  assign('titleAccent', text(source.titleAccent, 40));
  assign('subtitle', text(source.subtitle, 220));
  assign('footer', text(source.footer, 240));
  assign('playerId', text(source.playerId, 60));
  assign('playerCaption', text(source.playerCaption, 40));
  assign('playerSub', text(source.playerSub, 50));
  if (source.layout === 'barras' || source.layout === 'ranking' || source.layout === 'podio' || source.layout === 'comparar') out.layout = source.layout;
  if (source.background === 'nocturna' || source.background === 'interior' || source.background === 'ninguno') out.background = source.background;
  if (source.logo === 'ninguno' || source.logo === 'ismaelete') out.logo = source.logo;
  if (source.competition === 'liga' || source.competition === 'ligaCopa') out.competition = source.competition;
  assign('compareSuffix', text(source.compareSuffix, 3));
  assign('duelsNote', text(source.duelsNote, 120));
  if (Array.isArray(source.duels)) {
    const side = (raw: unknown): ImageDuelSide | null => {
      const item = (raw && typeof raw === 'object' ? raw : null) as Record<string, unknown> | null;
      if (!item || typeof item.rival !== 'string' || typeof item.score !== 'string') return null;
      const outcome = item.outcome === 'w' || item.outcome === 'd' || item.outcome === 'l' ? item.outcome : 'd';
      const rank = Number(item.rank);
      return {
        rival: item.rival.trim().slice(0, 30),
        score: item.score.trim().slice(0, 8),
        outcome,
        ...(Number.isInteger(rank) && rank > 0 && rank < 100 ? { rank } : {}),
        ...(item.harder === true ? { harder: true } : {}),
      };
    };
    out.duels = source.duels
      .map((raw) => {
        const item = (raw ?? {}) as Record<string, unknown>;
        return { day: String(item.day ?? '').trim().slice(0, 8), left: side(item.left), right: side(item.right) };
      })
      .filter((duel) => duel.day)
      .slice(0, MAX_DUELS);
  }
  if (typeof source.showPercent === 'boolean') out.showPercent = source.showPercent;
  if (Array.isArray(source.rows)) {
    out.rows = source.rows
      .map((row) => {
        const item = (row ?? {}) as Record<string, unknown>;
        const value = Number(item.value);
        const playerId = typeof item.playerId === 'string' && item.playerId ? item.playerId.slice(0, 60) : undefined;
        return typeof item.label === 'string' && Number.isFinite(value) && value >= 0 ? { label: item.label.trim().slice(0, 30), value, ...(playerId ? { playerId } : {}) } : null;
      })
      .filter((row): row is ImageRow => row !== null)
      .slice(0, MAX_ROWS);
  }
  if (Array.isArray(source.unit) && source.unit.length === 2 && source.unit.every((item) => typeof item === 'string')) {
    out.unit = [String(source.unit[0]).slice(0, 24), String(source.unit[1]).slice(0, 24)];
  }
  if (typeof source.dividerAfter === 'number' && Number.isFinite(source.dividerAfter)) out.dividerAfter = Math.max(0, Math.min(MAX_ROWS, Math.round(source.dividerAfter)));
  if (Array.isArray(source.dividerLabels) && source.dividerLabels.length === 2 && source.dividerLabels.every((item) => typeof item === 'string')) {
    out.dividerLabels = [String(source.dividerLabels[0]).slice(0, 20), String(source.dividerLabels[1]).slice(0, 20)];
  }
  if (Array.isArray(source.cards)) {
    out.cards = source.cards
      .map((card) => {
        const item = (card ?? {}) as Record<string, unknown>;
        return { value: String(item.value ?? '').trim().slice(0, 10), text: String(item.text ?? '').trim().slice(0, 80) };
      })
      .filter((card) => card.value || card.text)
      .slice(0, 3);
  }
  return { ...DEFAULT_SPEC, ...out };
}
