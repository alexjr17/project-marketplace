/**
 * Montaje 2D de un diseño sobre una plantilla personalizable que trabaja con fotos y zonas (sin
 * modelo 3D, o además de él): toma la foto de la vista de la zona, pone el diseño centrado en la zona
 * (del tamaño pedido, recortado a su forma) y le devuelve un poco de la sombra de la tela encima
 * para que se vea impreso y no pegado.
 */
import type { SourceProduct, SourceZone } from '../../services/marketing.service';
import { canonicalView, resolveViewImage } from '../customizer/customizerModel';
import { hasTransparency } from './cutout';

/** Plantilla con fotos para montar diseños (al menos una zona con la foto de su vista). */
export const hasPhotoViews = (t: SourceProduct) => (t.zones ?? []).some((z) => !!viewImageOf(t, z));

/** Foto de la vista donde está la zona (la misma lógica del personalizador). */
export function viewImageOf(t: SourceProduct, z: Pick<SourceZone, 'view'>): string | null {
  if (!z.view) return null;
  // Mismas reglas que el personalizador (el tipo pide `front`, pero acepta lo que falte).
  return resolveViewImage({ images: (t.viewImages ?? {}) as { front: string }, zoneTypeImages: t.zoneTypeImages ?? {} }, z.view) ?? null;
}

/** Zonas que se pueden usar en 2D (las que tienen foto de su vista), del frente primero. */
export function photoZones(t: SourceProduct): SourceZone[] {
  const order = { front: 0, back: 1, side: 2 } as const;
  return (t.zones ?? [])
    .filter((z) => !!viewImageOf(t, z))
    .sort((a, b) => (order[canonicalView(a.view) ?? 'side'] ?? 3) - (order[canonicalView(b.view) ?? 'side'] ?? 3));
}

type Src = HTMLImageElement | HTMLCanvasElement;
const dims = (s: Src) => (s instanceof HTMLImageElement ? [s.naturalWidth, s.naturalHeight] : [s.width, s.height]);

/**
 * Quita el fondo claro de un diseño (los píxeles claros y sin color que tocan el borde), con un borde
 * suave; los blancos de adentro del diseño se quedan. Devuelve un lienzo nuevo.
 */
export function knockoutWhite(src: Src): HTMLCanvasElement {
  const [W, H] = dims(src);
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(src, 0, 0);
  const data = ctx.getImageData(0, 0, W, H);
  const p = data.data;
  const light = (i: number) => p[i + 3] > 0 && Math.min(p[i], p[i + 1], p[i + 2]) > 205 && Math.max(p[i], p[i + 1], p[i + 2]) - Math.min(p[i], p[i + 1], p[i + 2]) < 28;
  const seen = new Uint8Array(W * H);
  const stack: number[] = [];
  for (let x = 0; x < W; x++) stack.push(x, (H - 1) * W + x);
  for (let y = 0; y < H; y++) stack.push(y * W, y * W + W - 1);
  while (stack.length) {
    const k = stack.pop()!;
    if (seen[k]) continue;
    seen[k] = 1;
    const i = k * 4;
    if (!light(i)) continue;
    const m = Math.min(p[i], p[i + 1], p[i + 2]);
    p[i + 3] = m > 238 ? 0 : Math.round(((238 - m) / 33) * p[i + 3]);
    const x = k % W, y = (k - x) / W;
    if (x > 0) stack.push(k - 1);
    if (x < W - 1) stack.push(k + 1);
    if (y > 0) stack.push(k - W);
    if (y < H - 1) stack.push(k + W);
  }
  ctx.putImageData(data, 0, 0);
  return c;
}

const cleaned = new WeakMap<object, Src>();
/** El diseño listo para estampar: si trae fondo claro y opaco (como los de la IA), se le quita. */
export function printable(design: Src): Src {
  const known = cleaned.get(design);
  if (known) return known;
  let out: Src = design;
  try {
    const [W, H] = dims(design);
    const t = document.createElement('canvas');
    t.width = t.height = 8;
    const tc = t.getContext('2d')!;
    tc.drawImage(design, 0, 0, 8, 8);
    const d = tc.getImageData(0, 0, 8, 8).data;
    const corner = (k: number) => d[k * 4 + 3] > 240 && Math.min(d[k * 4], d[k * 4 + 1], d[k * 4 + 2]) > 205;
    if (W && H && [0, 7, 56, 63].every(corner)) out = knockoutWhite(design);
  } catch { /* otro origen: se usa tal cual */ }
  cleaned.set(design, out);
  return out;
}

