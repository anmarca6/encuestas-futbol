'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Copy, Download, ImagePlus, Loader2, Minus, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { levantePlayers } from '@/lib/levante-data';
import {
  BACKGROUNDS,
  DEFAULT_SPEC,
  MAX_ROWS,
  QUARTER_LABELS,
  ensureImageFonts,
  loadImage,
  renderInfographic,
  sanitizeSpec,
  suggestCards,
  type ImageAssets,
  type ImageSpec,
} from '@/lib/image-generator';
import { IMAGE_TEMPLATES, buildTemplate, isTemplateId, type ImageTemplateId, type MatchStats, type TemplateResult } from '@/lib/image-stats';

// Enlace que acompana a cada publicacion en X (X lo cuenta como 23 caracteres).
const SHARE_URL = 'https://encuestas-futbol.vercel.app/ismaelete';
const TWEET_MAX = 280;
const TWEET_URL_LENGTH = 24;
const AUTOSAVE_DELAY = 1500;

const labelClass = 'mb-1 block text-xs font-black uppercase text-slate-400';

interface SavedImage {
  id: string;
  title: string;
  template: string;
  thumb: string;
  updatedAt: number;
}

interface CurrentImage {
  id: string;
  template: ImageTemplateId;
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

function Field({ id, label, children }: { id?: string; label: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className={labelClass}>{label}</label>
      {children}
    </div>
  );
}

const titleOf = (spec: ImageSpec) => `${spec.title} ${spec.titleAccent}`.trim() || 'Imagen sin título';
const playerName = (id: string) => levantePlayers.find((item) => item.id === id)?.displayName ?? null;

// Miniatura para el historial.
function makeThumb(canvas: HTMLCanvasElement) {
  const small = document.createElement('canvas');
  small.width = 216;
  small.height = 270;
  small.getContext('2d')?.drawImage(canvas, 0, 0, small.width, small.height);
  return small.toDataURL('image/jpeg', 0.72);
}

// Generador de imagenes estadisticas. Cada imagen se guarda sola en el historial (ficha + miniatura) para poder reabrirla y editarla.
export function ImageGenerator({ communitySlug }: { communitySlug: string }) {
  const [spec, setSpec] = useState<ImageSpec>(DEFAULT_SPEC);
  const [assets, setAssets] = useState<ImageAssets>({ background: null, player: null });
  const [assetsReady, setAssetsReady] = useState(false);
  const [fontsReady, setFontsReady] = useState(false);
  const [assetError, setAssetError] = useState('');
  const [tweetText, setTweetText] = useState<string | null>(null);
  const [shareMessage, setShareMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [images, setImages] = useState<SavedImage[] | null>(null);
  const [current, setCurrent] = useState<CurrentImage | null>(null);
  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState<ImageTemplateId | null>(null);
  const [opening, setOpening] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [pickerError, setPickerError] = useState('');
  const [warnings, setWarnings] = useState<string[]>([]);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // PNG ya preparado: el menu de compartir del movil exige llamarse en el mismo toque, sin esperas intermedias.
  const shareFileRef = useRef<File | null>(null);
  // Hay cambios sin guardar en el historial (imagen recien creada o editada).
  const dirtyRef = useRef(false);

  const update = (patch: Partial<ImageSpec>) => {
    dirtyRef.current = true;
    setSpec((value) => ({ ...value, ...patch }));
  };
  const player = useMemo(() => levantePlayers.find((item) => item.id === spec.playerId) ?? null, [spec.playerId]);
  const sortedPlayers = useMemo(() => [...levantePlayers].sort((a, b) => a.displayName.localeCompare(b.displayName, 'es')), []);

  useEffect(() => {
    void ensureImageFonts().then(() => setFontsReady(true));
    fetch('/api/admin/images', { cache: 'no-store' })
      .then(async (response) => (response.ok ? ((await response.json()) as { images: SavedImage[] }).images : []))
      .then(setImages)
      .catch(() => setImages([]));
  }, []);

  // Las imagenes del historial que aun no tienen miniatura (p. ej. la de ejemplo) se dibujan en segundo plano una sola vez.
  const imagesLoaded = images !== null;
  useEffect(() => {
    if (!fontsReady || !imagesLoaded) return;
    let cancelled = false;
    void (async () => {
      for (const item of (images ?? []).filter((entry) => !entry.thumb)) {
        if (cancelled) return;
        try {
          const response = await fetch(`/api/admin/images?id=${encodeURIComponent(item.id)}`, { cache: 'no-store' });
          const { image } = (await response.json()) as { image: { spec: ImageSpec } };
          const saved = sanitizeSpec(image.spec);
          const [background, playerImage] = await Promise.all([
            saved.background === 'ninguno' ? Promise.resolve(null) : loadImage(BACKGROUNDS[saved.background].src),
            saved.playerId ? loadImage(levantePlayers.find((entry) => entry.id === saved.playerId)?.image ?? '') : Promise.resolve(null),
          ]);
          const canvas = document.createElement('canvas');
          renderInfographic(canvas, saved, { background, player: playerImage });
          const thumb = makeThumb(canvas);
          await fetch('/api/admin/images', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: item.id, thumb, thumbOnly: true }) });
          if (!cancelled) setImages((list) => list?.map((entry) => (entry.id === item.id ? { ...entry, thumb } : entry)) ?? list);
        } catch {
          // Si una falla, se seguira intentando la proxima vez que se abra el generador.
        }
      }
    })();
    return () => { cancelled = true; };
    // Solo cuando la lista se carga por primera vez.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fontsReady, imagesLoaded]);

  // Fondo y foto del jugador: se cargan al elegirlos.
  useEffect(() => {
    let cancelled = false;
    setAssetError('');
    setAssetsReady(false);
    const backgroundSrc = spec.background === 'ninguno' ? null : BACKGROUNDS[spec.background].src;
    Promise.all([
      backgroundSrc ? loadImage(backgroundSrc) : Promise.resolve(null),
      player?.image ? loadImage(player.image) : Promise.resolve(null),
    ])
      .then(([background, playerImage]) => { if (!cancelled) setAssets({ background, player: playerImage }); })
      .catch(() => { if (!cancelled) setAssetError('No se ha podido cargar el fondo o la foto del jugador.'); })
      .finally(() => { if (!cancelled) setAssetsReady(true); });
    return () => { cancelled = true; };
  }, [spec.background, player]);

  useEffect(() => {
    if (!fontsReady || !current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    renderInfographic(canvas, spec, assets);
    shareFileRef.current = null;
    const timer = window.setTimeout(() => {
      // JPEG: pesa unas diez veces menos que el PNG y X rechaza imagenes de mas de 5 MB.
      canvas.toBlob((blob) => { if (blob) shareFileRef.current = new File([blob], 'granota-estadistica.jpg', { type: 'image/jpeg' }); }, 'image/jpeg', 0.92);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [spec, assets, fontsReady, current]);

  // Guardado automatico en el historial: un momento despues del ultimo cambio, con la miniatura de lo que se ve.
  useEffect(() => {
    if (!current || !dirtyRef.current || !fontsReady || !assetsReady) return;
    const id = current.id;
    const timer = window.setTimeout(async () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      dirtyRef.current = false;
      setSaveState('saving');
      const thumb = makeThumb(canvas);
      const title = titleOf(spec);
      try {
        const response = await fetch('/api/admin/images', {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ id, spec, thumb, title }),
        });
        const body = (await response.json().catch(() => ({}))) as { updatedAt?: number; error?: string };
        if (!response.ok) throw new Error(body.error ?? 'No se pudo guardar.');
        setImages((list) => (list ? [{ id, title, template: current.template, thumb, updatedAt: body.updatedAt ?? Date.now() }, ...list.filter((item) => item.id !== id)] : list));
        setSaveState('saved');
      } catch {
        dirtyRef.current = true;
        setSaveState('error');
      }
    }, AUTOSAVE_DELAY);
    return () => window.clearTimeout(timer);
  }, [spec, assets, fontsReady, assetsReady, current]);

  // Datos reales de la app (resultados, goles y minutos) convertidos en la ficha de la plantilla.
  const buildFor = async (id: ImageTemplateId): Promise<TemplateResult> => {
    if (id === 'libre') return buildTemplate(id, [], playerName);
    const response = await fetch(`/api/admin/image-data?community=${encodeURIComponent(communitySlug)}`, { cache: 'no-store' });
    if (!response.ok) throw new Error('No se pudieron cargar los datos de la app.');
    const { matches } = (await response.json()) as { matches: MatchStats[] };
    return buildTemplate(id, matches, playerName);
  };

  // Elegir una plantilla crea la imagen al instante y la deja guardada en el historial.
  const createFromTemplate = async (id: ImageTemplateId) => {
    setCreating(id);
    setPickerError('');
    try {
      const result = await buildFor(id);
      const next = { ...DEFAULT_SPEC, ...result.spec };
      const response = await fetch('/api/admin/images', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ community: communitySlug, template: id, spec: next, title: titleOf(next) }),
      });
      const body = (await response.json().catch(() => ({}))) as { id?: string; updatedAt?: number; error?: string };
      if (!response.ok || !body.id) throw new Error(body.error ?? 'No se pudo crear la imagen.');
      dirtyRef.current = true;
      setSpec(next);
      setTweetText(null);
      setShareMessage(null);
      setWarnings(result.warnings);
      setSaveState('idle');
      setEditing(false);
      setCurrent({ id: body.id, template: id });
      setImages((list) => [{ id: body.id!, title: titleOf(next), template: id, thumb: '', updatedAt: body.updatedAt ?? Date.now() }, ...(list ?? [])]);
    } catch (failure) {
      setPickerError(failure instanceof Error ? failure.message : 'No se pudo crear la imagen.');
    } finally {
      setCreating(null);
    }
  };

  const openImage = async (id: string) => {
    if (current?.id === id) return;
    setOpening(true);
    setPickerError('');
    try {
      const response = await fetch(`/api/admin/images?id=${encodeURIComponent(id)}`, { cache: 'no-store' });
      const body = (await response.json().catch(() => ({}))) as { image?: { id: string; template: string; spec: ImageSpec }; error?: string };
      if (!response.ok || !body.image) throw new Error(body.error ?? 'No se pudo abrir la imagen.');
      dirtyRef.current = false;
      setSpec(sanitizeSpec(body.image.spec));
      setTweetText(null);
      setShareMessage(null);
      setWarnings([]);
      setSaveState('idle');
      setEditing(false);
      setCurrent({ id: body.image.id, template: isTemplateId(body.image.template) ? body.image.template : 'libre' });
    } catch (failure) {
      setPickerError(failure instanceof Error ? failure.message : 'No se pudo abrir la imagen.');
      setCurrent(null);
    } finally {
      setOpening(false);
    }
  };

  const removeImage = async (item: SavedImage) => {
    if (!window.confirm(`¿Borrar "${item.title}" del historial? No se puede deshacer.`)) return;
    await fetch(`/api/admin/images?id=${encodeURIComponent(item.id)}`, { method: 'DELETE' }).catch(() => undefined);
    setImages((list) => list?.filter((other) => other.id !== item.id) ?? list);
    if (current?.id === item.id) {
      dirtyRef.current = false;
      setCurrent(null);
      setEditing(false);
    }
  };

  const newImage = () => {
    dirtyRef.current = false;
    setCurrent(null);
    setEditing(false);
    setPickerError('');
  };

  // Vuelve a calcular los datos con lo que haya ahora en el panel (sustituye los datos y textos de la plantilla).
  const reloadData = async () => {
    if (!current || current.template === 'libre') return;
    if (!window.confirm('Se sustituirán los datos y los textos por los actuales de la app. ¿Continuar?')) return;
    setReloading(true);
    try {
      const result = await buildFor(current.template);
      update(result.spec);
      setWarnings(result.warnings);
    } catch (failure) {
      setWarnings([failure instanceof Error ? failure.message : 'No se pudieron cargar los datos de la app.']);
    } finally {
      setReloading(false);
    }
  };

  const setRow = (index: number, patch: Partial<ImageSpec['rows'][number]>) =>
    update({ rows: spec.rows.map((row, position) => (position === index ? { ...row, ...patch } : row)) });
  const setCard = (index: number, patch: Partial<ImageSpec['cards'][number]>) => {
    const cards = [0, 1, 2].map((position) => spec.cards[position] ?? { value: '', text: '' });
    cards[index] = { ...cards[index], ...patch };
    update({ cards });
  };

  const choosePlayer = (id: string) => {
    const chosen = levantePlayers.find((item) => item.id === id);
    update({ playerId: id, playerCaption: chosen ? chosen.displayName : '', playerSub: chosen ? spec.playerSub : '' });
  };

  // Texto de la publicacion: el que haya escrito el usuario o, mientras no lo toque, uno basado en el titulo.
  const tweet = tweetText ?? `${[spec.title, spec.titleAccent].filter(Boolean).join(' ')} 📊 #GranotaApp`;
  const tweetLeft = TWEET_MAX - TWEET_URL_LENGTH - tweet.length;

  const canvasBlob = () =>
    new Promise<Blob>((resolve, reject) => {
      const canvas = canvasRef.current;
      if (!canvas) return reject(new Error('La imagen todavía no está lista.'));
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('No se pudo crear la imagen.'))), 'image/png');
    });

  const copyImage = async () => {
    // Promesa dentro del ClipboardItem: Safari solo deja copiar si el permiso se pide en el mismo gesto del clic.
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': canvasBlob() })]);
  };

  const onCopy = async () => {
    setShareMessage(null);
    try {
      await copyImage();
      setShareMessage({ ok: true, text: 'Imagen copiada. Pégala donde quieras (Ctrl+V o mantener pulsado → Pegar).' });
    } catch {
      setShareMessage({ ok: false, text: 'Este navegador no deja copiar la imagen. Descárgala y adjúntala a mano.' });
    }
  };

  // En el movil se abre el menu de compartir con la imagen ya adjunta: al elegir X sale la publicacion con la imagen puesta.
  // En el ordenador, X no permite adjuntar una imagen desde un enlace: se copia la imagen y se abre el editor de X (en la cuenta con la
  // que el usuario tenga la sesion iniciada) con el texto y el enlace listos; solo hay que pegar la imagen en la publicacion.
  const onShareX = async () => {
    setShareMessage(null);
    const file = shareFileRef.current;
    const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (mobile && file && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], text: `${tweet} ${SHARE_URL}` });
        setShareMessage({ ok: true, text: 'Compartido. Si has elegido X, la publicación ya llevaba la imagen adjunta.' });
        return;
      } catch (failure) {
        if (failure instanceof DOMException && failure.name === 'AbortError') return;
        // Cualquier otro fallo: se sigue con el metodo de copiar y pegar.
      }
    }
    const popup = window.open('', '_blank');
    let copied = true;
    try {
      await copyImage();
    } catch {
      copied = false;
    }
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweet)}&url=${encodeURIComponent(SHARE_URL)}`;
    if (popup) popup.location.href = url;
    else window.location.href = url;
    setShareMessage(copied
      ? { ok: true, text: 'Se ha abierto X con el texto y el enlace. La imagen está copiada: pégala en la publicación (Ctrl+V o mantener pulsado → Pegar).' }
      : { ok: false, text: 'Se ha abierto X con el texto y el enlace, pero este navegador no deja copiar la imagen: descárgala y adjúntala a mano.' });
  };

  const download = () => {
    canvasRef.current?.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const name = titleOf(spec).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      link.href = url;
      link.download = `granota-${name || 'estadistica'}.png`;
      link.click();
      URL.revokeObjectURL(url);
    }, 'image/png');
  };

  const formatDate = (value: number) => new Date(value).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const templateLabel = IMAGE_TEMPLATES.find((item) => item.id === current?.template)?.name ?? '';

  return (
    <div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="space-y-3">
        <Button onClick={newImage} className="w-full bg-[#153e72] font-black text-white">
          <Plus className="size-4" /> Nueva imagen
        </Button>
        <div className="max-h-72 overflow-y-auto rounded-2xl bg-white p-2 shadow-sm ring-1 ring-slate-200 lg:max-h-[75vh]" aria-label="Historial de imágenes">
          <p className="px-2 pb-1 pt-1 text-xs font-black uppercase text-slate-400">Mis imágenes</p>
          {images === null && <p className="px-2 py-3 text-sm text-slate-400">Cargando…</p>}
          {images?.length === 0 && <p className="px-2 py-3 text-sm text-slate-500">Todavía no has creado ninguna imagen. Elige una plantilla y aparecerá aquí.</p>}
          {images?.map((item) => (
            <div key={item.id} className={`flex items-center gap-1 rounded-xl p-1.5 ${current?.id === item.id ? 'bg-sky-50 ring-1 ring-sky-200' : 'hover:bg-slate-50'}`}>
              <button type="button" onClick={() => void openImage(item.id)} disabled={opening} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-label={`Abrir ${item.title}`}>
                {item.thumb
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={item.thumb} alt="" className="h-14 w-11 shrink-0 rounded-md object-cover ring-1 ring-slate-200" />
                  : <span className="grid h-14 w-11 shrink-0 place-items-center rounded-md bg-slate-100 text-slate-300"><ImagePlus className="size-4" /></span>}
                <span className="min-w-0">
                  <strong className="line-clamp-2 block text-sm font-black leading-tight text-[#071527]">{item.title}</strong>
                  <span className="block text-xs text-slate-400">{formatDate(item.updatedAt)}</span>
                </span>
              </button>
              <button type="button" onClick={() => void removeImage(item)} aria-label={`Borrar ${item.title}`} className="grid size-8 shrink-0 place-items-center rounded-full text-slate-400 hover:bg-rose-50 hover:text-[#a91d43]">
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
        </div>
      </aside>

      <div className="min-w-0">
        {!current && (
          <Card className="border-0 shadow-sm ring-slate-200">
            <CardContent className="space-y-4">
              <div>
                <h3 className="text-lg font-black text-[#071527]">Crea una imagen</h3>
                <p className="text-sm text-slate-500">Elige una plantilla y la imagen se genera sola con los datos de la app. Se guarda en tu historial y podrás editarla cuando quieras.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {IMAGE_TEMPLATES.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => void createFromTemplate(item.id)}
                    disabled={creating !== null || opening || item.id === 'libre'}
                    className="flex flex-col items-start gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-[#153e72] hover:bg-sky-50 disabled:opacity-60 disabled:hover:border-slate-200 disabled:hover:bg-slate-50 disabled:cursor-not-allowed"
                  >
                    <span className="grid size-10 place-items-center rounded-xl bg-[#153e72] text-white">
                      {creating === item.id ? <Loader2 className="size-5 animate-spin" /> : item.id === 'libre' ? <Plus className="size-5" /> : <ImagePlus className="size-5" />}
                    </span>
                    <strong className="text-base font-black leading-tight text-[#071527]">{item.label}</strong>
                    {item.id === 'libre' && <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-black uppercase text-slate-500">Próximamente</span>}
                    <span className="text-xs text-slate-500">{item.description}</span>
                  </button>
                ))}
              </div>
              {(creating !== null || opening) && <p className="text-sm font-bold text-slate-500">{creating !== null ? 'Generando la imagen…' : 'Abriendo la imagen…'}</p>}
              {pickerError && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm font-bold text-[#a91d43]">{pickerError}</p>}
            </CardContent>
          </Card>
        )}

        {current && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate text-lg font-black text-[#071527]">{titleOf(spec)}</h3>
                <p className="text-xs text-slate-400">
                  Plantilla: {templateLabel} ·{' '}
                  {saveState === 'saving' ? 'Guardando…' : saveState === 'error' ? 'No se pudo guardar; se reintentará con el próximo cambio' : saveState === 'saved' ? 'Guardada en el historial ✓' : 'Se guarda sola en el historial'}
                </p>
              </div>
              <Button type="button" variant={editing ? 'default' : 'outline'} onClick={() => setEditing((value) => !value)} className={`font-black ${editing ? 'bg-[#153e72] text-white' : ''}`}>
                <Pencil className="size-4" /> {editing ? 'Cerrar edición' : 'Editar imagen'}
              </Button>
            </div>

            <div className={editing ? 'grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]' : ''}>
              {editing && (
                <div className="space-y-5">
                  {current.template !== 'libre' && (
                    <Card className="border-0 shadow-sm ring-slate-200">
                      <CardContent className="space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-sm text-slate-500">Los datos vienen de la app. Si has cambiado resultados o goles, recárgalos.</span>
                          <Button type="button" variant="outline" disabled={reloading} onClick={() => void reloadData()} className="font-black">
                            {reloading ? <Loader2 className="animate-spin" /> : <RefreshCw className="size-4" />} Recargar datos
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  <Card className="border-0 shadow-sm ring-slate-200">
                    <CardContent className="space-y-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field id="img-layout" label="Tipo de gráfico">
                          <NativeSelect id="img-layout" value={spec.layout} onChange={(event) => update({ layout: event.target.value as ImageSpec['layout'] })} className="w-full">
                            <NativeSelectOption value="barras">Barras verticales (tramos, jornadas…)</NativeSelectOption>
                            <NativeSelectOption value="ranking">Ranking horizontal (jugadores, equipos…)</NativeSelectOption>
                          </NativeSelect>
                        </Field>
                        <Field label="Porcentajes">
                          <label className="flex h-9 items-center gap-2 text-sm font-bold text-slate-600">
                            <input type="checkbox" checked={spec.showPercent} onChange={(event) => update({ showPercent: event.target.checked })} className="size-4" />
                            Mostrar % sobre el total
                          </label>
                        </Field>
                      </div>

                      <div>
                        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                          <span className={labelClass + ' mb-0'}>Datos ({spec.rows.length}/{MAX_ROWS})</span>
                          <div className="flex gap-2">
                            <Button type="button" size="sm" variant="outline" onClick={() => update({ rows: QUARTER_LABELS.map((label) => ({ label, value: 0 })), dividerAfter: 3 })}>Tramos de 15 min</Button>
                            <Button type="button" size="sm" variant="outline" onClick={() => update({ rows: [] })}>Vaciar</Button>
                          </div>
                        </div>
                        <div className="space-y-2">
                          {spec.rows.map((row, index) => (
                            <div key={index} className="flex items-center gap-2">
                              <Input aria-label={`Etiqueta ${index + 1}`} value={row.label} maxLength={30} onChange={(event) => setRow(index, { label: event.target.value })} className="h-10 flex-1" />
                              <Input aria-label={`Valor ${index + 1}`} type="number" min={0} step="any" value={Number.isFinite(row.value) ? row.value : 0} onChange={(event) => setRow(index, { value: Math.max(0, Number(event.target.value) || 0) })} className="h-10 w-24" />
                              <Button type="button" size="icon" variant="outline" aria-label="Quitar fila" onClick={() => update({ rows: spec.rows.filter((_, position) => position !== index) })}><Minus className="size-4" /></Button>
                            </div>
                          ))}
                        </div>
                        <Button type="button" size="sm" variant="outline" className="mt-2" disabled={spec.rows.length >= MAX_ROWS} onClick={() => update({ rows: [...spec.rows, { label: '', value: 0 }] })}>
                          <Plus className="size-4" /> Añadir dato
                        </Button>
                      </div>

                      {spec.layout === 'barras' && (
                        <div className="grid gap-3 sm:grid-cols-3">
                          <Field id="img-divider" label="Línea tras la columna (0 = ninguna)">
                            <Input id="img-divider" type="number" min={0} max={spec.rows.length} value={spec.dividerAfter} onChange={(event) => update({ dividerAfter: Math.max(0, Math.round(Number(event.target.value) || 0)) })} className="h-10" />
                          </Field>
                          <Field id="img-div-left" label="Etiqueta izquierda">
                            <Input id="img-div-left" value={spec.dividerLabels[0]} maxLength={20} onChange={(event) => update({ dividerLabels: [event.target.value, spec.dividerLabels[1]] })} className="h-10" />
                          </Field>
                          <Field id="img-div-right" label="Etiqueta derecha">
                            <Input id="img-div-right" value={spec.dividerLabels[1]} maxLength={20} onChange={(event) => update({ dividerLabels: [spec.dividerLabels[0], event.target.value] })} className="h-10" />
                          </Field>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="border-0 shadow-sm ring-slate-200">
                    <CardContent className="space-y-3">
                      <Field id="img-kicker" label="Texto pequeño superior"><Input id="img-kicker" value={spec.kicker} maxLength={60} onChange={(event) => update({ kicker: event.target.value })} className="h-10" /></Field>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field id="img-title" label="Título (blanco)"><Input id="img-title" value={spec.title} maxLength={40} onChange={(event) => update({ title: event.target.value })} className="h-10" /></Field>
                        <Field id="img-accent" label="Título (rojo)"><Input id="img-accent" value={spec.titleAccent} maxLength={40} onChange={(event) => update({ titleAccent: event.target.value })} className="h-10" /></Field>
                      </div>
                      <Field id="img-subtitle" label="Subtítulo"><Textarea id="img-subtitle" value={spec.subtitle} rows={2} maxLength={220} onChange={(event) => update({ subtitle: event.target.value })} /></Field>
                      <Field id="img-footer" label="Pie (fuente)"><Textarea id="img-footer" value={spec.footer} rows={2} maxLength={240} onChange={(event) => update({ footer: event.target.value })} /></Field>
                    </CardContent>
                  </Card>

                  <Card className="border-0 shadow-sm ring-slate-200">
                    <CardContent className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className={labelClass + ' mb-0'}>Tarjetas con datos clave (máx. 3)</span>
                        <Button type="button" size="sm" variant="outline" onClick={() => update({ cards: suggestCards(spec.rows) })}>Calcular desde los datos</Button>
                      </div>
                      {[0, 1, 2].map((index) => (
                        <div key={index} className="flex gap-2">
                          <Input aria-label={`Cifra de la tarjeta ${index + 1}`} placeholder="69%" value={spec.cards[index]?.value ?? ''} maxLength={10} onChange={(event) => setCard(index, { value: event.target.value })} className="h-10 w-28" />
                          <Input aria-label={`Texto de la tarjeta ${index + 1}`} placeholder="de los goles llegan en la 2ª parte" value={spec.cards[index]?.text ?? ''} maxLength={80} onChange={(event) => setCard(index, { text: event.target.value })} className="h-10 flex-1" />
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  <Card className="border-0 shadow-sm ring-slate-200">
                    <CardContent className="space-y-3">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field id="img-bg" label="Fondo">
                          <NativeSelect id="img-bg" value={spec.background} onChange={(event) => update({ background: event.target.value as ImageSpec['background'] })} className="w-full">
                            {Object.entries(BACKGROUNDS).map(([key, item]) => <NativeSelectOption key={key} value={key}>{item.label}</NativeSelectOption>)}
                            <NativeSelectOption value="ninguno">Sin foto (degradado)</NativeSelectOption>
                          </NativeSelect>
                        </Field>
                        <Field id="img-player" label="Jugador destacado">
                          <NativeSelect id="img-player" value={spec.playerId} onChange={(event) => choosePlayer(event.target.value)} className="w-full">
                            <NativeSelectOption value="">Ninguno</NativeSelectOption>
                            {sortedPlayers.map((item) => <NativeSelectOption key={item.id} value={item.id}>{item.number ? `${item.number} · ` : ''}{item.displayName}</NativeSelectOption>)}
                          </NativeSelect>
                        </Field>
                      </div>
                      {spec.playerId && (
                        <div className="grid gap-3 sm:grid-cols-2">
                          <Field id="img-caption" label="Texto del jugador"><Input id="img-caption" value={spec.playerCaption} maxLength={40} onChange={(event) => update({ playerCaption: event.target.value })} className="h-10" /></Field>
                          <Field id="img-playersub" label="Detalle"><Input id="img-playersub" value={spec.playerSub} maxLength={50} onChange={(event) => update({ playerSub: event.target.value })} className="h-10" /></Field>
                        </div>
                      )}
                      {spec.background !== 'ninguno' && <p className="text-xs text-slate-400">Con foto de fondo, el pie incluye automáticamente el crédito del autor (licencia CC BY-SA).</p>}
                      {assetError && <p role="alert" className="text-sm font-bold text-[#a91d43]">{assetError}</p>}
                    </CardContent>
                  </Card>
                </div>
              )}

              <div className={editing ? 'order-first xl:sticky xl:top-4 xl:order-last xl:self-start' : 'mx-auto w-full max-w-md'}>
                <Card className="border-0 shadow-sm ring-slate-200">
                  <CardContent className="space-y-3">
                    <canvas ref={canvasRef} aria-label="Vista previa de la imagen" className="h-auto w-full rounded-xl bg-[#050b18]" style={{ aspectRatio: '1080 / 1350' }} />
                    {warnings.map((warning) => <p key={warning} className="rounded-xl bg-amber-50 p-3 text-xs font-bold text-amber-900">{warning}</p>)}
                    <Button onClick={download} disabled={!fontsReady} className="w-full bg-[#a91d43] font-black text-white">
                      <Download className="size-4" /> Descargar PNG (1620×2025)
                    </Button>
                    <Button variant="outline" onClick={() => void onCopy()} disabled={!fontsReady} className="w-full font-black">
                      <Copy className="size-4" /> Copiar imagen
                    </Button>
                    <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <label htmlFor="img-tweet" className={labelClass + ' mb-0 flex items-center justify-between'}>
                        <span>Publicación en X</span>
                        <span className={tweetLeft < 0 ? 'text-[#a91d43]' : ''}>{tweetLeft}</span>
                      </label>
                      <Textarea id="img-tweet" value={tweet} rows={3} onChange={(event) => setTweetText(event.target.value)} />
                      <p className="text-xs text-slate-500">Se añade el enlace {SHARE_URL.replace('https://', '')}.</p>
                      <Button onClick={() => void onShareX()} disabled={!fontsReady || tweetLeft < 0} className="w-full bg-black font-black text-white hover:bg-slate-800">
                        <span aria-hidden className="text-base leading-none">𝕏</span> Publicar en X
                      </Button>
                    </div>
                    {shareMessage && (
                      <p role="status" className={`flex items-start gap-2 rounded-xl p-3 text-xs font-bold ${shareMessage.ok ? 'bg-emerald-50 text-emerald-900' : 'bg-amber-50 text-amber-900'}`}>
                        {shareMessage.ok && <Check className="mt-0.5 size-4 shrink-0" />}{shareMessage.text}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
