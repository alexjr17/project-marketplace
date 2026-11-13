/**
 * Estudio de contenido: dibuja las piezas para redes en un lienzo (post 1:1, historia 9:16, reel 9:16
 * animado y el marco del video 360°) con la marca de la tienda. Todo en el navegador, sin IA de
 * imagen: plantillas fijas con las fotos, precios y ofertas reales.
 *
 * Unidad: el lienzo mide 1080 de ancho; las medidas se escriben en esa escala.
 */
import { frameAt, layout, type Scene } from './timeline';

export type Format = 'post' | 'historia' | 'reel' | 'video360';
export type TemplateId = 'destacado' | 'oferta' | 'coleccion' | 'nuevo' | 'cupon' | 'personaliza';

export interface Brand {
  name: string;
  slogan?: string;
  primary: string;
  accent: string;
  paper: string;
  secondary?: string;
  /** Logo de texto para fondos claros y su versión clara para fondos oscuros. */
  logo: HTMLImageElement | null;
  logoOnDark: HTMLImageElement | null;
  /** Ícono de la marca (cierre del reel). */
  icon?: HTMLImageElement | null;
  iconOnDark?: HTMLImageElement | null;
  headingFont?: string;
  bodyFont?: string;
  /** Títulos en mayúsculas. */
  uppercase?: boolean;
}

export interface PieceItem {
  name: string;
  price?: number;
  listPrice?: number;
  discountPercent?: number;
  image: HTMLImageElement | null;
}

export interface PieceSpec {
  format: Format;
  template: TemplateId;
  title: string;
  subtitle: string;
  cta: string;
  showPrice: boolean;
  items: PieceItem[];
  promo?: { label: string; code?: string | null; name: string } | null;
  brand: Brand;
  /** Escenario del video 360°: claro (fondo de la marca) u oscuro (color principal). */
  stage?: 'claro' | 'oscuro';
}

export const TEMPLATES: { id: TemplateId; label: string; hint: string }[] = [
  { id: 'destacado', label: 'Destacado', hint: 'Foto grande del producto con precio' },
  { id: 'oferta', label: 'Oferta', hint: 'El descuento en grande' },
  { id: 'coleccion', label: 'Colección', hint: 'Varios productos en cuadrícula' },
  { id: 'nuevo', label: 'Nuevo', hint: 'Lanzamiento sobre fondo claro' },
  { id: 'cupon', label: 'Cupón', hint: 'El código de descuento como ticket' },
  { id: 'personaliza', label: 'Personaliza', hint: 'Invita a diseñar la prenda propia' },
];

export const sizeOf = (format: Format): [number, number] => (format === 'post' ? [1080, 1080] : [1080, 1920]);

/** Segundos de cada escena del reel y del cierre. */
export const REEL_SCENE = 2.6;
export const REEL_END = 2.2;
export const reelDuration = (items: number) => Math.max(1, Math.min(items, 5)) * REEL_SCENE + REEL_END;

// Tipografías de la ficha de la marca (se fijan al empezar cada dibujo).
let HEADING = 'Inter, system-ui, sans-serif';
let BODY = 'Inter, system-ui, sans-serif';
let UPPER = true;
function setBrandFonts(b: Brand) {
  HEADING = `"${b.headingFont || 'Inter'}", Inter, system-ui, sans-serif`;
  BODY = `"${b.bodyFont || 'Inter'}", Inter, system-ui, sans-serif`;
  UPPER = b.uppercase !== false;
}
const up = (t: string) => (UPPER ? t.toUpperCase() : t);
export const money = (v: number) => '$' + Math.round(v).toLocaleString('es-CO');

const ease = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);

function font(ctx: CanvasRenderingContext2D, weight: number, size: number, kind: 'heading' | 'body' = 'body') {
  ctx.font = `${weight} ${size}px ${kind === 'heading' ? HEADING : BODY}`;
}

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** Texto en varias líneas dentro de un ancho; devuelve la altura usada. */
function wrap(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lineH: number, maxLines = 3): number {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; } else line = test;
  }
  if (line) lines.push(line);
  const shown = lines.slice(0, maxLines);
  if (lines.length > maxLines) shown[maxLines - 1] = shown[maxLines - 1].replace(/\s*\S*$/, '…');
  shown.forEach((l, i) => ctx.fillText(l, x, y + i * lineH));
  return shown.length * lineH;
}

