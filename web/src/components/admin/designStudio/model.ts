/**
 * Editor de diseños (admin → Imágenes de diseño): el diseño por capas (imágenes, SVG con sus colores
 * editables y textos) sobre un lienzo de impresión transparente. Se guarda por capas (para volver a
 * editarlo) y como PNG en alta calidad (lo que se estampa). Los textos marcados "lo cambia el cliente"
 * no van en el PNG: se guardan como textos editables (el nombre…) y se dibujan al personalizar.
 * Para DTF: sin sombras ni transparencias a medias.
 */
import type { DesignImage, NamedField } from '../../../services/design-images.service';
import { assetUrl } from '../../../utils/assetUrl';
import { DEFAULT_TEXT, loadTextFont, measureText, renderText, type TextSpec } from '../../../lib/textArt';
import { recolorSvg, svgUrl } from '../../../lib/svgColors';

export interface Artboard { key: string; label: string; w: number; h: number }
export const ARTBOARDS: Artboard[] = [
  { key: 'cuadrado', label: 'Cuadrado', w: 3000, h: 3000 },
  { key: 'vertical', label: 'Vertical', w: 2400, h: 3000 },
  { key: 'horizontal', label: 'Horizontal', w: 3000, h: 2000 },
];

interface LayerBase {
  id: string;
  name: string;
  /** Caja en px del lienzo (esquina de arriba a la izquierda) y giro en grados. */
  x: number; y: number; w: number; h: number; rot: number;
  flipX: boolean; flipY: boolean;
  hidden?: boolean;
}
export type ImageLayer = LayerBase & { kind: 'image'; src: string };
export type SvgLayer = LayerBase & { kind: 'svg'; svg: string; colors: Record<string, string> };
export type TextLayer = LayerBase & { kind: 'text'; spec: TextSpec; editable: { label: string; maxLength: number } | null };
export type DLayer = ImageLayer | SvgLayer | TextLayer;

export interface EditorData { v: 1; artboard: Artboard; layers: DLayer[] }

