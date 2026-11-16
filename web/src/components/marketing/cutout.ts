/**
 * El producto como protagonista: la foto sin su fondo, recortada al contorno de la prenda y dibujada
 * grande con una sombra que sigue la silueta. El recorte bueno lo hace la IA en el servidor (queda
 * guardado); mientras llega, uno rápido en el navegador quita el fondo liso de la foto.
 */
type Src = HTMLImageElement | HTMLCanvasElement;

const dims = (s: Src): [number, number] => (s instanceof HTMLCanvasElement ? [s.width, s.height] : [s.naturalWidth, s.naturalHeight]);

const alphaCache = new WeakMap<object, boolean>();
/** ¿La imagen tiene fondo transparente? (mira las cuatro esquinas; queda en caché). */
export function hasTransparency(img: Src): boolean {
  const known = alphaCache.get(img);
  if (known !== undefined) return known;
  let out = false;
  try {
    const c = document.createElement('canvas');
    c.width = c.height = 8;
    const x = c.getContext('2d')!;
    x.drawImage(img, 0, 0, 8, 8);
    const d = x.getImageData(0, 0, 8, 8).data;
    out = [0, 7, 56, 63].some((k) => d[k * 4 + 3] < 200);
  } catch { /* imagen de otro origen: se trata como opaca */ }
  alphaCache.set(img, out);
  return out;
}

const boxCache = new WeakMap<object, [number, number, number, number]>();
/** Caja de lo que no es transparente (en píxeles de la imagen), con un poco de aire. */
export function contentBox(img: Src, padK = 0.03): [number, number, number, number] {
  const known = boxCache.get(img);
  if (known) return known;
  const [W, H] = dims(img);
  let out: [number, number, number, number] = [0, 0, W, H];
  try {
    const S = 160, k = Math.min(1, S / Math.max(W, H));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(W * k)); c.height = Math.max(1, Math.round(H * k));
    const x = c.getContext('2d')!;
    x.drawImage(img, 0, 0, c.width, c.height);
    const d = x.getImageData(0, 0, c.width, c.height).data;
    let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
    for (let y = 0; y < c.height; y++) for (let i = 0; i < c.width; i++) if (d[(y * c.width + i) * 4 + 3] > 24) { x0 = Math.min(x0, i); x1 = Math.max(x1, i); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    if (x1 >= x0) {
      const pad = padK * Math.max(W, H);
      const bx = Math.max(0, x0 / k - pad), by = Math.max(0, y0 / k - pad);
      out = [bx, by, Math.min(W, (x1 + 1) / k + pad) - bx, Math.min(H, (y1 + 1) / k + pad) - by];
    }
  } catch { /* otro origen: la imagen entera */ }
  boxCache.set(img, out);
  return out;
}

const quickCache = new WeakMap<object, HTMLCanvasElement | null>();
/**
 * Recorte rápido: si la foto tiene un fondo liso (las cuatro esquinas del mismo color), lo quita desde
 * los bordes con un borde suave. Si el fondo no es liso (una foto con escena), devuelve null.
 */
export function quickCutout(img: Src): HTMLCanvasElement | null {
  if (quickCache.has(img)) return quickCache.get(img)!;
  let out: HTMLCanvasElement | null = null;
  try {
    const [W0, H0] = dims(img);
    const k = Math.min(1, 900 / Math.max(W0, H0));
    const W = Math.max(1, Math.round(W0 * k)), H = Math.max(1, Math.round(H0 * k));
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(img, 0, 0, W, H);
    const data = ctx.getImageData(0, 0, W, H);
    const p = data.data;
    // Color del fondo: el promedio de las esquinas, si se parecen entre sí.
    const s = Math.max(2, Math.round(Math.min(W, H) * 0.02));
    const corners = [[0, 0], [W - s, 0], [0, H - s], [W - s, H - s]].map(([cx, cy]) => {
      let r = 0, g = 0, b = 0, n = 0;
      for (let y = cy; y < cy + s; y++) for (let x = cx; x < cx + s; x++) { const i = (y * W + x) * 4; r += p[i]; g += p[i + 1]; b += p[i + 2]; n++; }
      return [r / n, g / n, b / n];
    });
    const bg = [0, 1, 2].map((j) => corners.reduce((a, c) => a + c[j], 0) / 4);
    const spread = Math.max(...corners.map((c) => Math.hypot(c[0] - bg[0], c[1] - bg[1], c[2] - bg[2])));
    if (spread < 22) {
      const near = (i: number) => Math.hypot(p[i] - bg[0], p[i + 1] - bg[1], p[i + 2] - bg[2]);
      const seen = new Uint8Array(W * H);
      const stack: number[] = [];
      for (let x = 0; x < W; x++) stack.push(x, (H - 1) * W + x);
      for (let y = 0; y < H; y++) stack.push(y * W, y * W + W - 1);
      while (stack.length) {
        const q = stack.pop()!;
        if (seen[q]) continue;
        seen[q] = 1;
        const i = q * 4;
        const dist = near(i);
        if (dist > 20) continue;
        p[i + 3] = dist < 9 ? 0 : Math.round(((dist - 9) / 11) * 255);
        const x = q % W, y = (q - x) / W;
        if (x > 0) stack.push(q - 1);
        if (x < W - 1) stack.push(q + 1);
        if (y > 0) stack.push(q - W);
        if (y < H - 1) stack.push(q + W);
      }
      ctx.putImageData(data, 0, 0);
      // Si casi no quedó nada (la prenda era del color del fondo), mejor no recortar.
      let solid = 0;
      for (let i = 3; i < p.length; i += 16) if (p[i] > 200) solid++;
      out = solid / (p.length / 16) > 0.12 ? c : null;
    }
  } catch { /* otro origen: sin recorte */ }
  quickCache.set(img, out);
  return out;
}

/**
 * Dibuja el producto recortado dentro de la caja (completo, sin el aire vacío de la foto), apoyado
 * abajo, con su sombra. `zoom` lo agranda desde el centro; `align` lo pega abajo o lo centra.
 */
export function drawCutout(ctx: CanvasRenderingContext2D, img: Src, x: number, y: number, w: number, h: number, opts: { zoom?: number; shadow?: boolean; align?: 'bottom' | 'center'; floor?: boolean } = {}) {
  const [sx, sy, nw, nh] = contentBox(img, 0.005);
  if (!nw || !nh) return;
  const k = Math.min(w / nw, h / nh) * (opts.zoom ?? 1);
  const iw = nw * k, ih = nh * k;
  const ix = x + (w - iw) / 2;
  const iy = opts.align === 'center' ? y + (h - ih) / 2 : y + h - ih;
  if (opts.floor !== false && opts.shadow !== false) {
    // Sombra de contacto en el piso.
    const r = iw * 0.46;
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
    g.addColorStop(0, 'rgba(0,0,0,0.3)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.save();
    ctx.translate(ix + iw / 2, iy + ih * 0.985);
    ctx.scale(1, 0.1);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.save();
  if (opts.shadow !== false) {
    ctx.shadowColor = 'rgba(0,0,0,0.34)';
    ctx.shadowBlur = Math.max(18, iw * 0.05);
    ctx.shadowOffsetY = Math.max(10, ih * 0.025);
  }
  ctx.drawImage(img, sx, sy, nw, nh, ix, iy, iw, ih);
  ctx.restore();
}
