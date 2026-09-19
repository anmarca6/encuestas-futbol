import Image from 'next/image';
import { ArrowRight } from 'lucide-react';
import { HERO_FEATURES, type CommunityHero } from '@/lib/community-identity';

// Portada de Inicio de una comunidad: textos a la izquierda, imagen a la derecha.
// La primera línea del título va en oscuro y las siguientes en el color de acento de la comunidad.
export function CommunityHeroCard({
  hero,
  onPredict,
  onRules,
}: {
  hero: CommunityHero;
  onPredict: () => void;
  onRules: () => void;
}) {
  const [firstLine, ...restLines] = hero.title.split('\n');
  return (
    <section className="mb-8 overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
      <div className={`grid ${hero.imageUrl ? 'md:grid-cols-[1.2fr_1fr]' : ''}`}>
        <div className="px-5 py-7 sm:px-8 sm:py-9">
          <p className="text-xs font-black uppercase tracking-[.2em]" style={{ color: hero.accentColor }}>
            {hero.eyebrow}
          </p>
          <h1 className="mt-3 text-4xl font-black uppercase leading-[.95] tracking-[-.04em] text-[#071527] sm:text-5xl">
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
          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
            <button
              type="button"
              onClick={onPredict}
              className="inline-flex items-center gap-3 rounded-xl px-5 py-3 text-sm font-black uppercase tracking-wide text-white shadow-lg transition hover:brightness-110"
              style={{ backgroundColor: hero.accentColor }}
            >
              Haz tu pronóstico <ArrowRight className="size-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={onRules}
              className="inline-flex items-center gap-2 text-sm font-black uppercase tracking-[.16em] text-[#153e72] underline decoration-2 underline-offset-4 transition hover:opacity-80"
              style={{ textDecorationColor: hero.accentColor }}
            >
              Cómo se juega <span aria-hidden="true">→</span>
            </button>
          </div>
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
