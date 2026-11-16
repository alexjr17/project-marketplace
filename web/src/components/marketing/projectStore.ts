/**
 * Proyectos del estudio: lo que se sube en el momento (diseños, fotos, fondos y música) vive solo en
 * este navegador (data: o blob:). Antes de guardar el proyecto se sube como archivo y se cambia por su
 * dirección, para que el proyecto se abra igual en cualquier lado. Lo que no se puede guardar (clips
 * de video) queda vacío.
 */

/** ¿Es algo que solo vive en este navegador? */
export const isLocalUrl = (v: string) => v.startsWith('blob:') || v.startsWith('data:');

const SAVABLE = /^(image\/(png|jpe?g|webp)|audio\/(mpeg|mp3|wav|x-wav|ogg|webm|mp4|x-m4a|aac))$/;

/** Junta las direcciones locales que hay en el valor (en cualquier profundidad). */
export function localUrls(value: unknown, out = new Set<string>()): Set<string> {
  if (typeof value === 'string') {
    if (isLocalUrl(value)) out.add(value);
  } else if (Array.isArray(value)) {
    value.forEach((v) => localUrls(v, out));
  } else if (value && typeof value === 'object') {
    Object.values(value as Record<string, unknown>).forEach((v) => localUrls(v, out));
  }
  return out;
}

/** El valor con cada dirección cambiada según el mapa (las locales sin reemplazo quedan vacías). */
export function swapUrls<T>(value: T, map: Map<string, string>): T {
  const walk = (v: unknown): unknown => {
    if (typeof v === 'string') return isLocalUrl(v) ? map.get(v) ?? '' : v;
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, walk(x)]));
    return v;
  };
  return walk(value) as T;
}

/**
 * Sube lo local que haga falta (una sola vez por dirección: `cache` recuerda lo ya subido) y devuelve
 * el valor listo para guardar.
 */
export async function persistLocal<T>(value: T, cache: Map<string, string>, upload: (b: Blob) => Promise<{ url: string }>): Promise<T> {
  for (const u of localUrls(value)) {
    if (cache.has(u)) continue;
    try {
      const blob = await (await fetch(u)).blob();
      if (!SAVABLE.test(blob.type) || blob.size > 15 * 1024 * 1024) { cache.set(u, ''); continue; }
      cache.set(u, (await upload(blob)).url);
    } catch {
      // Ya no existe (se liberó): queda vacío. No se recuerda, por si vuelve a aparecer.
    }
  }
  return swapUrls(value, cache);
}

/** Miniatura del lienzo (JPEG pequeño) para la lista de proyectos. */
export function thumbOf(canvas: HTMLCanvasElement | null, width = 360): string | null {
  if (!canvas || !canvas.width || !canvas.height) return null;
  try {
    const c = document.createElement('canvas');
    c.width = width;
    c.height = Math.round((width * canvas.height) / canvas.width);
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(canvas, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.72);
  } catch {
    // Lienzo con imágenes de otro sitio: sin miniatura.
    return null;
  }
}

/** "hace un momento", "hace 5 min", "ayer 3:40 p. m."… */
export function ago(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 45) return 'hace un momento';
  if (s < 3600) return `hace ${Math.max(1, Math.round(s / 60))} min`;
  if (s < 6 * 3600) return `hace ${Math.round(s / 3600)} h`;
  const d = new Date(t);
  const today = new Date(now);
  const time = d.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' });
  if (d.toDateString() === today.toDateString()) return `hoy ${time}`;
  const y = new Date(now - 86400000);
  if (d.toDateString() === y.toDateString()) return `ayer ${time}`;
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric' });
}
