'use client';

import { useState } from 'react';
import { ChevronLeft, Languages, LogOut, Settings, SunMedium } from 'lucide-react';
import { useAppPreferences, type AppLanguage } from '@/components/app-preferences';
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

export function SettingsSection({ onBack, onLogout }: { onBack: () => void; onLogout: () => Promise<void> }) {
  const { language, setLanguage, brightness, setBrightness } = useAppPreferences();
  const [confirming, setConfirming] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const logout = async () => {
    setLoggingOut(true);
    await onLogout();
    setLoggingOut(false);
    setConfirming(false);
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
