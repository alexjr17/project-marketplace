/**
 * Posición del diseño de la portada dentro de su zona. Los maniquíes y las zonas viven en
 * components/mannequin (modelos) y en la BD (zonas de cada plantilla).
 *
 * `x` y `y` van de -1 a 1 (borde a borde del espacio libre de la zona) y `scale` es el tamaño
 * respecto al máximo de la zona. Así el diseño nunca sale de la zona.
 */
export interface PrintLayout { x: number; y: number; scale: number }
// Arranca al 70 % de la zona, arriba (el pecho): hay espacio para moverlo y se puede agrandar.
export const DEFAULT_LAYOUT: PrintLayout = { x: 0, y: -1, scale: 0.7 };
export const LAYOUT_LIMITS = { minScale: 0.3, maxScale: 1, step: 0.25, scaleStep: 0.1 };

/** Mueve o escala dentro de los límites de la zona. */
export function nudgeLayout(l: PrintLayout, move: { dx?: number; dy?: number; ds?: number }): PrintLayout {
  const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
  return {
    x: clamp(l.x + (move.dx ?? 0), -1, 1),
    y: clamp(l.y + (move.dy ?? 0), -1, 1),
    scale: clamp(Math.round((l.scale + (move.ds ?? 0)) * 100) / 100, LAYOUT_LIMITS.minScale, LAYOUT_LIMITS.maxScale),
  };
}
