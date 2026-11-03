/**
 * La prenda del estudio: carga la foto de la vista (o una silueta integrada si no hay foto
 * o falla), la pinta del color elegido y arma el mockup final (prenda + diseños) en canvas.
 * Nada aquí puede dejar la pantalla colgada: cada paso tiene respaldo.
 */
import { API_ORIGIN } from '../../lib/config';
import { assetUrl } from '../../utils/assetUrl';
import type { GarmentKind, StudioDesign, StudioZone } from './customizerModel';

export interface Garment {
  /** Imagen a mostrar (pintada si se pudo). */
  src: string;
  /** Imagen para recortar los diseños al contorno, o null si no se puede usar (sin CORS). */
  maskSrc: string | null;
  /** Ancho / alto. */
  aspect: number;
  isSilhouette: boolean;
  /** Si se puede dibujar en canvas sin "ensuciarlo" (para el mockup). */
  canvasSafe: boolean;
}

// ─── Silueta integrada ───────────────────────────────────────────────────────

const PATHS: Record<GarmentKind, { body: string; trims: string[] }> = {
  front: {
    body: 'M200 58 C214 96 286 96 300 58 L372 78 Q420 96 440 150 L478 330 L480 402 L428 412 L410 300 L398 238 L400 470 Q250 482 100 470 L102 238 L90 300 L72 412 L20 402 L22 330 L60 150 Q80 96 128 78 Z',
    trims: [
      'M200 58 C214 96 286 96 300 58 L312 62 C298 112 202 112 188 62 Z',
      'M100 446 Q250 458 400 446 L400 470 Q250 482 100 470 Z',
      'M22 382 L74 390 L72 412 L20 402 Z',
      'M478 382 L426 390 L428 412 L480 402 Z',
    ],
  },
  back: {
    body: 'M200 58 C214 72 286 72 300 58 L372 78 Q420 96 440 150 L478 330 L480 402 L428 412 L410 300 L398 238 L400 470 Q250 482 100 470 L102 238 L90 300 L72 412 L20 402 L22 330 L60 150 Q80 96 128 78 Z',
    trims: [
      'M200 58 C214 72 286 72 300 58 L312 62 C298 86 202 86 188 62 Z',
      'M100 446 Q250 458 400 446 L400 470 Q250 482 100 470 Z',
      'M22 382 L74 390 L72 412 L20 402 Z',
      'M478 382 L426 390 L428 412 L480 402 Z',
    ],
  },
  sleeve: {
    body: 'M170 40 Q250 20 330 40 L372 440 Q250 456 128 440 Z',
    trims: ['M134 404 Q250 418 366 404 L372 440 Q250 456 128 440 Z'],
  },
};

function shade(hex: string, amount: number): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return hex;
  const f = (v: string) => Math.max(0, Math.min(255, Math.round(parseInt(v, 16) * (1 + amount))));
  return `#${[m[1], m[2], m[3]].map((v) => f(v).toString(16).padStart(2, '0')).join('')}`;
}

