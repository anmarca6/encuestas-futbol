'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Award, Check, Copy, Download, Loader2, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { communityFetch, currentCommunitySlug } from '@/lib/community-client';
import type { CommunityRankingEntry, CommunityUser } from '@/lib/community-types';
import { renderDiploma, loadAvatar, type DiplomaData } from '@/lib/diploma-image';
import { BACKGROUNDS, ensureImageFonts, loadImage } from '@/lib/image-generator';
import { CUP_MATCHDAY_OFFSET, levanteMatches } from '@/lib/levante-data';

const TWEET_MAX = 280;
const TWEET_URL_LENGTH = 24;

// La ultima jornada con datos oficiales (la mas reciente por fecha): es la "edicion" del diploma. Cada jornada nueva da un diploma nuevo.
function latestMatchday(reports: Array<{ matchday: number }>): number | null {
  const dated = reports
    .map((report) => ({ matchday: report.matchday, date: levanteMatches.find((match) => match.matchday === report.matchday)?.date ?? '' }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.matchday - b.matchday);
  return dated.length ? dated[dated.length - 1].matchday : null;
}

const editionLabel = (matchday: number) => (matchday > CUP_MATCHDAY_OFFSET ? 'Tras la Copa del Rey' : `Tras la jornada ${matchday}`);

// Datos del diploma a partir de la clasificacion de la comunidad: puesto, total, puntos y cuanto ha subido o bajado en la ultima jornada.
export function buildDiplomaData(ranking: CommunityRankingEntry[], user: CommunityUser, matchday: number, communityName: string, url: string, displayUrl: string): DiplomaData | null {
  const index = ranking.findIndex((entry) => entry.userId === user.id);
  if (index < 0) return null;
  const me = ranking[index];
  const gained = (entry: CommunityRankingEntry) => entry.matchBreakdowns.find((item) => item.matchday === matchday)?.points ?? 0;
  // Clasificacion antes de esa jornada: sin sus puntos y sin quien solo tiene pronosticos de ella (aun no estaba).
  const before = ranking
    .filter((entry) => entry.matchBreakdowns.some((item) => item.matchday !== matchday))
    .map((entry) => ({ userId: entry.userId, nickname: entry.nickname, points: entry.points - gained(entry) }))
    .sort((a, b) => b.points - a.points || a.nickname.localeCompare(b.nickname, 'es', { sensitivity: 'base' }));
  const previous = before.findIndex((entry) => entry.userId === user.id);
  const played = me.matchBreakdowns.some((item) => item.matchday === matchday);
  return {
    nickname: me.nickname,
    position: index + 1,
    total: ranking.length,
    points: me.points,
    matchdayPoints: played ? gained(me) : null,
    movement: previous < 0 ? null : previous - index,
    predictions: me.predictions,
    edition: editionLabel(matchday),
    communityName,
    url,
    displayUrl,
  };
}

// Boton "Mi diploma" y la ventana con la imagen para descargarla o compartirla (WhatsApp, X, Instagram...).
export function DiplomaButton({ ranking, user }: { ranking: CommunityRankingEntry[]; user: CommunityUser }) {
  const [open, setOpen] = useState(false);
  const [matchday, setMatchday] = useState<number | null | undefined>(undefined);
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<File | null>(null);

  const slug = typeof window === 'undefined' ? '' : currentCommunitySlug();
  const communityName = slug === 'granota' ? 'Granota App' : slug;
  const { url, displayUrl } = useMemo(() => {
    if (typeof window === 'undefined') return { url: '', displayUrl: '' };
    const path = slug === 'granota' ? '' : `/${slug}`;
    return { url: `${window.location.origin}${path}?ref=diploma`, displayUrl: `${window.location.host}${path}` };
  }, [slug]);

  useEffect(() => {
    if (!open || matchday !== undefined) return;
    void communityFetch('/api/reports')
      .then(async (response) => (await response.json()) as { reports?: Array<{ matchday: number }> })
      .then((result) => setMatchday(latestMatchday(result.reports ?? [])))
      .catch(() => setMatchday(null));
  }, [open, matchday]);

  const data = useMemo(() => (matchday ? buildDiplomaData(ranking, user, matchday, communityName, url, displayUrl) : null), [ranking, user, matchday, communityName, url, displayUrl]);

  useEffect(() => {
    if (!open || !data) return;
    let cancelled = false;
    setReady(false);
    fileRef.current = null;
    void (async () => {
      await ensureImageFonts();
      const [background, avatar] = await Promise.all([loadImage(BACKGROUNDS.nocturna.src).catch(() => null), loadAvatar(user.avatarUrl)]);
      if (cancelled || !canvasRef.current) return;
      renderDiploma(canvasRef.current, data, { background, avatar });
      // JPEG: pesa mucho menos y todas las redes lo aceptan; el menu de compartir del movil exige tener el archivo listo antes del toque.
      canvasRef.current.toBlob((blob) => {
        if (blob && !cancelled) fileRef.current = new File([blob], `diploma-granota-${data.nickname}.jpg`, { type: 'image/jpeg' });
      }, 'image/jpeg', 0.92);
      setReady(true);
    })();
    return () => { cancelled = true; };
  }, [open, data, user.avatarUrl]);

  const text = data
    ? `Voy ${data.position}.º de ${data.total} en la porra granota${data.communityName === 'Granota App' ? '' : ` de ${data.communityName}`}. ¿Te atreves a superarme? 💙❤️ #GranotaApp`
    : '';
  const tweet = text.slice(0, TWEET_MAX - TWEET_URL_LENGTH - 1);

  const canvasBlob = useCallback(() => new Promise<Blob>((resolve, reject) => {
    const canvas = canvasRef.current;
    if (!canvas) return reject(new Error('La imagen todavía no está lista.'));
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('No se pudo crear la imagen.'))), 'image/png');
  }), []);

  const download = () => {
    void canvasBlob().then((blob) => {
      const href = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = href;
      link.download = `diploma-granota-${data?.nickname ?? 'usuario'}.png`;
      link.click();
      URL.revokeObjectURL(href);
    });
  };

  // Menu nativo del movil (WhatsApp, Instagram, X, Telegram...) con la imagen ya adjunta.
  const nativeShare = async () => {
    setMessage(null);
    const file = fileRef.current;
    if (file && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], text: `${text} ${url}` });
        return;
      } catch (failure) {
        if (failure instanceof DOMException && failure.name === 'AbortError') return;
      }
    }
    setMessage({ ok: false, text: 'Este navegador no puede compartir la imagen directamente. Descárgala y súbela a la red que prefieras.' });
  };

  const copyImage = async () => {
    // Promesa dentro del ClipboardItem: Safari solo deja copiar si el permiso se pide en el mismo gesto del clic.
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': canvasBlob() })]);
  };

  const shareWhatsApp = () => {
    setMessage(null);
    window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`, '_blank', 'noopener');
    setMessage({ ok: true, text: 'WhatsApp se abre con el texto y el enlace. Para enviar también la imagen, usa «Compartir…» o descárgala y adjúntala.' });
  };

  const shareX = async () => {
    setMessage(null);
    let copied = true;
    try {
      await copyImage();
    } catch {
      copied = false;
    }
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(tweet)}&url=${encodeURIComponent(url)}`, '_blank', 'noopener');
    setMessage(copied
      ? { ok: true, text: 'Se abre X con el texto y el enlace. La imagen está copiada: pégala en la publicación (Ctrl+V o mantener pulsado → Pegar).' }
      : { ok: false, text: 'Se abre X con el texto y el enlace. Descarga la imagen y adjúntala a mano.' });
  };

  const shareInstagram = () => {
    download();
    setMessage({ ok: true, text: 'Imagen descargada. Instagram no permite publicar desde un enlace: ábrelo y súbela como publicación o historia (o usa «Compartir…» en el móvil).' });
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
      setMessage({ ok: true, text: 'Texto y enlace copiados.' });
    } catch {
      setMessage({ ok: false, text: 'No se pudo copiar. Selecciona y copia el enlace a mano.' });
    }
  };

  const canShareNatively = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)} className="bg-[#a91d43] font-black text-white hover:bg-[#8d1738]">
        <Award className="size-4" /> Mi diploma
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[94dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-[#071527]">Tu diploma de la jornada</DialogTitle>
            <DialogDescription>Presume de puesto y anima a más gente a jugar: cada diploma lleva el botón Participa y un QR que lleva a la app.</DialogDescription>
          </DialogHeader>
          {matchday === undefined && <p className="flex items-center gap-2 py-6 text-sm font-bold text-slate-500"><Loader2 className="size-4 animate-spin" /> Preparando tu diploma…</p>}
          {matchday === null && <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">Todavía no hay ninguna jornada con puntos. Tu diploma estará listo en cuanto se puntúe el primer partido.</p>}
          {matchday !== undefined && matchday !== null && !data && <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">Aún no apareces en la clasificación: publica tu primer pronóstico y tendrás tu diploma.</p>}
          {data && (
            <div className="space-y-4">
              <div className="relative overflow-hidden rounded-2xl bg-[#050b18] shadow-md ring-1 ring-slate-200">
                <canvas ref={canvasRef} className="block h-auto w-full" aria-label={`Diploma de @${data.nickname}: ${data.position}.º de ${data.total}`} />
                {!ready && <div className="absolute inset-0 grid place-items-center bg-[#050b18]/80 text-white"><Loader2 className="size-6 animate-spin" /></div>}
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {canShareNatively && (
                  <Button type="button" onClick={() => void nativeShare()} disabled={!ready} className="col-span-2 bg-[#153e72] font-black text-white sm:col-span-3">
                    <Share2 className="size-4" /> Compartir…
                  </Button>
                )}
                <Button type="button" variant="outline" onClick={shareWhatsApp} disabled={!ready} className="font-black">WhatsApp</Button>
                <Button type="button" variant="outline" onClick={() => void shareX()} disabled={!ready} className="font-black">X (Twitter)</Button>
                <Button type="button" variant="outline" onClick={shareInstagram} disabled={!ready} className="font-black">Instagram</Button>
                <Button type="button" variant="outline" onClick={download} disabled={!ready} className="font-black"><Download className="size-4" /> Descargar</Button>
                <Button type="button" variant="outline" onClick={() => void copyLink()} disabled={!ready} className="font-black"><Copy className="size-4" /> Copiar texto</Button>
              </div>
              {message && (
                <p role="status" className={`flex items-start gap-2 rounded-xl p-3 text-xs font-bold ${message.ok ? 'bg-emerald-50 text-emerald-900' : 'bg-amber-50 text-amber-900'}`}>
                  {message.ok && <Check className="mt-0.5 size-3.5 shrink-0" />} {message.text}
                </p>
              )}
              <p className="text-center text-[11px] text-slate-400">Un botón dentro de una imagen no se puede pulsar: por eso lleva el QR y el enlace, y al compartir se envía también el enlace directo.</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
