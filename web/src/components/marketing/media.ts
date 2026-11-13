/**
 * Estudio de contenido: carga de fotos para el lienzo y grabación de video.
 *
 * Las fotos de la API (/uploads) traen permisos CORS; las de afuera (catálogo de prueba, enlaces) se
 * piden por la API (proxy) para que el lienzo no quede "manchado" y se pueda exportar.
 */
import { http } from '../../lib/http';

const cache = new Map<string, Promise<HTMLImageElement | null>>();

function fromSrc(src: string, cors: boolean): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    if (cors) img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** Foto lista para dibujar (o null si no se pudo). Queda en caché por URL. */
export function loadImage(url: string | null | undefined): Promise<HTMLImageElement | null> {
  if (!url) return Promise.resolve(null);
  let p = cache.get(url);
  if (!p) {
    if (url.startsWith('data:') || url.startsWith('blob:')) p = fromSrc(url, false);
    else if (url.includes('/uploads/') || url.startsWith('/')) p = fromSrc(url, true);
    else {
      p = http.blob('/messaging/marketing/image', { params: { url } })
        .then((b) => fromSrc(URL.createObjectURL(b), false))
        .catch(() => null);
    }
    cache.set(url, p);
  }
  return p;
}

/** Formato de video que graba este navegador (MP4 primero: es el que pide Instagram). */
export function videoMime(): string | null {
  if (typeof MediaRecorder === 'undefined') return null;
  for (const m of ['video/mp4;codecs=avc1.42E01E', 'video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']) {
    if (MediaRecorder.isTypeSupported(m)) return m;
  }
  return null;
}

/**
 * Graba un lienzo en tiempo real: `draw(segundo)` pinta cada cuadro durante `seconds` segundos.
 * Devuelve el video (Blob) y avisa el avance (0..1).
 */
export function recordCanvas(
  canvas: HTMLCanvasElement,
  seconds: number,
  draw: (time: number) => void,
  onProgress?: (p: number) => void,
): Promise<Blob> {
  const mime = videoMime();
  if (!mime) return Promise.reject(new Error('Este navegador no puede grabar video. Usa Chrome o Edge actualizados.'));
  const stream = canvas.captureStream(30);
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8_000_000 });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  return new Promise((resolve, reject) => {
    rec.onstop = () => resolve(new Blob(chunks, { type: mime.split(';')[0] }));
    rec.onerror = () => reject(new Error('No se pudo grabar el video'));
    draw(0);
    rec.start(250);
    const start = performance.now();
    const tick = () => {
      const t = (performance.now() - start) / 1000;
      draw(Math.min(t, seconds));
      onProgress?.(Math.min(1, t / seconds));
      if (t < seconds) requestAnimationFrame(tick);
      else setTimeout(() => rec.stop(), 120);
    };
    requestAnimationFrame(tick);
  });
}

export const extOf = (mime: string) => (mime.includes('mp4') ? 'mp4' : mime.includes('webm') ? 'webm' : mime.includes('jpeg') ? 'jpg' : 'png');