/** Silueta de suéter (frente, espalda o manga) en el color pedido, como data URL SVG de 500×500. */
export function silhouetteDataUrl(kind: GarmentKind, color = '#FFFFFF'): string {
  const p = PATHS[kind];
  const dark = isDark(color);
  const stroke = dark ? shade(color, 0.6) : shade(color, -0.28);
  const trim = dark ? shade(color, 0.18) : shade(color, -0.08);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500" width="500" height="500">
<defs><linearGradient id="s" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000" stop-opacity=".10"/><stop offset=".25" stop-color="#fff" stop-opacity=".06"/><stop offset=".75" stop-color="#fff" stop-opacity=".04"/><stop offset="1" stop-color="#000" stop-opacity=".12"/></linearGradient></defs>
<path d="${p.body}" fill="${color}" stroke="${stroke}" stroke-width="3" stroke-linejoin="round"/>
${p.trims.map((t) => `<path d="${t}" fill="${trim}" stroke="${stroke}" stroke-width="2" stroke-linejoin="round"/>`).join('')}
<path d="${p.body}" fill="url(#s)"/>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function isDark(hex: string): boolean {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return false;
  const [r, g, b] = [m[1], m[2], m[3]].map((v) => parseInt(v, 16));
  return 0.299 * r + 0.587 * g + 0.114 * b < 110;
}

export const silhouetteGarment = (kind: GarmentKind, color: string): Garment => {
  const src = silhouetteDataUrl(kind, color);
  return { src, maskSrc: src, aspect: 1, isSilhouette: true, canvasSafe: true };
};

// ─── Carga de imágenes ───────────────────────────────────────────────────────

const LOAD_TIMEOUT_MS = 12000;

/** Carga una imagen con tiempo límite. `cors` = pedirla con CORS (para usarla en canvas). */
export function loadImage(src: string, cors: boolean): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (cors && !src.startsWith('data:') && !src.startsWith('blob:')) img.crossOrigin = 'anonymous';
    const timer = window.setTimeout(() => { img.src = ''; reject(new Error('timeout')); }, LOAD_TIMEOUT_MS);
    img.onload = () => { window.clearTimeout(timer); resolve(img); };
    img.onerror = () => { window.clearTimeout(timer); reject(new Error('error')); };
    img.src = src;
  });
}

/**
 * Direcciones a probar para leer una imagen en canvas: primero la ruta del mismo origen
 * (/uploads pasa por el proxy en desarrollo y es el mismo dominio en producción), luego la absoluta.
 */
export function canvasCandidates(url: string): string[] {
  if (!url) return [];
  if (url.startsWith('data:') || url.startsWith('blob:')) return [url];
  const abs = assetUrl(url);
  const out: string[] = [];
  if (abs.startsWith(`${API_ORIGIN}/uploads/`) && typeof window !== 'undefined' && window.location.origin !== API_ORIGIN) {
    out.push(abs.slice(API_ORIGIN.length));
  } else if (url.startsWith('/uploads/')) {
    out.push(url);
  }
  out.push(abs);
  return [...new Set(out)];
}

/** Direcciones que ya fallaron en esta sesión (no se vuelven a pedir en cada cambio de color). */
const failed = new Set<string>();

/** Primera de las direcciones que cargue con CORS (o null). */
export async function loadForCanvas(url: string): Promise<HTMLImageElement | null> {
  for (const candidate of canvasCandidates(url)) {
    if (failed.has(`cors:${candidate}`)) continue;
    try {
      const img = await loadImage(candidate, true);
      // Comprueba que el canvas no quede "sucio" (imagen sin permiso CORS).
      const { ctx } = canvas2d(1, 1);
      ctx.drawImage(img, 0, 0, 1, 1);
      ctx.getImageData(0, 0, 1, 1);
      return img;
    } catch {
      failed.add(`cors:${candidate}`);
    }
  }
  return null;
}

function canvas2d(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('canvas');
  return { c, ctx };
}

const isWhite = (hex: string) => /^#?(fff|ffffff)$/i.test(hex.trim());

/** Pinta la foto del color pedido (multiplica la luminosidad; conserva la transparencia). */
export function colorizeImage(img: HTMLImageElement, hex: string, maxPx = 1200): string {
  const k = Math.min(1, maxPx / Math.max(img.naturalWidth, img.naturalHeight));
  const { c, ctx } = canvas2d(img.naturalWidth * k, img.naturalHeight * k);
  ctx.drawImage(img, 0, 0, c.width, c.height);
  if (!isWhite(hex)) {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (m) {
      const [r, g, b] = [m[1], m[2], m[3]].map((v) => parseInt(v, 16));
      const data = ctx.getImageData(0, 0, c.width, c.height);
      const d = data.data;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] === 0) continue;
        const lum = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255;
        d[i] = Math.round(r * lum);
        d[i + 1] = Math.round(g * lum);
        d[i + 2] = Math.round(b * lum);
      }
      ctx.putImageData(data, 0, 0);
    }
  }
  return c.toDataURL('image/png');
}

/**
 * Prepara la prenda de una vista: foto pintada → foto sin pintar (si no hay CORS) →
 * silueta (si no hay foto o no carga).
 */
