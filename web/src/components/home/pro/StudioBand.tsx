import { Component, lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Check, Hand, ImageUp, Minus, Move, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { useSettings } from '../../../context/SettingsContext';
import { useCurrency } from '../../../hooks/useCurrency';
import { useStoreData } from '../../../hooks/useStoreData';
import { templatesService, type Template } from '../../../services/templates.service';
import { templateZonesService } from '../../../services/template-zones.service';
import { isDark } from '../../customizer/garment';
import { isModel3D, MODELS_3D, type Model3D, type View3D } from '../../mannequin/models';
import { frameOf, type ArtArea, type ArtLayer, type MannequinArt } from '../../mannequin/art';
import { zones3DOf, type Zone3D } from '../../mannequin/zones';
import { DEFAULT_LAYOUT, LAYOUT_LIMITS, nudgeLayout, type PrintLayout } from './shirtConfig';
import { accentInk, brandInk, cropToContent, loadImage, sampleDesign, type PrintSource } from './printTexture';
import { gsap } from './motion';

const Mannequin3D = lazy(() => import('../../mannequin/Mannequin3D'));

const fetchTemplates = () => templatesService.getPublicTemplates();

/** Si el navegador no puede con WebGL, queda la foto fija. */
class WebGLBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

const sizeOf = (s: PrintSource) =>
  s instanceof HTMLImageElement ? { w: s.naturalWidth, h: s.naturalHeight } : { w: s.width, h: s.height };

/** Caja del diseño dentro de su zona según su posición (-1..1) y tamaño (fracción del máximo). */
function placeInZone(src: PrintSource, area: ArtArea, l: PrintLayout) {
  const { w, h } = sizeOf(src);
  const k = Math.min(area.w / (w || 1), area.h / (h || 1)) * l.scale;
  const dw = (w || 1) * k, dh = (h || 1) * k;
  return {
    cx: area.x + area.w / 2 + (l.x * (area.w - dw)) / 2,
    cy: area.y + area.h / 2 + (l.y * (area.h - dh)) / 2,
    w: dw,
    h: dh,
  };
}

/** Arte del maniquí: cada zona con su diseño, agrupado por vista; las bloqueadas no se imprimen. */
function buildArt(zones: Zone3D[], prints: Record<number, PrintSource | null | undefined>, layouts: Record<number, PrintLayout | undefined>): MannequinArt {
  const art: MannequinArt = {};
  for (const z of zones) {
    const v = (art[z.view] ??= { layers: [], holes: [] });
    if (z.isBlocked) { v.holes!.push(z.area); continue; }
    const src = prints[z.id];
    if (!src) continue;
    const layer: ArtLayer = { src, ...placeInZone(src, z.area, layouts[z.id] ?? DEFAULT_LAYOUT), clip: z.area };
    v.layers.push(layer);
  }
  return art;
}

/**
 * "¿No está tu diseño? Créalo." (valor añadido de la tienda): titular a la izquierda y, a la
 * derecha, el maniquí 3D de las plantillas personalizables (configuradas en el admin: modelo 3D,
 * zonas, colores y precio). La rasqueta "imprime" un diseño de muestra; la persona puede cambiar el
 * corte, el color, la zona y probar con su propia imagen (no sale del navegador).
 */
export function StudioBand({ reduced }: { reduced: boolean }) {
  const { settings } = useSettings();
  const { format } = useCurrency();
  const storeName = settings.general.siteName || 'StylePrint';
  const templates = useStoreData<Template[]>('studio:templates', fetchTemplates);

  // Plantillas con maniquí 3D (las que se pueden probar aquí).
  const models = useMemo(
    () => (templates.data ?? []).filter((t) => t.isActive !== false && isModel3D(t.model3d)) as Array<Template & { model3d: Model3D }>,
    [templates.data],
  );
  const [tplIdx, setTplIdx] = useState(0);
  const template = models[Math.min(tplIdx, Math.max(0, models.length - 1))];
  const model: Model3D = template?.model3d ?? 'basica';
  const colors = template?.colors?.length ? template.colors : [{ id: 0, name: 'Blanco', slug: 'blanco', hexCode: '#FFFFFF' }];
  const fromPrice = models.length ? Math.min(...models.map((t) => Number(t.basePrice) || 0).filter((p) => p > 0)) : null;

  // Zonas de la plantilla elegida (de la BD).
  const [zonesByTpl, setZonesByTpl] = useState<Record<number, Zone3D[]>>({});
  useEffect(() => {
    if (!template || zonesByTpl[template.id]) return;
    let alive = true;
    templateZonesService.getByTemplateId(template.id)
      .then((raw) => { if (alive) setZonesByTpl((m) => ({ ...m, [template.id]: zones3DOf(raw) })); })
      .catch(() => { if (alive) setZonesByTpl((m) => ({ ...m, [template.id]: [] })); });
    return () => { alive = false; };
  }, [template, zonesByTpl]);
  const allZones = useMemo(() => (template ? zonesByTpl[template.id] ?? [] : []), [template, zonesByTpl]);
  const zones = useMemo(() => allZones.filter((z) => !z.isBlocked), [allZones]);

  const [colorIdx, setColorIdx] = useState(0);
  const [modelReady, setModelReady] = useState(false);
  const markReady = useCallback(() => setModelReady(true), []);
  const color = colors[Math.min(colorIdx, colors.length - 1)].hexCode;

  // Un diseño por zona (por id de zona). El frente arranca con el de muestra.
  const [prints, setPrints] = useState<Record<number, PrintSource | null>>({});
  const [own, setOwn] = useState<Record<number, boolean>>({});
  const [layouts, setLayouts] = useState<Record<number, PrintLayout>>({});
  const [zoneId, setZoneId] = useState<number | null>(null);
  const zone = zones.find((z) => z.id === zoneId) ?? zones[0] ?? null;
  const frontZone = zones.find((z) => z.view === 'front') ?? null;
  const [animView, setAnimView] = useState<View3D>('front');
  const [printKey, setPrintKey] = useState(0);

  // Posición "en vivo": mientras se arrastra se escribe aquí y el 3D la lee en cada cuadro.
  const liveLayouts = useRef<Record<number, PrintLayout>>({});
  const art = useMemo(() => buildArt(allZones, prints, layouts), [allZones, prints, layouts]);
  const artRef = useRef({ version: 0, art });
  useEffect(() => { artRef.current = { version: artRef.current.version + 1, art }; }, [art]);
  const frames = useMemo(() => {
    const out: Partial<Record<View3D, ArtArea>> = {};
    for (const v of ['front', 'back', 'rightSleeve', 'leftSleeve'] as View3D[]) {
      const f = frameOf(allZones.filter((z) => z.view === v).map((z) => z.area));
      if (f) out[v] = f;
    }
    return out;
  }, [allZones]);

  const layout = (zone && layouts[zone.id]) ?? DEFAULT_LAYOUT;
  const currentLayout = () => (zone ? liveLayouts.current[zone.id] ?? layouts[zone.id] ?? DEFAULT_LAYOUT : DEFAULT_LAYOUT);
  const commit = (next: PrintLayout) => {
    if (!zone) return;
    liveLayouts.current[zone.id] = next;
    setLayouts((l) => ({ ...l, [zone.id]: next }));
  };
  const move = (m: { dx?: number; dy?: number; ds?: number }) => commit(nudgeLayout(currentLayout(), m));
  const resetLayout = () => commit(DEFAULT_LAYOUT);

  // Modo "Mover diseño": el maniquí queda quieto mirando la zona y el diseño se arrastra con la mano.
  const [editing, setEditing] = useState(false);
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  // La rueda sobre el recuadro cambia el tamaño y NO desplaza la página (listener no pasivo).
  const editLayer = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = editLayer.current;
    if (!editing || !el) return;
    const stop = (e: WheelEvent) => e.preventDefault();
    el.addEventListener('wheel', stop, { passive: false });
    return () => el.removeEventListener('wheel', stop);
  }, [editing]);
  const onEditDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY };
  };
  const onEditMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    const src = zone && prints[zone.id];
    if (!d || !zone || !src) return;
    // 1:1 con el cursor: el espacio libre de la zona (en % del recuadro) equivale al recorrido -1..1.
    const cur = currentLayout();
    const box = placeInZone(src, zone.area, cur);
    const px = e.currentTarget.clientWidth / 100;
    const freeX = Math.max(((zone.area.w - box.w) / 2) * px, 1);
    const freeY = Math.max(((zone.area.h - box.h) / 2) * px, 1);
    liveLayouts.current[zone.id] = nudgeLayout(cur, { dx: (e.clientX - d.x) / freeX, dy: (e.clientY - d.y) / freeY });
    artRef.current = { version: artRef.current.version + 1, art: buildArt(allZones, prints, { ...layouts, ...liveLayouts.current }) };
    dragRef.current = { x: e.clientX, y: e.clientY };
  };
  const onEditUp = () => {
    if (!dragRef.current) return;
    dragRef.current = null;
    commit(currentLayout());
  };
  const onEditWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    move({ ds: e.deltaY < 0 ? 0.05 : -0.05 });
  };
  const [inView, setInView] = useState(true);
  const [dragOver, setDragOver] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  // Diseño de muestra: sello con el nombre de la tienda y su ícono (favicon); tinta oscura sobre
  // prenda clara y clara sobre prenda oscura.
  const darkGarment = isDark(color);
  const sampleZone = frontZone?.id ?? null;
  const ownSample = sampleZone !== null && !!own[sampleZone];
  const storeIcon = settings.general.favicon;
  useEffect(() => {
    if (sampleZone === null || ownSample) return;
    let alive = true;
    const icon = storeIcon ? loadImage(storeIcon).catch(() => null) : Promise.resolve(null);
    icon
      .then((img) => sampleDesign(storeName, darkGarment ? '#F3F3EE' : brandInk(), accentInk(), img, darkGarment))
      .then((c) => {
        if (alive) { setPrints((p) => ({ ...p, [sampleZone]: cropToContent(c) })); setAnimView('front'); setPrintKey((k) => k + 1); }
      });
    return () => { alive = false; };
  }, [storeName, storeIcon, darkGarment, ownSample, sampleZone]);

  // Pausa el 3D fuera de pantalla.
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.05 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Entrada: las líneas del titular suben desde su máscara, una tras otra.
  useLayoutEffect(() => {
    if (reduced || !root.current) return;
    const ctx = gsap.context(() => {
      const scrollTrigger = { trigger: root.current, start: 'top 72%', once: true };
      gsap.from('[data-line]', { yPercent: 105, duration: 0.9, ease: 'power4.out', stagger: 0.09, scrollTrigger });
      gsap.from('[data-rise]', { y: 16, opacity: 0, duration: 0.7, ease: 'power3.out', stagger: 0.06, delay: 0.35, scrollTrigger });
    }, root);
    return () => ctx.revert();
  }, [reduced]);

  // La imagen va a la zona elegida.
  const loadPrintFile = (file?: File | null) => {
    if (!file || !file.type.startsWith('image/') || !zone) return;
    const target = zone;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const design = cropToContent(img);
      setPrints((p) => ({ ...p, [target.id]: design }));
      setOwn((o) => ({ ...o, [target.id]: true }));
      setAnimView(target.view);
      setPrintKey((k) => k + 1);
    };
    img.src = url;
  };

  const clearZone = () => {
    if (!zone) return;
    setPrints((p) => ({ ...p, [zone.id]: null }));
    setOwn((o) => ({ ...o, [zone.id]: false }));
    setEditing(false);
  };
  const zoneLabel = (zone?.name ?? '').toLowerCase();

  // Foto fija del maniquí mientras carga el 3D (o si el navegador no tiene WebGL).
  const flat = <img src={MODELS_3D[model].poster} alt="" className="w-full h-full object-contain rounded-[2rem]" />;

  // Sin plantillas 3D configuradas no hay nada que probar aquí.
  if (templates.data && !models.length) return null;

  return (
    <section ref={root} className="relative bg-white overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 md:px-6 grid lg:grid-cols-[1.08fr_1fr] lg:grid-rows-[auto_auto] lg:content-center gap-x-8 gap-y-6 items-center py-14 md:py-20">
        {/* Titular: arriba en celular, a la izquierda en escritorio */}
        <h2 className="min-w-0 lg:col-start-1 lg:row-start-1 lg:self-end font-poster font-bold tracking-[-0.035em] uppercase text-gray-900 leading-[0.9] text-[clamp(2.4rem,8.5vw,4.4rem)] lg:text-[clamp(3.2rem,4.6vw,4.8rem)]">
          <span className="block overflow-hidden pt-[0.06em]"><span data-line className="block">¿No está</span></span>
          <span className="block overflow-hidden pt-[0.06em]"><span data-line className="block">tu diseño?</span></span>
          <span className="block overflow-hidden pt-[0.06em]"><span data-line className="block"><span className="bg-accent text-accent-ink px-2 -mx-1 rounded-md box-decoration-clone">Créalo.</span></span></span>
        </h2>

        {/* Texto y acciones */}
        <div className="min-w-0 order-last lg:order-none lg:col-start-1 lg:row-start-2 lg:self-start">
          <p data-rise className="max-w-md text-lg text-gray-700 leading-relaxed">
            Sube tu imagen, tu logo o tu frase y la estampamos en la prenda que elijas. Pruébalo aquí mismo: cambia el color o carga tu imagen.
          </p>
          <div data-rise className="mt-8 flex flex-col sm:flex-row gap-3">
            <Link
              to={template ? `/customize?template=${template.id}` : '/customize'}
              className="inline-flex items-center justify-center h-14 px-8 rounded-full bg-app-600 text-white text-base font-semibold hover:bg-app-700 active:scale-[0.98] transition focus:outline-none focus-visible:ring-4 focus-visible:ring-app-200"
            >
              Diseñar mi prenda
            </Link>
          </div>
          {fromPrice !== null && Number.isFinite(fromPrice) && (
            <p data-rise className="mt-5 text-sm text-gray-600">
              Desde <span className="font-semibold text-gray-900 tabular-nums">{format(fromPrice)}</span>. Pagas solo las zonas que diseñas.
            </p>
          )}
        </div>

        {/* Prenda 3D */}
        <div className="relative lg:col-start-2 lg:row-start-1 lg:row-span-2 lg:py-8">
          <div
            ref={stage}
            className={`relative aspect-square w-full max-w-[620px] mx-auto rounded-[2rem] transition-colors ${dragOver ? 'bg-accent/30' : 'bg-paper'}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); loadPrintFile(e.dataTransfer.files?.[0]); }}
          >
            <div className="absolute inset-0">
              {!modelReady && <div className="absolute inset-0">{flat}</div>}
              {template && (
                <WebGLBoundary fallback={flat}>
                  <Suspense fallback={flat}>
                    <Mannequin3D
                      model={model}
                      color={color}
                      art={art}
                      artRef={artRef}
                      frames={frames}
                      focus={zone?.view ?? 'front'}
                      locked={editing}
                      animView={animView}
                      printKey={printKey}
                      still={reduced}
                      active={inView}
                      onReady={markReady}
                    />
                  </Suspense>
                </WebGLBoundary>
              )}
            </div>
            <p className="sr-only">Prenda de muestra con un diseño estampado en el pecho. Puedes cambiar el color y probar con tu imagen.</p>

            {/* Mover el diseño de la zona elegida: siempre dentro de la zona. */}
            {zone && prints[zone.id] && !editing && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="absolute right-3 bottom-3 inline-flex items-center gap-2 h-10 px-4 rounded-full bg-white/30 backdrop-blur-md ring-1 ring-white/50 text-sm font-semibold text-gray-900 shadow-[0_4px_20px_rgba(0,0,0,0.08)] hover:bg-white/50 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-app-500"
              >
                <Move className="w-4 h-4" aria-hidden="true" />
                Mover diseño
              </button>
            )}
            {zone && prints[zone.id] && editing && (
              <>
                {/* Capa de arrastre: la mano mueve el diseño; la rueda cambia el tamaño. */}
                <div
                  ref={editLayer}
                  data-lenis-prevent
                  className="absolute inset-0 cursor-grab active:cursor-grabbing touch-none rounded-[2rem] ring-2 ring-accent/70"
                  onPointerDown={onEditDown}
                  onPointerMove={onEditMove}
                  onPointerUp={onEditUp}
                  onPointerCancel={onEditUp}
                  onWheel={onEditWheel}
                  aria-label={`Arrastra para mover el diseño (${zoneLabel})`}
                >
                  {/* Límite de la zona */}
                  <span
                    className={`pointer-events-none absolute border-2 border-dashed border-accent/80 ${zone.area.circle ? 'rounded-full' : 'rounded-md'}`}
                    style={{ left: `${zone.area.x}%`, top: `${zone.area.y}%`, width: `${zone.area.w}%`, height: `${zone.area.h}%` }}
                  />
                </div>
                <p className="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-white/30 backdrop-blur-md ring-1 ring-white/50 px-3 py-1.5 text-xs font-semibold text-gray-900">
                  <Hand className="w-3.5 h-3.5" aria-hidden="true" />
                  Arrastra el diseño · rueda o +/− para el tamaño
                </p>
                <div className="absolute right-3 bottom-3 flex items-center gap-1 p-1.5 rounded-full bg-white/30 backdrop-blur-md ring-1 ring-white/50 shadow-[0_4px_20px_rgba(0,0,0,0.08)]" role="group" aria-label={`Tamaño del diseño (${zoneLabel})`}>
                  <PadButton label="Más pequeño" disabled={layout.scale <= LAYOUT_LIMITS.minScale} onClick={() => move({ ds: -LAYOUT_LIMITS.scaleStep })}><Minus className="w-4 h-4" /></PadButton>
                  <span className="w-10 text-xs font-semibold text-gray-900 text-center tabular-nums" aria-live="polite">{Math.round(layout.scale * 100)}%</span>
                  <PadButton label="Más grande" disabled={layout.scale >= LAYOUT_LIMITS.maxScale} onClick={() => move({ ds: LAYOUT_LIMITS.scaleStep })}><Plus className="w-4 h-4" /></PadButton>
                  <PadButton label="Centrar" onClick={resetLayout}><RotateCcw className="w-4 h-4" /></PadButton>
                  <button
                    type="button"
                    onClick={() => setEditing(false)}
                    className="ml-1 inline-flex items-center gap-1.5 h-8 px-3.5 rounded-full bg-accent text-accent-ink text-sm font-semibold hover:brightness-95 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-app-500"
                  >
                    <Check className="w-4 h-4" aria-hidden="true" />
                    Listo
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Controles compactos: arriba la zona (la prenda gira a mostrarla); abajo corte, color e imagen. */}
          <div className="mt-3 max-w-[620px] mx-auto rounded-3xl bg-paper p-1.5 space-y-1.5">
            {zones.length > 0 && (
              <div className="grid gap-1 p-1 rounded-[1.25rem] bg-white ring-1 ring-black/5" style={{ gridTemplateColumns: `repeat(${Math.min(zones.length, 4)}, minmax(0, 1fr))` }} role="group" aria-label="Zona de estampado">
                {zones.map((z) => (
                  <button
                    key={z.id}
                    type="button"
                    onClick={() => { setZoneId(z.id); setEditing(false); }}
                    aria-pressed={z.id === zone?.id}
                    className={`relative h-9 px-1 rounded-2xl text-[13px] sm:text-sm font-semibold whitespace-nowrap overflow-hidden text-ellipsis transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-app-500 ${
                      z.id === zone?.id ? 'bg-accent text-accent-ink' : 'text-gray-600 hover:text-gray-900 hover:bg-black/5'
                    }`}
                  >
                    {/* Nombre corto para que quepan 4 en el celular. */}
                    {z.name.replace(/\s+derecha$/i, ' der.').replace(/\s+izquierda$/i, ' izq.')}
                    {prints[z.id] && <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-app-600" aria-label="con diseño" />}
                  </button>
                ))}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-1">
              {models.length > 1 && (
                <div className="flex items-center gap-0.5 p-0.5 rounded-full bg-white ring-1 ring-black/5" role="group" aria-label="Corte de la camiseta">
                  {models.map((t, i) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => { setTplIdx(i); setZoneId(null); setEditing(false); setColorIdx(0); setAnimView('front'); setPrintKey((k) => k + 1); }}
                      aria-pressed={t.id === template?.id}
                      className={`h-8 px-3.5 rounded-full text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-app-500 ${
                        t.id === template?.id ? 'bg-app-600 text-white' : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      {MODELS_3D[t.model3d].label}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-1.5" role="group" aria-label="Color de la prenda">
                {colors.slice(0, 6).map((c, i) => (
                  <button
                    key={c.hexCode + i}
                    type="button"
                    onClick={() => setColorIdx(i)}
                    aria-pressed={i === colorIdx}
                    aria-label={c.name}
                    title={c.name}
                    className={`w-7 h-7 rounded-full ring-1 ring-black/15 transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-app-500 ${i === colorIdx ? 'ring-2 ring-app-600 ring-offset-2 ring-offset-paper' : ''}`}
                    style={{ backgroundColor: c.hexCode }}
                  />
                ))}
              </div>
              <div className="w-full sm:w-auto sm:ml-auto flex items-center gap-1">
                {zone && prints[zone.id] && (
                  <button
                    type="button"
                    onClick={clearZone}
                    aria-label={`Quitar el diseño (${zoneLabel})`}
                    title="Quitar diseño"
                    className="w-9 h-9 rounded-full flex items-center justify-center text-gray-600 hover:text-gray-900 hover:bg-black/5 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-app-500"
                  >
                    <Trash2 className="w-4 h-4" aria-hidden="true" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  disabled={!zone}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 h-9 px-4 rounded-full bg-app-600 text-white text-sm font-semibold hover:bg-app-800 active:scale-[0.98] transition disabled:opacity-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-gray-300"
                >
                  <ImageUp className="w-4 h-4" aria-hidden="true" />
                  {zone && own[zone.id] ? 'Cambiar imagen' : 'Subir imagen'}
                </button>
              </div>
              <input
                ref={fileInput}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                tabIndex={-1}
                onChange={(e) => { loadPrintFile(e.target.files?.[0]); e.target.value = ''; }}
              />
            </div>
          </div>
          <p className="mt-2 max-w-[620px] mx-auto px-2 text-xs text-gray-500">
            Arrastra la prenda para girarla o suelta una imagen encima. Tu imagen se queda en tu navegador: no se sube a ningún lado.
          </p>
        </div>
      </div>
    </section>
  );
}

/** Botón del control de tamaño. */
function PadButton({ label, disabled, onClick, children }: { label: string; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="w-8 h-8 rounded-full flex items-center justify-center text-gray-900 hover:bg-white/60 active:scale-95 transition disabled:opacity-25 disabled:hover:bg-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-app-500"
    >
      {children}
    </button>
  );
}
