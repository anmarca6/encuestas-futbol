'use client';

import { useMemo, useState } from 'react';
import { Award, Check, ChevronLeft, ChevronRight, Goal, Loader2, Send, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { LineupBuilder, PlayerPhoto } from '@/components/lineup-builder';
import { TeamCrest } from '@/components/shared';
import { LEVANTE_TEAM, levantePlayers } from '@/lib/levante-data';
import { getNextLevanteMatch } from '@/lib/levante-services';
import { formationOptions, type FormationId, type SavedLineup } from '@/lib/formations';
import type { CommunityUser } from '@/lib/community-types';
import type { PredictionDraft } from '@/lib/prediction-types';

const stepNames = ['Formación', 'Tu XI', 'Resultado', 'Goleadores', 'MVP', 'Publicar'];

function ScorePicker({ team, value, onChange }: { team: string; value: number; onChange: (value: number) => void }) {
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <TeamCrest teamName={team} size="lg" />
      <strong>{team}</strong>
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" onClick={() => onChange(Math.max(0, value - 1))} aria-label={`Restar gol a ${team}`}>−</Button>
        <span className="w-12 text-center text-4xl font-black">{value}</span>
        <Button variant="outline" size="icon" onClick={() => onChange(Math.min(20, value + 1))} aria-label={`Sumar gol a ${team}`}>+</Button>
      </div>
    </div>
  );
}

