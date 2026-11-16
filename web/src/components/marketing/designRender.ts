/**
 * Dibuja un diseño por capas (ver design.ts) en un lienzo y devuelve dónde quedó cada capa (para
 * seleccionarla y moverla en el editor). Los textos vinculados toman su valor de los datos de la pieza
 * y se achican solos hasta caber en sus líneas.
 */
import type { Brand, PieceItem } from './render';
import type { ColorsLayer, Design, ImageLayer, Layer, LogoLayer, Paint, PatternLayer, PieceMock, ShapeLayer, TextLayer } from './design';
import { darkColor, paintBackground } from './backgrounds';
import { contentBox, drawCutout, hasTransparency, quickCutout } from './cutout';
import { cropFraction, designRectOf, isMovableMockup } from './mockup';

export interface DesignData {
  brand: Brand;
  title: string;
  subtitle: string;
  cta: string;
  items: PieceItem[];
  promo: { label: string; code?: string | null; name: string } | null;
  /** Fotos cargadas por URL (las de las capas con foto propia). */
  images: Record<string, HTMLImageElement | null>;
  /** Montajes de plantillas personalizables con su diseño (por id de capa). */
  mockups?: Record<string, HTMLCanvasElement | HTMLImageElement>;
  /** Montaje de cualquier prenda con diseño (para las vistas previas de las plantillas). */
  mockOf?: (m: PieceMock) => HTMLCanvasElement | HTMLImageElement | null;
  /** La prenda (frente, con su diseño) en un color: para mostrar los colores disponibles. */
  garmentInColor?: (color: string) => HTMLCanvasElement | HTMLImageElement | null;
}

export interface Box {
  x: number; y: number; w: number; h: number;
  /** Cuánto mide (en el lienzo) la foto completa de la capa: para mover el diseño dentro de la prenda. */
  span?: [number, number];
  /** Dónde quedó el diseño en el lienzo (para agarrarlo y moverlo). */
  designRect?: { x: number; y: number; w: number; h: number };
}

const money = (v: number) => '$' + Math.round(v).toLocaleString('es-CO');

export function paint(c: Paint | null | undefined, b: Brand): string {
  switch (c) {
    case 'primary': return b.primary;
    case 'accent': return b.accent;
    case 'paper': return b.paper;
    case 'white': return '#ffffff';
    case 'black': return '#000000';
    default: return c || '#000000';
  }
}

/** Luminancia relativa (0 negro … 1 blanco) de un color #RGB / #RRGGBB. */
function lumOf(hex: string): number {
  const h = hex.replace('#', '');
  const f = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6);
  const n = parseInt(f, 16);
  const ch = (v: number) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * ch((n >> 16) & 255) + 0.7152 * ch((n >> 8) & 255) + 0.0722 * ch(n & 255);
}
const contrast = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

/** Qué tan claro es lo ya dibujado detrás de una zona (0 negro … 1 blanco); null si no se puede leer. */
function backdropLum(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): number | null {
  try {
    const W = ctx.canvas.width, H = ctx.canvas.height;
    const x0 = Math.max(0, Math.floor(x)), y0 = Math.max(0, Math.floor(y));
    const x1 = Math.min(W, Math.ceil(x + w)), y1 = Math.min(H, Math.ceil(y + h));
    if (x1 - x0 < 2 || y1 - y0 < 2) return null;
    const c = document.createElement('canvas');
    c.width = c.height = 10;
    const g = c.getContext('2d', { willReadFrequently: true })!;
    g.drawImage(ctx.canvas, x0, y0, x1 - x0, y1 - y0, 0, 0, 10, 10);
    const p = g.getImageData(0, 0, 10, 10).data;
    let sum = 0;
    for (let i = 0; i < p.length; i += 4) sum += lumOf('#' + [p[i], p[i + 1], p[i + 2]].map((v) => v.toString(16).padStart(2, '0')).join(''));
    return sum / 100;
  } catch {
    return null; // lienzo con imágenes de otro origen: no se puede leer
  }
}

/** Color de texto legible sobre ese fondo: el elegido si se lee bien; si no, claro u oscuro. */
function readable(color: string, bg: number | null, b: Brand): string {
  if (bg == null) return color;
  if (contrast(lumOf(color), bg) >= 2.6) return color;
  if (bg < 0.4) return '#FFFFFF';
  return lumOf(b.primary) < 0.2 ? b.primary : '#1F1D1E';
}