export const newId = () => `l${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export const emptyData = (): EditorData => ({ v: 1, artboard: ARTBOARDS[0], layers: [] });

/** Caja que cabe en el lienzo (fracción `fill`), centrada, con la proporción dada. */
export function fitBox(a: Artboard, aspect: number, fill = 0.7) {
  let w = a.w * fill, h = w / aspect;
  if (h > a.h * fill) { h = a.h * fill; w = h * aspect; }
  return { x: (a.w - w) / 2, y: (a.h - h) / 2, w, h };
}

const imgs = new Map<string, Promise<HTMLImageElement>>();
export function loadImg(src: string): Promise<HTMLImageElement> {
  const url = src.startsWith('data:') ? src : assetUrl(src);
  if (!imgs.has(url)) {
    imgs.set(url, new Promise((res, rej) => {
      const i = new Image();
      if (!url.startsWith('data:')) i.crossOrigin = 'anonymous';
      i.onload = () => res(i);
      i.onerror = () => { imgs.delete(url); rej(new Error('No se pudo cargar la imagen')); };
      i.src = url;
    }));
  }
  return imgs.get(url)!;
}

/** Proporción (ancho/alto) que ocupa el texto dibujado. */
export function textAspect(spec: TextSpec): number {
  const m = measureText(spec);
  return m.width / Math.max(1, m.height);
}

/** Texto editable (lo cambia el cliente) → texto editable del diseño (caja en % del lienzo). */
export function toTextFields(d: EditorData): NamedField[] | null {
  const out: NamedField[] = d.layers
    .filter((l): l is TextLayer => l.kind === 'text' && !!l.editable && !l.hidden)
    .map((l, i) => ({
      key: `${(l.editable!.label || 'texto').toLowerCase().normalize('NFD').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '') || 'texto'}${i ? `-${i + 1}` : ''}`,
      label: l.editable!.label || 'Nombre',
      default: l.spec.text.slice(0, l.editable!.maxLength),
      maxLength: l.editable!.maxLength,
      box: {
        x: Math.round((l.x / d.artboard.w) * 10000) / 100, y: Math.round((l.y / d.artboard.h) * 10000) / 100,
        w: Math.round((l.w / d.artboard.w) * 10000) / 100, h: Math.round((l.h / d.artboard.h) * 10000) / 100,
      },
      style: {
        font: l.spec.font, weight: l.spec.weight, italic: l.spec.italic, color: l.spec.color, upper: l.spec.upper,
        spacing: l.spec.spacing, shape: l.spec.shape, curve: l.spec.curve, outline: l.spec.outline,
      },
    }));
  return out.length ? out : null;
}

/** Un diseño viejo (sin capas): su imagen y sus textos editables como capas. */
export async function fromDesign(d: DesignImage): Promise<EditorData> {
  const a = ARTBOARDS[0];
  const src = d.printUrl || d.thumbnailUrl;
  let aspect = 1;
  try { const im = await loadImg(src); aspect = im.naturalWidth / Math.max(1, im.naturalHeight); } catch { /* cuadrada */ }
  const box = fitBox(a, aspect, 1);
  const layers: DLayer[] = [{ id: newId(), name: 'Imagen', kind: 'image', src, ...box, rot: 0, flipX: false, flipY: false }];
  for (const f of d.textFields ?? []) {
    layers.push({
      id: newId(), name: f.label, kind: 'text', rot: 0, flipX: false, flipY: false,
      x: box.x + (f.box.x / 100) * box.w, y: box.y + (f.box.y / 100) * box.h, w: (f.box.w / 100) * box.w, h: (f.box.h / 100) * box.h,
      spec: { ...DEFAULT_TEXT, ...f.style, text: f.default }, editable: { label: f.label, maxLength: f.maxLength },
    });
  }
  return { v: 1, artboard: a, layers };
}

/** Dibuja las capas en el contexto a la escala dada. */
export async function drawLayers(ctx: CanvasRenderingContext2D, d: EditorData, scale: number, opts: { skipEditable?: boolean } = {}) {
  for (const l of d.layers) {
    if (l.hidden || (opts.skipEditable && l.kind === 'text' && l.editable)) continue;
    let src: CanvasImageSource;
    if (l.kind === 'image') src = await loadImg(l.src);
    else if (l.kind === 'svg') src = await loadImg(svgUrl(recolorSvg(l.svg, l.colors)));
    else {
      await loadTextFont(l.spec.font);
      src = renderText(l.spec, Math.max(64, Math.max(l.w, l.h) * scale));
    }
    ctx.save();
    ctx.translate((l.x + l.w / 2) * scale, (l.y + l.h / 2) * scale);
    ctx.rotate((l.rot * Math.PI) / 180);
    ctx.scale(l.flipX ? -1 : 1, l.flipY ? -1 : 1);
    const w = l.w * scale, h = l.h * scale;
    if (l.kind === 'text') {
      // El texto dentro de su caja, sin deformarse.
      const c = src as HTMLCanvasElement;
      const k = Math.min(w / c.width, h / c.height);
      ctx.drawImage(c, (-c.width * k) / 2, (-c.height * k) / 2, c.width * k, c.height * k);
    } else {
      ctx.drawImage(src, -w / 2, -h / 2, w, h);
    }
    ctx.restore();
  }
}

/** El diseño como PNG transparente con el lado mayor `maxSide`. */
export async function exportPng(d: EditorData, maxSide: number, opts: { skipEditable?: boolean } = {}): Promise<string> {
  const k = maxSide / Math.max(d.artboard.w, d.artboard.h);
  const c = document.createElement('canvas');
  c.width = Math.round(d.artboard.w * k); c.height = Math.round(d.artboard.h * k);
  await drawLayers(c.getContext('2d')!, d, k, opts);
  return c.toDataURL('image/png');
}

/**
 * Quita el fondo blanco (o casi blanco) que toca los bordes de la imagen: lo de adentro que también es
 * blanco se conserva (un ojo, un brillo). `tol` 0..80.
 */
export async function removeWhiteBg(src: string, tol = 28): Promise<string> {
  const im = await loadImg(src);
  const max = 3000;
  const k = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight));
  const W = Math.round(im.naturalWidth * k), H = Math.round(im.naturalHeight * k);
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(im, 0, 0, W, H);
  const data = ctx.getImageData(0, 0, W, H);
  const px = data.data;
  const near = (i: number) => px[i + 3] > 0 && px[i] >= 255 - tol && px[i + 1] >= 255 - tol && px[i + 2] >= 255 - tol;
  const seen = new Uint8Array(W * H);
  const stack: number[] = [];
  const push = (x: number, y: number) => { const p = y * W + x; if (!seen[p] && near(p * 4)) { seen[p] = 1; stack.push(p); } };
  for (let x = 0; x < W; x++) { push(x, 0); push(x, H - 1); }
  for (let y = 0; y < H; y++) { push(0, y); push(W - 1, y); }
  while (stack.length) {
    const p = stack.pop()!;
    px[p * 4 + 3] = 0;
    const x = p % W, y = (p / W) | 0;
    if (x > 0) push(x - 1, y);
    if (x < W - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y < H - 1) push(x, y + 1);
  }
  ctx.putImageData(data, 0, 0);
  return c.toDataURL('image/png');
}

/** Cualquier imagen que el navegador abra (GIF, BMP, AVIF…) → PNG (las PNG, JPG y WEBP se quedan igual). */
export async function toUploadable(dataUrl: string): Promise<string> {
  if (/^data:image\/(png|jpe?g|webp);/i.test(dataUrl)) return dataUrl;
  const im = await loadImg(dataUrl);
  const c = document.createElement('canvas');
  c.width = im.naturalWidth; c.height = im.naturalHeight;
  c.getContext('2d')!.drawImage(im, 0, 0);
  return c.toDataURL('image/png');
}
