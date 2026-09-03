import type { ReactNode } from 'react';
import {
  CalendarDays,
  House,
  MessageCircleMore,
  Sparkles,
  UserRound,
} from 'lucide-react';
import { TeamCrest } from '@/components/shared';
export type SectionId = 'inicio' | 'jornada' | 'predice' | 'grada' | 'perfil';
const items = [
  ['inicio', 'Inicio', House],
  ['jornada', 'Jornada', CalendarDays],
  ['predice', 'Predice', Sparkles],
  ['grada', 'Grada', MessageCircleMore],
  ['perfil', 'Perfil', UserRound],
] as const;
function NavItems({
  active,
  navigate,
  mobile = false,
}: {
  active: SectionId;
  navigate: (s: SectionId) => void;
  mobile?: boolean;
}) {
  return (
    <>
      {items.map(([id, label, Icon]) => (
        <button
          key={id}
          onClick={() => navigate(id)}
          aria-current={active === id ? 'page' : undefined}
          className={
            mobile
              ? `flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-bold ${active === id ? 'text-[#a91d43]' : 'text-slate-500'}`
              : `flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition ${active === id ? 'bg-white text-[#071527]' : 'text-slate-300 hover:bg-white/10 hover:text-white'}`
          }
        >
          <Icon className={mobile ? 'size-5' : 'size-4'} />
          {label}
        </button>
      ))}
    </>
  );
}
export function AppShell({
  active,
  navigate,
  children,
}: {
  active: SectionId;
  navigate: (s: SectionId) => void;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#071527]/95 text-white backdrop-blur-xl">
        <div className="mx-auto flex h-18 max-w-6xl items-center justify-between px-4 sm:px-6">
          <button
            onClick={() => navigate('inicio')}
            className="flex items-center gap-3"
            aria-label="Ir a inicio"
          >
            <TeamCrest teamName="Levante UD" size="md" className="rounded-lg" />
            <span className="text-left">
              <small className="block text-[10px] font-bold uppercase tracking-[.22em] text-sky-300">
                Levante UD
              </small>
              <strong className="text-lg font-black">Granota App</strong>
            </span>
          </button>
          <nav className="hidden gap-1 md:flex">
            <NavItems active={active} navigate={navigate} />
          </nav>
          <span className="hidden rounded-full border border-white/15 px-3 py-1.5 text-xs text-slate-300 lg:block">
            Temporada 26/27
          </span>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 pb-28 pt-7 sm:px-6 md:pb-12 md:pt-10">
        {children}
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 px-2 pb-[max(.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-10px_35px_rgba(7,21,39,.08)] md:hidden">
        <div className="mx-auto grid max-w-md grid-cols-5">
          <NavItems active={active} navigate={navigate} mobile />
        </div>
      </nav>
    </div>
  );
}
