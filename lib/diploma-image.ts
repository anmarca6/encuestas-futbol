import qrcode from 'qrcode-generator';
import {
  BACKGROUNDS,
  BODY_FONT,
  HEAD_FONT,
  IMAGE_HEIGHT,
  IMAGE_SCALE,
  IMAGE_WIDTH,
  MUTE,
  RED,
  RED_LIGHT,
  fitFont,
  roundRect,
  setSpacing,
  wrap,
  type Ctx,
} from '@/lib/image-generator';

// Diploma de cada usuario: su posicion en la clasificacion de la comunidad tras la ultima jornada, con un boton "Participa" y un QR que llevan a la app.
// Se dibuja en el navegador con el mismo estilo que las imagenes del generador del administrador.
export interface DiplomaData {
  nickname: string;
  position: number;
  total: number;
  points: number;
  // Puntos de la ultima jornada (null si no pronostico).
  matchdayPoints: number | null;
  // Puestos que ha subido (+) o bajado (-) en esa jornada; null si debuta en ella.
  movement: number | null;
  predictions: number;
  // "Tras la jornada 12", "Tras la Copa del Rey"...
  edition: string;
  communityName: string;
  // Direccion que se muestra y codifica el QR.
  url: string;
  displayUrl: string;
}

export interface DiplomaAssets {
  background: HTMLImageElement | null;
  avatar: HTMLImageElement | null;
}

// "5.º" -> numero ordinal femenino/masculino en castellano no hace falta: siempre "{n}.º".
export const ordinal = (position: number) => `${position}.º`;

