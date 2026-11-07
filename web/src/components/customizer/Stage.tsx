/**
 * Lienzo del estudio: la prenda de la vista, las zonas imprimibles y los diseños.
 * - Arrastrar mueve; la esquina escala; el asa de arriba rota (con imán cada 15°).
 * - En táctil, dos dedos escalan y rotan a la vez.
 * - Soltar un archivo encima lo agrega a la zona activa.
 * Todo en % del escenario, así no depende del tamaño de pantalla.
 * Con `overlay` va encima del maniquí 3D: no pinta la prenda ni las imágenes (las pinta el 3D),
 * solo las zonas, las cajas de selección y sus asas.
 */
import { useRef, useState, type CSSProperties, type PointerEvent as RPointerEvent } from 'react';
import { ImagePlus, Loader2, RotateCw, Maximize2 } from 'lucide-react';
import { useCurrency } from '../../hooks/useCurrency';
import type { CustomizerApi } from './useCustomizer';
import type { StudioDesign, StudioZone } from './customizerModel';

type Gesture =
  | { kind: 'move'; id: string; start: { x: number; y: number }; pos: { x: number; y: number } }
  | { kind: 'scale'; id: string; center: { x: number; y: number }; startDist: number; size: { width: number; height: number } }
  | { kind: 'rotate'; id: string; center: { x: number; y: number }; startAngle: number; rotation: number }
  | { kind: 'pinch'; id: string; startDist: number; startAngle: number; size: { width: number; height: number }; rotation: number };

const deg = (r: number) => (r * 180) / Math.PI;

function zoneStyle(z: StudioZone): CSSProperties {
  return { left: `${z.x}%`, top: `${z.y}%`, width: `${z.width}%`, height: `${z.height}%`, borderRadius: z.shape === 'circle' ? '9999px' : undefined };
}

/** Recorte del diseño a su zona (las zonas son rectángulos o elipses en % del escenario). */
function zoneClip(z?: StudioZone): string | undefined {
  if (!z) return undefined;
  if (z.shape === 'circle') return `ellipse(${z.width / 2}% ${z.height / 2}% at ${z.x + z.width / 2}% ${z.y + z.height / 2}%)`;
  return `inset(${z.y}% ${100 - z.x - z.width}% ${100 - z.y - z.height}% ${z.x}%)`;
}