/** Las luces claras detrás del producto, sobre un fondo oscuro, se vuelven un brillo suave del acento. */
function adaptLight(ctx: CanvasRenderingContext2D, l: ShapeLayer, b: Brand): ShapeLayer {
  if (!/^Luz/.test(l.name) || lumOf(paint(l.fill, b)) < 0.6) return l;
  const under = backdropLum(ctx, l.x + l.w * 0.3, l.y + l.h * 0.3, l.w * 0.4, l.h * 0.4);
  return under != null && under < 0.4 ? { ...l, fill: 'accent', fillTo: 'accent', fillAlpha: 0.2, fillToAlpha: 0 } : l;
}

/** Color con transparencia (acepta #RGB, #RRGGBB y #RRGGBBAA). */
function withAlpha(hex: string, a: number) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full.slice(0, 6), 16);
  const base = full.length >= 8 ? parseInt(full.slice(6, 8), 16) / 255 : 1;
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.max(0, Math.min(1, a * base))})`;
}

/** Texto que muestra una capa: el suyo o el del dato al que está vinculada. */
export function textOf(l: TextLayer, d: DesignData): string {
  if (!l.bind) return l.text;
  // El texto de un producto que no se eligió (el 2.º, 3.º…) queda vacío, no repite el primero.
  const it = l.item > 0 ? d.items[l.item] : d.items[0];
  const off = it?.discountPercent ? `-${it.discountPercent}%` : '';
  switch (l.bind) {
    case 'title': return d.title || it?.name || '';
    case 'subtitle': return d.subtitle;
    case 'cta': return d.cta;
    case 'price': return it?.price != null && it.price > 0 ? money(it.price) : '';
    case 'listPrice': return it?.listPrice && it.price != null && it.listPrice > it.price ? money(it.listPrice) : '';
    case 'discount': return off || d.promo?.label || '';
    case 'promo': return d.promo?.label || off || 'OFERTA';
    case 'code': return d.promo?.code || d.promo?.label || 'TUCODIGO';
    case 'name': return it?.name ?? '';
    case 'brand': return d.brand.name;
    case 'slogan': return d.brand.slogan ?? '';
  }
}

const fontOf = (l: TextLayer, b: Brand, size: number) =>
  `${l.weight} ${size}px "${(l.font === 'heading' ? b.headingFont : b.bodyFont) || 'Inter'}", Inter, system-ui, sans-serif`;

function splitLines(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const out: string[] = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const w of para.split(/\s+/).filter(Boolean)) {
      const test = line ? `${line} ${w}` : w;
      if (ctx.measureText(test).width > maxW && line) { out.push(line); line = w; } else line = test;
    }
    out.push(line);
  }
  return out;
}

/** Medidas de un texto: tamaño final (achicado si no cabe), líneas y alto. */
export function layoutText(ctx: CanvasRenderingContext2D, l: TextLayer, text: string, b: Brand) {
  const t = l.upper ? text.toUpperCase() : text;
  const padX = l.bg ? Math.min(l.size * 0.75, l.w * 0.2) : 0;
  const maxW = Math.max(20, l.w - padX * 2);
  let size = l.size;
  let lines: string[] = [];
  for (let k = 0; k < 40; k++) {
    ctx.font = fontOf(l, b, size);
    if ('letterSpacing' in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${l.letterSpacing}px`;
    lines = splitLines(ctx, t, maxW);
    const widest = Math.max(0, ...t.split(/\s+/).map((w) => ctx.measureText(w).width));
    if ((lines.length <= Math.max(1, l.maxLines) && widest <= maxW) || size <= 14) break;
    size *= 0.94;
  }
  if (lines.length > l.maxLines) { lines = lines.slice(0, l.maxLines); lines[lines.length - 1] = lines[lines.length - 1].replace(/\s*\S*$/, '…'); }
  const lh = size * l.lineHeight;
  const padY = l.bg ? size * 0.42 : 0;
  const widths = lines.map((x) => ctx.measureText(x).width);
  return { size, lines, lh, padX, padY, widths, height: lines.length * lh + padY * 2 + (l.bg ? 0 : size * 0.12) };
}

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, Math.max(0, Math.min(r, w / 2, h / 2)));
}

