import type { ReactNode } from 'react';
import Image from 'next/image';
import {
  CalendarDays,
  House,
  LogIn,
  LogOut,
  MessageCircleMore,
  Trophy,
  UserRound,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TeamCrest } from '@/components/shared';
import type { CommunityUser } from '@/lib/community-types';
import milCromosBanner from '@/public/bannerMilcromos_v2.png';
import { headerColorWithAlpha, type CommunityIdentity } from '@/lib/community-identity';
export type SectionId = 'inicio' | 'jornada' | 'grada' | 'clasificacion' | 'reglas' | 'perfil' | 'ajustes';
const items = [
  ['inicio', 'Inicio', House],
  ['jornada', 'Calendario', CalendarDays],
  ['grada', 'Grada', MessageCircleMore],
  ['clasificacion', 'El Raconet', Trophy],
  ['perfil', 'Perfil', UserRound],
] as const;
function NavItems({
  active,
  navigate,
  user,
  mobile = false,
}: {
  active: SectionId;
  navigate: (s: SectionId) => void;
  user: CommunityUser | null;
  mobile?: boolean;
}) {
  return (
    <>
      {items.filter(([id]) => id !== 'perfil' || user).map(([id, label, Icon]) => (
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
  user,
  identity,
  onLogin,
  onLogout,
  children,
}: {
  active: SectionId;
  navigate: (s: SectionId) => void;
  user: CommunityUser | null;
  identity: CommunityIdentity;
  onLogin: () => void;
  onLogout: () => void;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <header
        className={`sticky top-0 z-40 border-b border-white/10 text-white backdrop-blur-xl ${identity.color ? '' : 'bg-[#071527]/95'}`}
        style={identity.color ? { backgroundColor: headerColorWithAlpha(identity.color, 0.95) } : undefined}
      >
        <div className="mx-auto flex h-18 max-w-6xl items-center justify-between px-4 sm:px-6">
          <button
            onClick={() => navigate('inicio')}
            className="flex min-w-0 items-center gap-3"
            aria-label="Ir a inicio"
          >
            {identity.logoSrc ? (
              <Image
                unoptimized
                src={identity.logoSrc}
                width={96}
                height={96}
                alt=""
                className="size-12 shrink-0 rounded-full object-cover ring-2 ring-white/20"
              />
            ) : (
              <TeamCrest teamName="Levante UD" size="lg" />
            )}
            <span className="min-w-0 text-left">
              <small className={`block truncate text-[10px] font-bold uppercase tracking-[.22em] ${identity.color ? 'text-white/80' : 'text-sky-300'}`}>
                {identity.eyebrow}
              </small>
              <strong className="block truncate text-lg font-black">{identity.title}</strong>
            </span>
          </button>
            <nav className="hidden gap-1 md:flex">
            <NavItems active={active} navigate={navigate} user={user} />
          </nav>
          <div className="flex items-center gap-2">
            <span className="hidden rounded-full border border-white/15 px-3 py-1.5 text-xs text-slate-300 lg:block">
              Temporada 26/27
            </span>
            {user ? (
              <Button
                variant="outline"
                onClick={onLogout}
                className="border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white"
              >
                <LogOut className="size-4" />
                <span className="hidden sm:inline">Cerrar sesión</span>
                <span className="sm:hidden">Salir</span>
              </Button>
            ) : (
              <Button
                onClick={onLogin}
                className="bg-[#a91d43] font-black text-white shadow-lg shadow-black/20 hover:bg-[#8f1738]"
              >
                <LogIn className="size-4" />
                <span>Iniciar sesión</span>
              </Button>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 pt-7 sm:px-6 md:pt-10">
        {children}
      </main>
      <footer className="mx-auto max-w-6xl px-4 pb-28 pt-10 sm:px-6 md:pb-12">
        <a
          href="https://www.milcromos.com"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="MilCromos: organiza tu colección de cromos de LaLiga. Abre www.milcromos.com en una pestaña nueva"
          className="relative mx-auto mb-6 block aspect-[2000/450] w-full max-w-4xl overflow-hidden rounded-2xl transition duration-200 hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
        >
          {/* El banner trae su propia tarjeta con borde y sombra, rodeada de margen en blanco: se recorta ese margen. */}
          <Image
            fill
            src={milCromosBanner}
            alt="MilCromos: ¿Coleccionas cromos de LaLiga? Organiza tu colección, encuentra los que te faltan y cambia tus repetidos gratis en milcromos.com."
            sizes="(min-width: 896px) 896px, 100vw"
            className="scale-[1.035] object-cover"
          />
        </a>
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-5 text-center text-sm leading-6 text-slate-500 shadow-sm sm:text-base">
          👋 ¡Hola! Soy Leo, tengo 14 años. Me gusta{' '}
          <s className="text-slate-400">el fútbol</s> el Levante UD, la
          tecnología y estoy aprendiendo a programar. ¡Espero que disfrutes
          participando! ⚽🚀
        </div>
      </footer>
      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 px-2 pb-[max(.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-10px_35px_rgba(7,21,39,.08)] md:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-5">
          <NavItems active={active} navigate={navigate} user={user} mobile />
        </div>
      </nav>
    </div>
  );
}
