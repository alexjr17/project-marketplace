/**
 * Preparación de la imagen que sube el cliente: recorta los bordes transparentes, deja
 * una versión de producción (máx. MAX_ORIGINAL_PX y MAX_ORIGINAL_BYTES, para que quepa en
 * una petición del API) y una vista previa liviana para el estudio.
 */

export interface ProcessedDesignImage {
  preview: string;
  original: string;
  fileName: string;
  fileSize: number;
  width: number;
  height: number;
}

export const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/gif'];
export const MAX_INPUT_MB = 40;
export const MAX_ORIGINAL_PX = 3000;
/** El API acepta peticiones de hasta 8 MB: la imagen de producción queda por debajo. */
export const MAX_ORIGINAL_BYTES = 4.5 * 1024 * 1024;
export const PREVIEW_PX = 900;

/** Bytes aproximados del contenido de un data URL. */
export function dataUrlBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(',');
  return Math.floor(((comma >= 0 ? dataUrl.length - comma - 1 : dataUrl.length) * 3) / 4);
}

export function validateDesignFile(file: File): string | null {
  if (!ACCEPTED_TYPES.includes(file.type)) return 'Usa una imagen PNG, JPG, WEBP o SVG.';
  if (file.size > MAX_INPUT_MB * 1024 * 1024) return `La imagen pesa más de ${MAX_INPUT_MB} MB.`;
  return null;
}

const readAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error('No se pudo leer el archivo'));
    r.readAsDataURL(file);
  });

export const decodeImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('La imagen no se pudo abrir'));
    img.src = src;
  });

function canvasOf(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('El navegador no permite procesar imágenes');
  return { c, ctx };
}

/** Caja del contenido visible (alpha > 10) o null si no hay transparencia. */
function opaqueBox(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const data = ctx.getImageData(0, 0, w, h).data;
  let minX = w, minY = h, maxX = -1, maxY = -1, transparent = false;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const a = data[(y * w + x) * 4 + 3];
      if (a < 255) transparent = true;
      if (a > 10) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (!transparent) return { transparent: false as const };
  if (maxX < 0) return { transparent: true as const, box: null };
  const pad = 2;
  return {
    transparent: true as const,
    box: { x: Math.max(0, minX - pad), y: Math.max(0, minY - pad), w: Math.min(w - 1, maxX + pad) - Math.max(0, minX - pad) + 1, h: Math.min(h - 1, maxY + pad) - Math.max(0, minY - pad) + 1 },
  };
}

/** Codifica un canvas bajando calidad y luego tamaño hasta pesar ≤ maxBytes. */
function encodeWithin(source: HTMLCanvasElement, transparent: boolean, maxBytes: number): { url: string; w: number; h: number } {
  const type = transparent ? 'image/png' : 'image/jpeg';
  let w = source.width;
  let h = source.height;
  let url = source.toDataURL(type, transparent ? undefined : 0.92);
  for (let i = 0; i < 6 && dataUrlBytes(url) > maxBytes; i++) {
    const k = Math.sqrt(maxBytes / dataUrlBytes(url)) * 0.92;
    w = Math.max(1, Math.round(w * k));
    h = Math.max(1, Math.round(h * k));
    const { c, ctx } = canvasOf(w, h);
    ctx.drawImage(source, 0, 0, w, h);
    url = c.toDataURL(type, transparent ? undefined : 0.85);
  }
  return { url, w, h };
}

function resized(source: HTMLCanvasElement, maxPx: number) {
  const k = Math.min(1, maxPx / Math.max(source.width, source.height));
  if (k >= 1) return source;
  const { c, ctx } = canvasOf(source.width * k, source.height * k);
  ctx.drawImage(source, 0, 0, c.width, c.height);
  return c;
}

/** Archivo del cliente → versiones de producción y vista previa. */
export async function processDesignFile(file: File): Promise<ProcessedDesignImage> {
  const problem = validateDesignFile(file);
  if (problem) throw new Error(problem);
  const raw = await readAsDataUrl(file);
  const img = await decodeImage(raw);
  // Los SVG pueden no tener tamaño propio: se rasterizan a 2000 px.
  const iw = img.naturalWidth || 2000;
  const ih = img.naturalHeight || 2000;
  const k = Math.min(1, MAX_ORIGINAL_PX / Math.max(iw, ih));
  const scale = file.type === 'image/svg+xml' && Math.max(iw, ih) < 2000 ? 2000 / Math.max(iw, ih) : k;
  const base = canvasOf(iw * scale, ih * scale);
  base.ctx.drawImage(img, 0, 0, base.c.width, base.c.height);

  let work = base.c;
  const info = opaqueBox(base.ctx, base.c.width, base.c.height);
  if (info.transparent && info.box && (info.box.w < base.c.width || info.box.h < base.c.height)) {
    const t = canvasOf(info.box.w, info.box.h);
    t.ctx.drawImage(base.c, info.box.x, info.box.y, info.box.w, info.box.h, 0, 0, info.box.w, info.box.h);
    work = t.c;
  }

  const original = encodeWithin(work, info.transparent, MAX_ORIGINAL_BYTES);
  const preview = encodeWithin(resized(work, PREVIEW_PX), info.transparent, 600 * 1024).url;
  return { preview, original: original.url, fileName: file.name, fileSize: dataUrlBytes(original.url), width: original.w, height: original.h };
}

/** Achica una imagen (data URL) hasta pesar ≤ maxBytes. Las URLs se devuelven igual. */
export async function shrinkDataUrl(src: string, maxBytes: number): Promise<string> {
  if (!src.startsWith('data:') || dataUrlBytes(src) <= maxBytes) return src;
  const img = await decodeImage(src);
  const { c, ctx } = canvasOf(img.naturalWidth, img.naturalHeight);
  ctx.drawImage(img, 0, 0);
  return encodeWithin(c, src.startsWith('data:image/png'), maxBytes).url;
}
