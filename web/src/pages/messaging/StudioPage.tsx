/**
 * App Social → Estudio de contenido. Arma piezas para redes con la marca: elige qué promocionar
 * (producto, colección, promoción, diseño o prenda personalizable), el formato (post, historia, reel
 * o video 360° del maniquí) y la plantilla; la IA escribe los textos. Se descarga, se guarda en la
 * biblioteca y se publica o programa en Facebook e Instagram (ver CalendarPage).
 */
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarClock, Download, Film, Palette, Pause, Play, Save, Send, Sparkles, Wand2, X } from 'lucide-react';
import {
  Alert, Badge, Button, Card, CardTitle, Checkbox, Dialog, Field, FormActions, Page, PageHeader, RadioGroup, SearchInput,
  SelectInput, Spinner, Switch, TextArea, TextInput, toast,
} from '../../components/ui';
import { errorMessage } from '../../lib/http';
import { useBrandKit } from '../../components/marketing/brand';
import {
  drawReel, drawScenes, drawStill, reelLength, sizeOf, TEMPLATES, type Format, type PieceItem, type PieceSpec, type TemplateId,
} from '../../components/marketing/render';
import { layout, motionAt, newScene, slotsAt, type Scene } from '../../components/marketing/timeline';
import { sceneArt } from '../../components/marketing/sceneArt';
import { SceneEditor } from '../../components/marketing/SceneEditor';
import { extOf, loadImage, recordCanvas, videoMime } from '../../components/marketing/media';
import { AiAccountsCard } from '../../components/marketing/AiAccountsCard';
import { isModel3D } from '../../components/mannequin/models';
import { useModels3D } from '../../components/mannequin/useModels3D';
import {
  marketingService, type CopyTone, type Creative, type SourceCollection, type SourceDesign, type SourceProduct, type SourcePromotion, type SourceType,
} from '../../services/marketing.service';

const Mannequin3D = lazy(() => import('../../components/mannequin/Mannequin3D'));

const SOURCES: { value: SourceType; label: string }[] = [
  { value: 'producto', label: 'Productos' },
  { value: 'coleccion', label: 'Colección' },
  { value: 'promocion', label: 'Promoción' },
  { value: 'diseno', label: 'Diseños' },
  { value: 'plantilla', label: 'Personalizable' },
];

const FORMATS: { value: Format; label: string }[] = [
  { value: 'post', label: 'Post 1:1' },
  { value: 'historia', label: 'Historia 9:16' },
  { value: 'reel', label: 'Reel (video)' },
  { value: 'video360', label: 'Video 360°' },
];

const TONES: { value: CopyTone; label: string }[] = [
  { value: 'cercano', label: 'Cercano' }, { value: 'urgente', label: 'Urgente' }, { value: 'elegante', label: 'Elegante' },
  { value: 'divertido', label: 'Divertido' }, { value: 'inspirador', label: 'Inspirador' },
];

/** Plantilla sugerida para cada fuente. */
const SUGGESTED: Record<SourceType, TemplateId> = { producto: 'destacado', coleccion: 'coleccion', promocion: 'oferta', diseno: 'personaliza', plantilla: 'personaliza' };

const MAX_ITEMS: Record<SourceType, number> = { producto: 5, coleccion: 1, promocion: 1, diseno: 4, plantilla: 1 };

type AnySource = SourceProduct | SourceCollection | SourcePromotion | SourceDesign;

/** Primera escena del video 3D: un giro completo de la prenda en su color. */
const firstScene = (color: string) => newScene({ color, motion: 'giro', seconds: 6, transition: 'fundido' });

const canvasOf = (h: RefObject<HTMLDivElement | null>) => (h.current?.querySelector('canvas') as HTMLCanvasElement | null) ?? null;