/** Título grande que se achica hasta caber en el ancho (como los titulares de la portada). */
function poster(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, size: number, color: string, maxLines = 2): number {
  let s = size;
  font(ctx, 800, s, 'heading');
  const txt = up(text);
  while (s > 48 && ctx.measureText(txt.split(' ').reduce((a, b) => (a.length > b.length ? a : b), '')).width > maxW) { s -= 4; font(ctx, 800, s, 'heading'); }
  ctx.fillStyle = color;
  ctx.textBaseline = 'top';
  return wrap(ctx, txt, x, y, maxW, s * 0.98, maxLines);
}

function cover(ctx: CanvasRenderingContext2D, img: HTMLImageElement | null, x: number, y: number, w: number, h: number, zoom = 1, bg = '#e5e5e0') {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, w, h);
  if (img && img.naturalWidth) {
    const k = Math.max(w / img.naturalWidth, h / img.naturalHeight) * zoom;
    const iw = img.naturalWidth * k, ih = img.naturalHeight * k;
    ctx.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
  }
  ctx.restore();
}

function contain(ctx: CanvasRenderingContext2D, img: HTMLImageElement | HTMLCanvasElement | null, x: number, y: number, w: number, h: number, zoom = 1) {
  if (!img) return;
  const nw = img instanceof HTMLImageElement ? img.naturalWidth : img.width;
  const nh = img instanceof HTMLImageElement ? img.naturalHeight : img.height;
  if (!nw || !nh) return;
  const k = Math.min(w / nw, h / nh) * zoom;
  ctx.drawImage(img, x + (w - nw * k) / 2, y + (h - nh * k) / 2, nw * k, nh * k);
}

function roundImage(ctx: CanvasRenderingContext2D, img: HTMLImageElement | null, x: number, y: number, w: number, h: number, r: number, zoom = 1) {
  ctx.save();
  rr(ctx, x, y, w, h, r);
  ctx.clip();
  cover(ctx, img, x, y, w, h, zoom);
  ctx.restore();
}

/** Color hex con transparencia. */
function rgba(hex: string, a: number) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function logo(ctx: CanvasRenderingContext2D, b: Brand, dark: boolean, x: number, y: number, h: number, align: 'left' | 'center' = 'left') {
  const img = dark ? b.logoOnDark ?? b.logo : b.logo;
  if (img && img.naturalWidth) {
    const w = (img.naturalWidth / img.naturalHeight) * h;
    ctx.drawImage(img, align === 'center' ? x - w / 2 : x, y, w, h);
    return;
  }
  font(ctx, 800, h * 0.8);
  ctx.fillStyle = dark ? '#ffffff' : b.primary;
  ctx.textBaseline = 'top';
  ctx.textAlign = align;
  ctx.fillText(b.name.toUpperCase(), x, y);
  ctx.textAlign = 'left';
}

function pill(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, bg: string, fg: string, align: 'left' | 'center' = 'left') {
  font(ctx, 700, size);
  const w = ctx.measureText(text).width + size * 1.6;
  const h = size * 2;
  const px = align === 'center' ? x - w / 2 : x;
  ctx.fillStyle = bg;
  rr(ctx, px, y, w, h, h / 2);
  ctx.fill();
  ctx.fillStyle = fg;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, px + size * 0.8, y + h / 2 + 1);
  ctx.textBaseline = 'top';
  return w;
}

function priceRow(ctx: CanvasRenderingContext2D, item: PieceItem, x: number, y: number, size: number, color: string, strikeColor: string) {
  if (item.price == null) return;
  ctx.textBaseline = 'top';
  let cx = x;
  if (item.listPrice && item.listPrice > item.price) {
    font(ctx, 500, size * 0.6);
    ctx.fillStyle = strikeColor;
    const s = money(item.listPrice);
    const w = ctx.measureText(s).width;
    ctx.fillText(s, cx, y + size * 0.3);
    ctx.fillRect(cx, y + size * 0.62, w, Math.max(2, size * 0.05));
    cx += w + size * 0.35;
  }
  font(ctx, 800, size);
  ctx.fillStyle = color;
  ctx.fillText(money(item.price), cx, y);
}

const off = (item?: PieceItem) => (item?.discountPercent ? `-${item.discountPercent}%` : null);

// ─── Plantillas (t: 0..1, entrada de la escena; zoom: movimiento lento de la foto) ─────────────

