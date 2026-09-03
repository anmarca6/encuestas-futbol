'use client';

import { FormEvent, useState } from 'react';
import { Mail, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TeamCrest } from '@/components/shared';
import type { CommunityUser } from '@/lib/community-types';

export function Registration({ onRegistered }: { onRegistered: (user: CommunityUser) => void }) {
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setError('');
    try {
      const data = new FormData(event.currentTarget);
      const response = await fetch('/api/session', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: data.get('name'), nickname: data.get('nickname'), email: data.get('email') }),
      });
      const result = await response.json() as { user?: CommunityUser; error?: string };
      if (!response.ok || !result.user) {
        setError(result.error ?? 'No se pudo completar el registro.');
        return;
      }
      onRegistered(result.user);
    } catch {
      setError('No se pudo conectar con la app. Vuelve a intentarlo en unos segundos.');
    } finally {
      setSaving(false);
    }
  }
  return (
    <main className="grid min-h-screen place-items-center bg-[#071527] px-4 py-10">
      <Card className="w-full max-w-md border-0 shadow-2xl ring-0">
        <CardHeader className="items-center text-center">
          <TeamCrest teamName="Levante UD" size="xl" bare />
          <p className="mt-3 text-xs font-black uppercase tracking-[.2em] text-[#a91d43]">Granota App</p>
          <CardTitle className="text-3xl font-black tracking-tight text-[#071527]">Únete a la grada</CardTitle>
          <p className="text-sm leading-6 text-slate-500">Regístrate para publicar tus predicciones y compartirlas con la afición.</p>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={submit}>
            <label className="block text-sm font-bold text-[#071527]">Nombre
              <div className="relative mt-1.5"><UserRound className="absolute left-3 top-3 size-4 text-slate-400"/><Input name="name" required minLength={2} maxLength={80} autoComplete="name" className="pl-9" placeholder="Tu nombre" /></div>
            </label>
            <label className="block text-sm font-bold text-[#071527]">Apodo
              <div className="relative mt-1.5"><span className="absolute left-3 top-2.5 font-black text-slate-400">@</span><Input name="nickname" required minLength={2} maxLength={30} className="pl-8" placeholder="apodo_granota" /></div>
            </label>
            <label className="block text-sm font-bold text-[#071527]">Correo electrónico
              <div className="relative mt-1.5"><Mail className="absolute left-3 top-3 size-4 text-slate-400"/><Input name="email" required type="email" maxLength={160} autoComplete="email" className="pl-9" placeholder="tu@correo.com" /></div>
            </label>
            {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm font-bold text-[#a91d43]">{error}</p>}
            <Button disabled={saving} className="h-12 w-full bg-[#a91d43] font-black text-white">{saving ? 'Creando tu perfil…' : 'Entrar en Granota App'}</Button>
          </form>
          <p className="mt-4 text-center text-xs leading-5 text-slate-400">Usaremos estos datos para identificar tus predicciones en La Grada.</p>
        </CardContent>
      </Card>
    </main>
  );
}