/**
 * Texto en contorno limpio: el trazo va solo por FUERA de la letra. (Trazar el borde directo deja ver
 * los contornos internos que se cruzan en las tipografías muy gruesas: líneas rotas dentro de la letra.)
 */
function outlineText(ctx: CanvasRenderingContext2D, line: string, x: number, y: number, lw: number, size: number, ink: string, spacing: string) {
  const sw = Math.max(2, size * 0.025);
  const pad = Math.ceil(sw * 2 + 4);
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(lw + pad * 2 + size * 0.2));
  c.height = Math.max(1, Math.ceil(size * 1.5 + pad * 2));
  const o = c.getContext('2d')!;
  o.font = ctx.font;
  if ('letterSpacing' in o) (o as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = spacing;
  o.textBaseline = 'top';
  o.textAlign = 'left';
  o.lineJoin = 'round';
  o.strokeStyle = ink;
  o.lineWidth = sw * 2;
  o.strokeText(line, pad, pad);
  // Se borra el interior de la letra: queda solo el borde de afuera, parejo.
  o.globalCompositeOperation = 'destination-out';
  o.fillText(line, pad, pad);
  ctx.drawImage(c, x - pad, y - pad);
}

function drawText(ctx: CanvasRenderingContext2D, l: TextLayer, d: DesignData): Box {
  const b = d.brand;
  const text = textOf(l, d);
  // Se esconde si el dato del que depende está vacío (ej.: "Antes" sin precio de antes).
  if (l.showIf && !textOf({ ...l, bind: l.showIf }, d).trim()) return { x: l.x, y: l.y, w: l.w, h: l.h };
  if (!text.trim()) return { x: l.x, y: l.y, w: l.w, h: l.h };
  const m = layoutText(ctx, l, text, b);
  const contentW = Math.max(...m.widths, 1);
  // El fondo (etiqueta o botón) abraza el texto; el bloque se alinea dentro del ancho de la capa.
  const boxW = l.bg ? Math.min(l.w, contentW + m.padX * 2) : l.w;
  const boxX = l.bg ? (l.align === 'center' ? l.x + (l.w - boxW) / 2 : l.align === 'right' ? l.x + l.w - boxW : l.x) : l.x;
  if (l.bg) {
    ctx.fillStyle = paint(l.bg, b);
    rr(ctx, boxX, l.y, boxW, m.height, l.radius >= 999 ? m.height / 2 : l.radius);
    ctx.fill();
  }
  ctx.font = fontOf(l, b, m.size);
  if ('letterSpacing' in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${l.letterSpacing}px`;
  // Sin etiqueta propia, el texto se ajusta al fondo de verdad: si no se lee (oscuro sobre oscuro), en negativo.
  const ink = l.bg || l.locked ? paint(l.color, b) : readable(paint(l.color, b), backdropLum(ctx, boxX, l.y, boxW, Math.min(l.h, m.lines.length * m.size * l.lineHeight + 8)), b);
  ctx.fillStyle = ink;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  if (l.shadow) { ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = m.size * 0.25; ctx.shadowOffsetY = m.size * 0.05; }
  const innerX = boxX + m.padX, innerW = boxW - m.padX * 2;
  m.lines.forEach((line, i) => {
    const lw = m.widths[i];
    const x = l.align === 'center' ? innerX + (innerW - lw) / 2 : l.align === 'right' ? innerX + innerW - lw : innerX;
    const y = l.y + m.padY + i * m.lh + (m.lh - m.size) / 2;
    if (l.outline) outlineText(ctx, line, x, y, lw, m.size, ink, `${l.letterSpacing}px`);
    else ctx.fillText(line, x, y);
    if (l.strike) ctx.fillRect(x, y + m.size * 0.52, lw, Math.max(2, m.size * 0.07));
  });
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  if ('letterSpacing' in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = '0px';
  return { x: l.bg ? boxX : l.x, y: l.y, w: boxW, h: m.height };
}

function drawImageLayer(ctx: CanvasRenderingContext2D, l: ImageLayer, d: DesignData, placeholders: boolean): Box {
  // La prenda con su diseño; mientras se arma (o en las vistas previas de las plantillas), la foto del producto.
  const img: HTMLImageElement | HTMLCanvasElement | null = l.mock
    ? d.mockups?.[l.id] ?? d.mockOf?.(l.mock) ?? (l.mock.view === 'front' || !l.mock.view ? d.items[l.item]?.image ?? null : null)
    : l.src ? d.images[l.src] ?? null : d.items[l.item]?.image ?? null;
  const r = l.radius >= 999 ? Math.min(l.w, l.h) / 2 : l.radius;
  // El producto recortado (sin el fondo de su foto), grande y con la sombra de su silueta.
  if (l.cutout && !l.src && img) {
    const it = l.mock ? null : d.items[l.item];
    const cut = hasTransparency(img) ? img : it?.cutout ?? quickCutout(img);
    if (cut) {
      drawCutout(ctx, cut, l.x, l.y, l.w, l.h, { zoom: l.zoom, shadow: l.shadow, align: l.anchor === 'center' ? 'center' : 'bottom' });
      const [cx0, cy0, cw, ch] = contentBox(cut, 0.005);
      const [fw, fh] = cut instanceof HTMLCanvasElement ? [cut.width, cut.height] : [cut.naturalWidth, cut.naturalHeight];
      const k = cw && ch ? Math.min(l.w / cw, l.h / ch) * l.zoom : 0;
      const [fx, fy] = cropFraction(cut);
      const movable = !!l.mock && isMovableMockup(cut);
      // Misma ubicación que drawCutout: para saber dónde quedó el diseño.
      const ix = l.x + (l.w - cw * k) / 2, iy = l.anchor === 'center' ? l.y + (l.h - ch * k) / 2 : l.y + l.h - ch * k;
      const dr = movable ? designRectOf(cut) : null;
      return {
        x: l.x, y: l.y, w: l.w, h: l.h, span: movable ? [(fw * k) / fx, (fh * k) / fy] : undefined,
        designRect: dr ? { x: ix + (dr.x - cx0) * k, y: iy + (dr.y - cy0) * k, w: dr.w * k, h: dr.h * k } : undefined,
      };
    }
    // Foto con escena (no se puede recortar): completa, con esquinas redondeadas y sombra.
    const fw0 = img instanceof HTMLCanvasElement ? img.width : img.naturalWidth, fh0 = img instanceof HTMLCanvasElement ? img.height : img.naturalHeight;
    const k0 = Math.min(l.w / fw0, l.h / fh0), iw0 = fw0 * k0, ih0 = fh0 * k0;
    const bx = l.x + (l.w - iw0) / 2, by = l.anchor === 'center' ? l.y + (l.h - ih0) / 2 : l.y + l.h - ih0;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.3)'; ctx.shadowBlur = 50; ctx.shadowOffsetY = 24;
    rr(ctx, bx, by, iw0, ih0, 36); ctx.fillStyle = '#fff'; ctx.fill();
    ctx.restore();
    ctx.save(); rr(ctx, bx, by, iw0, ih0, 36); ctx.clip(); ctx.drawImage(img, bx, by, iw0, ih0); ctx.restore();
    return { x: l.x, y: l.y, w: l.w, h: l.h };
  }
  if (l.shadow) {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 60;
    ctx.shadowOffsetY = 28;
    ctx.fillStyle = '#ffffff';
    rr(ctx, l.x, l.y, l.w, l.h, r);
    ctx.fill();
    ctx.restore();
  }
  ctx.save();
  rr(ctx, l.x, l.y, l.w, l.h, r);
  ctx.clip();
  const fw = img instanceof HTMLCanvasElement ? img.width : img?.naturalWidth ?? 0;
  const fh = img instanceof HTMLCanvasElement ? img.height : img?.naturalHeight ?? 0;
  // Fotos con fondo transparente (prendas en PNG) en "Completa": sin el margen vacío, para que la prenda llene su espacio.
  const box = img && fw && fh && l.fit === 'contain' && hasTransparency(img) ? contentBox(img) : null;
  const [sx, sy, nw, nh] = box ?? [0, 0, fw, fh];
  let span: [number, number] | undefined;
  let designRect: Box['designRect'];
  if (img && nw && nh) {
    // En los acercamientos de la prenda, el zoom ya está en el encuadre: la foto llena el cuadro.
    const k = (l.fit === 'contain' ? Math.min(l.w / nw, l.h / nh) : Math.max(l.w / nw, l.h / nh)) * (l.mock?.closeUp ? 1 : l.zoom);
    // En un acercamiento, cuánto mediría la foto completa (para mover el diseño con el cursor).
    const [fx, fy] = cropFraction(img);
    const iw = nw * k, ih = nh * k;
    const ix = l.x + (l.w - iw) / 2, iy = l.y + (l.h - ih) / 2;
    if (l.mock && isMovableMockup(img)) {
      span = [(fw * k) / fx, (fh * k) / fy];
      const dr = designRectOf(img);
      if (dr) designRect = { x: ix + (dr.x - sx) * k, y: iy + (dr.y - sy) * k, w: dr.w * k, h: dr.h * k };
    }
    // Las fotos con fondo transparente (prendas en PNG) quedan nítidas: el difuminado es para las que traen fondo.
    if (l.feather && l.feather > 0 && !hasTransparency(img)) {
      // Bordes que se desvanecen: la foto se pinta aparte y se le aplica una máscara en los cuatro lados.
      const vx = Math.max(l.x, ix), vy = Math.max(l.y, iy), vw = Math.min(l.x + l.w, ix + iw) - vx, vh = Math.min(l.y + l.h, iy + ih) - vy;
      if (vw > 2 && vh > 2) {
        const off = document.createElement('canvas');
        off.width = Math.ceil(vw); off.height = Math.ceil(vh);
        const o = off.getContext('2d')!;
        o.drawImage(img, sx, sy, nw, nh, ix - vx, iy - vy, iw, ih);
        o.globalCompositeOperation = 'destination-in';
        const f = Math.min(0.5, l.feather);
        const gx = o.createLinearGradient(0, 0, vw, 0);
        gx.addColorStop(0, 'rgba(0,0,0,0)'); gx.addColorStop(f, 'rgba(0,0,0,1)'); gx.addColorStop(1 - f, 'rgba(0,0,0,1)'); gx.addColorStop(1, 'rgba(0,0,0,0)');
        o.fillStyle = gx; o.fillRect(0, 0, vw, vh);
        const gy = o.createLinearGradient(0, 0, 0, vh);
        gy.addColorStop(0, 'rgba(0,0,0,0)'); gy.addColorStop(f, 'rgba(0,0,0,1)'); gy.addColorStop(1 - f, 'rgba(0,0,0,1)'); gy.addColorStop(1, 'rgba(0,0,0,0)');
        o.fillStyle = gy; o.fillRect(0, 0, vw, vh);
        ctx.drawImage(off, vx, vy);
      }
    } else ctx.drawImage(img, sx, sy, nw, nh, ix, iy, iw, ih);
  } else if (placeholders) {
    // Hueco vacío (otro producto, foto o vista): discreto, con la invitación a elegirlo.
    ctx.restore();
    ctx.save();
    ctx.setLineDash([14, 12]);
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(140,140,140,0.55)';
    ctx.fillStyle = 'rgba(140,140,140,0.08)';
    rr(ctx, l.x + 12, l.y + 12, l.w - 24, l.h - 24, 28);
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(120,120,120,0.85)';
    ctx.font = `600 ${Math.round(Math.max(22, Math.min(34, l.w * 0.06)))}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(l.w < 300 ? '+ Foto' : '+ Otra foto o vista', l.x + l.w / 2, l.y + l.h / 2);
  }
  ctx.restore();
  if (l.border) {
    ctx.strokeStyle = paint(l.border, d.brand);
    ctx.lineWidth = 10;
    rr(ctx, l.x, l.y, l.w, l.h, r);
    ctx.stroke();
  }
  return { x: l.x, y: l.y, w: l.w, h: l.h, span, designRect };
}

