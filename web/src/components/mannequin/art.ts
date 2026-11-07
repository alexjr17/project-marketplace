/**
 * Arte de cada vista del maniquí: los diseños que se pintan en su escenario (lienzo cuadrado en %).
 * Sin React ni Three.js: se puede probar aparte.
 */
import type { View3D } from './models';

export type ArtSource = HTMLImageElement | HTMLCanvasElement | ImageBitmap;

/** Rectángulo o elipse en % del escenario (esquina de arriba a la izquierda + tamaño). */
export interface ArtArea { x: number; y: number; w: number; h: number; circle?: boolean }

/** Un diseño: caja centrada en (cx, cy) de w × h (en %), con la imagen entera adentro ("contain"). */
export interface ArtLayer {
  src: ArtSource;
  cx: number;
  cy: number;
  w: number;
  h: number;
  /** Grados, a favor del reloj. */
  rotation?: number;
  opacity?: number;
  /** Zona a la que se recorta (no se pinta afuera). */
  clip?: ArtArea;
}

export interface ViewArt {
  layers: ArtLayer[];
  /** Zonas bloqueadas: ahí no se imprime. */
  holes?: ArtArea[];
}

export type MannequinArt = Partial<Record<View3D, ViewArt>>;

const sizeOf = (s: ArtSource) =>
  s instanceof HTMLImageElement ? { w: s.naturalWidth, h: s.naturalHeight } : { w: s.width, h: s.height };

/** Área del escenario que cubre la textura de una vista (la caja de sus zonas): más nitidez. */
export const FULL_FRAME: ArtArea = { x: 0, y: 0, w: 100, h: 100 };

/** Caja de todos los diseños (en %), para la rasqueta. */
function layersBox(layers: ArtLayer[]) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const l of layers) {
    const r = l.rotation ? Math.hypot(l.w, l.h) : 0;
    const hw = (r || l.w) / 2, hh = (r || l.h) / 2;
    x0 = Math.min(x0, l.cx - hw); x1 = Math.max(x1, l.cx + hw);
    y0 = Math.min(y0, l.cy - hh); y1 = Math.max(y1, l.cy + hh);
  }
  return { x0, y0, x1, y1 };
}

function areaPath(ctx: CanvasRenderingContext2D, a: ArtArea) {
  ctx.beginPath();
  if (a.circle) ctx.ellipse(a.x + a.w / 2, a.y + a.h / 2, a.w / 2, a.h / 2, 0, 0, Math.PI * 2);
  else ctx.rect(a.x, a.y, a.w, a.h);
}

/**
 * Pinta el arte de una vista en su textura, que cubre `frame` (en % del escenario). Se dibuja en
 * unidades de % gracias a la transformación. `progress` (0..1) es el avance de la rasqueta.
 */
export function paintArt(ctx: CanvasRenderingContext2D, art: ViewArt | undefined, progress = 1, frame: ArtArea = FULL_FRAME) {
  const W = ctx.canvas.width, H = ctx.canvas.height;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, W, H);
  const layers = (art?.layers ?? []).filter((l) => l.w > 0 && l.h > 0);
  if (!layers.length || progress <= 0) return;
  const kx = W / frame.w, ky = H / frame.h;
  ctx.setTransform(kx, 0, 0, ky, -frame.x * kx, -frame.y * ky);
  const box = layersBox(layers);
  const edge = box.x0 + (box.x1 - box.x0) * Math.min(1, progress);

  for (const l of layers) {
    const { w: iw, h: ih } = sizeOf(l.src);
    if (!iw || !ih) continue;
    const s = Math.min(l.w / iw, l.h / ih);
    const dw = iw * s, dh = ih * s;
    ctx.save();
    if (l.clip) { areaPath(ctx, l.clip); ctx.clip(); }
    if (progress < 1) { ctx.beginPath(); ctx.rect(-1, -1, edge + 1, 102); ctx.clip(); }
    ctx.globalAlpha = l.opacity ?? 1;
    ctx.translate(l.cx, l.cy);
    if (l.rotation) ctx.rotate((l.rotation * Math.PI) / 180);
    ctx.drawImage(l.src, -dw / 2, -dh / 2, dw, dh);
    ctx.restore();
  }

  if (art?.holes?.length) {
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    for (const h of art.holes) { areaPath(ctx, h); ctx.fill(); }
    ctx.restore();
  }

  if (progress < 1) {
    const bar = 12 / kx;
    ctx.fillStyle = 'rgba(20,20,24,0.55)';
    ctx.fillRect(edge - bar / 2, box.y0, bar, box.y1 - box.y0);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillRect(edge - bar / 2, box.y0, bar / 3, box.y1 - box.y0);
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

/** Caja (en % del escenario) que cubre unas zonas, con un margen; null si no hay zonas. */
export function frameOf(areas: ArtArea[], margin = 2): ArtArea | null {
  if (!areas.length) return null;
  const x0 = Math.max(0, Math.min(...areas.map((a) => a.x)) - margin);
  const y0 = Math.max(0, Math.min(...areas.map((a) => a.y)) - margin);
  const x1 = Math.min(100, Math.max(...areas.map((a) => a.x + a.w)) + margin);
  const y1 = Math.min(100, Math.max(...areas.map((a) => a.y + a.h)) + margin);
  return { x: x0, y: y0, w: Math.max(1, x1 - x0), h: Math.max(1, y1 - y0) };
}
