/**
 * Las imágenes del diseño viajan como data URL mientras se edita. Antes de guardarlas en el
 * carrito del servidor o en el pedido se suben (/uploads/base64) y se reemplazan por su URL:
 * así la petición pesa poco y producción recibe los archivos originales.
 */
import { customizerService } from '../../services/customizer.service';
import type { CustomizedProduct } from '../../types/design';
import { dataUrlBytes, shrinkDataUrl } from './designImage';

const isData = (v?: string): v is string => !!v && v.startsWith('data:');

/** Cuántos bytes en data URL lleva el producto (lo que pesaría la petición). */
export function inlineBytes(cp: CustomizedProduct): number {
  const seen = new Set<string>();
  let total = 0;
  const add = (v?: string) => { if (isData(v) && !seen.has(v)) { seen.add(v); total += dataUrlBytes(v); } };
  cp.designs.forEach((d) => { add(d.imageData); add(d.originalImageData); });
  Object.values(cp.previews || {}).forEach(add);
  add(cp.previewImages?.front); add(cp.previewImages?.back);
  add(cp.productionImages?.front); add(cp.productionImages?.back);
  return total;
}

/** Reemplaza cada data URL por lo que devuelva `map` (una sola vez por imagen repetida). */
async function mapImages(cp: CustomizedProduct, map: (v: string) => Promise<string>): Promise<CustomizedProduct> {
  // Una imagen a la vez: no satura el límite de subidas del API y cada repetida se sube una vez.
  const cache = new Map<string, string>();
  const conv = async (v?: string) => {
    if (!isData(v)) return v;
    if (!cache.has(v)) cache.set(v, await map(v));
    return cache.get(v)!;
  };
  const designs = [];
  for (const d of cp.designs) designs.push({ ...d, imageData: await conv(d.imageData), originalImageData: await conv(d.originalImageData) });
  const previews: Record<string, string> = {};
  for (const [k, v] of Object.entries(cp.previews || {})) previews[k] = (await conv(v)) || v;
  return {
    ...cp,
    designs,
    previews: cp.previews ? previews : undefined,
    previewImages: { front: (await conv(cp.previewImages?.front)) || '', back: await conv(cp.previewImages?.back) },
    productionImages: cp.productionImages
      ? { front: await conv(cp.productionImages.front), back: await conv(cp.productionImages.back) }
      : undefined,
  };
}

/** Sube todas las imágenes en data URL (requiere sesión). Si una falla, lanza el error. */
export function uploadCustomizationAssets(cp: CustomizedProduct): Promise<CustomizedProduct> {
  if (inlineBytes(cp) === 0) return Promise.resolve(cp);
  return mapImages(cp, (v) => customizerService.uploadDesignImage(v));
}

/**
 * Para el carrito sin sesión (se guarda en el navegador, ~5 MB en total): achica las
 * imágenes de producción hasta que el producto pese ≤ maxBytes. Al pagar se suben.
 */
export async function fitForLocalCart(cp: CustomizedProduct, maxBytes = 2.5 * 1024 * 1024): Promise<CustomizedProduct> {
  let current = cp;
  for (let i = 0; i < 3 && inlineBytes(current) > maxBytes; i++) {
    const k = maxBytes / inlineBytes(current);
    current = await mapImages(current, (v) => (dataUrlBytes(v) > 200 * 1024 ? shrinkDataUrl(v, Math.max(120 * 1024, dataUrlBytes(v) * k * 0.9)) : Promise.resolve(v)));
  }
  return current;
}