function drawShape(ctx: CanvasRenderingContext2D, l: ShapeLayer, b: Brand): Box {
  const from = withAlpha(paint(l.fill, b), l.fillAlpha);
  let fill: string | CanvasGradient = from;
  if (l.fillTo) {
    const g = l.shape === 'ellipse'
      ? ctx.createRadialGradient(l.x + l.w / 2, l.y + l.h / 2, 0, l.x + l.w / 2, l.y + l.h / 2, Math.max(l.w, l.h) / 2)
      : ctx.createLinearGradient(0, l.y, 0, l.y + l.h);
    g.addColorStop(0, from);
    g.addColorStop(1, withAlpha(paint(l.fillTo, b), l.fillToAlpha));
    fill = g;
  }
  ctx.beginPath();
  if (l.shape === 'ellipse') ctx.ellipse(l.x + l.w / 2, l.y + l.h / 2, Math.abs(l.w / 2), Math.abs(l.h / 2), 0, 0, Math.PI * 2);
  else ctx.roundRect(l.x, l.y, l.w, l.h, Math.max(0, Math.min(l.radius >= 999 ? Math.min(l.w, l.h) / 2 : l.radius, l.w / 2, l.h / 2)));
  ctx.fillStyle = fill;
  ctx.fill();
  if (l.stroke) {
    ctx.strokeStyle = paint(l.stroke, b);
    ctx.lineWidth = 5;
    if (l.dashed) ctx.setLineDash([18, 14]);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  return { x: l.x, y: l.y, w: l.w, h: l.h };
}

function drawLogo(ctx: CanvasRenderingContext2D, l0: LogoLayer, b: Brand): Box {
  // La versión clara u oscura del logo según el fondo que tiene detrás.
  const under = backdropLum(ctx, l0.x, l0.y, l0.w, l0.h);
  const l = under == null ? l0 : { ...l0, onDark: under < 0.4 };
  const word = l.onDark ? b.logoOnDark ?? b.logo : b.logo;
  const img = l.kind === 'icon' ? (l.onDark ? b.iconOnDark ?? b.icon : b.icon)
    : l.kind === 'full' ? (l.onDark ? b.fullOnDark ?? b.full : b.full) ?? word : word;
  if (img && img.naturalWidth) {
    const k = Math.min(l.w / img.naturalWidth, l.h / img.naturalHeight);
    const w = img.naturalWidth * k, h = img.naturalHeight * k;
    ctx.drawImage(img, l.x, l.y + (l.h - h) / 2, w, h);
    return { x: l.x, y: l.y, w: Math.max(w, 40), h: l.h };
  }
  ctx.font = `800 ${l.h * 0.8}px Inter, system-ui, sans-serif`;
  ctx.fillStyle = l.onDark ? '#ffffff' : b.primary;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.fillText(b.name.toUpperCase(), l.x, l.y);
  return { x: l.x, y: l.y, w: Math.max(40, ctx.measureText(b.name.toUpperCase()).width), h: l.h };
}

/** Colores disponibles: la prenda en cada color (o círculos) en fila o en columna, con "Disponible en N colores". */
function drawColors(ctx: CanvasRenderingContext2D, l: ColorsLayer, d: DesignData): Box {
  const colors = l.colors.slice(0, 10);
  if (!colors.length) return { x: l.x, y: l.y, w: l.w, h: l.h };
  const fg = readable(l.onDark ? '#FFFFFF' : d.brand.primary, backdropLum(ctx, l.x, l.y, l.w, Math.min(l.h, 40)), d.brand);
  const row = l.w >= l.h;
  let top = l.y, avail = l.h;
  if (l.label) {
    // En fila: "Disponible en N colores"; en columna (angosta): "N colores", ajustado al ancho.
    const text = row ? `Disponible en ${colors.length} ${colors.length === 1 ? 'color' : 'colores'}` : `${colors.length} ${colors.length === 1 ? 'color' : 'colores'}`;
    let fs = Math.max(16, Math.min(34, (row ? l.h : l.w) * 0.2));
    const setFont = () => { ctx.font = `700 ${fs}px "${d.brand.bodyFont || 'Inter'}", Inter, system-ui, sans-serif`; };
    setFont();
    while (fs > 12 && ctx.measureText(text).width > l.w) { fs -= 1; setFont(); }
    ctx.fillStyle = fg;
    ctx.textBaseline = 'top';
    ctx.textAlign = row ? 'left' : 'center';
    ctx.fillText(text, row ? l.x : l.x + l.w / 2, l.y);
    ctx.textAlign = 'left';
    top += fs * 1.5; avail -= fs * 1.5;
  }
  const n = colors.length, gap = 10;
  const cell = row ? Math.min(avail, (l.w - gap * (n - 1)) / n) : Math.min(l.w, (avail - gap * (n - 1)) / n);
  colors.forEach((c, i) => {
    const x = row ? l.x + i * (cell + gap) : l.x + (l.w - cell) / 2;
    const y = row ? top + (avail - cell) / 2 : top + i * (cell + gap);
    const shirt = l.style === 'prendas' ? d.garmentInColor?.(c) ?? null : null;
    if (shirt) {
      drawCutout(ctx, shirt, x, y, cell, cell, { shadow: true, floor: false, align: 'center' });
      return;
    }
    const r = cell * 0.36;
    ctx.beginPath();
    ctx.arc(x + cell / 2, y + cell / 2, r, 0, Math.PI * 2);
    ctx.fillStyle = c;
    ctx.fill();
    ctx.lineWidth = Math.max(2, cell * 0.04);
    ctx.strokeStyle = l.onDark ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.15)';
    ctx.stroke();
  });
  return { x: l.x, y: l.y, w: l.w, h: l.h };
}

