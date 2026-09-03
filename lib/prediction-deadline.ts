import type { LevanteMatch } from '@/lib/levante-data';

const MADRID_TIME_ZONE = 'Europe/Madrid';

function madridDateTimeToUtc(date: string, time: string): Date {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const desired = Date.UTC(year, month - 1, day, hour, minute);
  let utc = desired;
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: MADRID_TIME_ZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  });
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const parts = Object.fromEntries(
      formatter.formatToParts(new Date(utc)).map((part) => [part.type, part.value]),
    );
    const displayed = Date.UTC(
      Number(parts.year), Number(parts.month) - 1, Number(parts.day),
      Number(parts.hour), Number(parts.minute),
    );
    utc += desired - displayed;
  }
  return new Date(utc);
}

export function getPredictionDeadline(match: LevanteMatch): Date | null {
  if (!match.kickoffTime) return null;
  return new Date(madridDateTimeToUtc(match.date, match.kickoffTime).getTime() - 2 * 60 * 60 * 1000);
}

export function isPredictionClosed(match: LevanteMatch, now = new Date()): boolean {
  const deadline = getPredictionDeadline(match);
  return deadline ? now >= deadline : false;
}

export function formatPredictionDeadline(match: LevanteMatch): string {
  const deadline = getPredictionDeadline(match);
  if (!deadline) return '2 horas antes del horario oficial del partido';
  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'long', timeStyle: 'short', timeZone: MADRID_TIME_ZONE,
  }).format(deadline);
}
