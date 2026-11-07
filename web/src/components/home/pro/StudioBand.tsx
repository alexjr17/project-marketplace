import { Component, lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Check, Hand, ImageUp, Minus, Move, Plus, RotateCcw } from 'lucide-react';
import { useSettings } from '../../../context/SettingsContext';
import { useCurrency } from '../../../hooks/useCurrency';
import { useStoreData } from '../../../hooks/useStoreData';
import { templatesService, type Template } from '../../../services/templates.service';
import { isDark } from '../../customizer/garment';
import { DEFAULT_LAYOUT, FITS, LAYOUT_LIMITS, nudgeLayout, zoneScreenFraction, ZONES, type Fit, type PrintLayout, type Zone } from './shirtConfig';
import type { Prints } from './Shirt3D';
import { accentInk, brandInk, cropToContent, loadImage, sampleDesign } from './printTexture';
import { gsap } from './motion';

const Shirt3D = lazy(() => import('./Shirt3D'));

/** Colores de prenda si los modelos aún no cargan. */
const FALLBACK_COLORS = [
  { name: 'Blanco', hexCode: '#FFFFFF' },
  { name: 'Negro', hexCode: '#1F2937' },
  { name: 'Gris', hexCode: '#9CA3AF' },
];

const fetchTemplates = () => templatesService.getPublicTemplates();

/** Si el navegador no puede con WebGL, queda la silueta plana. */
class WebGLBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

/**
 * "Personaliza la tuya" (valor añadido de la tienda): titular a la izquierda y, a la derecha, una prenda 3D donde la
 * rasqueta "imprime" un diseño al cargar. La persona puede cambiar el color de la prenda y
 * probar con su propia imagen (no sale del navegador).
 */
