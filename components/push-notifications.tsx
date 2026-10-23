'use client';

import { useCallback, useEffect, useState } from 'react';
import { Bell, BellOff, BellRing } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { CommunityUser } from '@/lib/community-types';
import { communityFetch } from '@/lib/community-client';

type PushStatus = 'checking' | 'unavailable' | 'needs-install' | 'unsupported' | 'denied' | 'off' | 'on';

function urlBase64ToUint8Array(value: string): Uint8Array<ArrayBuffer> {
  const padded = `${value}${'='.repeat((4 - (value.length % 4)) % 4)}`.replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index);
  return bytes;
}

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;

// Avisos push del cierre de predicciones: estado del dispositivo y acciones de activar / desactivar.
function usePushReminders(userId: string | undefined) {
  const [status, setStatus] = useState<PushStatus>('checking');
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const update = (next: PushStatus) => { if (!cancelled) setStatus(next); };
    (async () => {
      const config = await fetch('/api/push').then((response) => response.json() as Promise<{ publicKey: string | null }>).catch(() => null);
      if (!config?.publicKey) return update('unavailable');
      if (!cancelled) setPublicKey(config.publicKey);
      // En iPhone solo hay notificaciones push cuando la web se abre desde el icono de la pantalla de inicio.
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
        return update(isIos() && !isStandalone() ? 'needs-install' : 'unsupported');
      }
      if (Notification.permission === 'denied') return update('denied');
      const registration = await navigator.serviceWorker.register('/sw.js').catch(() => null);
      if (!registration) return update('unsupported');
      const subscription = await registration.pushManager.getSubscription();
      update(subscription && Notification.permission === 'granted' ? 'on' : 'off');
    })().catch(() => update('unsupported'));
    return () => { cancelled = true; };
  }, []);

  // Si en este dispositivo ya hay una suscripcion, se vuelve a asociar al usuario con sesion (por si antes entro otra cuenta).
  useEffect(() => {
    if (status !== 'on' || !userId) return;
    void navigator.serviceWorker.getRegistration('/sw.js')
      .then((registration) => registration?.pushManager.getSubscription())
      .then((subscription) => subscription && communityFetch('/api/push', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(subscription.toJSON()),
      }))
      .catch(() => undefined);
  }, [status, userId]);

  const enable = useCallback(async () => {
    if (!publicKey) return;
    setBusy(true);
    setError('');
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setStatus(permission === 'denied' ? 'denied' : 'off');
        return;
      }
      const registration = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      const subscription = (await registration.pushManager.getSubscription())
        ?? (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) }).catch(() => {
          throw new Error('Este navegador no ha permitido activar los avisos. Revisa los permisos de notificaciones o prueba con otro navegador.');
        }));
      const response = await communityFetch('/api/push', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(subscription.toJSON()),
      });
      if (!response.ok) throw new Error(((await response.json().catch(() => ({}))) as { error?: string }).error ?? 'No se pudo activar el aviso.');
      setStatus('on');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'No se pudo activar el aviso.');
    } finally {
      setBusy(false);
    }
  }, [publicKey]);

  const disable = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      const registration = await navigator.serviceWorker.getRegistration('/sw.js');
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await communityFetch('/api/push', {
          method: 'DELETE',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        await subscription.unsubscribe();
      }
      setStatus('off');
    } catch {
      setError('No se pudo desactivar el aviso.');
    } finally {
      setBusy(false);
    }
  }, []);

  return { status, busy, error, enable, disable };
}

// hideWhenOn: en pantallas de paso (Inicio) solo se muestra mientras el aviso no esta activado.
export function PushToggle({ user, compact = false, hideWhenOn = false }: { user: CommunityUser | null; compact?: boolean; hideWhenOn?: boolean }) {
  const { status, busy, error, enable, disable } = usePushReminders(user?.id);
  if (status === 'checking' || status === 'unavailable' || (hideWhenOn && status === 'on')) return null;

  const message: Record<PushStatus, string> = {
    checking: '',
    unavailable: '',
    on: 'Te avisaremos en este dispositivo cuando se acerque el cierre y aún no hayas publicado tu previa.',
    off: 'Recibe un aviso en este dispositivo cuando se acerque el cierre y aún no hayas publicado tu previa.',
    denied: 'Has bloqueado las notificaciones. Para activarlas, permite las notificaciones de esta web en los ajustes del navegador.',
    unsupported: 'Este navegador no admite avisos. Prueba con Chrome, Edge o Firefox.',
    'needs-install': 'En iPhone, primero añade la web a tu pantalla de inicio (Compartir → Añadir a pantalla de inicio) y ábrela desde su icono para activar los avisos.',
  };
  const canAct = status === 'on' || status === 'off';

  return (
    <div className={`flex items-start gap-3 rounded-2xl ${compact ? 'border border-sky-200 bg-sky-50 p-4 text-sky-950' : ''}`}>
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-sky-100 text-[#153e72]">
        {status === 'on' ? <BellRing className="size-5" /> : status === 'off' ? <Bell className="size-5" /> : <BellOff className="size-5" />}
      </span>
      <div className="min-w-0 flex-1">
        <strong className="block font-black text-[#071527]">Avisos de cierre</strong>
        <p className="mt-1 text-sm text-slate-600">{message[status]}</p>
        {canAct && !user && <p className="mt-2 text-xs text-amber-700">Publica tu primera previa para crear tu perfil y poder activar los avisos.</p>}
        {canAct && (
          <Button
            onClick={() => void (status === 'on' ? disable() : enable())}
            disabled={busy || !user}
            variant={status === 'on' ? 'outline' : 'default'}
            className={`mt-3 ${status === 'on' ? '' : 'bg-[#153e72] font-black text-white'}`}
          >
            {busy ? 'Un momento…' : status === 'on' ? 'Desactivar avisos' : 'Avisarme del cierre'}
          </Button>
        )}
        {error && <p role="alert" className="mt-2 text-xs font-bold text-[#a91d43]">{error}</p>}
      </div>
    </div>
  );
}
