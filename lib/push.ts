import webpush from 'web-push';
import { ensureCommunitySchema, getDatabase } from '@/lib/db';
import { DEFAULT_COMMUNITY_SLUG } from '@/lib/community-shared';

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
}

export interface PushAudience {
  configured: boolean;
  devices: number;
  users: number;
}

// Cuantos dispositivos y usuarios de la comunidad tienen los avisos activados.
export async function communityPushAudience(communitySlug: string): Promise<PushAudience> {
  await ensureCommunitySchema();
  const row = await getDatabase().prepare(
    'SELECT COUNT(*) AS devices, COUNT(DISTINCT user_id) AS users FROM push_subscriptions WHERE community_slug = ?',
  ).bind(communitySlug).first<{ devices: number; users: number }>();
  return { configured: vapidPublicKey() !== null, devices: row?.devices ?? 0, users: row?.users ?? 0 };
}

export interface PushSendResult {
  configured: boolean;
  devices: number;
  sent: number;
  failed: number;
  removed: number;
  // Fallos agrupados por servicio de notificaciones (Apple, Google...) y codigo de respuesta, para saber por que no llega un aviso.
  errors: Array<{ service: string; status: number | null; count: number; message: string }>;
}

const serviceName = (endpoint: string) => {
  try {
    return new URL(endpoint).hostname;
  } catch {
    return 'desconocido';
  }
};

// Envia un aviso manual a todos los dispositivos de la comunidad que lo tienen activado.
export async function sendPushToCommunity(communitySlug: string, message: { title: string; body: string }): Promise<PushSendResult> {
  const result: PushSendResult = { configured: false, devices: 0, sent: 0, failed: 0, removed: 0, errors: [] };
  if (!configureWebPush()) return result;
  result.configured = true;
  await ensureCommunitySchema();
  const db = getDatabase();
  const rows = await db.prepare('SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE community_slug = ?').bind(communitySlug).all<SubscriptionRow>();
  result.devices = rows.results.length;
  const payload = JSON.stringify({
    title: message.title,
    body: message.body,
    url: communitySlug === DEFAULT_COMMUNITY_SLUG ? '/' : `/${communitySlug}`,
    // Etiqueta unica: dos avisos seguidos no se pisan entre si.
    tag: `aviso-${Date.now()}`,
  });
  const errors = new Map<string, PushSendResult['errors'][number]>();
  // De 10 en 10, para no tardar demasiado con muchos dispositivos.
  for (let start = 0; start < rows.results.length; start += 10) {
    await Promise.all(rows.results.slice(start, start + 10).map(async (row) => {
      try {
        await webpush.sendNotification({ endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } }, payload, { TTL: 24 * 60 * 60, urgency: 'high' });
        result.sent += 1;
      } catch (error) {
        const failure = error as { statusCode?: number; body?: string; message?: string };
        const status = failure.statusCode ?? null;
        // 404/410: el dispositivo ya no existe (desinstalado o permiso retirado): se olvida su suscripcion.
        if (status === 404 || status === 410) {
          await db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').bind(row.endpoint).run();
          result.removed += 1;
          return;
        }
        result.failed += 1;
        const service = serviceName(row.endpoint);
        const key = `${service}|${status}`;
        const entry = errors.get(key) ?? { service, status, count: 0, message: (failure.body || failure.message || '').slice(0, 160) };
        entry.count += 1;
        errors.set(key, entry);
      }
    }));
  }
  result.errors = [...errors.values()];
  return result;
}