/** Cuántas líneas ocupa un texto en un ancho (para armar bloques de abajo hacia arriba). */
function lineCount(ctx: CanvasRenderingContext2D, text: string, maxW: number, maxLines: number): number {
  let n = 1, line = '';
  for (const w of text.split(/\s+/).filter(Boolean)) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) { n++; line = w; } else line = test;
  }
  return Math.min(n, maxLines);
}

function posterSize(ctx: CanvasRenderingContext2D, text: string, maxW: number, size: number): number {
  let s = size;
  font(ctx, 800, s, 'heading');
  const longest = up(text).split(' ').reduce((a, b) => (a.length > b.length ? a : b), '');
  while (s > 48 && ctx.measureText(longest).width > maxW) { s -= 4; font(ctx, 800, s, 'heading'); }
  return s;
}

function destacado(ctx: CanvasRenderingContext2D, s: PieceSpec, W: number, H: number, t: number, zoom: number, item: PieceItem) {
  const b = s.brand;
  cover(ctx, item.image, 0, 0, W, H, zoom);
  // Sombras arriba (logo) y abajo (textos) para que se lean sobre cualquier foto.
  const top = ctx.createLinearGradient(0, 0, 0, 240);
  top.addColorStop(0, 'rgba(15,14,14,0.55)');
  top.addColorStop(1, 'rgba(15,14,14,0)');
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, W, 240);
  const g = ctx.createLinearGradient(0, H * 0.38, 0, H);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(15,14,14,0.9)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  logo(ctx, b, true, 64, 64, 64);
  const badge = off(item);
  if (badge && s.showPrice) pill(ctx, badge, W - 64 - 200, 60, 44, b.accent, b.primary);

  // Bloque de abajo hacia arriba: botón, precio, subtítulo y título.
  const story = s.format !== 'post';
  const maxW = W - 128;
  const titleText = s.title || item.name;
  const tSize = posterSize(ctx, titleText, maxW, story ? 120 : 96);
  font(ctx, 800, tSize, 'heading');
  const tLines = lineCount(ctx, up(titleText), maxW, story ? 3 : 2);
  font(ctx, 500, 40);
  const sLines = s.subtitle ? lineCount(ctx, s.subtitle, maxW, 2) : 0;
  const ctaH = s.cta ? 76 : 0;
  const priceH = s.showPrice && item.price != null ? 96 : 0;
  const blockH = tLines * tSize * 0.98 + 16 + (sLines ? sLines * 50 + 18 : 0) + priceH + ctaH;
  const a = ease(t * 1.6);
  ctx.globalAlpha = a;
  let y = H - (story ? 160 : 64) - blockH + (1 - a) * 40;
  y += poster(ctx, titleText, 64, y, maxW, tSize, '#ffffff', story ? 3 : 2) + 16;
  if (s.subtitle) { font(ctx, 500, 40); ctx.fillStyle = 'rgba(255,255,255,0.86)'; y += wrap(ctx, s.subtitle, 64, y, maxW, 50, 2) + 18; }
  if (priceH) { priceRow(ctx, item, 64, y, 72, b.accent, 'rgba(255,255,255,0.6)'); y += priceH; }
  if (s.cta) pill(ctx, s.cta, 64, y, 38, b.accent, b.primary);
  ctx.globalAlpha = 1;
}

