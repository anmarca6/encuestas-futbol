'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type AppLanguage = 'es' | 'val';
export type AppTheme = 'light' | 'dark';

interface AppPreferencesValue {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => void;
  brightness: number;
  setBrightness: (brightness: number) => void;
  theme: AppTheme;
  setTheme: (theme: AppTheme) => void;
}

const AppPreferencesContext = createContext<AppPreferencesValue | null>(null);

const valencian: Record<string, string> = {
  Inicio: 'Inici', Jornada: 'Jornada', Grada: 'Grada', Clasificación: 'Classificació', Perfil: 'Perfil', Ajustes: 'Configuració',
  'Cómo se juega': 'Com es juga', 'Próximo partido': 'Pròxim partit', 'Último partido': 'Últim partit', 'Próximos partidos': 'Pròxims partits',
  'Todo el Levante. En un solo sitio.': 'Tot el Llevant. En un sol lloc.', 'Participa. Acierta. Suma': 'Participa. Encerta. Suma',
  'Participa →': 'Participa →', Modificar: 'Modificar', 'Cierre de predicciones en': 'Tancament de prediccions en',
  'Situación actual': 'Situació actual', 'Últimos resultados': 'Últims resultats', 'Temporada 2026/27': 'Temporada 2026/27',
  PARTIDOS: 'PARTITS', CLASIFICACIÓN: 'CLASSIFICACIÓ', RESULTADOS: 'RESULTATS', PRÓXIMOS: 'PRÒXIMS', CALENDARIO: 'CALENDARI',
  Programado: 'Programat', 'La jornada': 'La jornada', 'La comunidad': 'La comunitat', 'Predicciones reales publicadas por la afición para el próximo partido.': 'Prediccions reals publicades per l’afició per al pròxim partit.',
  'La grada está esperando su primera previa': 'La grada espera la seua primera prèvia', 'Cuando un usuario publique una predicción, aparecerá aquí.': 'Quan un usuari publique una predicció, apareixerà ací.',
  'Cargando predicciones…': 'Carregant prediccions…', 'Afición granota': 'Afició granota', Goleadores: 'Golejadors', 'Sin elegir': 'Sense triar',
  'Clasificación granota': 'Classificació granota', Usuario: 'Usuari', Predicciones: 'Prediccions', Puntos: 'Punts', Líder: 'Líder',
  'Cargando clasificación…': 'Carregant classificació…', 'La clasificación espera a sus primeros participantes': 'La classificació espera els seus primers participants',
  'Los usuarios aparecerán aquí cuando publiquen su predicción para la nueva jornada.': 'Els usuaris apareixeran ací quan publiquen la seua predicció per a la nova jornada.',
  'Perfil granota': 'Perfil granota', 'Tu espacio': 'El teu espai', 'Tu actividad y tus números de esta temporada.': 'La teua activitat i els teus números d’esta temporada.',
  'Todavía no tienes perfil': 'Encara no tens perfil', 'Mis predicciones': 'Les meues prediccions', 'Aún no has publicado ninguna predicción.': 'Encara no has publicat cap predicció.',
  'Cargando tus predicciones…': 'Carregant les teues prediccions…', 'Predice, acierta y suma puntos': 'Prediu, encerta i suma punts',
  'Haz tu predicción': 'Fes la teua predicció', 'Publica a tiempo': 'Publica a temps', 'Sube en la clasificación': 'Puja en la classificació',
  'Elige formación, XI, resultado, goleadores y MVP.': 'Tria formació, XI, resultat, golejadors i MVP.', 'Las predicciones cierran 2 horas antes del partido.': 'Les prediccions tanquen 2 hores abans del partit.',
  'Tus puntos se acumulan jornada tras jornada.': 'Els teus punts s’acumulen jornada rere jornada.', 'Así se reparten los puntos': 'Així es repartixen els punts',
  'Formación correcta': 'Formació correcta', 'XI titular': 'XI titular', Resultado: 'Resultat', MVP: 'MVP',
  Participa: 'Participa', Formación: 'Formació', 'Tu XI': 'El teu XI', Publicar: 'Publicar', 'Elige la formación': 'Tria la formació',
  'Selecciona el dibujo táctico de tu once.': 'Selecciona el dibuix tàctic del teu onze.', Volver: 'Tornar', Siguiente: 'Següent', Atrás: 'Arrere',
  'Jugadores disponibles': 'Jugadors disponibles', 'Sin duplicados': 'Sense duplicats', 'Cada futbolista solo puede ocupar una posición.': 'Cada futbolista només pot ocupar una posició.',
  'Elige un jugador': 'Tria un jugador', 'Todos los jugadores están disponibles para cualquier posición.': 'Tots els jugadors estan disponibles per a qualsevol posició.',
  'Predice el resultado': 'Prediu el resultat', '¿Quién marca?': 'Qui marca?', 'Elige el MVP': 'Tria l’MVP', 'Publica tu predicción': 'Publica la teua predicció',
  'Elige tu apodo público': 'Tria el teu malnom públic', 'Publicar en La Grada': 'Publicar en La Grada', 'Guardar cambios': 'Guardar canvis',
  'Modificar predicción': 'Modificar predicció', 'Guarda los cambios': 'Guarda els canvis', '¡Predicción guardada!': 'Predicció guardada!', 'Ver La Grada': 'Veure La Grada',
  '¡Predicción publicada!': 'Predicció publicada!', 'Ajustes de la app': 'Configuració de l’app', Idioma: 'Idioma', Español: 'Espanyol',
  Valenciano: 'Valencià', Brillo: 'Brillantor', 'Cerrar sesión': 'Tancar sessió', Cancelar: 'Cancel·lar', '¿Quieres cerrar sesión?': 'Vols tancar la sessió?',
  'Elige el idioma de toda la interfaz.': 'Tria l’idioma de tota la interfície.', 'Ajusta la intensidad visual de la aplicación.': 'Ajusta la intensitat visual de l’aplicació.',
  'Foto de perfil': 'Foto de perfil', 'Se mostrará en tu perfil, La Grada y la clasificación.': 'Es mostrarà en el teu perfil, La Grada i la classificació.',
  'Elegir foto': 'Triar foto', Apariencia: 'Aparença', 'Elige cómo quieres ver la aplicación.': 'Tria com vols veure l’aplicació.',
  'Publica una predicción para crear primero tu perfil.': 'Publica una predicció per a crear primer el teu perfil.',
  'Tu apodo será visible para todos los usuarios en La Grada.': 'El teu malnom serà visible per a tots els usuaris en La Grada.', Apodo: 'Malnom',
};