export const StudioPage = () => {
  const navigate = useNavigate();
  // Ficha de la marca (Social → Marca): colores, logos, tipografía y voz.
  const { kit, brand } = useBrandKit();
  useModels3D();

  // 1. Qué se promociona
  const [sourceType, setSourceType] = useState<SourceType>('producto');
  const [q, setQ] = useState('');
  const [options, setOptions] = useState<AnySource[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [selected, setSelected] = useState<AnySource[]>([]);

  // 2. Formato y plantilla
  const [format, setFormat] = useState<Format>('post');
  const [template, setTemplate] = useState<TemplateId>('destacado');
  const [stage, setStage] = useState<'claro' | 'oscuro'>('oscuro');
  // Video 3D por escenas: cada una con su diseño, color, movimiento, textos y transición.
  const [scenes, setScenes] = useState<Scene[]>(() => [firstScene('#FFFFFF')]);
  const [sceneSel, setSceneSel] = useState<string | null>(null);
  const [endCard, setEndCard] = useState(true);
  /** Qué escena muestra cada uno de los dos maniquíes (se turnan para las transiciones). */
  const [slots, setSlots] = useState<[number, number]>([0, -1]);
  /** Segundo que se ve en pausa (la escena elegida). */
  const [pausedAt, setPausedAt] = useState(3);

  // 3. Textos
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [cta, setCta] = useState('Compra ya');
  const [showPrice, setShowPrice] = useState(true);
  const [caption, setCaption] = useState('');
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [tone, setTone] = useState<CopyTone>('cercano');
  const [brief, setBrief] = useState('');
  const [writing, setWriting] = useState(false);

  // Lienzo y salida
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const holder3d = useRef<HTMLDivElement>(null);
  const holder3dB = useRef<HTMLDivElement>(null);
  const motionA = useRef({ turn: 0, zoom: 1 });
  const motionB = useRef({ turn: 0, zoom: 1 });
  const playheadRef = useRef<HTMLDivElement | null>(null);
  const recording = useRef(false);
  const [images, setImages] = useState<Record<string, HTMLImageElement | null>>({});
  const [playing, setPlaying] = useState(false);
  const [busy, setBusy] = useState<null | 'download' | 'save' | 'publish'>(null);
  const [progress, setProgress] = useState(0);
  const [publishFor, setPublishFor] = useState<Creative | null>(null);

  // El tono por defecto es el de la ficha de la marca.
  const kitTone = kit?.voice.tone;
  useEffect(() => { if (kitTone) setTone(kitTone); }, [kitTone]);

  // Opciones de la fuente elegida.
  useEffect(() => {
    let alive = true;
    setLoadingOptions(true);
    const t = window.setTimeout(() => {
      marketingService.sources<AnySource>(sourceType, q)
        .then((r) => { if (alive) setOptions(r); })
        .catch((e) => { if (alive) toast.error(errorMessage(e, 'No se pudieron cargar las opciones')); })
        .finally(() => { if (alive) setLoadingOptions(false); });
    }, q ? 300 : 0);
    return () => { alive = false; window.clearTimeout(t); };
  }, [sourceType, q]);

  const changeSource = (t: SourceType) => {
    setSourceType(t);
    setSelected([]);
    setQ('');
    setTemplate(SUGGESTED[t]);
    if (format === 'video360' && t !== 'plantilla') setFormat('post');
  };

  const toggle = (o: AnySource) => {
    setSelected((prev) => {
      const has = prev.some((p) => p.id === o.id);
      if (has) return prev.filter((p) => p.id !== o.id);
      const max = MAX_ITEMS[sourceType];
      return max === 1 ? [o] : [...prev, o].slice(-max);
    });
  };

  // Productos (o diseños) que van en la pieza.
  const items = useMemo<SourceProduct[]>(() => {
    if (sourceType === 'coleccion') return ((selected[0] as SourceCollection | undefined)?.products ?? []).slice(0, 5);
    if (sourceType === 'promocion') return ((selected[0] as SourcePromotion | undefined)?.products ?? []).slice(0, 5);
    if (sourceType === 'diseno') return (selected as SourceDesign[]).map((d) => ({ id: d.id, name: d.name, image: d.image, price: 0, listPrice: 0, discountPercent: 0 }));
    return selected as SourceProduct[];
  }, [selected, sourceType]);
  const promo = sourceType === 'promocion' ? (selected[0] as SourcePromotion | undefined) ?? null : null;
  const template3d = sourceType === 'plantilla' ? (selected[0] as SourceProduct | undefined) : undefined;
  const can360 = !!template3d?.model3d && isModel3D(template3d.model3d);
  const zones = useMemo(() => template3d?.zones ?? [], [template3d]);

  // Plantilla nueva: el video arranca con una escena en el primer color de la prenda.
  const templateId = template3d?.id;
  const firstColor = template3d?.colors?.[0];
  useEffect(() => {
    const s = firstScene(firstColor || '#FFFFFF');
    setScenes([s]);
    setSceneSel(s.id);
  }, [templateId, firstColor]);

  // Diseños de las escenas, listos para pintar sobre el maniquí.
  useEffect(() => {
    let alive = true;
    scenes.forEach((sc) => {
      const url = sc.design?.image;
      if (!url || url in images) return;
      loadImage(url).then((img) => { if (alive) setImages((m) => ({ ...m, [url]: img })); });
    });
    return () => { alive = false; };
  }, [scenes, images]);

  // Lo que pinta cada maniquí: su escena con el diseño en la zona elegida.
  const slotViews = useMemo(() => slots.map((j) => {
    const sc = scenes[j];
    return sc ? { sc, ...sceneArt(sc, zones, sc.design ? images[sc.design.image] : null) } : null;
  }), [scenes, slots, zones, images]);

  // Fotos de los productos.
  useEffect(() => {
    let alive = true;
    items.forEach((it) => {
      const url = it.image;
      if (!url || url in images) return;
      loadImage(url).then((img) => { if (alive) setImages((m) => ({ ...m, [url]: img })); });
    });
    return () => { alive = false; };
  }, [items, images]);

  const spec = useMemo<PieceSpec | null>(() => {
    if (!brand) return null;
    const pieceItems: PieceItem[] = items.map((it) => ({
      name: it.name,
      price: sourceType === 'diseno' ? undefined : it.price,
      listPrice: it.listPrice,
      discountPercent: it.discountPercent,
      image: it.image ? images[it.image] ?? null : null,
    }));
    return {
      format, template, title, subtitle, cta, showPrice, items: pieceItems, brand, stage,
      promo: promo ? { label: promo.label, code: promo.code, name: promo.name } : null,
    };
  }, [brand, items, images, format, template, title, subtitle, cta, showPrice, promo, sourceType, stage]);

  const [W, H] = sizeOf(format);
  const isVideo = format === 'reel' || format === 'video360';
  const timing = useMemo(() => layout(scenes, endCard), [scenes, endCard]);
  const length = format === 'video360' ? timing.total : spec ? reelLength(spec) : 6;

  const drawAt = useCallback((time: number) => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx || !spec) return;
    if (format === 'reel') drawReel(ctx, spec, time);
    else if (format === 'video360') {
      // Cada maniquí muestra su escena; el movimiento sale de la línea de tiempo.
      const next = slotsAt(scenes, endCard, time);
      setSlots((cur) => (cur[0] === next[0] && cur[1] === next[1] ? cur : next));
      [motionA, motionB].forEach((m, k) => {
        const j = next[k];
        if (j >= 0) m.current = motionAt(scenes[j].motion, time - timing.starts[j], scenes[j].seconds);
      });
      drawScenes(ctx, spec, scenes, endCard, [canvasOf(holder3d), canvasOf(holder3dB)], time);
      const ph = playheadRef.current;
      if (ph) { ph.style.left = `${timing.total ? (time / timing.total) * 100 : 0}%`; ph.style.opacity = '1'; }
    } else drawStill(ctx, spec);
  }, [spec, format, scenes, endCard, timing]);

  // Vista previa: fija o animada (reel y video 3D en bucle). El video 3D se redibuja siempre, aun en
  // pausa, porque los maniquíes siguen pintándose.
  useEffect(() => {
    if (!isVideo || (!playing && format !== 'video360')) { drawAt(isVideo ? length * 0.35 : 0); return; }
    let raf = 0;
    const start = performance.now();
    const loop = () => {
      // Mientras se graba, el lienzo es solo de la grabación.
      if (!recording.current) drawAt(playing ? ((performance.now() - start) / 1000) % length : Math.min(pausedAt, length - 0.01));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [drawAt, isVideo, playing, length, format, pausedAt]);

  /** Ver una escena: pausa a la mitad de ella. */
  const previewScene = (id: string) => {
    const i = scenes.findIndex((s) => s.id === id);
    if (i < 0) return;
    setPlaying(false);
    const len = layout([scenes[i]], false).total;
    setPausedAt(timing.starts[i] + (scenes[i].motion === 'giro' ? Math.min(0.6, len * 0.15) : len * 0.5));
  };

  const ready = !!spec && items.length > 0 && (format !== 'video360' || can360);

  /** La pieza terminada: PNG (post, historia) o video grabado (reel, 360°). */
  const render = async (): Promise<{ blob: Blob; name: string }> => {
    const canvas = canvasRef.current!;
    const base = (title || items[0]?.name || 'pieza').toLowerCase().replace(/[^a-z0-9áéíóúñ]+/gi, '-').slice(0, 40);
    if (!isVideo) {
      drawAt(0);
      const blob = await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('No se pudo exportar la imagen'))), 'image/png'));
      return { blob, name: `${base}.png` };
    }
    setPlaying(false);
    setProgress(0);
    recording.current = true;
    try {
      const blob = await recordCanvas(canvas, length, (t) => drawAt(t), setProgress);
      return { blob, name: `${base}.${extOf(blob.type)}` };
    } finally {
      recording.current = false;
    }
  };

  const download = async () => {
    setBusy('download');
    try {
      const { blob, name } = await render();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    } catch (e) {
      toast.error(errorMessage(e, 'No se pudo descargar'));
    } finally {
      setBusy(null);
      setProgress(0);
    }
  };

  const save = async (): Promise<Creative | null> => {
    const { blob, name } = await render();
    return marketingService.saveCreative({
      title: title || items[0]?.name || 'Pieza',
      kind: format === 'reel' ? 'reel' : format === 'video360' ? 'video360' : format === 'historia' ? 'historia' : 'post',
      source: sourceType,
      sourceIds: selected.map((s) => s.id),
      template,
      data: { title, subtitle, cta, showPrice, ...(format === 'video360' ? { stage, endCard, scenes: scenes.map((sc) => (sc.design?.image.startsWith('data:') ? { ...sc, design: { ...sc.design, image: '' } } : sc)) } : {}) },
      caption,
      hashtags,
    }, blob, name);
  };

  const onSave = async (thenPublish: boolean) => {
    setBusy(thenPublish ? 'publish' : 'save');
    try {
      const c = await save();
      toast.success('Pieza guardada en la biblioteca');
      if (c && thenPublish) setPublishFor(c);
    } catch (e) {
      toast.error(errorMessage(e, 'No se pudo guardar la pieza'));
    } finally {
      setBusy(null);
      setProgress(0);
    }
  };

  const writeWithAi = async () => {
    if (!selected.length) { toast.error('Primero elige qué promocionar'); return; }
    setWriting(true);
    try {
      const kind = format === 'reel' ? 'reel' : format === 'video360' ? 'video360' : format === 'historia' ? 'historia' : 'post';
      const r = await marketingService.copy({ kind, source: sourceType, tone, brief: brief || undefined, items: selected });
      setTitle(r.title); setSubtitle(r.subtitle); setCta(r.cta); setCaption(r.caption); setHashtags(r.hashtags);
      if (!r.ai) toast.info('La IA no respondió: se usaron textos de plantilla');
    } catch (e) {
      toast.error(errorMessage(e, 'No se pudieron escribir los textos'));
    } finally {
      setWriting(false);
    }
  };

  const addTag = () => {
    const t = tagInput.trim().replace(/^#/, '').replace(/\s+/g, '');
    if (t && !hashtags.includes(t)) setHashtags([...hashtags, t]);
    setTagInput('');
  };

  const optionImage = (o: AnySource) => ('image' in o ? o.image : (o as SourceCollection).products?.[0]?.image) ?? null;
  const optionLabel = (o: AnySource) => {
    if (sourceType === 'coleccion') return `${(o as SourceCollection).count} productos`;
    if (sourceType === 'promocion') { const p = o as SourcePromotion; return `${p.label}${p.code ? ` · ${p.code}` : ' · automática'}`; }
    if (sourceType === 'diseno') return (o as SourceDesign).category || 'Diseño';
    const p = o as SourceProduct;
    return p.discountPercent ? `$${Math.round(p.price).toLocaleString('es-CO')} · -${p.discountPercent}%` : `$${Math.round(p.price).toLocaleString('es-CO')}`;
  };

  return (
    <Page className="max-w-7xl mx-auto">
      <PageHeader
        icon={Wand2}
        title="Estudio de contenido"
        subtitle="Arma posts, historias y videos para tus redes con la marca, los productos y las ofertas reales."
        actions={(
          <>
            <Button variant="ghost" icon={<Palette className="w-4 h-4" />} onClick={() => navigate('/messaging/brand')}>Marca</Button>
            <Button variant="secondary" icon={<CalendarClock className="w-4 h-4" />} onClick={() => navigate('/messaging/calendar')}>Calendario y biblioteca</Button>
          </>
        )}
      />

      <div className="grid grid-cols-1 xl:grid-cols-[320px_minmax(0,1fr)_360px] gap-5 items-start">
        {/* 1. Qué promocionas */}
        <Card>
          <CardTitle>1. Qué promocionas</CardTitle>
          <div className="flex flex-wrap gap-1.5 mb-3" role="radiogroup" aria-label="Qué promocionas">
            {SOURCES.map((s) => (
              <button
                key={s.value} type="button" role="radio" aria-checked={sourceType === s.value} onClick={() => changeSource(s.value)}
                className={`rounded-full px-3 py-1.5 text-sm border transition-colors ${sourceType === s.value ? 'bg-app-600 border-app-600 text-white' : 'border-gray-200 text-gray-700 hover:border-app-300'}`}
              >
                {s.label}
              </button>
            ))}
          </div>
          {sourceType !== 'promocion' && sourceType !== 'plantilla' && <SearchInput value={q} onChange={setQ} placeholder="Buscar…" />}
          <p className="text-xs text-gray-500 mt-2 mb-2">
            {MAX_ITEMS[sourceType] > 1 ? `Elige hasta ${MAX_ITEMS[sourceType]} (en el reel sale uno por escena).` : 'Elige uno.'}
          </p>
          <div className="max-h-[560px] overflow-y-auto -mx-1 px-1 space-y-1.5">
            {loadingOptions && <Spinner label="Cargando…" />}
            {!loadingOptions && options.length === 0 && (
              <p className="text-sm text-gray-500 py-6 text-center">{sourceType === 'promocion' ? 'No hay promociones ni cupones activos. Créalos en Cupones del panel.' : 'No hay resultados.'}</p>
            )}
            {!loadingOptions && options.map((o) => {
              const on = selected.some((s) => s.id === o.id);
              const img = optionImage(o);
              return (
                <button
                  key={String(o.id)} type="button" onClick={() => toggle(o)} aria-pressed={on}
                  className={`w-full flex items-center gap-3 rounded-xl border p-2 text-left transition-colors ${on ? 'border-app-500 bg-app-50' : 'border-gray-200 hover:border-app-300'}`}
                >
                  <span className="w-12 h-12 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
                    {img && <img src={img} alt="" className="w-full h-full object-cover" loading="lazy" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-gray-900 truncate">{o.name}</span>
                    <span className="block text-xs text-gray-500 truncate">{optionLabel(o)}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </Card>

        {/* 2. Formato, plantilla y vista previa */}
        <Card>
          <CardTitle>2. Formato y diseño</CardTitle>
          <div className="space-y-3">
            <RadioGroup
              variant="segmented" value={format}
              onChange={(v) => { setFormat(v); setPlaying(v === 'reel' || v === 'video360'); }}
              options={FORMATS.map((f) => ({ ...f, disabled: f.value === 'video360' && sourceType !== 'plantilla' }))}
            />
            {format === 'video360' && !can360 && (
              <Alert tone="info">El video 360° es de las prendas personalizables con maniquí 3D: en "Qué promocionas" elige <b>Personalizable</b> y una plantilla con modelo 3D.</Alert>
            )}
            {format === 'video360' && can360 && (
              <RadioGroup
                variant="segmented" value={stage} onChange={setStage}
                options={[{ value: 'oscuro', label: 'Escenario oscuro' }, { value: 'claro', label: 'Escenario claro' }]}
              />
            )}
            {format !== 'video360' && (
              <div className="flex flex-wrap gap-1.5">
                {TEMPLATES.map((t) => (
                  <button
                    key={t.id} type="button" title={t.hint} onClick={() => setTemplate(t.id)} aria-pressed={template === t.id}
                    className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${template === t.id ? 'border-app-600 text-app-700 bg-app-50 font-medium' : 'border-gray-200 text-gray-600 hover:border-app-300'}`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 flex justify-center">
            <div className="relative w-full" style={{ maxWidth: format === 'post' ? 520 : 340 }}>
              <canvas
                ref={canvasRef} width={W} height={H}
                className="w-full h-auto rounded-xl ring-1 ring-gray-200 bg-gray-50"
                aria-label="Vista previa de la pieza"
              />
              {!ready && (
                <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-white/80 text-sm text-gray-500 text-center px-6">
                  {format === 'video360' && !can360 ? 'Elige una prenda personalizable con modelo 3D' : 'Elige qué promocionar para ver la pieza'}
                </div>
              )}
              {busy && isVideo && progress > 0 && (
                <div className="absolute inset-x-0 bottom-0 p-3">
                  <div className="h-2 rounded-full bg-black/20 overflow-hidden"><div className="h-full bg-app-600" style={{ width: `${Math.round(progress * 100)}%` }} /></div>
                  <p className="text-xs text-white text-center mt-1 drop-shadow">Grabando el video… {Math.round(progress * length)} de {Math.round(length)} s</p>
                </div>
              )}
            </div>
          </div>
          {isVideo && (
            <div className="mt-3 flex items-center justify-center gap-3 text-sm text-gray-600">
              <Button size="sm" variant="secondary" icon={playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />} onClick={() => setPlaying((p) => !p)} disabled={!ready || !!busy}>
                {playing ? 'Pausar' : 'Reproducir'}
              </Button>
              <span className="inline-flex items-center gap-1"><Film className="w-4 h-4" />{Math.round(length)} s · 1080×1920 · {(videoMime() ?? '').includes('mp4') ? 'MP4' : 'WEBM'}</span>
            </div>
          )}

          {/* Dos maniquíes 3D fuera de pantalla (se turnan las escenas); se copian cuadro a cuadro al lienzo. */}
          {format === 'video360' && can360 && template3d?.model3d && [holder3d, holder3dB].map((holder, k) => {
            const view = slotViews[k];
            return (
              <div key={k} ref={holder} aria-hidden="true" style={{ position: 'fixed', left: -10000 - k * 600, top: 0, width: 540, height: 960, pointerEvents: 'none' }}>
                {view && (
                  <Suspense fallback={null}>
                    <Mannequin3D
                      key={template3d.model3d} model={template3d.model3d!} color={view.sc.color} art={view.art} frames={view.frames} focus="front"
                      still recordable motionRef={k === 0 ? motionA : motionB}
                      stage={brand ? { base: stage === 'oscuro' ? brand.primary : brand.paper, accent: brand.accent, dark: stage === 'oscuro' } : undefined}
                    />
                  </Suspense>
                )}
              </div>
            );
          })}

          <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-gray-100 pt-4">
            <Button variant="secondary" icon={<Download className="w-4 h-4" />} disabled={!ready || !!busy} isLoading={busy === 'download'} onClick={download}>Descargar</Button>
            <Button variant="outline" icon={<Save className="w-4 h-4" />} disabled={!ready || !!busy} isLoading={busy === 'save'} onClick={() => onSave(false)}>Guardar en la biblioteca</Button>
            <Button icon={<Send className="w-4 h-4" />} disabled={!ready || !!busy} isLoading={busy === 'publish'} onClick={() => onSave(true)}>Publicar o programar</Button>
          </div>
        </Card>

        {/* 3. Textos */}
        <Card>
          <CardTitle>3. Textos</CardTitle>
          <div className="space-y-3">
            <div className="rounded-xl border border-app-200 bg-app-50/50 p-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <Field label="Tono" htmlFor="st-tone">
                  <SelectInput id="st-tone" value={tone} onChange={(e) => setTone(e.target.value as CopyTone)}>
                    {TONES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </SelectInput>
                </Field>
                <div className="flex items-end">
                  <Button className="w-full" icon={<Sparkles className="w-4 h-4" />} isLoading={writing} disabled={!selected.length} onClick={writeWithAi}>Escribir con IA</Button>
                </div>
              </div>
              <TextInput aria-label="Indicaciones para la IA" placeholder="Indicaciones (opcional): ej. lanzamiento de fin de semana" value={brief} maxLength={500} onChange={(e) => setBrief(e.target.value)} />
            </div>
            <Field label="Título en la imagen" htmlFor="st-title"><TextInput id="st-title" value={title} maxLength={60} placeholder={items[0]?.name ?? 'Título'} onChange={(e) => setTitle(e.target.value)} /></Field>
            <Field label="Subtítulo" htmlFor="st-sub"><TextInput id="st-sub" value={subtitle} maxLength={90} onChange={(e) => setSubtitle(e.target.value)} /></Field>
            <Field label="Botón" htmlFor="st-cta"><TextInput id="st-cta" value={cta} maxLength={24} onChange={(e) => setCta(e.target.value)} /></Field>
            {sourceType !== 'diseno' && <Switch checked={showPrice} onChange={setShowPrice} label="Mostrar precio" description="Con la oferta vigente si la tiene." />}
            <Field label="Texto del post" htmlFor="st-caption" hint="Va en Facebook e Instagram junto con la pieza.">
              <TextArea id="st-caption" rows={5} maxLength={2200} value={caption} onChange={(e) => setCaption(e.target.value)} />
            </Field>
            <div>
              <p className="text-sm font-medium text-gray-700 mb-1.5">Hashtags</p>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {hashtags.map((t) => (
                  <Badge key={t} tone="app">
                    #{t}
                    <button type="button" aria-label={`Quitar #${t}`} className="ml-0.5" onClick={() => setHashtags(hashtags.filter((x) => x !== t))}><X className="w-3 h-3" /></button>
                  </Badge>
                ))}
              </div>
              <TextInput aria-label="Agregar hashtag" placeholder="Agregar hashtag y Enter" value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }} />
            </div>
          </div>
        </Card>
      </div>

      {format === 'video360' && can360 && (
        <div className="mt-5">
          <SceneEditor
            scenes={scenes} onChange={setScenes} selectedId={sceneSel} onSelect={setSceneSel} endCard={endCard} onEndCard={setEndCard}
            zones={zones} colors={template3d?.colors ?? []} playheadRef={playheadRef} onPreview={previewScene}
          />
        </div>
      )}

      <AiAccountsCard />

      {publishFor && <PublishDialog creative={publishFor} caption={caption} hashtags={hashtags} onClose={() => setPublishFor(null)} onDone={() => { setPublishFor(null); navigate('/messaging/calendar'); }} />}
    </Page>
  );
};

/** Publicar ya o programar una pieza en Facebook y/o Instagram. */
export function PublishDialog({ creative, caption, hashtags, onClose, onDone }: {
  creative: Creative; caption: string; hashtags: string[]; onClose: () => void; onDone: () => void;
}) {
  const [fb, setFb] = useState(true);
  const [ig, setIg] = useState(true);
  const [when, setWhen] = useState<'now' | 'later'>('now');
  const [at, setAt] = useState(() => {
    const d = new Date(Date.now() + 60 * 60 * 1000);
    d.setMinutes(0, 0, 0);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  });
  const [text, setText] = useState(() => {
    const tags = hashtags.length ? '\n\n' + hashtags.map((t) => '#' + t).join(' ') : '';
    return (caption || creative.caption || '') + tags;
  });
  const [sending, setSending] = useState(false);
  const isVideo = creative.mediaType === 'video';

  const send = async () => {
    const platforms = [fb && 'facebook', ig && 'instagram'].filter(Boolean) as Array<'facebook' | 'instagram'>;
    if (!platforms.length) { toast.error('Elige al menos una red'); return; }
    setSending(true);
    try {
      const posts = await marketingService.publish({
        creativeIds: [creative.id], platforms, caption: text,
        scheduledAt: when === 'later' ? new Date(at).toISOString() : null,
      });
      const failed = posts.filter((p) => p.status === 'failed');
      if (failed.length) toast.error(`No se pudo publicar en ${failed.map((p) => p.platform).join(' y ')}: ${failed[0].error}`);
      else toast.success(when === 'later' ? 'Publicación programada' : 'Publicado');
      onDone();
    } catch (e) {
      toast.error(errorMessage(e, 'No se pudo publicar'));
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog
      open onClose={() => !sending && onClose()} title="Publicar o programar"
      description={`${creative.title} · ${isVideo ? 'video' : creative.kind === 'historia' ? 'historia' : 'imagen'}`}
      size="lg"
      footer={(
        <FormActions>
          <Button variant="secondary" onClick={onClose} disabled={sending}>Cancelar</Button>
          <Button icon={when === 'later' ? <CalendarClock className="w-4 h-4" /> : <Send className="w-4 h-4" />} isLoading={sending} onClick={send}>
            {when === 'later' ? 'Programar' : 'Publicar ahora'}
          </Button>
        </FormActions>
      )}
    >
      <div className="grid grid-cols-1 sm:grid-cols-[180px_minmax(0,1fr)] gap-4">
        <div className="rounded-xl overflow-hidden bg-gray-100 ring-1 ring-gray-200">
          {isVideo ? <video src={creative.media} className="w-full" muted autoPlay loop playsInline /> : <img src={creative.media} alt="" className="w-full" />}
        </div>
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700">Dónde</p>
            <Checkbox checked={fb} onChange={(e) => setFb(e.target.checked)} label="Facebook (página)" description={creative.kind === 'historia' && isVideo ? 'Facebook no permite historias de video por API.' : undefined} />
            <Checkbox checked={ig} onChange={(e) => setIg(e.target.checked)} label="Instagram" description={isVideo ? 'Sale como reel.' : creative.kind === 'historia' ? 'Sale como historia.' : undefined} />
          </div>
          <div className="space-y-2">
            <RadioGroup variant="segmented" value={when} onChange={setWhen} options={[{ value: 'now', label: 'Ahora' }, { value: 'later', label: 'Programar' }]} />
            {when === 'later' && <TextInput type="datetime-local" aria-label="Fecha y hora" value={at} onChange={(e) => setAt(e.target.value)} />}
          </div>
          <Field label="Texto" htmlFor="pd-text"><TextArea id="pd-text" rows={6} maxLength={2200} value={text} onChange={(e) => setText(e.target.value)} /></Field>
        </div>
      </div>
    </Dialog>
  );
}