function oferta(ctx: CanvasRenderingContext2D, s: PieceSpec, W: number, H: number, t: number, zoom: number, item: PieceItem) {
  const b = s.brand;
  ctx.fillStyle = b.primary;
  ctx.fillRect(0, 0, W, H);
  logo(ctx, b, true, W / 2, 64, 56, 'center');
  const big = s.promo?.label || off(item) || 'OFERTA';
  const a = ease(t * 1.8);
  font(ctx, 900, s.format === 'post' ? 220 : 260, 'heading');
  ctx.fillStyle = b.accent;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.save();
  ctx.translate(W / 2, 150);
  ctx.scale(0.8 + 0.2 * a, 0.8 + 0.2 * a);
  ctx.fillText(big, 0, 0);
  ctx.restore();
  ctx.textAlign = 'left';
  const imgTop = s.format === 'post' ? 400 : 470;
  const imgH = s.format === 'post' ? 330 : 820;
  const imgW = s.format === 'post' ? 480 : 820;
  roundImage(ctx, item.image, (W - imgW) / 2, imgTop, imgW, imgH, 36, zoom);
  let y = imgTop + imgH + 36;
  ctx.textAlign = 'center';
  font(ctx, 800, s.format === 'post' ? 52 : 64, 'heading');
  ctx.fillStyle = '#ffffff';
  y += wrap(ctx, up(s.title || item.name), W / 2, y, W - 160, s.format === 'post' ? 58 : 72, s.format === 'post' ? 1 : 2) + 10;
  if (s.subtitle && s.format !== 'post') { font(ctx, 500, 40); ctx.fillStyle = 'rgba(255,255,255,0.8)'; y += wrap(ctx, s.subtitle, W / 2, y, W - 160, 50, 2) + 16; }
  ctx.textAlign = 'left';
  if (s.showPrice && item.price != null) {
    font(ctx, 800, 64);
    const pw = ctx.measureText(money(item.price)).width + (item.listPrice && item.listPrice > item.price ? ctx.measureText(money(item.listPrice)).width * 0.6 + 30 : 0);
    priceRow(ctx, item, (W - pw) / 2, y, 64, b.accent, 'rgba(255,255,255,0.55)');
    y += 90;
  }
  if (s.cta) pill(ctx, s.cta, W / 2, Math.min(y + 6, H - (s.format === 'post' ? 96 : 170)), s.format === 'post' ? 34 : 40, b.accent, b.primary, 'center');
}

function coleccion(ctx: CanvasRenderingContext2D, s: PieceSpec, W: number, H: number, t: number, zoom: number) {
  const b = s.brand;
  ctx.fillStyle = b.paper;
  ctx.fillRect(0, 0, W, H);
  logo(ctx, b, false, 64, 60, 52);
  let y = s.format === 'post' ? 150 : 200;
  y += poster(ctx, s.title || 'Colección', 64, y, W - 128, s.format === 'post' ? 84 : 110, b.primary) + 20;
  const items = s.items.slice(0, 4);
  const cols = 2;
  const gap = 24;
  const cw = (W - 128 - gap) / cols;
  const ch = s.format === 'post' ? Math.min(cw, (H - y - 170 - gap) / 2) : cw * 1.25;
  items.forEach((it, i) => {
    const a = ease(t * 2.2 - i * 0.18);
    const cx = 64 + (i % cols) * (cw + gap);
    const cy = y + Math.floor(i / cols) * (ch + gap + (s.format === 'post' ? 0 : 70)) + (1 - a) * 30;
    ctx.globalAlpha = a;
    roundImage(ctx, it.image, cx, cy, cw, ch, 28, zoom);
    if (s.showPrice && it.price != null) {
      const label = money(it.price);
      font(ctx, 700, 30);
      const w = ctx.measureText(label).width + 36;
      ctx.fillStyle = b.primary;
      rr(ctx, cx + 16, cy + ch - 64, w, 48, 24);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, cx + 34, cy + ch - 40);
      ctx.textBaseline = 'top';
    }
    if (s.format !== 'post') { font(ctx, 600, 32); ctx.fillStyle = b.primary; wrap(ctx, it.name, cx, cy + ch + 14, cw, 38, 1); }
    ctx.globalAlpha = 1;
  });
  if (s.cta) pill(ctx, s.cta, 64, H - (s.format === 'post' ? 120 : 190), 38, b.primary, '#ffffff');
  if (s.subtitle) { font(ctx, 500, 34); ctx.fillStyle = '#5b5b5b'; ctx.textAlign = 'right'; wrap(ctx, s.subtitle, W - 64, H - (s.format === 'post' ? 106 : 176), W / 2 - 40, 40, 1); ctx.textAlign = 'left'; }
}