/**
 * Foto de la plantilla con el diseño en la zona. `size` (0.3..1): cuánto de la zona ocupa el diseño.
 * Devuelve un lienzo del tamaño de la foto (hasta 1600 px de lado).
 */
const tinted = new WeakMap<object, Map<string, HTMLCanvasElement>>();
/**
 * La prenda en otro color: tiñe la foto (en PNG con fondo transparente) conservando sus sombras, costuras
 * y arrugas. En blanco (o en fotos con fondo) queda igual.
 */
export function tintGarment(base: Src, color: string | null | undefined): Src {
  const hex = (color ?? '').toUpperCase();
  if (!/^#[0-9A-F]{6}$/.test(hex) || hex === '#FFFFFF' || !hasTransparency(base)) return base;
  let byColor = tinted.get(base);
  if (!byColor) { byColor = new Map(); tinted.set(base, byColor); }
  const known = byColor.get(hex);
  if (known) return known;
  const [W, H] = dims(base);
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(base, 0, 0);
  // El color por encima, multiplicado: las sombras de la tela se conservan.
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = hex;
  ctx.fillRect(0, 0, W, H);
  // En colores oscuros, un poco de la textura original para que la tela no quede plana.
  const n = parseInt(hex.slice(1), 16);
  const lum = (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
  ctx.globalCompositeOperation = 'soft-light';
  ctx.globalAlpha = lum < 0.35 ? 0.5 : 0.25;
  ctx.drawImage(base, 0, 0);
  ctx.globalAlpha = 1;
  // Solo la prenda (el fondo sigue transparente).
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(base, 0, 0);
  byColor.set(hex, c);
  return c;
}

export function composeMockup(base0: HTMLImageElement, design: Src | null, zone: SourceZone, size = 0.9, offset?: { x: number; y: number } | null, color?: string | null): HTMLCanvasElement {
  const base = tintGarment(base0, color);
  const [bw, bh] = dims(base);
  const k = Math.min(1, 1600 / Math.max(bw, bh));
  const W = Math.max(1, Math.round(bw * k)), H = Math.max(1, Math.round(bh * k));
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(base, 0, 0, W, H);
  movable.add(c);
  if (!design) return c;
  design = printable(design);
  const [dw, dh] = dims(design);
  if (!dw || !dh) return c;
  const zx = (zone.x / 100) * W, zy = (zone.y / 100) * H, zw = (zone.w / 100) * W, zh = (zone.h / 100) * H;
  const s = Math.min((zw * size) / dw, (zh * size) / dh);
  const w = dw * s, h = dh * s;
  const clip = () => {
    ctx.beginPath();
    if (zone.circle) ctx.ellipse(zx + zw / 2, zy + zh / 2, zw / 2, zh / 2, 0, 0, Math.PI * 2);
    else ctx.rect(zx, zy, zw, zh);
    ctx.clip();
  };
  // ¿La prenda es clara en la zona? Entonces el diseño se imprime como tinta (multiplicar): su fondo
  // blanco desaparece y los colores se asientan en la tela. En prendas oscuras va normal.
  const probe = document.createElement('canvas');
  probe.width = probe.height = 8;
  const pc = probe.getContext('2d')!;
  pc.drawImage(c, zx, zy, Math.max(1, zw), Math.max(1, zh), 0, 0, 8, 8);
  const px = pc.getImageData(0, 0, 8, 8).data;
  let lum = 0;
  for (let i = 0; i < px.length; i += 4) lum += 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2];
  // Tinta (multiplicar) solo en prendas casi blancas: en una de color, multiplicar teñiría el diseño.
  const tinted = base !== base0;
  const light = lum / 64 > (tinted ? 215 : 150);
  // El diseño con la sombra de la tela solo sobre él (no sobre todo el recuadro): se arma aparte.
  // Centrado en la zona, o corrido a donde lo movió el usuario (fracción de la foto).
  const dx = zx + (zw - w) / 2 + (offset?.x ?? 0) * W, dy = zy + (zh - h) / 2 + (offset?.y ?? 0) * H;
  const t = document.createElement('canvas');
  t.width = Math.max(1, Math.round(w)); t.height = Math.max(1, Math.round(h));
  const tc = t.getContext('2d')!;
  tc.drawImage(design, 0, 0, t.width, t.height);
  tc.globalCompositeOperation = 'multiply';
  tc.globalAlpha = 0.3;
  // La textura de la tela sale de la prenda original (neutra), no de la teñida: el diseño conserva sus colores.
  if (tinted) {
    const k0 = dims(base0)[0] / W;
    tc.drawImage(base0, dx * k0, dy * k0, w * k0, h * k0, 0, 0, t.width, t.height);
  } else tc.drawImage(c, dx, dy, w, h, 0, 0, t.width, t.height);
  tc.globalAlpha = 1;
  tc.globalCompositeOperation = 'destination-in';
  tc.drawImage(design, 0, 0, t.width, t.height);
  // Prenda recortada (PNG): el diseño se puede poner en cualquier parte de la prenda y se corta en su
  // silueta. En fotos con fondo, se corta en la zona.
  let print: HTMLCanvasElement = t;
  let px0 = dx, py0 = dy;
  if (hasTransparency(base)) {
    const g = document.createElement('canvas');
    g.width = W; g.height = H;
    const gc = g.getContext('2d')!;
    gc.drawImage(t, dx, dy, w, h);
    gc.globalCompositeOperation = 'destination-in';
    gc.drawImage(base, 0, 0, W, H);
    print = g; px0 = 0; py0 = 0;
  }
  ctx.save();
  if (print === t) clip();
  ctx.globalAlpha = 0.97;
  if (light) ctx.globalCompositeOperation = 'multiply';
  if (print === t) ctx.drawImage(t, dx, dy, w, h);
  else ctx.drawImage(print, px0, py0);
  designRects.set(c, { x: dx, y: dy, w, h });
  ctx.restore();
  return c;
}

/**
 * Acercamiento a la zona (planos de detalle, como la manga): un recorte cuadrado centrado en la zona,
 * con `pad` veces su tamaño de aire alrededor.
 */
const cropParts = new WeakMap<object, [number, number]>();
const movable = new WeakSet<object>();
const designRects = new WeakMap<object, { x: number; y: number; w: number; h: number }>();
/** Dónde quedó el diseño dentro de un montaje (en píxeles de esa imagen). */
export function designRectOf(img: object): { x: number; y: number; w: number; h: number } | null {
  return designRects.get(img) ?? null;
}
/** ¿Es un montaje sobre foto (donde el diseño se puede correr dentro de su zona)? */
export function isMovableMockup(img: object): boolean {
  return movable.has(img);
}
/** Qué parte de la foto completa es un acercamiento (ancho y alto, de 0 a 1); 1 si es la foto entera. */
export function cropFraction(img: object): [number, number] {
  return cropParts.get(img) ?? [1, 1];
}

export function zoneCrop(mock: Src, zone: Pick<SourceZone, 'x' | 'y' | 'w' | 'h'>, pad = 0.6, zoom = 1): HTMLCanvasElement {
  const [W, H] = dims(mock);
  const zw = (zone.w / 100) * W, zh = (zone.h / 100) * H;
  // El zoom cambia el encuadre: alejar muestra más de la prenda alrededor de la zona, acercar menos.
  const side = Math.min(W, H, (Math.max(zw, zh) * (1 + pad * 2)) / Math.max(0.2, zoom));
  const cx = (zone.x / 100) * W + zw / 2, cy = (zone.y / 100) * H + zh / 2;
  const sx = Math.max(0, Math.min(W - side, cx - side / 2)), sy = Math.max(0, Math.min(H - side, cy - side / 2));
  const c = document.createElement('canvas');
  c.width = c.height = Math.round(Math.min(side, W, H));
  c.getContext('2d')!.drawImage(mock, sx, sy, c.width, c.height, 0, 0, c.width, c.height);
  cropParts.set(c, [c.width / W, c.height / H]);
  if (movable.has(mock)) movable.add(c);
  const dr = designRects.get(mock);
  if (dr) designRects.set(c, { x: dr.x - sx, y: dr.y - sy, w: dr.w, h: dr.h });
  return c;
}