/** Fondo con estilo (malla, rayas, mosaicos), con los diseños de las prendas del post si se piden. */
function drawPattern(ctx: CanvasRenderingContext2D, l: PatternLayer, d: DesignData, design: Design): Box {
  const b = d.brand;
  const base = paint(l.base, b);
  const urls = [...l.designs];
  if (l.useMockDesigns) for (const x of design.layers) if (x.type === 'image' && x.mock?.design?.image) urls.push(x.mock.design.image);
  const designs = Array.from(new Set(urls)).map((u) => d.images[u]).filter((i): i is HTMLImageElement => !!i && i.naturalWidth > 0);
  const onDark = darkColor(base);
  paintBackground(ctx, l.x, l.y, l.w, l.h, {
    style: l.style, base, ink: paint(l.ink, b), accent: paint(l.accent, b), density: l.density, size: l.size, angle: l.angle, grain: l.grain,
    logo: (onDark ? b.iconOnDark ?? b.icon ?? b.logoOnDark : b.icon ?? b.logo) ?? null, brandName: b.name, designs,
  });
  return { x: l.x, y: l.y, w: l.w, h: l.h };
}

/** Dibuja el diseño completo. `placeholders`: muestra un recuadro donde falta una foto (en el editor). */
export function drawDesign(ctx: CanvasRenderingContext2D, design: Design, d: DesignData, placeholders = false): Record<string, Box> {
  const W = ctx.canvas.width, H = ctx.canvas.height;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);
  const boxes: Record<string, Box> = {};
  for (const l of design.layers) {
    if (l.hidden) continue;
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, l.opacity));
    if (l.rotation) {
      const cx = l.x + l.w / 2, cy = l.y + (l.type === 'text' ? l.h / 2 : l.h / 2);
      ctx.translate(cx, cy);
      ctx.rotate((l.rotation * Math.PI) / 180);
      ctx.translate(-cx, -cy);
    }
    boxes[l.id] = l.type === 'text' ? drawText(ctx, l, d) : l.type === 'image' ? drawImageLayer(ctx, l, d, placeholders) : l.type === 'shape' ? drawShape(ctx, adaptLight(ctx, l, d.brand), d.brand) : l.type === 'pattern' ? drawPattern(ctx, l, d, design) : l.type === 'colors' ? drawColors(ctx, l, d) : drawLogo(ctx, l, d.brand);
    ctx.restore();
  }
  return boxes;
}

/** Capa de más arriba bajo el punto (sin las ocultas ni las bloqueadas). */
export function hitLayer(layers: Layer[], boxes: Record<string, Box>, x: number, y: number): Layer | null {
  for (let i = layers.length - 1; i >= 0; i--) {
    const l = layers[i];
    const bx = boxes[l.id];
    if (!bx || l.hidden || l.locked) continue;
    if (x >= bx.x && x <= bx.x + bx.w && y >= bx.y && y <= bx.y + bx.h) return l;
  }
  return null;
}