export function PredictionWizard({
  open,
  onOpenChange,
  user,
  onRegistered,
  onPublished,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: CommunityUser | null;
  onRegistered: (user: CommunityUser) => void;
  onPublished: () => void;
}) {
  const match = getNextLevanteMatch();
  const [step, setStep] = useState(0);
  const [formation, setFormation] = useState<FormationId>('4-3-3');
  const [lineup, setLineup] = useState<SavedLineup | null>(null);
  const [home, setHome] = useState(0);
  const [away, setAway] = useState(0);
  const [scorerCounts, setScorerCounts] = useState<Record<string, number>>({});
  const [mvp, setMvp] = useState<string | null>(null);
  const [nickname, setNickname] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState('');
  const [published, setPublished] = useState(false);

  const levanteGoals = match?.homeTeam === LEVANTE_TEAM ? home : away;
  const selectedGoals = useMemo(
    () => Object.values(scorerCounts).reduce((total, count) => total + count, 0),
    [scorerCounts],
  );
  const scorers = useMemo(
    () => Object.entries(scorerCounts).flatMap(([playerId, count]) => Array(count).fill(playerId) as string[]),
    [scorerCounts],
  );

  if (!match) return null;

  const changeScorer = (playerId: string, delta: number) => {
    setScorerCounts((current) => {
      const nextCount = Math.max(0, (current[playerId] ?? 0) + delta);
      if (delta > 0 && selectedGoals >= levanteGoals) return current;
      const next = { ...current };
      if (nextCount === 0) delete next[playerId];
      else next[playerId] = nextCount;
      return next;
    });
  };

  const publish = async () => {
    setPublishing(true);
    setError('');
    try {
      let currentUser = user;
      if (!currentUser) {
        const sessionResponse = await fetch('/api/session', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ nickname }),
        });
        const sessionResult = (await sessionResponse.json()) as { user?: CommunityUser; error?: string };
        if (!sessionResponse.ok || !sessionResult.user) throw new Error(sessionResult.error ?? 'No se pudo guardar el apodo.');
        currentUser = sessionResult.user;
        onRegistered(currentUser);
      }
      const response = await fetch('/api/predictions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          matchId: match.id,
          predictedScore: { home, away },
          lineup,
          scorers,
          mvp,
        } satisfies PredictionDraft),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? 'No se pudo publicar la predicción.');
      setPublished(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo publicar la predicción.');
    } finally {
      setPublishing(false);
    }
  };

  const canContinue = step !== 3 || selectedGoals === levanteGoals;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="max-h-[92dvh] overflow-y-auto p-0 sm:max-w-4xl">
        <DialogHeader className="sticky top-0 z-20 border-b bg-white px-5 py-4 pr-16">
          <DialogClose
            render={<Button variant="outline" size="icon" className="absolute right-4 top-4 rounded-full bg-white shadow-sm" />}
          >
            <X />
            <span className="sr-only">Salir de la predicción</span>
          </DialogClose>
          <div className="flex items-center justify-between gap-3">
            <div>
              <DialogTitle className="text-xl font-black text-[#071527]">Participa</DialogTitle>
              <DialogDescription>Paso {step + 1} de 6 · {stepNames[step]}</DialogDescription>
            </div>
            <span className="rounded-full bg-[#a91d43] px-3 py-1 text-xs font-black text-white">J{match.matchday}</span>
          </div>
          <div className="grid grid-cols-6 gap-1" aria-label={`Paso ${step + 1} de 6`}>
            {stepNames.map((name, index) => <span key={name} title={name} className={`h-1.5 rounded-full ${index <= step ? 'bg-[#a91d43]' : 'bg-slate-200'}`} />)}
          </div>
        </DialogHeader>

        <div className="min-h-[28rem] p-5 sm:p-7">
          {step === 0 && (
            <section>
              <p className="text-xs font-black uppercase tracking-widest text-[#a91d43]">Paso 1</p>
              <h2 className="mt-1 text-2xl font-black text-[#071527]">Elige la formación</h2>
              <p className="mt-2 text-slate-500">Selecciona el dibujo táctico de tu once.</p>
              <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {formationOptions.map((option) => (
                  <button key={option} onClick={() => { setFormation(option); setLineup(null); }} className={`relative min-h-28 rounded-2xl border-2 p-4 text-2xl font-black transition ${formation === option ? 'border-[#a91d43] bg-rose-50 text-[#a91d43]' : 'border-slate-200 bg-white text-[#153e72] hover:border-[#a91d43]/40'}`}>
                    {formation === option && <Check className="absolute right-3 top-3 size-5" />}
                    {option}
                  </button>
                ))}
              </div>
            </section>
          )}
          {step === 1 && (
            <section>
              <p className="mb-4 rounded-xl bg-sky-50 p-3 text-sm font-bold text-[#153e72]">
                Todos los jugadores están liberados: puedes colocar a cualquiera en cualquier posición.
                <span className="mt-1 block">Pero recuerda: debes coincidir con Luis Castro.</span>
              </p>
              <LineupBuilder key={formation} fixedFormation={formation} unrestricted saveLabel="Siguiente" initialLineup={lineup} onCancel={() => setStep(0)} onSave={(saved) => { setLineup(saved); setStep(2); }} />
            </section>
          )}
          {step === 2 && (
            <section>
              <p className="text-xs font-black uppercase tracking-widest text-[#a91d43]">Paso 3</p>
              <h2 className="mt-1 text-2xl font-black text-[#071527]">Predice el resultado</h2>
              <div className="mx-auto mt-10 grid max-w-xl grid-cols-[1fr_auto_1fr] items-center rounded-3xl border bg-white p-6 shadow-sm">
                <ScorePicker team={match.homeTeam} value={home} onChange={setHome} />
                <strong className="text-2xl text-slate-300">:</strong>
                <ScorePicker team={match.awayTeam} value={away} onChange={setAway} />
              </div>
            </section>
          )}
          {step === 3 && (
            <section>
              <p className="text-xs font-black uppercase tracking-widest text-[#a91d43]">Paso 4</p>
              <h2 className="mt-1 text-2xl font-black text-[#071527]">¿Quién marca?</h2>
              <p className="mt-2 text-slate-500">Asigna exactamente {levanteGoals} {levanteGoals === 1 ? 'gol' : 'goles'}. Un jugador puede marcar más de una vez.</p>
              <div className={`mt-4 rounded-xl p-3 text-center text-sm font-black ${selectedGoals === levanteGoals ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>{selectedGoals} de {levanteGoals} goles asignados</div>
              {levanteGoals === 0 ? <p className="mt-10 text-center text-slate-500">Has pronosticado que el Levante no marcará, así que no necesitas elegir goleadores.</p> : (
                <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {levantePlayers.map((player) => {
                    const count = scorerCounts[player.id] ?? 0;
                    return <div key={player.id} className="flex items-center gap-3 rounded-2xl border bg-white p-3"><PlayerPhoto player={player} size="sm" /><strong className="min-w-0 flex-1 truncate text-sm">{player.displayName}</strong><Button variant="outline" size="icon-sm" disabled={count === 0} onClick={() => changeScorer(player.id, -1)}>−</Button><b className="w-4 text-center">{count}</b><Button variant="outline" size="icon-sm" disabled={selectedGoals >= levanteGoals} onClick={() => changeScorer(player.id, 1)}>+</Button></div>;
                  })}
                </div>
              )}
            </section>
          )}
          {step === 4 && (
            <section>
              <p className="text-xs font-black uppercase tracking-widest text-[#a91d43]">Paso 5</p>
              <h2 className="mt-1 text-2xl font-black text-[#071527]">Elige el MVP</h2>
              <div className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {levantePlayers.map((player) => <button key={player.id} onClick={() => setMvp(player.id)} className={`flex items-center gap-3 rounded-2xl border-2 p-3 text-left transition ${mvp === player.id ? 'border-amber-400 bg-amber-50' : 'border-slate-200 bg-white hover:border-amber-300'}`}><PlayerPhoto player={player} size="sm" /><strong className="min-w-0 flex-1 truncate">{player.displayName}</strong>{mvp === player.id && <Award className="size-5 text-amber-500" />}</button>)}
              </div>
            </section>
          )}
          {step === 5 && (
            <section className="mx-auto max-w-xl text-center">
              {published ? <><span className="mx-auto grid size-16 place-items-center rounded-full bg-emerald-100 text-emerald-700"><Check className="size-8" /></span><h2 className="mt-5 text-2xl font-black">¡Predicción publicada!</h2><p className="mt-2 text-slate-500">Ya aparece en La Grada y también queda guardada en tu perfil.</p><Button className="mt-7 bg-[#a91d43] text-white" onClick={onPublished}>Ver La Grada</Button></> : <><span className="mx-auto grid size-16 place-items-center rounded-full bg-rose-100 text-[#a91d43]"><Send className="size-7" /></span><p className="mt-5 text-xs font-black uppercase tracking-widest text-[#a91d43]">Paso 6</p><h2 className="mt-1 text-2xl font-black">Publica tu predicción</h2>{user ? <div className="mt-6 rounded-2xl bg-slate-50 p-5"><p className="text-sm text-slate-500">Se publicará en La Grada como</p><strong className="mt-1 block text-xl text-[#153e72]">@{user.nickname}</strong></div> : <div className="mt-6 text-left"><label htmlFor="prediction-nickname" className="text-sm font-black">Elige tu apodo público</label><Input id="prediction-nickname" value={nickname} onChange={(event) => setNickname(event.target.value)} placeholder="Ej. Leo_Granota" className="mt-2 h-12 bg-white" /><p className="mt-2 text-xs text-slate-500">Lo recordaremos para tus próximas predicciones y será visible en La Grada.</p></div>}{error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm font-bold text-[#a91d43]">{error}</p>}<Button disabled={publishing || (!user && nickname.trim().length < 2)} onClick={() => void publish()} className="mt-7 h-12 w-full bg-[#a91d43] font-black text-white">{publishing ? <><Loader2 className="animate-spin" /> Publicando…</> : <><Goal /> Publicar en La Grada</>}</Button></>}
            </section>
          )}
        </div>

        {step !== 1 && !published && <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t bg-white px-5 py-4">
          <Button variant="outline" disabled={step === 0} onClick={() => setStep((current) => Math.max(0, current - 1))}><ChevronLeft /> Atrás</Button>
          {step < 5 && <Button disabled={!canContinue || (step === 4 && !mvp)} onClick={() => setStep((current) => Math.min(5, current + 1))} className="bg-[#a91d43] text-white">Siguiente <ChevronRight /></Button>}
        </div>}
      </DialogContent>
    </Dialog>
  );
}