function nuevo(ctx: CanvasRenderingContext2D, s: PieceSpec, W: number, H: number, t: number, zoom: number, item: PieceItem) {
  const b = s.brand;
  ctx.fillStyle = b.paper;
  ctx.fillRect(0, 0, W, H);
  logo(ctx, b, false, W / 2, 64, 52, 'center');
  pill(ctx, 'NUEVO', W / 2, s.format === 'post' ? 150 : 200, 32, b.accent, b.primary, 'center');
  const a = ease(t * 1.6);
  const top = s.format === 'post' ? 240 : 330;
  const h = s.format === 'post' ? 520 : 900;
  ctx.fillStyle = 'rgba(0,0,0,0.08)';
  ctx.beginPath();
  ctx.ellipse(W / 2, top + h - 10, W * 0.3, 28, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = a;
  roundImage(ctx, item.image, (W - h * 0.85) / 2, top + (1 - a) * 30, h * 0.85, h - 40, 40, zoom);
  ctx.globalAlpha = 1;
  let y = top + h + 30;
  ctx.textAlign = 'center';
  font(ctx, 800, s.format === 'post' ? 64 : 84, 'heading');
  ctx.fillStyle = b.primary;
  ctx.textBaseline = 'top';
  y += wrap(ctx, up(s.title || item.name), W / 2, y, W - 160, s.format === 'post' ? 70 : 92, 2) + 8;
  if (s.subtitle) { font(ctx, 500, 38); ctx.fillStyle = '#5b5b5b'; y += wrap(ctx, s.subtitle, W / 2, y, W - 200, 46, 2) + 12; }
  ctx.textAlign = 'left';
  if (s.showPrice && item.price != null) {
    font(ctx, 800, 60);
    const w = ctx.measureText(money(item.price)).width;
    priceRow(ctx, { ...item, listPrice: undefined }, (W - w) / 2, y, 60, b.primary, '#888');
    y += 84;
  }
  if (s.cta && s.format !== 'post') pill(ctx, s.cta, W / 2, Math.min(y + 10, H - 170), 40, b.primary, '#ffffff', 'center');
}

function cupon(ctx: CanvasRenderingContext2D, s: PieceSpec, W: number, H: number, t: number, zoom: number, item: PieceItem) {
  const b = s.brand;
  ctx.fillStyle = b.accent;
  ctx.fillRect(0, 0, W, H);
  logo(ctx, b, false, 64, 64, 56);
  let y = s.format === 'post' ? 170 : 240;
  y += poster(ctx, s.title || s.promo?.name || 'Cupón', 64, y, W - 128, s.format === 'post' ? 92 : 120, b.primary) + 30;
  const tw = W - 128, th = s.format === 'post' ? 300 : 380;
  const a = ease(t * 1.8);
  ctx.save();
  ctx.translate(0, (1 - a) * 40);
  ctx.globalAlpha = a;
  ctx.fillStyle = b.primary;
  rr(ctx, 64, y, tw, th, 36);
  ctx.fill();
  ctx.setLineDash([18, 14]);
  ctx.strokeStyle = b.accent;
  ctx.lineWidth = 5;
  rr(ctx, 90, y + 26, tw - 52, th - 52, 24);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.textAlign = 'center';
  font(ctx, 600, 36);
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillText(s.promo?.code ? 'Usa el código' : 'Descuento', W / 2, y + 62);
  font(ctx, 900, s.promo?.code ? 110 : 150, 'heading');
  ctx.fillStyle = b.accent;
  ctx.fillText(s.promo?.code || s.promo?.label || off(item) || '', W / 2, y + 120);
  if (s.promo?.code && s.promo?.label) { font(ctx, 700, 44); ctx.fillStyle = '#ffffff'; ctx.fillText(s.promo.label, W / 2, y + th - 90); }
  ctx.restore();
  ctx.textAlign = 'left';
  y += th + 40;
  if (s.subtitle) { font(ctx, 600, 40); ctx.fillStyle = b.primary; y += wrap(ctx, s.subtitle, 64, y, W - 128, 50, 2) + 20; }
  if (item.image && s.format !== 'post') { roundImage(ctx, item.image, 64, y, W - 128, Math.min(560, H - y - 240), 32, zoom); }
  if (s.cta) pill(ctx, s.cta, 64, H - (s.format === 'post' ? 130 : 190), 40, b.primary, '#ffffff');
}

function personaliza(ctx: CanvasRenderingContext2D, s: PieceSpec, W: number, H: number, t: number, zoom: number, item: PieceItem) {
  const b = s.brand;
  ctx.fillStyle = b.primary;
  ctx.fillRect(0, 0, W, H);
  const g = ctx.createRadialGradient(W / 2, H * 0.45, 40, W / 2, H * 0.45, W * 0.75);
  g.addColorStop(0, 'rgba(171,208,76,0.25)');
  g.addColorStop(1, 'rgba(171,208,76,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  logo(ctx, b, true, 64, 64, 56);
  const top = s.format === 'post' ? 150 : 220;
  const h = s.format === 'post' ? 560 : 980;
  const a = ease(t * 1.5);
  ctx.globalAlpha = a;
  contain(ctx, item.image, 120, top, W - 240, h, zoom);
  ctx.globalAlpha = 1;
  let y = top + h + 20;
  y += poster(ctx, s.title || 'Diseña la tuya', 64, y, W - 128, s.format === 'post' ? 84 : 110, '#ffffff') + 12;
  if (s.subtitle) { font(ctx, 500, 40); ctx.fillStyle = 'rgba(255,255,255,0.8)'; y += wrap(ctx, s.subtitle, 64, y, W - 128, 50, 2) + 16; }
  if (s.cta) pill(ctx, s.cta, 64, Math.min(y + 6, H - 150), 40, b.accent, b.primary);
  if (s.showPrice && item.price != null) { font(ctx, 700, 40); ctx.fillStyle = b.accent; ctx.textAlign = 'right'; ctx.fillText('desde ' + money(item.price), W - 64, Math.min(y + 18, H - 132)); ctx.textAlign = 'left'; }
}

const DRAW: Record<TemplateId, (ctx: CanvasRenderingContext2D, s: PieceSpec, W: number, H: number, t: number, zoom: number, item: PieceItem) => void> = {
  destacado, oferta, coleccion, nuevo, cupon, personaliza,
};

const EMPTY_ITEM: PieceItem = { name: '', image: null };

/** Pieza fija (post o historia) o el cuadro final de la animación. */
export function drawStill(ctx: CanvasRenderingContext2D, s: PieceSpec) {
  setBrandFonts(s.brand);
  const [W, H] = sizeOf(s.format);
  ctx.clearRect(0, 0, W, H);
  DRAW[s.template](ctx, s, W, H, 1, 1.02, s.items[0] ?? EMPTY_ITEM);
}

/**
 * Cuadro del reel en el segundo `time`: una escena por producto (la plantilla con entrada animada y la
 * foto acercándose despacio) y un cierre con el logo y el llamado a la acción.
 */
export function drawReel(ctx: CanvasRenderingContext2D, s: PieceSpec, time: number) {
  setBrandFonts(s.brand);
  const [W, H] = sizeOf(s.format);
  const items = s.items.length ? s.items.slice(0, 5) : [EMPTY_ITEM];
  const scenes = s.template === 'coleccion' ? 1 : items.length;
  const sceneLen = s.template === 'coleccion' ? REEL_SCENE * Math.min(2, items.length) : REEL_SCENE;
  const body = scenes * sceneLen;
  ctx.clearRect(0, 0, W, H);
  if (time < body) {
    const i = Math.min(scenes - 1, Math.floor(time / sceneLen));
    const local = (time - i * sceneLen) / sceneLen;
    DRAW[s.template](ctx, s, W, H, local, 1 + local * 0.08, items[i]);
    // Fundido entre escenas.
    const fade = Math.min(1, Math.min(local, 1 - local) * 8);
    if (fade < 1) { ctx.fillStyle = `rgba(0,0,0,${(1 - fade) * 0.9})`; ctx.fillRect(0, 0, W, H); }
    return;
  }
  endCard(ctx, s, W, H, (time - body) / REEL_END);
}

export const reelLength = (s: PieceSpec) =>
  (s.template === 'coleccion' ? REEL_SCENE * Math.min(2, Math.max(1, s.items.length)) : Math.max(1, Math.min(5, s.items.length)) * REEL_SCENE) + REEL_END;

function endCard(ctx: CanvasRenderingContext2D, s: PieceSpec, W: number, H: number, t: number) {
  const b = s.brand;
  ctx.fillStyle = b.primary;
  ctx.fillRect(0, 0, W, H);
  const a = ease(t * 2);
  ctx.globalAlpha = a;
  const icon = b.iconOnDark ?? b.icon;
  if (icon && icon.naturalWidth) {
    const ih = 220, iw = (icon.naturalWidth / icon.naturalHeight) * ih;
    ctx.save();
    ctx.translate(W / 2, H * 0.36 - 150);
    ctx.scale(0.85 + 0.15 * a, 0.85 + 0.15 * a);
    ctx.drawImage(icon, -iw / 2, -ih / 2, iw, ih);
    ctx.restore();
  }
  logo(ctx, b, true, W / 2, H * 0.36, 120, 'center');
  if (b.slogan) {
    font(ctx, 500, 34);
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(b.slogan, W / 2, H * 0.36 + 520);
    ctx.textAlign = 'left';
  }
  ctx.textAlign = 'center';
  font(ctx, 600, 46);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.textBaseline = 'top';
  wrap(ctx, s.subtitle || s.title, W / 2, H * 0.36 + 170, W - 200, 56, 2);
  ctx.textAlign = 'left';
  if (s.cta) pill(ctx, s.cta, W / 2, H * 0.36 + 320, 44, b.accent, b.primary, 'center');
  ctx.globalAlpha = 1;
}

// ─── Video 3D por escenas (ver timeline.ts) ─────────────────────────────────────────────────────

/** Cuadro 3D a pantalla completa, con zoom opcional desde el centro. */
function frameCover(ctx: CanvasRenderingContext2D, frame: HTMLCanvasElement | null, W: number, H: number, zoom = 1) {
  if (!frame || !frame.width || !frame.height) return;
  const k = Math.max(W / frame.width, H / frame.height) * zoom;
  ctx.drawImage(frame, (W - frame.width * k) / 2, (H - frame.height * k) / 2, frame.width * k, frame.height * k);
}

/** Textos de una escena (título y subtítulo), entrando desde abajo al empezar la escena. */
function sceneText(ctx: CanvasRenderingContext2D, s: PieceSpec, sc: Scene, local: number, alpha: number, W: number, H: number, ctaRoom: boolean) {
  if (!sc.title && !sc.subtitle) return;
  const dark = s.stage === 'oscuro';
  const a = ease(local * 2.2) * alpha;
  if (a <= 0) return;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.translate(0, (1 - ease(local * 2.2)) * 40);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const bottom = ctaRoom ? H - 176 : H - 110;
  let y = bottom;
  if (sc.subtitle) {
    font(ctx, 500, 38);
    y -= 50;
    ctx.fillStyle = dark ? 'rgba(255,255,255,0.78)' : '#5b5b5b';
    wrap(ctx, sc.subtitle, W / 2, y, W - 200, 46, 1);
    y -= 14;
  }
  if (sc.title) {
    font(ctx, 800, 84, 'heading');
    const t = up(sc.title);
    const lines = lineCount(ctx, t, W - 140, 2);
    ctx.fillStyle = dark ? '#ffffff' : s.brand.primary;
    wrap(ctx, t, W / 2, y - lines * 90, W - 140, 90, 2);
  }
  ctx.restore();
}

/**
 * Cuadro del video 3D por escenas en el segundo `time`. `frames` son los lienzos de los dos maniquíes
 * (la escena i se ve en frames[i % 2]). Encima van el logo, el precio, los textos de cada escena y,
 * al final, el cierre con el logo y el botón.
 */
export function drawScenes(
  ctx: CanvasRenderingContext2D, s: PieceSpec, scenes: Scene[], withEnd: boolean,
  frames: [HTMLCanvasElement | null, HTMLCanvasElement | null], time: number,
) {
  setBrandFonts(s.brand);
  const [W, H] = sizeOf(s.format);
  const b = s.brand;
  const dark = s.stage === 'oscuro';
  const base = dark ? b.primary : b.paper;
  const f = frameAt(scenes, withEnd, time);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, W, H);
  if (!scenes.length) return;

  if (f.index === -1) {
    // Cierre: entra con un velo del color de la marca sobre la última escena.
    if (f.end < 0.2) {
      frameCover(ctx, frames[(scenes.length - 1) % 2], W, H);
      ctx.fillStyle = rgba(b.primary, f.end / 0.2);
      ctx.fillRect(0, 0, W, H);
    } else {
      endCard(ctx, s, W, H, (f.end - 0.2) / 0.8);
    }
    return;
  }

  // 1. Escenas 3D (con la transición si hay).
  const tr = f.transition;
  if (!tr) {
    frameCover(ctx, frames[f.index % 2], W, H);
  } else {
    const A = frames[tr.from % 2], B = frames[tr.to % 2];
    const p = Math.min(1, Math.max(0, tr.p));
    switch (tr.kind) {
      case 'barrido': {
        frameCover(ctx, A, W, H);
        const x = ease(p) * W;
        ctx.save(); ctx.beginPath(); ctx.rect(0, 0, x, H); ctx.clip(); frameCover(ctx, B, W, H); ctx.restore();
        ctx.fillStyle = b.accent;
        ctx.fillRect(x - 10, 0, 20, H);
        break;
      }
      case 'zoom':
        frameCover(ctx, B, W, H, 1.15 - 0.15 * ease(p));
        ctx.globalAlpha = 1 - ease(p);
        frameCover(ctx, A, W, H, 1 + 0.35 * ease(p));
        ctx.globalAlpha = 1;
        break;
      case 'destello':
      case 'cortina':
        frameCover(ctx, p < 0.5 ? A : B, W, H);
        break;
      default: // fundido
        frameCover(ctx, A, W, H);
        ctx.globalAlpha = ease(p);
        frameCover(ctx, B, W, H);
        ctx.globalAlpha = 1;
    }
  }

  // 2. Velos arriba y abajo para leer el logo y los textos.
  const topG = ctx.createLinearGradient(0, 0, 0, 280);
  topG.addColorStop(0, rgba(base, 0.85));
  topG.addColorStop(1, rgba(base, 0));
  ctx.fillStyle = topG;
  ctx.fillRect(0, 0, W, 280);
  const botG = ctx.createLinearGradient(0, H - 620, 0, H);
  botG.addColorStop(0, rgba(base, 0));
  botG.addColorStop(0.45, rgba(base, 0.82));
  botG.addColorStop(1, rgba(base, 0.96));
  ctx.fillStyle = botG;
  ctx.fillRect(0, H - 620, W, 620);

  // 3. Marca, precio, textos de la escena y botón (en la última escena si no hay cierre).
  logo(ctx, b, dark, W / 2, 80, 60, 'center');
  const item = s.items[0];
  if (s.showPrice && item?.price != null) {
    font(ctx, 700, 40); ctx.fillStyle = dark ? '#ffffff' : b.primary; ctx.textAlign = 'right'; ctx.textBaseline = 'top';
    ctx.fillText('desde ' + money(item.price), W - 64, 96); ctx.textAlign = 'left';
  }
  const last = scenes.length - 1;
  const ctaRoom = !withEnd && !!s.cta;
  if (tr) {
    const p = Math.min(1, Math.max(0, tr.p));
    const lenFrom = layout(scenes, withEnd).starts;
    sceneText(ctx, s, scenes[tr.from], time - lenFrom[tr.from], Math.max(0, 1 - p * 2), W, H, ctaRoom && tr.from === last);
    sceneText(ctx, s, scenes[tr.to], Math.max(0, time - lenFrom[tr.to]), Math.max(0, p * 2 - 1), W, H, ctaRoom && tr.to === last);
  } else {
    sceneText(ctx, s, scenes[f.index], f.local, 1, W, H, ctaRoom && f.index === last);
  }
  if (ctaRoom && f.index === last) {
    ctx.globalAlpha = tr ? Math.min(1, Math.max(0, tr.p * 2 - 1)) : ease(f.local * 2);
    pill(ctx, s.cta, W / 2, H - 140, 36, dark ? b.accent : b.primary, dark ? b.primary : '#ffffff', 'center');
    ctx.globalAlpha = 1;
  }

  // 4. Velos de transición que tapan todo (escena, logo y textos).
  if (tr && (tr.kind === 'destello' || tr.kind === 'cortina')) {
    const p = Math.min(1, Math.max(0, tr.p));
    if (tr.kind === 'destello') {
      const a = 1 - Math.abs(p - 0.5) * 2;
      ctx.fillStyle = dark ? rgba(b.accent, a) : `rgba(255,255,255,${a})`;
      ctx.fillRect(0, 0, W, H);
    } else {
      // Un panel de la marca sube tapando la escena y sigue subiendo destapando la nueva.
      const top = p < 0.5 ? H * (1 - ease(p * 2)) : 0;
      const bottom = p < 0.5 ? H : H * (1 - ease((p - 0.5) * 2));
      ctx.fillStyle = dark ? b.accent : b.primary;
      ctx.fillRect(0, top, W, bottom - top);
      const icon = dark ? b.icon : b.iconOnDark ?? b.icon;
      if (icon && icon.naturalWidth && bottom - top > 300) {
        const ih = 180, iw = (icon.naturalWidth / icon.naturalHeight) * ih;
        ctx.drawImage(icon, W / 2 - iw / 2, (top + bottom) / 2 - ih / 2, iw, ih);
      }
    }
  }
}
