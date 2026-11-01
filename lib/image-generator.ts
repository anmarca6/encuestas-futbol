// Generador de imagenes estadisticas del panel de administracion. Todo se dibuja en el navegador con los datos que se escriben
// en el formulario: nada de esto se guarda en la base de datos ni afecta a la app.

export type ImageLayout = 'barras' | 'ranking';
export type ImageBackground = 'nocturna' | 'interior' | 'ninguno';

export interface ImageRow {
  label: string;
  value: number;
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
}

export const IMAGE_WIDTH = 1080;
export const IMAGE_HEIGHT = 1350;
export const IMAGE_SCALE = 1.5;
export const MAX_ROWS = 12;

export const BACKGROUNDS: Record<Exclude<ImageBackground, 'ninguno'>, { src: string; label: string; credit: string }> = {
  nocturna: { src: '/ciutat-nocturna.jpg', label: 'Ciutat de València (de noche)', credit: 'Foto del estadio: TaronjaSatsuma, CC BY-SA 4.0 (Wikimedia Commons).' },
  interior: { src: '/ciutat-interior.jpg', label: 'Ciutat de València (de día)', credit: 'Foto del estadio: Francesc Fort, CC BY-SA 4.0 (Wikimedia Commons).' },
};

export const QUARTER_LABELS = ["1-15'", "16-30'", "31-45'", "46-60'", "61-75'", "76-90'", '90+'];

export const DEFAULT_SPEC: ImageSpec = {
  kicker: 'Estadística · LaLiga 2026/27',
  title: '¿Cuándo',
  titleAccent: 'marca el Levante?',
  subtitle: '16 goles en 11 jornadas, por tramos de 15 minutos. Los picos: del 16 al 30 y en el descuento.',
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
  footer: 'Fuente: https://encuestas-futbol.vercel.app/ismaelete · Goles del Levante en LaLiga (J1–J11); el tramo 90+ incluye el descuento.',
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
  const hasPlayer = Boolean(assets.player);
  if (assets.player) {
    const image = assets.player;
    const height = 420;
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
      ctx.drawImage(layer, W - 10 - width, 225, width, height);
      ctx.restore();
    }
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
  const py = 640;
  const pw = W - 88;
  const ph = 470;
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

// Respuesta de la IA -> especificacion valida (la IA solo rellena datos y textos; el diseno es fijo).
export function sanitizeAiSpec(raw: unknown): Partial<ImageSpec> {
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
  if (source.layout === 'barras' || source.layout === 'ranking') out.layout = source.layout;
  if (typeof source.showPercent === 'boolean') out.showPercent = source.showPercent;
  if (Array.isArray(source.rows)) {
    out.rows = source.rows
      .map((row) => {
        const item = (row ?? {}) as Record<string, unknown>;
        const value = Number(item.value);
        return typeof item.label === 'string' && Number.isFinite(value) && value >= 0 ? { label: item.label.trim().slice(0, 30), value } : null;
      })
      .filter((row): row is ImageRow => row !== null)
      .slice(0, MAX_ROWS);
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
  return out;
}
