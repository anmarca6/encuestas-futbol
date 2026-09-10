'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { CommunityUser } from '@/lib/community-types';

export function Registration({
  open,
  onOpenChange,
  onRegistered,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRegistered: (user: CommunityUser) => void;
}) {
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setError('');
  }, [open]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const data = new FormData(event.currentTarget);
      const response = await fetch('/api/session', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          nickname: data.get('nickname'),
          password: data.get('password'),
        }),
      });
      const result = (await response.json()) as {
        user?: CommunityUser;
        error?: string;
      };
      if (!response.ok || !result.user) {
        setError(result.error ?? 'No se pudo completar el registro.');
        return;
      }
      setError('');
      onRegistered(result.user);
    } catch {
      setError(
        'No se pudo conectar con la app. Vuelve a intentarlo en unos segundos.',
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader className="text-left">
          <p className="text-xs font-black uppercase tracking-[.2em] text-[#a91d43]">
            Granota App
          </p>
          <DialogTitle className="text-2xl font-black text-[#071527]">
            Inicia sesión o crea tu cuenta
          </DialogTitle>
          <DialogDescription>
            La primera vez, crea tu cuenta con una contraseña. La necesitarás
            para volver a entrar.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          <label className="block text-sm font-bold text-[#071527]">
            Apodo
            <div className="relative mt-1.5">
              <span className="absolute left-3 top-2.5 font-black text-slate-400">
                @
              </span>
              <Input
                name="nickname"
                required
                minLength={2}
                maxLength={30}
                className="pl-8"
                placeholder="apodo_granota"
                onChange={() => setError('')}
              />
            </div>
          </label>
          <label className="block text-sm font-bold text-[#071527]">
            Contraseña
            <Input
              name="password"
              type="password"
              required
              minLength={4}
              className="mt-1.5"
              placeholder="••••••"
              onChange={() => setError('')}
            />
          </label>
          {error && (
            <p
              role="alert"
              className="rounded-xl bg-rose-50 p-3 text-sm font-bold text-[#a91d43]"
            >
              {error}
            </p>
          )}
          <Button
            type="submit"
            disabled={saving}
            className="h-12 w-full bg-[#a91d43] font-black text-white"
          >
            {saving ? 'Entrando…' : 'Entrar'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
