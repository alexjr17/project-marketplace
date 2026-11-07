/**
 * Fotos del maniquí en cada vista (frente, espalda, mangas), sin diseños, para usarlas de fondo
 * donde se dibujan las zonas (editor de zonas del admin). Monta el 3D fuera de la pantalla, toma
 * las fotos y avisa con `onDone`.
 */
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { VIEWS_3D, type Model3D, type View3D } from './models';
import type { Mannequin3DHandle } from './Mannequin3D';

const Mannequin3D = lazy(() => import('./Mannequin3D'));
const EMPTY = {};

export function MannequinSnapshots({ model, color = '#FFFFFF', onDone }: { model: Model3D; color?: string; onDone: (shots: Record<View3D, string>) => void }) {
  const handle = useRef<Mannequin3DHandle | null>(null);
  const [ready, setReady] = useState(false);
  const markReady = useCallback(() => setReady(true), []);
  const done = useRef(onDone);
  useEffect(() => { done.current = onDone; });

  useEffect(() => {
    if (!ready) return;
    // Deja pasar un par de cuadros (texturas y sombras) antes de las fotos.
    const t = window.setTimeout(() => {
      const h = handle.current;
      if (!h) return;
      const shots = {} as Record<View3D, string>;
      for (const { id } of VIEWS_3D) shots[id] = h.capture(id, { type: 'image/webp', quality: 0.9 }) ?? '';
      done.current(shots);
    }, 400);
    return () => window.clearTimeout(t);
  }, [ready, model, color]);

  return (
    <div aria-hidden="true" style={{ position: 'fixed', left: -10000, top: 0, width: 800, height: 800, pointerEvents: 'none' }}>
      <Suspense fallback={null}>
        <Mannequin3D key={model} model={model} color={color} art={EMPTY} focus="front" locked still onReady={markReady} handleRef={handle} />
      </Suspense>
    </div>
  );
}
