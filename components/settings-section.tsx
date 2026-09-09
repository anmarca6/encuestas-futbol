'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Camera, ChevronLeft, Languages, LogOut, Moon, Settings, Sun, SunMedium } from 'lucide-react';
import { useAppPreferences, type AppLanguage, type AppTheme } from '@/components/app-preferences';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Slider } from '@/components/ui/slider';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { CommunityUser } from '@/lib/community-types';

export function SettingsSection({ user, onUserUpdated, onBack, onLogout }: { user: CommunityUser | null; onUserUpdated: (user: CommunityUser) => void; onBack: () => void; onLogout: () => Promise<void> }) {
  const { language, setLanguage, brightness, setBrightness, theme, setTheme } = useAppPreferences();
  const [confirming, setConfirming] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [photoError, setPhotoError] = useState('');

  const logout = async () => {
    setLoggingOut(true);
    await onLogout();
    setLoggingOut(false);
    setConfirming(false);
  };

  const choosePhoto = async (file: File | undefined) => {
    if (!file || !user) return;
    setUploading(true);
    setPhotoError('');
    try {
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('No se pudo procesar la imagen.');
      const scale = Math.max(256 / bitmap.width, 256 / bitmap.height);
      const width = bitmap.width * scale;
      const height = bitmap.height * scale;
      context.drawImage(bitmap, (256 - width) / 2, (256 - height) / 2, width, height);
      bitmap.close();
      const avatarUrl = canvas.toDataURL('image/webp', 0.78);
      const response = await fetch('/api/profile/avatar', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ avatarUrl }),
      });
      const result = await response.json() as { avatarUrl?: string; error?: string };
      if (!response.ok || !result.avatarUrl) throw new Error(result.error ?? 'No se pudo guardar la foto.');
      onUserUpdated({ ...user, avatarUrl: result.avatarUrl });
    } catch (error) {
      setPhotoError(error instanceof Error ? error.message : 'No se pudo guardar la foto.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <div className="mb-7 flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={onBack} aria-label="Volver al perfil"><ChevronLeft /></Button>
        <div>
          <p className="text-xs font-black uppercase tracking-[.2em] text-[#a91d43]">Granota App</p>
          <h1 className="mt-1 flex items-center gap-2 text-3xl font-black text-[#071527]"><Settings className="size-7" /> Ajustes de la app</h1>
        </div>
      </div>

      <div className="mx-auto max-w-2xl space-y-5">
        <Card className="border-0 shadow-sm ring-slate-200">
          <CardContent className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
            <span className="grid size-24 shrink-0 place-items-center overflow-hidden rounded-full bg-rose-100 text-2xl font-black text-[#a91d43] ring-4 ring-white">
              {user?.avatarUrl ? <Image unoptimized src={user.avatarUrl} width={96} height={96} alt="Foto de perfil" className="h-full w-full object-cover" /> : user ? user.nickname.slice(0, 2).toUpperCase() : <Camera />}
            </span>
            <div className="flex-1">
              <h2 className="text-lg font-black text-[#071527]">Foto de perfil</h2>
              <p className="mt-1 text-sm text-slate-500">Se mostrará en tu perfil, La Grada y la clasificación.</p>
              <label className={`mt-3 inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#153e72] px-4 py-2 text-sm font-black text-white ${user ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}>
                <Camera className="size-4" /> {uploading ? 'Guardando…' : 'Elegir foto'}
                <input type="file" accept="image/jpeg,image/png,image/webp" disabled={!user || uploading} className="sr-only" onChange={(event) => void choosePhoto(event.target.files?.[0])} />
              </label>
              {!user && <p className="mt-2 text-xs text-amber-700">Publica una predicción para crear primero tu perfil.</p>}
              {photoError && <p role="alert" className="mt-2 text-xs font-bold text-[#a91d43]">{photoError}</p>}
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm ring-slate-200">
          <CardContent className="space-y-5">
            <div className="flex items-start gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-sky-100 text-[#153e72]"><Languages /></span>
              <div><h2 className="text-lg font-black text-[#071527]">Idioma</h2><p className="text-sm text-slate-500">Elige el idioma de toda la interfaz.</p></div>
            </div>
            <RadioGroup value={language} onValueChange={(value) => setLanguage(value as AppLanguage)}>
              {[['es', 'Español'], ['val', 'Valenciano']].map(([value, label]) => (
                <label key={value} className="flex min-h-12 cursor-pointer items-center justify-between rounded-xl border border-slate-200 px-4 py-3 font-bold text-[#071527]">
                  {label}<RadioGroupItem value={value} />
                </label>
              ))}
            </RadioGroup>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm ring-slate-200">
          <CardContent className="space-y-5">
            <div className="flex items-start gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-indigo-100 text-indigo-700"><Moon /></span>
              <div><h2 className="text-lg font-black text-[#071527]">Apariencia</h2><p className="text-sm text-slate-500">Elige cómo quieres ver la aplicación.</p></div>
            </div>
            <RadioGroup value={theme} onValueChange={(value) => setTheme(value as AppTheme)} className="grid-cols-2">
              <label htmlFor="theme-light" className="flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border border-slate-200 px-4 font-bold text-[#071527]"><Sun className="size-5 text-amber-500" /> Light Mode <RadioGroupItem id="theme-light" value="light" className="ml-auto" /></label>
              <label htmlFor="theme-dark" className="flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border border-slate-200 px-4 font-bold text-[#071527]"><Moon className="size-5 text-indigo-500" /> Dark Mode <RadioGroupItem id="theme-dark" value="dark" className="ml-auto" /></label>
            </RadioGroup>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm ring-slate-200">
          <CardContent>
            <div className="flex items-start gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-700"><SunMedium /></span>
              <div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-3"><h2 className="text-lg font-black text-[#071527]">Brillo</h2><strong className="text-[#a91d43]">{brightness}%</strong></div><p className="text-sm text-slate-500">Ajusta la intensidad visual de la aplicación.</p></div>
            </div>
            <Slider min={70} max={120} step={5} value={[brightness]} onValueChange={(value) => setBrightness(Array.isArray(value) ? value[0] : value)} className="mt-7" aria-label="Brillo de la aplicación" />
            <div className="mt-3 flex justify-between text-xs font-bold text-slate-400"><span>70%</span><span>100%</span><span>120%</span></div>
          </CardContent>
        </Card>

        <div className="border-t border-slate-200 pt-5">
          <Button variant="outline" onClick={() => setConfirming(true)} className="h-12 w-full border-rose-200 font-black text-[#a91d43] hover:bg-rose-50"><LogOut /> Cerrar sesión</Button>
        </div>
      </div>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogMedia className="bg-rose-100 text-[#a91d43]"><LogOut /></AlertDialogMedia><AlertDialogTitle className="font-black">¿Quieres cerrar sesión?</AlertDialogTitle><AlertDialogDescription>Tu perfil, predicciones, puntos y preferencias seguirán guardados.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction disabled={loggingOut} onClick={() => void logout()} className="bg-[#a91d43] text-white">{loggingOut ? 'Cerrando…' : 'Cerrar sesión'}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
