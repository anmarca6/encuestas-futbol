import webpush from 'web-push';
import { ensureCommunitySchema, getDatabase } from '@/lib/db';
import { nextOpenMatch } from '@/lib/prediction-state';
import { getPredictionDeadline } from '@/lib/prediction-deadline';
import { DEFAULT_COMMUNITY_SLUG } from '@/lib/community-shared';

const HOUR = 60 * 60 * 1000;

// Los avisos solo funcionan si estan las claves VAPID; sin ellas la app se comporta como antes (no se ofrece activarlos).
export function vapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY ? process.env.VAPID_PUBLIC_KEY : null;
}

function configureWebPush(): boolean {
  if (!vapidPublicKey()) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'https://encuestas-futbol.vercel.app', process.env.VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
  return true;
}

interface SubscriptionRow {
  endpoint: string;
  p256dh: string;
  auth: string;
  userId: string;
}

// Tramo de aviso segun el tiempo que queda: "3h" (menos de 3 horas) o "24h" (menos de un dia). Fuera de esos tramos no se avisa.
export function reminderKind(remainingMs: number): '3h' | '24h' | null {
  if (remainingMs <= 0) return null;
  if (remainingMs <= 3 * HOUR) return '3h';
  if (remainingMs <= 24 * HOUR) return '24h';
  return null;
}

export function describeRemaining(remainingMs: number): string {
  const minutes = Math.max(1, Math.round(remainingMs / 60000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(remainingMs / HOUR);
  return hours === 1 ? '1 hora' : `${hours} horas`;
}

export interface ReminderSummary {
  communities: number;
  sent: number;
  failed: number;
  removed: number;
  skipped?: string;
}

// Avisa a quien tiene el aviso activado y aun no ha publicado la prediccion del proximo partido de su comunidad.
// Es idempotente: cada usuario recibe como mucho un aviso por tramo y partido, asi que se puede llamar con la frecuencia que se quiera.
export async function sendClosingReminders(now = new Date()): Promise<ReminderSummary> {
  const summary: ReminderSummary = { communities: 0, sent: 0, failed: 0, removed: 0 };
  if (!configureWebPush()) return { ...summary, skipped: 'Faltan las claves VAPID.' };
  await ensureCommunitySchema();
  const db = getDatabase();
  const communities = await db.prepare('SELECT slug FROM communities').bind().all<{ slug: string }>();
  for (const { slug } of communities.results) {
    const match = await nextOpenMatch(slug);
    const deadline = match ? getPredictionDeadline(match) : null;
    if (!match || !deadline) continue;
    const kind = reminderKind(deadline.getTime() - now.getTime());
    if (!kind) continue;
    summary.communities += 1;
    const remaining = deadline.getTime() - now.getTime();
    const pending = await db.prepare(`
      SELECT s.endpoint, s.p256dh, s.auth, s.user_id AS userId
      FROM push_subscriptions s
      WHERE s.community_slug = ?
        AND NOT EXISTS (SELECT 1 FROM predictions p WHERE p.user_id = s.user_id AND p.match_id = ?)
        AND NOT EXISTS (SELECT 1 FROM push_reminders_sent r WHERE r.user_id = s.user_id AND r.match_id = ? AND r.kind = ?)
    `).bind(slug, match.id, match.id, kind).all<SubscriptionRow>();
    const payload = JSON.stringify({
      title: 'Se acerca el cierre de la porra',
      body: `${match.homeTeam} - ${match.awayTeam}: quedan ${describeRemaining(remaining)} para publicar tu previa.`,
      url: slug === DEFAULT_COMMUNITY_SLUG ? '/' : `/${slug}`,
      tag: `cierre-${match.id}`,
    });
    const notified = new Set<string>();
    for (const row of pending.results) {
      try {
        await webpush.sendNotification({ endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } }, payload, { TTL: Math.max(60, Math.floor(remaining / 1000)) });
        summary.sent += 1;
        notified.add(row.userId);
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        // 404/410: el dispositivo ya no existe (desinstalado o permiso retirado): se olvida su suscripcion.
        if (status === 404 || status === 410) {
          await db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').bind(row.endpoint).run();
          summary.removed += 1;
        } else {
          summary.failed += 1;
        }
      }
    }
    // El aviso de 3 h tambien cubre al de 24 h: asi quien se suscribe tarde no recibe dos avisos seguidos.
    const kinds = kind === '3h' ? ['24h', '3h'] : ['24h'];
    for (const userId of notified) {
      for (const sentKind of kinds) {
        await db.prepare('INSERT OR IGNORE INTO push_reminders_sent (user_id, match_id, kind, sent_at) VALUES (?, ?, ?, ?)').bind(userId, match.id, sentKind, now.getTime()).run();
      }
    }
  }
  return summary;
}
