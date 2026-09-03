'use client';

import Image from 'next/image';
import { useMemo, useState } from 'react';
import { Check, ChevronLeft, Plus, Save, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import {
  DEFAULT_FORMATION,
  formationOptions,
  formations,
  type FormationId,
  type FormationSlot,
  type SavedLineup,
} from '@/lib/formations';
import {
  levantePlayers,
  type LevantePlayer,
  type PlayerPosition,
} from '@/lib/levante-data';

const positionNames: Record<PlayerPosition, string> = {
  GOALKEEPER: 'portero',
  DEFENDER: 'defensa',
  MIDFIELDER: 'centrocampista',
  FORWARD: 'delantero',
};
type Assignments = Partial<Record<string, string>>;

export function PlayerPhoto({
  player,
  size = 'md',
}: {
  player: LevantePlayer;
  size?: 'sm' | 'md';
}) {
  return (
    <span
      className={`${size === 'sm' ? 'size-10' : 'size-14'} grid shrink-0 place-items-center overflow-hidden rounded-full bg-sky-100 text-[#153e72] ring-2 ring-white`}
    >
      {player.image ? (
        <Image
          src={player.image}
          width={80}
          height={100}
          alt={player.displayName}
          className="h-full w-full object-contain object-bottom"
        />
      ) : (
        <UserRound className="size-1/2" aria-label="Fotografía no disponible" />
      )}
    </span>
  );
}

function assignmentsFromLineup(lineup: SavedLineup): Assignments {
  return Object.fromEntries(
    formations[lineup.formation].slots
      .map((slot, index) => [slot.id, lineup.players[index]])
      .filter((entry) => entry[1]),
  ) as Assignments;
}

function migrateAssignments(
  current: Assignments,
  oldSlots: FormationSlot[],
  newSlots: FormationSlot[],
): Assignments {
  const selectedByPosition = new Map<PlayerPosition, string[]>();
  for (const slot of oldSlots) {
    const playerId = current[slot.id];
    if (!playerId) continue;
    const player = levantePlayers.find((item) => item.id === playerId);
    if (!player || player.position !== slot.position) continue;
    selectedByPosition.set(player.position, [
      ...(selectedByPosition.get(player.position) ?? []),
      playerId,
    ]);
  }
  const next: Assignments = {};
  for (const slot of newSlots) {
    const playerId = selectedByPosition.get(slot.position)?.shift();
    if (playerId) next[slot.id] = playerId;
  }
  return next;
}

export function LineupBuilder({
  initialLineup,
  onCancel,
  onSave,
}: {
  initialLineup: SavedLineup | null;
  onCancel: () => void;
  onSave: (lineup: SavedLineup) => void;
}) {
  const initialFormation = initialLineup?.formation ?? DEFAULT_FORMATION;
  const [formationId, setFormationId] = useState<FormationId>(initialFormation);
  const [assignments, setAssignments] = useState<Assignments>(() =>
    initialLineup ? assignmentsFromLineup(initialLineup) : {},
  );
  const [activeSlot, setActiveSlot] = useState<FormationSlot | null>(null);
  const formation = formations[formationId];
  const selectedIds = useMemo(
    () =>
      formation.slots
        .map((slot) => assignments[slot.id])
        .filter((id): id is string => Boolean(id)),
    [assignments, formation],
  );
  const candidates = activeSlot
    ? levantePlayers.filter((player) => player.position === activeSlot.position)
    : [];
  const changeFormation = (nextId: FormationId) => {
    if (nextId === formationId) return;
    setAssignments((current) =>
      migrateAssignments(current, formation.slots, formations[nextId].slots),
    );
    setActiveSlot(null);
    setFormationId(nextId);
  };
  const selectPlayer = (playerId: string) => {
    if (!activeSlot) return;
    setAssignments((current) => ({ ...current, [activeSlot.id]: playerId }));
    setActiveSlot(null);
  };
  const save = () => {
    if (selectedIds.length !== 11) return;
    onSave({
      formation: formationId,
      players: formation.slots.map((slot) => assignments[slot.id]!),
    });
  };

  return (
    <>
      <div className="mb-5 flex items-center justify-between gap-3">
        <Button variant="ghost" onClick={onCancel}>
          <ChevronLeft />
          Volver
        </Button>
        <div className="text-right">
          <p className="text-xs font-black uppercase tracking-wider text-slate-400">
            Formación {formationId}
          </p>
          <strong className="text-2xl text-[#071527]" aria-live="polite">
            {selectedIds.length} / 11
          </strong>
        </div>
      </div>
      <fieldset className="mb-5 min-w-0">
        <legend className="mb-2 text-sm font-black text-[#071527]">
          Elige la formación
        </legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {formationOptions.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => changeFormation(option)}
              aria-pressed={formationId === option}
              className={`min-h-11 rounded-xl border px-3 py-2 text-sm font-black transition ${formationId === option ? 'border-[#a91d43] bg-[#a91d43] text-white shadow-sm' : 'border-slate-200 bg-white text-[#153e72] hover:border-[#a91d43]/50'}`}
            >
              {option}
            </button>
          ))}
        </div>
      </fieldset>
      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <section
          aria-label={`Campo de fútbol, formación ${formationId}`}
          className="relative mx-auto aspect-[3/4.4] w-full max-w-xl overflow-hidden rounded-[2rem] border-4 border-white bg-[linear-gradient(90deg,rgba(255,255,255,.04)_50%,transparent_50%),linear-gradient(#197a55,#126645)] bg-[size:25%_100%,100%_100%] shadow-xl"
        >
          <div className="pointer-events-none absolute inset-3 rounded-xl border-2 border-white/55" />
          <div className="pointer-events-none absolute inset-x-3 top-1/2 border-t-2 border-white/55" />
          <div className="pointer-events-none absolute left-1/2 top-1/2 size-24 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/55" />
          <div className="pointer-events-none absolute left-1/2 top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/60" />
          <div className="pointer-events-none absolute left-1/2 top-3 h-[17%] w-[48%] -translate-x-1/2 border-x-2 border-b-2 border-white/55" />
          <div className="pointer-events-none absolute bottom-3 left-1/2 h-[17%] w-[48%] -translate-x-1/2 border-x-2 border-t-2 border-white/55" />
          <div className="pointer-events-none absolute left-1/2 top-3 h-2 w-[22%] -translate-x-1/2 -translate-y-full border-x-2 border-t-2 border-white/55" />
          <div className="pointer-events-none absolute bottom-3 left-1/2 h-2 w-[22%] -translate-x-1/2 translate-y-full border-x-2 border-b-2 border-white/55" />
          {formation.slots.map((slot) => {
            const player = levantePlayers.find(
              (item) => item.id === assignments[slot.id],
            );
            return (
              <button
                key={slot.id}
                onClick={() => setActiveSlot(slot)}
                style={{ left: `${slot.left}%`, top: `${slot.top}%` }}
                className="absolute flex min-h-16 w-[4.6rem] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-2xl px-1 py-1 text-white transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:w-[5.25rem]"
                aria-label={`${player ? 'Cambiar' : 'Elegir'} ${positionNames[slot.position]} ${slot.label}`}
              >
                {player ? (
                  <>
                    <PlayerPhoto player={player} />
                    <span className="mt-1 w-full truncate rounded-full bg-[#071527]/85 px-1.5 py-1 text-[9px] font-black shadow">
                      {player.displayName}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="grid size-11 place-items-center rounded-full border-2 border-dashed border-white/75 bg-white/10">
                      <Plus className="size-5" />
                    </span>
                    <span className="mt-1 text-[9px] font-black">
                      {slot.label}
                    </span>
                  </>
                )}
              </button>
            );
          })}
        </section>
        <aside className="space-y-4">
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <h2 className="font-black text-[#071527]">Jugadores disponibles</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              Toca una posición del campo y elige un jugador de esa línea.
            </p>
          </div>
          <div className="rounded-2xl bg-sky-50 p-4 text-sm text-[#153e72]">
            <strong>Sin duplicados</strong>
            <p className="mt-1 text-xs leading-5 opacity-75">
              Cada futbolista solo puede ocupar una posición.
            </p>
          </div>
          <Button
            onClick={save}
            disabled={selectedIds.length !== 11}
            className="h-12 w-full bg-[#a91d43] font-black text-white"
          >
            <Save />
            Guardar mi XI
          </Button>
        </aside>
      </div>
      <Drawer
        open={activeSlot !== null}
        onOpenChange={(open) => {
          if (!open) setActiveSlot(null);
        }}
        showSwipeHandle
      >
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle className="text-lg font-black">
              Elige {activeSlot ? positionNames[activeSlot.position] : ''}
            </DrawerTitle>
            <DrawerDescription>
              Solo se muestran jugadores disponibles para esta posición.
            </DrawerDescription>
          </DrawerHeader>
          <div className="grid max-h-[62dvh] gap-2 overflow-y-auto px-4 pb-5 sm:grid-cols-2 lg:grid-cols-3">
            {candidates.map((player) => {
              const activePlayerId = activeSlot
                ? assignments[activeSlot.id]
                : undefined;
              const used =
                selectedIds.includes(player.id) && activePlayerId !== player.id;
              return (
                <button
                  key={player.id}
                  onClick={() => !used && selectPlayer(player.id)}
                  disabled={used}
                  className="flex min-h-18 items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-left transition hover:border-[#a91d43]/40 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <PlayerPhoto player={player} size="sm" />
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate text-[#071527]">
                      {player.displayName}
                    </strong>
                    <small className="text-slate-500">
                      {player.number === null
                        ? 'Sin dorsal'
                        : `Dorsal ${player.number}`}
                    </small>
                    {player.possibleDeparture && (
                      <small className="mt-1 block text-[10px] font-bold text-amber-700">
                        Posible salida
                      </small>
                    )}
                  </span>
                  {activePlayerId === player.id && (
                    <Check className="size-5 text-emerald-600" />
                  )}
                  {used && (
                    <span className="text-[10px] font-black uppercase text-slate-400">
                      Elegido
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}

export function LineupSummary({
  lineup,
  onEdit,
}: {
  lineup: SavedLineup;
  onEdit: () => void;
}) {
  const formation = formations[lineup.formation];
  const players = lineup.players.map((id) =>
    levantePlayers.find((player) => player.id === id),
  );
  return (
    <div className="rounded-2xl bg-gradient-to-br from-[#153e72] to-[#071527] p-5 text-white">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-wider text-sky-200">
            Mi XI · {lineup.formation}
          </p>
          <h3 className="mt-1 text-xl font-black">Once guardado</h3>
        </div>
        <Button
          variant="outline"
          onClick={onEdit}
          className="shrink-0 border-white/20 bg-white/10 text-white hover:bg-white/20"
        >
          Editar XI
        </Button>
      </div>
      <div
        aria-label={`Representación del once en ${lineup.formation}`}
        className="relative mx-auto mt-5 aspect-[3/4] w-full max-w-xs overflow-hidden rounded-xl border border-white/30 bg-emerald-800/70"
      >
        {formation.slots.map((slot, index) => {
          const player = players[index];
          return (
            <div
              key={slot.id}
              style={{ left: `${slot.left}%`, top: `${slot.top}%` }}
              className="absolute w-16 -translate-x-1/2 -translate-y-1/2 text-center"
            >
              {player && (
                <>
                  <span className="mx-auto grid size-9 place-items-center overflow-hidden rounded-full bg-sky-100 ring-2 ring-white sm:size-11">
                    {player.image ? (
                      <Image
                        src={player.image}
                        width={40}
                        height={48}
                        alt={player.displayName}
                        className="h-full w-full object-contain object-bottom"
                      />
                    ) : (
                      <UserRound className="size-4 text-[#153e72]" />
                    )}
                  </span>
                  <span className="mt-1 block truncate rounded-full bg-[#071527]/80 px-1 py-0.5 text-[8px] font-bold sm:text-[9px]">
                    {player.displayName}
                  </span>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
