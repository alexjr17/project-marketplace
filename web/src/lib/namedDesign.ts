/**
 * Diseños con nombre editable: la imagen del diseño con cada texto (el nombre…) dibujado en su caja,
 * con la letra que definió el admin. Lo usan la galería y el pack familiar del personalizador, el
 * admin (vista previa) y el estudio. Para DTF: sólido, sin sombras.
 */
import type { NamedField } from '../services/design-images.service';
import { assetUrl } from '../utils/assetUrl';
import { DEFAULT_TEXT, loadTextFont, renderText, type TextSpec } from './textArt';

/** Lo que guarda un diseño con nombre colocado en la prenda (para volver a editarlo). */
export interface NamedDesign {
  designId: number;
  name: string;
  /** Imagen base (el archivo de producción si lo hay). */
  base: string;
  fields: NamedField[];
  /** Lo que escribió el cliente en cada texto (por key). */
  values: Record<string, string>;
}

/** El texto de un campo listo para dibujar. */
export const fieldSpec = (f: NamedField, value: string): TextSpec => ({
  ...DEFAULT_TEXT, ...f.style, text: value, align: 'center', lineHeight: 1.05,
});

/** Valores iniciales: los de ejemplo del diseño. */
export const defaultValues = (fields: NamedField[]): Record<string, string> => Object.fromEntries(fields.map((f) => [f.key, f.default]));

/** "Sofía" o "Sofía · 2025" (para listas y el pedido). */
export const namedLabel = (n: Pick<NamedDesign, 'fields' | 'values'>) =>
  n.fields.map((f) => (n.values[f.key] ?? '').trim()).filter(Boolean).join(' · ');

const images = new Map<string, Promise<HTMLImageElement>>();
function loadImage(src: string): Promise<HTMLImageElement> {
  const url = assetUrl(src);
  if (!images.has(url)) {
    images.set(url, new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => { images.delete(url); reject(new Error('No se pudo cargar el diseño')); };
      img.src = url;
    }));
  }
  return images.get(url)!;
}

/** Dibuja cada texto dentro de su caja (centrado, sin deformar y sin salirse). */
export function drawFields(ctx: CanvasRenderingContext2D, W: number, H: number, fields: NamedField[], values: Record<string, string>) {
  for (const f of fields) {
    const value = (values[f.key] ?? '').slice(0, f.maxLength);
    if (!value.trim()) continue;
    const bw = (f.box.w / 100) * W, bh = (f.box.h / 100) * H;
    const t = renderText(fieldSpec(f, value), Math.max(64, Math.min(3000, Math.max(bw, bh) * 1.5)));
    const k = Math.min(bw / t.width, bh / t.height);
    const w = t.width * k, h = t.height * k;
    ctx.drawImage(t, (f.box.x / 100) * W + (bw - w) / 2, (f.box.y / 100) * H + (bh - h) / 2, w, h);
  }
}

/**
 * El diseño con sus textos, como PNG transparente de lado mayor `maxSide` (sin agrandar la imagen
 * base más allá de su tamaño real, salvo que sea muy chica).
 */
export async function composeNamed(n: Pick<NamedDesign, 'base' | 'fields' | 'values'>, maxSide: number): Promise<{ url: string; width: number; height: number }> {
  const [img] = await Promise.all([loadImage(n.base), ...n.fields.map((f) => loadTextFont(f.style.font))]);
  const natural = Math.max(img.naturalWidth, img.naturalHeight) || 1;
  const k = Math.min(maxSide, Math.max(natural, 900)) / natural;
  const W = Math.max(1, Math.round(img.naturalWidth * k)), H = Math.max(1, Math.round(img.naturalHeight * k));
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(img, 0, 0, W, H);
  drawFields(ctx, W, H, n.fields, n.values);
  return { url: c.toDataURL('image/png'), width: W, height: H };
}
