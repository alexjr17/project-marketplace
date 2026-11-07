/**
 * Lienzo del estudio para plantillas con maniquí 3D: el maniquí mira la vista elegida y queda
 * quieto; encima va el lienzo de siempre (Stage en modo `overlay`) con las zonas de la BD y las asas
 * para mover, escalar y rotar. "Girar" suelta el maniquí para verlo por todos lados.
 */
import { Component, lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { PenLine, Rotate3d } from 'lucide-react';
import { assetUrl } from '../../utils/assetUrl';
import { MODELS_3D, view3DOf, type View3D } from '../mannequin/models';
import { frameOf, type ArtArea, type MannequinArt } from '../mannequin/art';
import { Stage } from './Stage';
import type { CustomizerApi } from './useCustomizer';

const Mannequin3D = lazy(() => import('../mannequin/Mannequin3D'));

class WebGLBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Imágenes de los diseños ya cargadas (para pintarlas en el 3D). */
function useDesignImages(sources: string[]) {
  const cache = useRef(new Map<string, HTMLImageElement | 'loading' | 'error'>());
  const [tick, setTick] = useState(0);
  const key = sources.join('|');
  useEffect(() => {
    for (const src of sources) {
      if (cache.current.has(src)) continue;
      cache.current.set(src, 'loading');
      const img = new Image();
      // Con CORS la foto del 3D (vista previa del carrito) se puede exportar.
      if (!src.startsWith('data:') && !src.startsWith('blob:')) img.crossOrigin = 'anonymous';
      img.onload = () => { cache.current.set(src, img); setTick((t) => t + 1); };
      img.onerror = () => { cache.current.set(src, 'error'); setTick((t) => t + 1); };
      img.src = src.startsWith('data:') || src.startsWith('blob:') ? src : assetUrl(src);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  // Cambia solo cuando termina de cargar alguna imagen.
  return useCallback((src: string) => {
    const v = cache.current.get(src);
    return v instanceof HTMLImageElement ? v : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);
}

export function Stage3D({ api, onRequestUpload }: { api: CustomizerApi; onRequestUpload: () => void }) {
  const model = api.model3d!;
  const [spin, setSpin] = useState(false);
  const [ready, setReady] = useState(false);
  const markReady = useCallback(() => setReady(true), []);
  const still = useMemo(reducedMotion, []);

  // Al cambiar de vista o elegir un diseño se vuelve a editar.
  useEffect(() => { setSpin(false); }, [api.view, api.studio.selectedId]);

  const imageOf = useDesignImages(api.studio.designs.map((d) => d.imageData));

  // Arte de cada vista del maniquí: los diseños recortados a su zona; las bloqueadas no se imprimen.
  const art = useMemo(() => {
    const out: MannequinArt = {};
    for (const z of api.zones) {
      if (!z.isBlocked) continue;
      const v = (out[view3DOf(z.viewSlug)] ??= { layers: [], holes: [] });
      v.holes!.push({ x: z.x, y: z.y, w: z.width, h: z.height, circle: z.shape === 'circle' });
    }
    for (const d of api.studio.designs) {
      const src = imageOf(d.imageData);
      const z = api.zones.find((x) => x.id === d.templateZoneId);
      if (!src || !z) continue;
      const v = (out[view3DOf(d.viewSlug)] ??= { layers: [], holes: [] });
      v.layers.push({
        src, cx: d.position.x, cy: d.position.y, w: d.size.width, h: d.size.height, rotation: d.rotation, opacity: d.opacity,
        clip: { x: z.x, y: z.y, w: z.width, h: z.height, circle: z.shape === 'circle' },
      });
    }
    return out;
  }, [api.zones, api.studio.designs, imageOf]);

  // Cada vista pinta solo la caja de sus zonas (más nitidez).
  const frames = useMemo(() => {
    const out: Partial<Record<View3D, ArtArea>> = {};
    for (const v of ['front', 'back', 'rightSleeve', 'leftSleeve'] as View3D[]) {
      const f = frameOf(api.zones.filter((z) => view3DOf(z.viewSlug) === v).map((z) => ({ x: z.x, y: z.y, w: z.width, h: z.height })));
      if (f) out[v] = f;
    }
    return out;
  }, [api.zones]);

  const poster = <img src={MODELS_3D[model].poster} alt="" className="w-full h-full object-contain" />;

  return (
    <div className="relative aspect-square w-full mx-auto" style={{ maxWidth: 'var(--stage-h, 60vh)' }}>
      <div className="absolute inset-0">
        {!ready && <div className="absolute inset-0">{poster}</div>}
        <WebGLBoundary fallback={poster}>
          <Suspense fallback={poster}>
            <Mannequin3D
              model={model}
              color={api.color?.hexCode || '#FFFFFF'}
              art={art}
              frames={frames}
              focus={view3DOf(api.view)}
              locked={!spin}
              still={still}
              onReady={markReady}
              handleRef={api.mannequinRef}
            />
          </Suspense>
        </WebGLBoundary>
      </div>

      {!spin && <Stage api={api} overlay onRequestUpload={onRequestUpload} />}

      <button
        type="button"
        onClick={() => setSpin((s) => !s)}
        aria-pressed={spin}
        className="absolute right-0 -bottom-1 translate-y-full sm:translate-y-0 sm:bottom-0 inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full bg-white/80 backdrop-blur ring-1 ring-black/10 text-sm font-semibold text-gray-800 shadow-sm hover:bg-white transition focus:outline-none focus-visible:ring-2 focus-visible:ring-app-500"
      >
        {spin ? <PenLine className="w-4 h-4" aria-hidden="true" /> : <Rotate3d className="w-4 h-4" aria-hidden="true" />}
        {spin ? 'Volver a editar' : 'Girar 360°'}
      </button>
    </div>
  );
}
