/**
 * Diseño de muestra de la camiseta 3D de la portada (sello con el nombre de la tienda) y los
 * colores de la marca leídos de las variables CSS para dibujar en canvas.
 */
export type PrintSource = HTMLImageElement | HTMLCanvasElement | ImageBitmap;

export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const i = new Image();
    i.crossOrigin = 'anonymous';
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = url;
  });
}

/** Sobre prenda oscura: lo casi negro y sin color (la tinta de un logo) se aclara; el color se conserva. */
function lightenInk(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, light = '#F3F3EE') {
  const data = g.getImageData(x, y, w, h);
  const d = data.data;
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(light)!;
  const [lr, lg, lb] = [m[1], m[2], m[3]].map((v) => parseInt(v, 16));
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    const max = Math.max(d[i], d[i + 1], d[i + 2]), min = Math.min(d[i], d[i + 1], d[i + 2]);
    if (max < 110 && max - min < 30) { d[i] = lr; d[i + 1] = lg; d[i + 2] = lb; }
  }
  g.putImageData(data, x, y);
}

/**
 * Recorta los márgenes transparentes de un diseño: así su tamaño y posición en la zona son los
 * del dibujo y no los del lienzo (si la imagen no tiene transparencia, queda igual).
 */
export function cropToContent(src: PrintSource): HTMLCanvasElement {
  const w = src instanceof HTMLImageElement ? src.naturalWidth : src.width;
  const h = src instanceof HTMLImageElement ? src.naturalHeight : src.height;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  g.drawImage(src, 0, 0);
  let d: Uint8ClampedArray;
  try {
    d = g.getImageData(0, 0, w, h).data;
  } catch {
    return c; // imagen de otro origen sin permiso: se usa tal cual
  }
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (d[(y * w + x) * 4 + 3] > 8) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0 || (x0 === 0 && y0 === 0 && x1 === w - 1 && y1 === h - 1)) return c;
  const out = document.createElement('canvas');
  out.width = x1 - x0 + 1;
  out.height = y1 - y0 + 1;
  out.getContext('2d')!.drawImage(c, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
  return out;
}

/**
 * Diseño de muestra: un sello con el nombre de la tienda. Arriba va el ícono de la tienda (si se
 * pasa) o un sol de líneas; `ink` es el texto y `rays` el color del sol.
 */
export async function sampleDesign(storeName: string, ink: string, rays = ink, icon: HTMLImageElement | null = null, onDark = false): Promise<HTMLCanvasElement> {
  try {
    await document.fonts.load('800 120px "Inter"');
  } catch {
    /* sin la fuente, se usa la del sistema */
  }
  const c = document.createElement('canvas');
  c.width = 900;
  c.height = 1000;
  const g = c.getContext('2d')!;
  const cx = 450;
  g.fillStyle = ink;
  g.strokeStyle = ink;

  if (icon) {
    // Ícono de la tienda en lugar del sol (sobre prenda oscura, su tinta se aclara).
    const size = 400;
    const k = Math.min(size / icon.naturalWidth, size / icon.naturalHeight);
    const w = icon.naturalWidth * k, h = icon.naturalHeight * k;
    const x = cx - w / 2, y = 330 - h / 2;
    g.drawImage(icon, x, y, w, h);
    if (onDark) lightenInk(g, Math.floor(x), Math.floor(y), Math.ceil(w) + 1, Math.ceil(h) + 1);
  } else {
    // Sol de líneas (rayos) detrás del texto.
    g.fillStyle = rays;
    g.strokeStyle = rays;
    g.save();
    g.translate(cx, 330);
    for (let i = 0; i < 28; i++) {
      g.rotate((Math.PI * 2) / 28);
      g.fillRect(-7, 150, 14, i % 2 ? 90 : 130);
    }
    g.restore();
    g.lineWidth = 22;
    g.beginPath();
    g.arc(cx, 330, 128, 0, Math.PI * 2);
    g.stroke();
  }

  g.fillStyle = ink;
  g.textAlign = 'center';
  g.textBaseline = 'alphabetic';
  g.font = '800 150px "Inter", system-ui, sans-serif';
  const word = (storeName || 'Taller').toUpperCase().slice(0, 12);
  // Ajusta el ancho del nombre al diseño.
  const m = g.measureText(word).width;
  const fit = Math.min(1, 820 / m);
  g.save();
  g.translate(cx, 690);
  g.scale(fit, 1);
  g.fillText(word, 0, 0);
  g.restore();

  g.font = '700 56px "Inter", system-ui, sans-serif';
  g.fillText('HECHO A MI MANERA', cx, 800);
  g.font = '600 36px "Inter", system-ui, sans-serif';
  g.fillText('TALLER DE ESTAMPADO', cx, 880);
  return c;
}

const cssRgb = (name: string, fallback: string) => {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v ? `rgb(${v.split(/\s+/).join(',')})` : fallback;
};

/** Acento de la marca (variable --accent) para dibujar en canvas. */
export const accentInk = () => cssRgb('--accent', '#ABD04C');

/** Color de la marca (variable --app-600 "r g b") como rgb() para dibujar en canvas. */
export function brandInk(): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue('--app-600').trim();
  return v ? `rgb(${v.split(/\s+/).join(',')})` : '#7c3aed';
}
