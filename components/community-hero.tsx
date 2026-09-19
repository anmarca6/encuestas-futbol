import type { CSSProperties } from 'react';
import Image from 'next/image';
import { HERO_FEATURES, type CommunityHero } from '@/lib/community-identity';
import { getSocialNetwork, type CommunityLink } from '@/lib/social-networks';

// Iconos de marca: un círculo del color de la red que se "enciende" al pasar el ratón.
function FollowMe({ links, accentColor }: { links: CommunityLink[]; accentColor: string }) {
  const items = links.flatMap((link) => {
    const network = getSocialNetwork(link.network);
    return network ? [{ link, network }] : [];
  });
  if (items.length === 0) return null;
  return (
    <div className="mt-6">
      <p className="mb-2.5 flex items-center gap-2 text-[11px] font-black uppercase tracking-[.22em] text-slate-400">
        <span className="relative flex size-2" aria-hidden="true">
          <span className="absolute inline-flex size-full animate-ping rounded-full opacity-60 motion-reduce:animate-none" style={{ backgroundColor: accentColor }} />
          <span className="relative inline-flex size-2 rounded-full" style={{ backgroundColor: accentColor }} />
        </span>
        Follow me
      </p>
      <ul className="flex flex-wrap gap-2.5">
        {items.map(({ link, network }) => (
          <li key={`${network.id}-${link.url}`}>
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${network.chipLabel} (se abre en una pestaña nueva)`}
              style={{ '--brand': network.color } as CSSProperties}
              className="group inline-flex items-center gap-2.5 rounded-full border border-slate-200 bg-white py-1.5 pl-1.5 pr-4 text-sm font-black text-[#071527] shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-transparent hover:bg-(--brand) hover:text-white hover:shadow-lg motion-reduce:transition-none motion-reduce:hover:translate-y-0"
            >
              <span className="grid size-8 place-items-center rounded-full bg-(--brand) text-white transition-colors duration-200 group-hover:bg-white/20">
                <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden="true">
                  <path d={network.iconPath} />
                </svg>
              </span>
              {network.chipLabel}
              <span aria-hidden="true" className="-ml-1 text-xs opacity-0 transition duration-200 group-hover:translate-x-0.5 group-hover:opacity-100">
                ↗
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Portada de Inicio de una comunidad: textos a la izquierda, imagen a la derecha.
// La primera línea del título va en oscuro y las siguientes en el color de acento de la comunidad.
export function CommunityHeroCard({
  hero,
  onRules,
}: {
  hero: CommunityHero;
  onRules: () => void;
}) {
  const [firstLine, ...restLines] = hero.title.split('\n');
  return (
    <section className="mb-8 overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
      <div className={`grid ${hero.imageUrl ? 'md:grid-cols-[1.2fr_1fr]' : ''}`}>
        <div className="px-5 py-7 sm:px-8 sm:py-9">
          <h1 className="text-4xl font-black uppercase leading-[.95] tracking-[-.04em] text-[#071527] sm:text-5xl">
            <span className="block">{firstLine}</span>
            {restLines.map((line, index) => (
              <span key={index} className="block" style={{ color: hero.accentColor }}>
                {line}
              </span>
            ))}
          </h1>
          {hero.subtitle && (
            <p className="mt-4 max-w-md text-sm leading-6 text-slate-600 sm:text-base">{hero.subtitle}</p>
          )}
          <ul className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-sm font-bold text-slate-700">
            {HERO_FEATURES.map((feature) => (
              <li key={feature.label} className="flex items-center gap-1.5">
                <span aria-hidden="true">{feature.emoji}</span>
                {feature.label}
              </li>
            ))}
          </ul>
          <FollowMe links={hero.links} accentColor={hero.accentColor} />
          <button
            type="button"
            onClick={onRules}
            className="mt-6 inline-flex items-center gap-2 text-sm font-black uppercase tracking-[.16em] text-[#153e72] underline decoration-2 underline-offset-4 transition hover:opacity-80"
            style={{ textDecorationColor: hero.accentColor }}
          >
            Cómo se juega <span aria-hidden="true">→</span>
          </button>
        </div>
        {hero.imageUrl && (
          <div className="relative min-h-56 md:min-h-full">
            <Image unoptimized fill src={hero.imageUrl} alt="" sizes="(min-width: 768px) 40vw, 100vw" className="object-cover" />
            <div className="absolute inset-0 bg-gradient-to-b from-white via-white/0 to-transparent md:bg-gradient-to-r" />
          </div>
        )}
      </div>
    </section>
  );
}

// Portada estándar de Inicio, para las comunidades que no han configurado la suya.
export function StandardHeroCard({ onRules }: { onRules: () => void }) {
  return (
    <section className="mb-8 overflow-hidden rounded-[2rem] border border-slate-200 bg-white px-5 py-7 shadow-sm sm:px-8 sm:py-9">
      <p className="text-xs font-black uppercase tracking-[.2em] text-[#a91d43]">
        En clave granota
      </p>
      <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <h1 className="max-w-3xl text-3xl font-black tracking-[-.04em] text-[#071527] sm:text-5xl">
          Todo el Levante. En un solo sitio.
        </h1>
        <span className="w-fit shrink-0 rounded-full bg-[#071527] px-4 py-2 text-xs font-black text-white">
          Temporada 2026/27
        </span>
      </div>
      <div className="mt-6 space-y-2 text-sm font-bold leading-6 text-slate-600 sm:text-base">
        <p>📅 Partidos · ⚽ Resultados · 👕 Alineaciones · ⭐ MVP</p>
        <p>🎯 Pronósticos · 🏆 Puntos para aficionados</p>
      </div>
      <p className="mt-6 text-lg font-black text-[#a91d43] sm:text-xl">
        Participa. Acierta. Suma
      </p>
      <button
        type="button"
        onClick={onRules}
        className="mt-3 inline-flex items-center gap-2 text-sm font-black uppercase tracking-[.16em] text-[#153e72] underline decoration-[#a91d43] decoration-2 underline-offset-4 transition hover:text-[#a91d43]"
      >
        Cómo se juega <span aria-hidden="true">→</span>
      </button>
    </section>
  );
}