const originals = new WeakMap<Text, string>();
function translated(original: string, language: AppLanguage) {
  if (language === 'es') return original;
  const leading = original.match(/^\s*/)?.[0] ?? '';
  const trailing = original.match(/\s*$/)?.[0] ?? '';
  const core = original.trim();
  let value = valencian[core] ?? core;
  value = value
    .replace(/Jornada (\d+)/g, 'Jornada $1')
    .replace(/Paso (\d+) de (\d+)/g, 'Pas $1 de $2')
    .replace(/(\d+) puntos?/g, '$1 punts')
    .replace(/predicción/g, 'predicció')
    .replace(/predicciones/g, 'prediccions');
  return `${leading}${value}${trailing}`;
}

function localize(root: Node, language: AppLanguage) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode() as Text | null;
  while (node) {
    const parent = node.parentElement;
    if (parent && !['SCRIPT', 'STYLE'].includes(parent.tagName)) {
      const previous = originals.get(node);
      if (!previous || node.nodeValue !== translated(previous, language)) originals.set(node, node.nodeValue ?? '');
      const nextValue = translated(originals.get(node) ?? '', language);
      if (node.nodeValue !== nextValue) node.nodeValue = nextValue;
    }
    node = walker.nextNode() as Text | null;
  }
}

export function AppPreferencesProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<AppLanguage>('es');
  const [brightness, setBrightness] = useState(100);
  const [theme, setTheme] = useState<AppTheme>('light');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const storedLanguage = localStorage.getItem('granota-language');
      const storedBrightness = Number(localStorage.getItem('granota-brightness'));
      const storedTheme = localStorage.getItem('granota-theme');
      if (storedLanguage === 'val' || storedLanguage === 'es') setLanguage(storedLanguage);
      if (storedBrightness >= 70 && storedBrightness <= 120) setBrightness(storedBrightness);
      if (storedTheme === 'light' || storedTheme === 'dark') setTheme(storedTheme);
      setReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem('granota-language', language);
    document.documentElement.lang = language === 'val' ? 'ca-valencia' : 'es';
    localize(document.body, language);
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'characterData') localize(mutation.target.parentNode ?? document.body, language);
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.TEXT_NODE) localize(node.parentNode ?? document.body, language);
          else if (node instanceof Element) localize(node, language);
        });
      }
    });
    observer.observe(document.body, { childList: true, characterData: true, subtree: true });
    return () => observer.disconnect();
  }, [language, ready]);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem('granota-brightness', String(brightness));
    document.documentElement.style.filter = `brightness(${brightness}%)`;
  }, [brightness, ready]);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem('granota-theme', theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [ready, theme]);

  const value = useMemo(() => ({ language, setLanguage, brightness, setBrightness, theme, setTheme }), [language, brightness, theme]);
  return <AppPreferencesContext.Provider value={value}>{children}</AppPreferencesContext.Provider>;
}

export function useAppPreferences() {
  const context = useContext(AppPreferencesContext);
  if (!context) throw new Error('useAppPreferences must be used inside AppPreferencesProvider');
  return context;
}
