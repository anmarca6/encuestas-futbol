'use client';

import Image from 'next/image';
import { createPortal } from 'react-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
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

// Arrastre de un jugador del campo a otra posicion: por debajo de este desplazamiento (px) se considera un toque normal.
const DRAG_THRESHOLD = 8;
// Distancia maxima (px) entre el puntero y el centro de una posicion para soltar sobre ella.
const DROP_RADIUS = 52;
interface DragState {
  slotId: string;
  playerId: string;
  startX: number;
  startY: number;
  x: number;
  y: number;
  grabX: number;
  grabY: number;
  active: boolean;
  overId: string | null;
}

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
          draggable={false}
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
  fixedFormation,
  unrestricted = false,
  saveLabel = 'Guardar mi XI',
}: {
  initialLineup: SavedLineup | null;
  onCancel: () => void;
  onSave: (lineup: SavedLineup) => void;
  fixedFormation?: FormationId;
  unrestricted?: boolean;
  saveLabel?: string;
}) {
  const initialFormation = fixedFormation ?? initialLineup?.formation ?? DEFAULT_FORMATION;
  const [formationId, setFormationId] = useState<FormationId>(initialFormation);
  const [assignments, setAssignments] = useState<Assignments>(() =>
    initialLineup ? assignmentsFromLineup(initialLineup) : {},
  );
  const [activeSlot, setActiveSlot] = useState<FormationSlot | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const suppressClick = useRef(false);
  const fieldRef = useRef<HTMLElement>(null);
  const formation = formations[formationId];
  const selectedIds = useMemo(
    () =>
      formation.slots
        .map((slot) => assignments[slot.id])
        .filter((id): id is string => Boolean(id)),
    [assignments, formation],
  );
  const candidates = activeSlot
    ? unrestricted
      ? levantePlayers
      : levantePlayers.filter((player) => player.position === activeSlot.position)
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
  // Un jugador cabe en una posicion si no hay restriccion o si es de esa linea (portero, defensa, centrocampista, delantero).
  const canPlace = (playerId: string, slot: FormationSlot) =>
    unrestricted || levantePlayers.find((item) => item.id === playerId)?.position === slot.position;
  const slotAt = (x: number, y: number): FormationSlot | null => {
    const rect = fieldRef.current?.getBoundingClientRect();
    if (!rect) return null;
    let best: FormationSlot | null = null;
    let bestDistance = DROP_RADIUS;
    for (const slot of formation.slots) {
      const distance = Math.hypot(
        x - (rect.left + (rect.width * slot.left) / 100),
        y - (rect.top + (rect.height * slot.top) / 100),
      );
      if (distance <= bestDistance) {
        best = slot;
        bestDistance = distance;
      }
    }
    return best;
  };
  // Soltar sobre otra posicion: el jugador pasa a ella y, si estaba ocupada, su ocupante toma el hueco de origen (intercambio).
  const dropOn = (fromId: string, target: FormationSlot) =>
    setAssignments((current) => {
      const fromSlot = formation.slots.find((slot) => slot.id === fromId);
      const moving = current[fromId];
      const displaced = current[target.id];
      if (!fromSlot || !moving || fromId === target.id) return current;
      if (!canPlace(moving, target) || (displaced && !canPlace(displaced, fromSlot))) return current;
      const next = { ...current, [target.id]: moving };
      if (displaced) next[fromId] = displaced;
      else delete next[fromId];
      return next;
    });
  useEffect(() => {
    dragRef.current = drag;
  });
  const dragging = drag !== null;
  useEffect(() => {
    if (!dragging) return;
    const onMove = (event: PointerEvent) =>
      setDrag((current) => {
        if (!current) return current;
        const active =
          current.active ||
          Math.hypot(event.clientX - current.startX, event.clientY - current.startY) > DRAG_THRESHOLD;
        const over = active ? slotAt(event.clientX, event.clientY) : null;
        return { ...current, x: event.clientX, y: event.clientY, active, overId: over && over.id !== current.slotId ? over.id : null };
      });
    const onUp = (event: PointerEvent) => {
      const current = dragRef.current;
      if (current?.active) {
        // El "click" que sigue a soltar no debe abrir el selector de jugadores.
        suppressClick.current = true;
        window.setTimeout(() => { suppressClick.current = false; }, 0);
        const target = slotAt(event.clientX, event.clientY);
        if (target) dropOn(current.slotId, target);
      }
      setDrag(null);
    };
    const onCancel = () => setDrag(null);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
    };
    // slotAt y dropOn leen siempre la formacion actual: la formacion no cambia mientras se arrastra.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragging, formationId, unrestricted]);
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
      {!fixedFormation && <fieldset className="mb-5 min-w-0">
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
      </fieldset>}
      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <section
          ref={fieldRef}
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
            const moving = drag?.active === true && drag.slotId === slot.id;
            const dropTarget =
              drag?.active === true &&
              drag.overId === slot.id &&
              canPlace(drag.playerId, slot) &&
              (!assignments[slot.id] || canPlace(assignments[slot.id]!, formation.slots.find((item) => item.id === drag.slotId)!));
            return (
              <button
                key={slot.id}
                onClick={() => {
                  if (!suppressClick.current) setActiveSlot(slot);
                }}
                onPointerDown={(event) => {
                  if (!player || event.button !== 0) return;
                  // grab: donde dentro del jugador se agarra (respecto a su centro), para que el muñeco quede pegado a la mano.
                  const rect = event.currentTarget.getBoundingClientRect();
                  setDrag({
                    slotId: slot.id, playerId: player.id,
                    startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY,
                    grabX: event.clientX - (rect.left + rect.width / 2), grabY: event.clientY - (rect.top + rect.height / 2),
                    active: false, overId: null,
                  });
                }}
                onDragStart={(event) => event.preventDefault()}
                style={{ left: `${slot.left}%`, top: `${slot.top}%` }}
                className={`absolute flex min-h-16 w-[4.6rem] -translate-x-1/2 -translate-y-1/2 select-none flex-col items-center justify-center rounded-2xl px-1 py-1 text-white transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:w-[5.25rem] ${player ? 'cursor-grab touch-none' : ''} ${moving ? 'opacity-40' : ''} ${dropTarget ? 'bg-white/25 ring-2 ring-white' : ''}`}
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
        {drag?.active && (() => {
          const dragged = levantePlayers.find((item) => item.id === drag.playerId);
          // En el body (no dentro de la ventana de Participa, que esta animada con transform) para que "fixed" use coordenadas de pantalla.
          return dragged ? createPortal(
            <div
              style={{ left: drag.x - drag.grabX, top: drag.y - drag.grabY }}
              className="pointer-events-none fixed z-[100] flex w-[4.6rem] -translate-x-1/2 -translate-y-1/2 flex-col items-center opacity-90 drop-shadow-xl sm:w-[5.25rem]"
            >
              <PlayerPhoto player={dragged} />
              <span className="mt-1 w-full truncate rounded-full bg-[#071527]/85 px-1.5 py-1 text-center text-[9px] font-black text-white shadow">
                {dragged.displayName}
              </span>
            </div>,
            document.body,
          ) : null;
        })()}
        <aside className="space-y-4">
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <h2 className="font-black text-[#071527]">Jugadores disponibles</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              {unrestricted
                ? 'Toca cualquier hueco del campo y coloca al jugador que quieras.'
                : 'Toca una posición del campo y elige un jugador de esa línea.'}
              {' '}Para cambiar a un jugador de sitio, arrástralo hasta otra posición: si está ocupada, se intercambian.
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
            {saveLabel}
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
              {unrestricted
                ? 'Elige un jugador'
                : `Elige ${activeSlot ? positionNames[activeSlot.position] : ''}`}
            </DrawerTitle>
            <DrawerDescription>
              {unrestricted
                ? 'Todos los jugadores están disponibles para cualquier posición.'
                : 'Solo se muestran jugadores disponibles para esta posición.'}
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