// Foto de perfil: si no se puede dibujar sin ensuciar el lienzo (otro dominio sin permiso), se usan las iniciales.
export function loadAvatar(src: string | null | undefined): Promise<HTMLImageElement | null> {
  if (!src) return Promise.resolve(null);
  return new Promise((resolve) => {
    const image = new window.Image();
    if (!src.startsWith('data:')) image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

function drawQr(ctx: Ctx, text: string, x: number, y: number, size: number) {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const count = qr.getModuleCount();
  const cell = size / count;
  ctx.fillStyle = '#071527';
  for (let row = 0; row < count; row += 1) {
    for (let column = 0; column < count; column += 1) {
      if (qr.isDark(row, column)) ctx.fillRect(x + column * cell, y + row * cell, Math.ceil(cell), Math.ceil(cell));
    }
  }
}

export function renderDiploma(canvas: HTMLCanvasElement, data: DiplomaData, assets: DiplomaAssets) {
  canvas.width = IMAGE_WIDTH * IMAGE_SCALE;
  canvas.height = IMAGE_HEIGHT * IMAGE_SCALE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(IMAGE_SCALE, 0, 0, IMAGE_SCALE, 0, 0);
  const W = IMAGE_WIDTH;
  const H = IMAGE_HEIGHT;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';

  // Fondo: el estadio de noche, oscurecido, y un resplandor granate arriba a la izquierda.
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
    shade.addColorStop(0, 'rgba(5,11,24,.6)');
    shade.addColorStop(0.45, 'rgba(5,11,24,.3)');
    shade.addColorStop(0.7, 'rgba(5,11,24,.55)');
    shade.addColorStop(1, 'rgba(5,11,24,.92)');
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, W, H);
  } else {
    const base = ctx.createLinearGradient(0, 0, 0, H);
    base.addColorStop(0, '#0b1a36');
    base.addColorStop(1, '#050b18');
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, W, H);
  }
  const glow = ctx.createRadialGradient(160, 120, 0, 160, 120, 600);
  glow.addColorStop(0, 'rgba(169,29,67,.4)');
  glow.addColorStop(1, 'rgba(169,29,67,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Cabecera
  ctx.fillStyle = RED;
  ctx.fillRect(64, 54, 44, 4);
  ctx.fillStyle = RED_LIGHT;
  ctx.font = `800 22px ${HEAD_FONT}`;
  setSpacing(ctx, 4.4);
  ctx.fillText('DIPLOMA GRANOTA · LALIGA 2026/27', 124, 64);
  ctx.fillStyle = '#fff';
  ctx.font = `800 36px ${HEAD_FONT}`;
  setSpacing(ctx, 3);
  ctx.fillText(data.edition.toUpperCase(), 64, 150);
  setSpacing(ctx, 0);

  // Posicion: lo mas grande de la imagen.
  ctx.shadowColor = 'rgba(0,0,0,.6)';
  ctx.shadowBlur = 28;
  ctx.shadowOffsetY = 8;
  const position = ordinal(data.position).toUpperCase();
  const ofText = `DE ${data.total}`;
  ctx.font = `900 300px ${HEAD_FONT}`;
  const positionWidth = ctx.measureText(position).width;
  ctx.fillStyle = RED_LIGHT;
  ctx.fillText(position, 64, 420);
  const restWidth = W - 64 - 64 - positionWidth - 24;
  const ofSize = fitFont(ctx, ofText, 900, 130, HEAD_FONT, Math.max(restWidth, 200), 56);
  ctx.font = `900 ${ofSize}px ${HEAD_FONT}`;
  ctx.fillStyle = '#fff';
  ctx.fillText(ofText, 64 + positionWidth + 24, 420);
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  const ahead = data.total > 1 ? Math.round(((data.total - data.position) / (data.total - 1)) * 100) : 0;
  ctx.fillStyle = '#e4ecf9';
  ctx.font = `500 28px ${BODY_FONT}`;
  const line = data.position === 1
    ? `Líder de la porra granota de ${data.communityName}. ¿Quién me tose?`
    : `En la porra granota de ${data.communityName}, por delante del ${ahead} % de la comunidad.`;
  wrap(ctx, line, 952).slice(0, 2).forEach((text, index) => ctx.fillText(text, 64, 476 + index * 36));

  // Panel: quien es y sus numeros.
  const px = 44;
  const py = 570;
  const pw = W - 88;
  const ph = 330;
  const panel = ctx.createLinearGradient(0, py, 0, py + ph);
  panel.addColorStop(0, 'rgba(10,22,48,.7)');
  panel.addColorStop(1, 'rgba(6,14,30,.86)');
  roundRect(ctx, px, py, pw, ph, 30);
  ctx.fillStyle = panel;
  ctx.fill();
  ctx.strokeStyle = 'rgba(160,190,240,.3)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Avatar y nombre
  const avatarSize = 112;
  const ax = px + 36;
  const ay = py + 32;
  ctx.save();
  ctx.beginPath();
  ctx.arc(ax + avatarSize / 2, ay + avatarSize / 2, avatarSize / 2 + 5, 0, Math.PI * 2);
  ctx.fillStyle = RED;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(ax + avatarSize / 2, ay + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
  ctx.clip();
  if (assets.avatar) {
    const side = Math.min(assets.avatar.naturalWidth, assets.avatar.naturalHeight);
    ctx.drawImage(assets.avatar, (assets.avatar.naturalWidth - side) / 2, (assets.avatar.naturalHeight - side) / 2, side, side, ax, ay, avatarSize, avatarSize);
  } else {
    ctx.fillStyle = '#fde4ea';
    ctx.fillRect(ax, ay, avatarSize, avatarSize);
    ctx.fillStyle = RED;
    ctx.font = `900 56px ${HEAD_FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(data.nickname.slice(0, 2).toUpperCase(), ax + avatarSize / 2, ay + avatarSize / 2 + 20);
    ctx.textAlign = 'left';
  }
  ctx.restore();
  const nameX = ax + avatarSize + 28;
  ctx.fillStyle = '#fff';
  fitFont(ctx, `@${data.nickname}`, 900, 62, HEAD_FONT, px + pw - 36 - nameX, 32);
  ctx.fillText(`@${data.nickname}`, nameX, ay + 62);
  ctx.fillStyle = MUTE;
  ctx.font = `700 22px ${BODY_FONT}`;
  ctx.fillText(`${data.predictions} ${data.predictions === 1 ? 'pronóstico' : 'pronósticos'} publicados`, nameX, ay + 100);

  // Tarjetas
  const movement = data.movement;
  const cards: Array<{ value: string; text: string }> = [
    { value: String(data.points), text: data.points === 1 ? 'punto en la temporada' : 'puntos en la temporada' },
    {
      value: data.matchdayPoints === null ? '—' : `+${data.matchdayPoints}`,
      text: data.matchdayPoints === null ? 'no pronostiqué la última jornada' : 'puntos en la última jornada',
    },
    movement === null
      ? { value: 'NUEVO', text: 'debutando en la clasificación' }
      : movement > 0
        ? { value: `▲ ${movement}`, text: movement === 1 ? 'puesto escalado esta jornada' : 'puestos escalados esta jornada' }
        : movement < 0
          ? { value: `▼ ${Math.abs(movement)}`, text: Math.abs(movement) === 1 ? 'puesto perdido esta jornada' : 'puestos perdidos esta jornada' }
          : { value: '=', text: 'mantengo mi puesto esta jornada' },
  ];
  const gap = 16;
  const cw = (pw - 72 - gap * 2) / 3;
  const ch = 130;
  cards.forEach((card, index) => {
    const cx = px + 36 + index * (cw + gap);
    const cy = py + ph - ch - 28;
    const red = index === 0;
    const fill = ctx.createLinearGradient(cx, cy, cx + cw, cy + ch);
    fill.addColorStop(0, red ? 'rgba(225,29,72,.92)' : 'rgba(28,108,214,.88)');
    fill.addColorStop(1, red ? 'rgba(130,15,45,.96)' : 'rgba(11,61,130,.94)');
    roundRect(ctx, cx, cy, cw, ch, 22);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = red ? 'rgba(255,160,180,.45)' : 'rgba(160,200,255,.35)';
    ctx.stroke();
    ctx.fillStyle = '#fff';
    const size = fitFont(ctx, card.value, 900, 62, HEAD_FONT, cw - 36, 30);
    ctx.font = `900 ${size}px ${HEAD_FONT}`;
    ctx.fillText(card.value, cx + 18, cy + 14 + size * 0.82);
    ctx.fillStyle = '#eaf1ff';
    ctx.font = `700 17px ${BODY_FONT}`;
    wrap(ctx, card.text, cw - 36).slice(0, 2).forEach((text, lineIndex) => ctx.fillText(text, cx + 18, cy + 96 + lineIndex * 20));
  });

  // Llamada a la accion: boton PARTICIPA y QR.
  ctx.fillStyle = '#fff';
  ctx.font = `900 46px ${HEAD_FONT}`;
  ctx.shadowColor = 'rgba(0,0,0,.6)';
  ctx.shadowBlur = 18;
  ctx.fillText('¿TE ATREVES A SUPERARME?', 64, 970);
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#dbe6f8';
  ctx.font = `500 25px ${BODY_FONT}`;
  ctx.fillText('Pronostica el próximo partido del Levante UD', 64, 1008);

  const bx = 64;
  const by = 1044;
  const bw = 600;
  const bh = 150;
  ctx.save();
  ctx.shadowColor = 'rgba(255,90,122,.6)';
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 10;
  const button = ctx.createLinearGradient(bx, by, bx, by + bh);
  button.addColorStop(0, RED_LIGHT);
  button.addColorStop(1, '#b3173f');
  roundRect(ctx, bx, by, bw, bh, 40);
  ctx.fillStyle = button;
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,.55)';
  ctx.lineWidth = 3;
  roundRect(ctx, bx + 1.5, by + 1.5, bw - 3, bh - 3, 38);
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.font = `900 104px ${HEAD_FONT}`;
  setSpacing(ctx, 6);
  ctx.textAlign = 'center';
  ctx.fillText('PARTICIPA', bx + bw / 2, by + 110);
  ctx.textAlign = 'left';
  setSpacing(ctx, 0);
  ctx.fillStyle = '#e4ecf9';
  ctx.font = `700 24px ${BODY_FONT}`;
  ctx.fillText(data.displayUrl, bx + 8, by + bh + 42);

  // QR
  const qrSize = 214;
  const qx = W - 64 - qrSize - 20;
  const qy = 1034;
  roundRect(ctx, qx - 16, qy - 16, qrSize + 32, qrSize + 32, 26);
  ctx.fillStyle = '#fff';
  ctx.fill();
  drawQr(ctx, data.url, qx, qy, qrSize);
  ctx.fillStyle = MUTE;
  ctx.font = `800 20px ${HEAD_FONT}`;
  setSpacing(ctx, 3);
  ctx.textAlign = 'center';
  ctx.fillText('ESCANEA Y JUEGA', qx + qrSize / 2, qy + qrSize + 56);
  ctx.textAlign = 'left';
  setSpacing(ctx, 0);

  // Pie: credito de la foto de fondo (licencia CC BY-SA).
  if (assets.background) {
    ctx.fillStyle = '#8aa0c4';
    ctx.font = `500 13px ${BODY_FONT}`;
    ctx.fillText(BACKGROUNDS.nocturna.credit, 64, H - 22);
  }
}
