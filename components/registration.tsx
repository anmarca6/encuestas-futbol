'use client';

import { FormEvent, useState } from 'react';
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
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const data = new FormData(event.currentTarget);
      const response = await fetch('/api/session', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ nickname: data.get('nickname') }),
      });
      const result = (await response.json()) as {
        user?: CommunityUser;
        error?: string;
      };
      if (!response.ok || !result.user) {
        setError(result.error ?? 'No se pudo completar el registro.');
        return;
      }
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
            Elige tu apodo para publicar
          </DialogTitle>
          <DialogDescription>
            Tu apodo será visible para todos los usuarios en La Grada.
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
              />
            </div>
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
            {saving ? 'Guardando tu apodo…' : 'Publicar en La Grada'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
