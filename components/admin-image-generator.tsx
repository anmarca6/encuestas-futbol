'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, Loader2, Minus, Plus, Sparkles } from 'lucide-react';
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
  sanitizeAiSpec,
  suggestCards,
  type ImageAssets,
  type ImageSpec,
} from '@/lib/image-generator';

const labelClass = 'mb-1 block text-xs font-black uppercase text-slate-400';

function Field({ id, label, children }: { id?: string; label: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className={labelClass}>{label}</label>
      {children}
    </div>
  );
}

// Generador de imagenes estadisticas: los datos solo viven en esta pantalla (no se guardan) y la imagen se descarga como PNG.
export function ImageGenerator() {
  const [spec, setSpec] = useState<ImageSpec>(DEFAULT_SPEC);
  const [assets, setAssets] = useState<ImageAssets>({ background: null, player: null });
  const [fontsReady, setFontsReady] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState('');
  const [assetError, setAssetError] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const update = (patch: Partial<ImageSpec>) => setSpec((current) => ({ ...current, ...patch }));
  const player = useMemo(() => levantePlayers.find((item) => item.id === spec.playerId) ?? null, [spec.playerId]);
  const sortedPlayers = useMemo(() => [...levantePlayers].sort((a, b) => a.displayName.localeCompare(b.displayName, 'es')), []);

  useEffect(() => {
    void ensureImageFonts().then(() => setFontsReady(true));
  }, []);

  // Fondo y foto del jugador: se cargan al elegirlos.
  useEffect(() => {
    let cancelled = false;
    setAssetError('');
    const backgroundSrc = spec.background === 'ninguno' ? null : BACKGROUNDS[spec.background].src;
    Promise.all([
      backgroundSrc ? loadImage(backgroundSrc) : Promise.resolve(null),
      player?.image ? loadImage(player.image) : Promise.resolve(null),
    ])
      .then(([background, playerImage]) => { if (!cancelled) setAssets({ background, player: playerImage }); })
      .catch(() => { if (!cancelled) setAssetError('No se ha podido cargar el fondo o la foto del jugador.'); });
    return () => { cancelled = true; };
  }, [spec.background, player]);

  useEffect(() => {
    if (!fontsReady || !canvasRef.current) return;
    renderInfographic(canvasRef.current, spec, assets);
  }, [spec, assets, fontsReady]);

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

  const askAi = async () => {
    setAiBusy(true);
    setAiError('');
    try {
      const response = await fetch('/api/admin/image-ai', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prompt: aiPrompt }),
      });
      const body = (await response.json().catch(() => ({}))) as { spec?: unknown; error?: string };
      if (!response.ok || !body.spec) throw new Error(body.error ?? 'No se pudo generar la ficha con IA.');
      update(sanitizeAiSpec(body.spec));
    } catch (failure) {
      setAiError(failure instanceof Error ? failure.message : 'No se pudo generar la ficha con IA.');
    } finally {
      setAiBusy(false);
    }
  };

  const download = () => {
    canvasRef.current?.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const name = `${spec.title} ${spec.titleAccent}`.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      link.href = url;
      link.download = `granota-${name || 'estadistica'}.png`;
      link.click();
      URL.revokeObjectURL(url);
    }, 'image/png');
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="space-y-5">
        <Card className="border-0 shadow-sm ring-slate-200">
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2 font-black text-[#071527]"><Sparkles className="size-4 text-[#a91d43]" /> Rellenar con IA</div>
            <p className="text-sm text-slate-500">
              Escribe los datos con tus palabras y la IA monta el título, el gráfico y las tarjetas. Después puedes retocar todo a mano. Lo que escribas no se guarda en la app.
            </p>
            <Textarea
              id="image-ai-prompt"
              value={aiPrompt}
              rows={4}
              maxLength={4000}
              placeholder="Ej.: Goles encajados por el Levante según el minuto: 1-15: 2, 16-30: 3, 31-45: 1, 46-60: 4, 61-75: 2, 76-90: 5, 90+: 3. Son 20 goles en 11 jornadas."
              onChange={(event) => setAiPrompt(event.target.value)}
            />
            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={() => void askAi()} disabled={aiBusy || !aiPrompt.trim()} className="bg-[#153e72] font-black text-white">
                {aiBusy ? <Loader2 className="animate-spin" /> : <Sparkles className="size-4" />} Generar con IA
              </Button>
              {aiBusy && <span className="text-xs text-slate-500">Pensando… puede tardar unos segundos.</span>}
            </div>
            {aiError && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm font-bold text-[#a91d43]">{aiError}</p>}
          </CardContent>
        </Card>

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

      <div className="lg:sticky lg:top-4 lg:self-start">
        <Card className="border-0 shadow-sm ring-slate-200">
          <CardContent className="space-y-3">
            <canvas ref={canvasRef} aria-label="Vista previa de la imagen" className="h-auto w-full rounded-xl bg-[#050b18]" style={{ aspectRatio: '1080 / 1350' }} />
            <Button onClick={download} disabled={!fontsReady} className="w-full bg-[#a91d43] font-black text-white">
              <Download className="size-4" /> Descargar PNG (1620×2025)
            </Button>
            <p className="text-xs text-slate-400">Formato vertical, pensado para redes sociales. La imagen se crea en tu navegador y no se guarda en la app.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