export function Stage({ api, maxHeight = '68vh', onRequestUpload, overlay = false }: { api: CustomizerApi; maxHeight?: string; onRequestUpload: () => void; overlay?: boolean }) {
  const { format } = useCurrency();
  const ref = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const [dragOver, setDragOver] = useState(false);
  const [active, setActive] = useState(false);

  const { garment, stageAspect, view, viewPrintZones, viewBlockedZones, activeZone, studio, zones } = api;
  const viewDesigns = studio.designs.filter((d) => d.viewSlug === view);
  const selected = api.selected && api.selected.viewSlug === view ? api.selected : null;
  const zoneById = (id: number) => zones.find((z) => z.id === id);

  /** Punto del puntero en % del escenario. */
  const pct = (e: { clientX: number; clientY: number }) => {
    const r = ref.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 };
  };
  /** Distancias en px para escalar/rotar sin deformarse con la proporción. */
  const px = (p: { x: number; y: number }) => {
    const r = ref.current!.getBoundingClientRect();
    return { x: (p.x / 100) * r.width, y: (p.y / 100) * r.height };
  };

  const startMove = (e: RPointerEvent, d: StudioDesign) => {
    e.stopPropagation();
    e.preventDefault();
    api.dispatch({ type: 'select', id: d.id });
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      gesture.current = { kind: 'pinch', id: d.id, startDist: Math.hypot(b.x - a.x, b.y - a.y), startAngle: deg(Math.atan2(b.y - a.y, b.x - a.x)), size: d.size, rotation: d.rotation };
      return;
    }
    api.dispatch({ type: 'begin' });
    setActive(true);
    gesture.current = { kind: 'move', id: d.id, start: pct(e), pos: d.position };
  };

  const startHandle = (e: RPointerEvent, d: StudioDesign, kind: 'scale' | 'rotate') => {
    e.stopPropagation();
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    api.dispatch({ type: 'begin' });
    setActive(true);
    const c = px(d.position);
    const p = px(pct(e));
    if (kind === 'scale') gesture.current = { kind, id: d.id, center: c, startDist: Math.max(4, Math.hypot(p.x - c.x, p.y - c.y)), size: d.size };
    else gesture.current = { kind, id: d.id, center: c, startAngle: deg(Math.atan2(p.y - c.y, p.x - c.x)), rotation: d.rotation };
  };

  const onMove = (e: RPointerEvent) => {
    const g = gesture.current;
    if (!g) return;
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (g.kind === 'move') {
      const p = pct(e);
      api.update(g.id, { position: { x: g.pos.x + p.x - g.start.x, y: g.pos.y + p.y - g.start.y } }, false);
    } else if (g.kind === 'scale') {
      const p = px(pct(e));
      const k = Math.hypot(p.x - g.center.x, p.y - g.center.y) / g.startDist;
      api.update(g.id, { size: { width: g.size.width * k, height: g.size.height * k } }, false);
    } else if (g.kind === 'rotate') {
      const p = px(pct(e));
      let r = g.rotation + deg(Math.atan2(p.y - g.center.y, p.x - g.center.x)) - g.startAngle;
      const snap = Math.round(r / 15) * 15;
      if (e.shiftKey || Math.abs(r - snap) < 4) r = snap;
      api.update(g.id, { rotation: r }, false);
    } else if (g.kind === 'pinch' && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const k = Math.hypot(b.x - a.x, b.y - a.y) / Math.max(1, g.startDist);
      const r = g.rotation + deg(Math.atan2(b.y - a.y, b.x - a.x)) - g.startAngle;
      api.update(g.id, { size: { width: g.size.width * k, height: g.size.height * k }, rotation: r }, false);
    }
  };

  const onUp = (e: RPointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (gesture.current?.kind === 'pinch' && pointers.current.size === 0) gesture.current = null;
    if (gesture.current && gesture.current.kind !== 'pinch') gesture.current = null;
    if (!gesture.current) setActive(false);
  };

  const masked: CSSProperties = garment?.maskSrc
    ? { WebkitMaskImage: `url("${garment.maskSrc}")`, maskImage: `url("${garment.maskSrc}")`, WebkitMaskSize: '100% 100%', maskSize: '100% 100%', WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat' }
    : {};
  const blockedMaskId = `blocked-${view}`;

  return (
    <div className={overlay ? 'absolute inset-0' : 'w-full flex justify-center'}>
      <div
        ref={ref}
        className={`relative w-full select-none rounded-xl transition-shadow ${overlay ? 'h-full' : ''} ${dragOver ? 'ring-2 ring-app-500 ring-offset-4' : ''}`}
        style={overlay ? undefined : { aspectRatio: String(stageAspect), maxWidth: `calc(${maxHeight} * ${stageAspect})` }}
        onPointerDown={() => api.dispatch({ type: 'select', id: null })}
        onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setDragOver(true); } }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); api.addFiles(Array.from(e.dataTransfer.files || [])); }}
        aria-label="Lienzo de diseño"
      >
        {/* Prenda */}
        {overlay ? null : garment ? (
          <img src={garment.src} alt="" draggable={false} className="absolute inset-0 w-full h-full object-fill pointer-events-none" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center"><Loader2 className="w-8 h-8 text-app-500 animate-spin" /></div>
        )}

        {/* Zonas imprimibles */}
        {viewPrintZones.map((z) => {
          const isActive = activeZone?.id === z.id;
          const has = viewDesigns.some((d) => d.templateZoneId === z.id);
          const show = isActive || !has || active;
          return (
            <button
              key={z.id}
              type="button"
              onPointerDown={(e) => { e.stopPropagation(); api.setActiveZone(z.id); if (!has) api.dispatch({ type: 'select', id: null }); }}
              className={`absolute border-2 border-dashed transition-colors ${show ? '' : 'opacity-0 hover:opacity-100'} ${isActive ? 'border-app-500/80 bg-app-500/5' : 'border-gray-400/60 hover:border-app-400'}`}
              style={zoneStyle(z)}
              aria-label={`Zona ${z.name}`}
            >
              {(isActive || viewPrintZones.length > 1) && (
                <span className={`absolute -top-6 left-0 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-medium ${isActive ? 'bg-app-600 text-white' : 'bg-white/90 text-gray-600 ring-1 ring-gray-200'}`}>
                  {z.name}{z.price > 0 ? ` · +${format(z.price)}` : ''}
                </span>
              )}
            </button>
          );
        })}

        {/* Zonas no imprimibles */}
        {viewBlockedZones.map((z) => (
          <div key={z.id} className="absolute pointer-events-none border border-red-300/70 bg-[repeating-linear-gradient(45deg,rgba(239,68,68,.10)_0,rgba(239,68,68,.10)_6px,transparent_6px,transparent_12px)]" style={zoneStyle(z)} title={`${z.name}: no imprimible`} />
        ))}

        {/* Diseños: recortados a su zona, a las zonas bloqueadas y al contorno de la prenda */}
        {viewBlockedZones.length > 0 && (
          <svg width="0" height="0" className="absolute" aria-hidden>
            <defs>
              <mask id={blockedMaskId} maskUnits="objectBoundingBox" maskContentUnits="objectBoundingBox">
                <rect x="0" y="0" width="1" height="1" fill="white" />
                {viewBlockedZones.map((z) =>
                  z.shape === 'circle'
                    ? <ellipse key={z.id} cx={(z.x + z.width / 2) / 100} cy={(z.y + z.height / 2) / 100} rx={z.width / 200} ry={z.height / 200} fill="black" />
                    : <rect key={z.id} x={z.x / 100} y={z.y / 100} width={z.width / 100} height={z.height / 100} fill="black" />,
                )}
              </mask>
            </defs>
          </svg>
        )}
        {!overlay && <div className="absolute inset-0 pointer-events-none" style={masked}>
          <div className="absolute inset-0" style={viewBlockedZones.length ? { mask: `url(#${blockedMaskId})`, WebkitMask: `url(#${blockedMaskId})` } : undefined}>
            {viewDesigns.map((d) => (
              <div key={d.id} className="absolute inset-0" style={{ clipPath: zoneClip(zoneById(d.templateZoneId)) }}>
                <img
                  src={d.imageData}
                  alt=""
                  draggable={false}
                  className="absolute object-contain"
                  style={{
                    left: `${d.position.x - d.size.width / 2}%`, top: `${d.position.y - d.size.height / 2}%`,
                    width: `${d.size.width}%`, height: `${d.size.height}%`,
                    transform: `rotate(${d.rotation}deg)`, opacity: d.opacity,
                  }}
                />
              </div>
            ))}
          </div>
        </div>}

        {/* Cajas de selección (encima, sin recorte) */}
        {viewDesigns.map((d) => {
          const isSel = selected?.id === d.id;
          return (
            <div
              key={d.id}
              role="button"
              tabIndex={-1}
              aria-label={`Diseño ${d.originalFileName || ''}`}
              onPointerDown={(e) => startMove(e, d)}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
              className={`absolute cursor-move touch-none ${isSel ? 'outline outline-2 outline-app-600' : 'hover:outline hover:outline-1 hover:outline-app-400'}`}
              style={{
                left: `${d.position.x - d.size.width / 2}%`, top: `${d.position.y - d.size.height / 2}%`,
                width: `${d.size.width}%`, height: `${d.size.height}%`, transform: `rotate(${d.rotation}deg)`,
              }}
            >
              {isSel && (
                <>
                  <span
                    onPointerDown={(e) => startHandle(e, d, 'rotate')} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
                    className="absolute left-1/2 -top-9 -translate-x-1/2 w-7 h-7 rounded-full bg-white shadow ring-1 ring-gray-300 flex items-center justify-center cursor-grab touch-none text-gray-700"
                    title="Girar (Mayús: cada 15°)"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                  </span>
                  <span className="absolute left-1/2 -top-2 h-2 w-px bg-app-600 -translate-x-1/2" />
                  <span
                    onPointerDown={(e) => startHandle(e, d, 'scale')} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
                    className="absolute -right-3 -bottom-3 w-7 h-7 rounded-full bg-app-600 text-white shadow flex items-center justify-center cursor-nwse-resize touch-none"
                    title="Cambiar tamaño"
                  >
                    <Maximize2 className="w-3.5 h-3.5 rotate-90" />
                  </span>
                </>
              )}
            </div>
          );
        })}

        {/* Vista sin diseño: invitación a subir en la zona activa */}
        {(garment || overlay) && activeZone && !viewDesigns.some((d) => d.templateZoneId === activeZone.id) && (
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onRequestUpload}
            disabled={api.processing}
            className="absolute flex flex-col items-center justify-center gap-1.5 text-center rounded-lg text-gray-600 hover:text-app-700 transition-colors"
            style={zoneStyle(activeZone)}
          >
            {api.processing ? <Loader2 className="w-7 h-7 animate-spin text-app-600" /> : (
              <span className="w-11 h-11 rounded-full bg-white/90 shadow-sm ring-1 ring-gray-200 flex items-center justify-center"><ImagePlus className="w-5 h-5 text-app-600" /></span>
            )}
            <span className="text-xs sm:text-sm font-medium bg-white/85 rounded-md px-2 py-0.5">{api.processing ? 'Preparando imagen…' : 'Sube tu diseño'}</span>
            <span className="hidden sm:block text-[11px] text-gray-500 bg-white/70 rounded px-1.5">o arrástralo aquí</span>
          </button>
        )}
      </div>
    </div>
  );
}