export async function prepareGarment(src: string | undefined, color: string, kind: GarmentKind): Promise<Garment> {
  if (!src) return silhouetteGarment(kind, color);
  const img = await loadForCanvas(src);
  if (img) {
    try {
      const painted = colorizeImage(img, color);
      return { src: painted, maskSrc: painted, aspect: img.naturalWidth / img.naturalHeight || 1, isSilhouette: false, canvasSafe: true };
    } catch {
      /* cae a la foto sin pintar */
    }
  }
  const abs = assetUrl(src);
  if (failed.has(`plain:${abs}`)) return silhouetteGarment(kind, color);
  try {
    const plain = await loadImage(abs, false);
    return { src: abs, maskSrc: null, aspect: plain.naturalWidth / plain.naturalHeight || 1, isSilhouette: false, canvasSafe: false };
  } catch {
    failed.add(`plain:${abs}`);
    return silhouetteGarment(kind, color);
  }
}

// ─── Mockup ──────────────────────────────────────────────────────────────────

function drawZonePath(ctx: CanvasRenderingContext2D, z: StudioZone, W: number, H: number) {
  const x = (z.x / 100) * W, y = (z.y / 100) * H, w = (z.width / 100) * W, h = (z.height / 100) * H;
  ctx.beginPath();
  if (z.shape === 'circle') ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
  else if (z.shape === 'polygon' && z.points?.length) {
    z.points.forEach((p, i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, x + (p.x / 100) * w, y + (p.y / 100) * h));
    ctx.closePath();
  } else ctx.rect(x, y, w, h);
}

async function drawDesigns(ctx: CanvasRenderingContext2D, W: number, H: number, designs: StudioDesign[], zones: StudioZone[], blocked: StudioZone[]) {
  for (const d of designs) {
    const img = await loadForCanvas(d.imageData);
    if (!img) continue;
    const zone = zones.find((z) => z.id === d.templateZoneId);
    const bw = (d.size.width / 100) * W, bh = (d.size.height / 100) * H;
    const cx = (d.position.x / 100) * W, cy = (d.position.y / 100) * H;
    const ir = img.naturalWidth / img.naturalHeight || 1;
    let dw = bw, dh = bw / ir;
    if (dh > bh) { dh = bh; dw = bh * ir; }
    ctx.save();
    if (zone) { drawZonePath(ctx, zone, W, H); ctx.clip(); }
    ctx.globalAlpha = d.opacity ?? 1;
    ctx.translate(cx, cy);
    ctx.rotate(((d.rotation || 0) * Math.PI) / 180);
    ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
    ctx.restore();
  }
  if (blocked.length) {
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    for (const z of blocked) { drawZonePath(ctx, z, W, H); ctx.fill(); }
    ctx.restore();
  }
}

/**
 * Mockup de una vista (prenda + diseños recortados al área imprimible y al contorno),
 * como PNG. Si la foto no se puede usar en canvas, se arma sobre la silueta.
 */
export async function renderMockup(opts: {
  garment: Garment; kind: GarmentKind; color: string; designs: StudioDesign[]; zones: StudioZone[]; blocked: StudioZone[]; width?: number;
}): Promise<string> {
  const garment = opts.garment.canvasSafe ? opts.garment : silhouetteGarment(opts.kind, opts.color);
  const W = opts.width ?? 900;
  const H = Math.round(W / (garment.aspect || 1));
  const base = await loadImage(garment.src, false);

  const layer = canvas2d(W, H);
  await drawDesigns(layer.ctx, W, H, opts.designs, opts.zones, opts.blocked);
  if (garment.maskSrc) {
    const mask = await loadImage(garment.maskSrc, false);
    layer.ctx.globalCompositeOperation = 'destination-in';
    layer.ctx.drawImage(mask, 0, 0, W, H);
    layer.ctx.globalCompositeOperation = 'source-over';
  }

  const out = canvas2d(W, H);
  out.ctx.drawImage(base, 0, 0, W, H);
  out.ctx.drawImage(layer.c, 0, 0);
  return out.c.toDataURL('image/png');
}