export function StudioBand({ reduced }: { reduced: boolean }) {
  const { settings } = useSettings();
  const { format } = useCurrency();
  const storeName = settings.general.siteName || 'StylePrint';
  const templates = useStoreData<Template[]>('studio:templates', fetchTemplates);

  const { colors, fromPrice } = useMemo(() => {
    const list = (templates.data ?? []).filter((t) => t.isActive !== false);
    const seen = new Set<string>();
    const fromTemplates = list
      .flatMap((t) => t.colors ?? [])
      .filter((c) => c.hexCode && !seen.has(c.hexCode.toUpperCase()) && seen.add(c.hexCode.toUpperCase()));
    const prices = list.map((t) => Number(t.basePrice)).filter((p) => p > 0);
    return {
      colors: (fromTemplates.length >= 2 ? fromTemplates : FALLBACK_COLORS).slice(0, 5),
      fromPrice: prices.length ? Math.min(...prices) : null,
    };
  }, [templates.data]);

  const [colorIdx, setColorIdx] = useState(0);
  const [fit, setFit] = useState<Fit>('basica');
  const [modelReady, setModelReady] = useState(false);
  const markReady = useCallback(() => setModelReady(true), []);
  const color = colors[Math.min(colorIdx, colors.length - 1)].hexCode;
  // Un diseño por zona. El frente arranca con el de muestra; las demás, vacías.
  const [prints, setPrints] = useState<Prints>({});
  const [zone, setZone] = useState<Zone>('front');
  const [animZone, setAnimZone] = useState<Zone>('front');
  const [printKey, setPrintKey] = useState(0);
  const [own, setOwn] = useState<Partial<Record<Zone, boolean>>>({});
  const [layouts, setLayouts] = useState<Partial<Record<Zone, PrintLayout>>>({});
  // Posición "en vivo": mientras se arrastra se escribe aquí (sin re-render) y el 3D la lee en
  // cada cuadro; al soltar se guarda en el estado.
  const liveLayouts = useRef<Partial<Record<Zone, PrintLayout>>>({});
  const layout = layouts[zone] ?? DEFAULT_LAYOUT;
  const currentLayout = () => liveLayouts.current[zone] ?? layouts[zone] ?? DEFAULT_LAYOUT;
  const commit = (next: PrintLayout) => {
    liveLayouts.current[zone] = next;
    setLayouts((l) => ({ ...l, [zone]: next }));
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
    if (!d) return;
    // 1:1 con el cursor: el espacio libre de la zona en pantalla equivale al recorrido -1..1.
    const cur = currentLayout();
    const zonePx = e.currentTarget.clientWidth * zoneScreenFraction(fit, zone);
    const free = Math.max(zonePx * (1 - cur.scale), 1) / 2;
    liveLayouts.current[zone] = nudgeLayout(cur, { dx: (e.clientX - d.x) / free, dy: (e.clientY - d.y) / free });
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

  // Diseño de muestra con el nombre de la tienda: tinta oscura sobre prenda clara y clara sobre
  // prenda oscura; los rayos en el acento de la marca.
  const darkGarment = isDark(color);
  const ownFront = !!own.front;
  // Diseño de muestra: sello con el nombre de la tienda y su ícono (favicon) arriba; sin ícono, un sol.
  const storeIcon = settings.general.favicon;
  useEffect(() => {
    if (ownFront) return;
    let alive = true;
    const icon = storeIcon ? loadImage(storeIcon).catch(() => null) : Promise.resolve(null);
    icon
      .then((img) => sampleDesign(storeName, darkGarment ? '#F3F3EE' : brandInk(), accentInk(), img, darkGarment))
      .then((c) => {
        if (alive) { setPrints((p) => ({ ...p, front: cropToContent(c) })); setAnimZone('front'); setPrintKey((k) => k + 1); }
      });
    return () => { alive = false; };
  }, [storeName, storeIcon, darkGarment, ownFront]);

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
      // Entra cuando la sección aparece en pantalla.
      const scrollTrigger = { trigger: root.current, start: 'top 72%', once: true };
      gsap.from('[data-line]', { yPercent: 105, duration: 0.9, ease: 'power4.out', stagger: 0.09, scrollTrigger });
      gsap.from('[data-rise]', { y: 16, opacity: 0, duration: 0.7, ease: 'power3.out', stagger: 0.06, delay: 0.35, scrollTrigger });
    }, root);
    return () => ctx.revert();
  }, [reduced]);

  // La imagen va a la zona elegida (frente, espalda o manga).
  const loadPrintFile = (file?: File | null) => {
    if (!file || !file.type.startsWith('image/')) return;
    const target = zone;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const design = cropToContent(img);
      setPrints((p) => ({ ...p, [target]: design }));
      setOwn((o) => ({ ...o, [target]: true }));
      setAnimZone(target);
      setPrintKey((k) => k + 1);
    };
    img.src = url;
  };

  const clearZone = () => {
    setPrints((p) => ({ ...p, [zone]: null }));
    setOwn((o) => ({ ...o, [zone]: false }));
    setPrintKey((k) => k + 1);
  };
  const zoneLabel = ZONES.find((z) => z.id === zone)!.label.toLowerCase();

  const pickColor = (i: number) => {
    setColorIdx(i);
  };

  // Sin WebGL: la camiseta plana del molde.
  // Foto fija de la camiseta mientras carga el 3D (o si el navegador no tiene WebGL).
  const flat = (
    <img src={FITS[fit].poster} alt="" className="w-full h-full object-contain rounded-[2rem]" />
  );

  return (
    <section
      ref={root}
      className="relative bg-white overflow-hidden"
    >
      <div
        className="max-w-7xl mx-auto px-4 md:px-6 grid lg:grid-cols-[1.08fr_1fr] lg:grid-rows-[auto_auto] lg:content-center gap-x-8 gap-y-6 items-center py-14 md:py-20"
      >
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
              to="/customize"
              className="inline-flex items-center justify-center h-14 px-8 rounded-full bg-app-600 text-white text-base font-semibold hover:bg-app-700 active:scale-[0.98] transition focus:outline-none focus-visible:ring-4 focus-visible:ring-app-200"
            >
              Diseñar mi prenda
            </Link>
          </div>
          {fromPrice !== null && (
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
              <WebGLBoundary fallback={flat}>
                <Suspense fallback={flat}>
                  <Shirt3D fit={fit} color={color} prints={prints} layouts={layouts} layoutRef={liveLayouts} locked={editing} focus={zone} animZone={animZone} printKey={printKey} still={reduced} active={inView} onReady={markReady} />
                </Suspense>
              </WebGLBoundary>
            </div>
            <p className="sr-only">Prenda de muestra con un diseño estampado en el pecho. Puedes cambiar el color y probar con tu imagen.</p>

            {/* Mover el diseño de la zona elegida: siempre dentro de la zona. */}
            {prints[zone] && !editing && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="absolute right-3 bottom-3 inline-flex items-center gap-2 h-10 px-4 rounded-full bg-white/30 backdrop-blur-md ring-1 ring-white/50 text-sm font-semibold text-gray-900 shadow-[0_4px_20px_rgba(0,0,0,0.08)] hover:bg-white/50 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-app-500"
              >
                <Move className="w-4 h-4" aria-hidden="true" />
                Mover diseño
              </button>
            )}
            {prints[zone] && editing && (
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
                />
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

          {/* Zonas de estampado: al elegir una, la prenda gira para mostrarla. */}
          <div className="mt-4 max-w-[620px] mx-auto flex flex-wrap items-center gap-1.5" role="group" aria-label="Zona de estampado">
            {ZONES.map((z) => (
              <button
                key={z.id}
                type="button"
                onClick={() => { setZone(z.id); setEditing(false); }}
                aria-pressed={z.id === zone}
                className={`relative h-9 px-4 rounded-full text-sm font-semibold border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-app-500 ${
                  z.id === zone ? 'bg-accent text-accent-ink border-accent' : 'bg-white text-gray-700 border-black/10 hover:border-black/30'
                }`}
              >
                {z.label}
                {prints[z.id] && <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-app-600 ring-2 ring-white" aria-label="con diseño" />}
              </button>
            ))}
          </div>

          <div className="mt-3 max-w-[620px] mx-auto flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1 p-1 rounded-full bg-black/5" role="group" aria-label="Corte de la camiseta">
              {(Object.keys(FITS) as Fit[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => { setFit(f); setAnimZone(zone); setPrintKey((k) => k + 1); }}
                  aria-pressed={f === fit}
                  className={`h-9 px-4 rounded-full text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-app-500 ${
                    f === fit ? 'bg-app-600 text-white' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {FITS[f].label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2" role="group" aria-label="Color de la prenda">
              {colors.map((c, i) => (
                <button
                  key={c.hexCode}
                  type="button"
                  onClick={() => pickColor(i)}
                  aria-pressed={i === colorIdx}
                  aria-label={c.name}
                  title={c.name}
                  className={`w-9 h-9 rounded-full ring-1 ring-black/15 transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-app-500 ${i === colorIdx ? 'ring-2 ring-app-600 ring-offset-2' : ''}`}
                  style={{ backgroundColor: c.hexCode }}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="inline-flex items-center gap-2 h-11 px-5 rounded-full bg-app-600 text-white text-sm font-semibold hover:bg-app-800 active:scale-[0.98] transition focus:outline-none focus-visible:ring-4 focus-visible:ring-gray-300"
            >
              <ImageUp className="w-4 h-4" aria-hidden="true" />
              {own[zone] ? `Cambiar imagen (${zoneLabel})` : `Mi imagen en ${zoneLabel}`}
            </button>
            {own[zone] && (
              <button type="button" onClick={clearZone} className="text-sm font-semibold text-gray-600 underline underline-offset-4 hover:text-gray-900">
                Quitar
              </button>
            )}
            <input
              ref={fileInput}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              tabIndex={-1}
              onChange={(e) => { loadPrintFile(e.target.files?.[0]); e.target.value = ''; }}
            />
          </div>
          <p className="mt-2 max-w-[620px] mx-auto text-xs text-gray-500">
            Arrastra la prenda para girarla. Tu imagen se queda en tu navegador: no se sube a ningún lado.
          </p>
        </div>
      </div>
    </section>
  );
}

/** Botón del control de posición (flechas y tamaño). */
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
