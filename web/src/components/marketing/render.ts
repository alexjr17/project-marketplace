/**
 * Estudio de contenido: dibuja las piezas para redes en un lienzo (post 1:1, historia 9:16, reel 9:16
 * animado y el marco del video 360°) con la marca de la tienda. Todo en el navegador, sin IA de
 * imagen: plantillas fijas con las fotos, precios y ofertas reales.
 *
 * Unidad: el lienzo mide 1080 de ancho; las medidas se escriben en esa escala.
 */
import { clampSeconds, END_SECONDS, frameAt, layout, type Scene } from './timeline';
import { composite, drawCover } from './transitions';
import { clipVideo } from './media';
import { paintBackground } from './backgrounds';
import { contentBox, drawCutout, hasTransparency, quickCutout } from './cutout';
import { designRectOf } from './mockup';

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
  /** Logo completo (ícono y nombre) y su versión para fondos oscuros: el que va en las piezas. */
  full?: HTMLImageElement | null;
  fullOnDark?: HTMLImageElement | null;
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
  /** La foto sin su fondo (recortada por la IA), si ya está. */
  cutout?: HTMLImageElement | HTMLCanvasElement | null;
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
  const img = (dark ? b.fullOnDark ?? b.full : b.full) ?? (dark ? b.logoOnDark ?? b.logo : b.logo);
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
  // El ícono grande arriba y debajo solo el nombre (el logo completo repetiría el ícono).
  const icon = b.iconOnDark ?? b.icon;
  if (icon && icon.naturalWidth) {
    const ih = 220, iw = (icon.naturalWidth / icon.naturalHeight) * ih;
    ctx.save();
    ctx.translate(W / 2, H * 0.36 - 150);
    ctx.scale(0.85 + 0.15 * a, 0.85 + 0.15 * a);
    ctx.drawImage(icon, -iw / 2, -ih / 2, iw, ih);
    ctx.restore();
  }
  logo(ctx, { ...b, full: null, fullOnDark: null }, true, W / 2, H * 0.36, 120, 'center');
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

// ─── Video por escenas (ver timeline.ts y transitions.ts) ───────────────────────────────────────

export type VideoRatio = '9:16' | '4:5' | '1:1';
export const VIDEO_RATIOS: { value: VideoRatio; label: string; hint: string }[] = [
  { value: '9:16', label: 'Vertical 9:16', hint: 'Reels, historias y TikTok' },
  { value: '4:5', label: 'Feed 4:5', hint: 'El que más ocupa en el feed de Instagram y Facebook' },
  { value: '1:1', label: 'Cuadrado 1:1', hint: 'Feed y anuncios' },
];
export const videoSize = (r: VideoRatio): [number, number] => (r === '1:1' ? [1080, 1080] : r === '4:5' ? [1080, 1350] : [1080, 1920]);

export interface VideoOptions {
  endCard: boolean;
  /** Logo de la marca arriba en todas las escenas. */
  logo: boolean;
}

export interface SceneAssets {
  /** Lienzos de los dos maniquíes 3D. */
  frames: [HTMLCanvasElement | null, HTMLCanvasElement | null];
  /** Qué escena tiene cargada cada maniquí (la escena j solo se pinta con el cuadro de su maniquí). */
  slots: [number, number];
  /** Fotos de los productos (por URL). */
  images: Record<string, HTMLImageElement | null>;
  /** Montajes 2D de las escenas de foto de plantilla (por id de escena). */
  mockups: Record<string, HTMLCanvasElement>;
  /** Foto sin fondo de cada producto (URL original → URL del recorte). */
  cutouts?: Record<string, string | null>;
  /** Precio "desde" de cada plantilla 3D. */
  templates: Record<number, { name: string; price: number }>;
  /** Dos lienzos de trabajo del tamaño del video (para las transiciones). */
  layers: [HTMLCanvasElement, HTMLCanvasElement];
}

/** ¿El color es oscuro? (para elegir el logo y el color del texto). */
export function isDark(hex: string) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6), 16);
  if (!Number.isFinite(n)) return true;
  const r = (n >> 16) & 255, g = (n >> 8) & 255, bl = n & 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * bl < 150;
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const backOut = (x: number) => { const t = clamp01(x), c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };

/** Fondo de una escena: el del escenario, o el elegido en las de texto. */
function bgOf(s: PieceSpec, sc: Scene | null): string {
  const b = s.brand;
  if (!sc) return b.primary; // cierre
  // Fondo propio: su color base (una foto oscurecida cuenta como oscura) para que los textos contrasten.
  if (sc.bg) return sc.bg.style === 'foto' && sc.bg.dim >= 0.3 ? '#111111' : sc.bg.base;
  if (sc.kind === 'texto') return sc.textBg === 'acento' || sc.textBg === 'rayas' ? b.accent : sc.textBg === 'claro' ? b.paper : b.primary;
  return s.stage === 'oscuro' ? b.primary : b.paper;
}

/** Cuadro 3D a pantalla completa, con zoom opcional desde el centro. */
function frameCover(ctx: CanvasRenderingContext2D, frame: HTMLCanvasElement | null, W: number, H: number, zoom = 1) {
  if (!frame || !frame.width || !frame.height) return;
  const k = Math.max(W / frame.width, H / frame.height) * zoom;
  ctx.drawImage(frame, (W - frame.width * k) / 2, (H - frame.height * k) / 2, frame.width * k, frame.height * k);
}

/** Foto que cubre un rectángulo, con zoom y corrimiento horizontal (paneo). */
function coverAt(ctx: CanvasRenderingContext2D, img: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement, x: number, y: number, w: number, h: number, zoom: number, dx: number) {
  const nw = img instanceof HTMLVideoElement ? img.videoWidth : img instanceof HTMLCanvasElement ? img.width : img.naturalWidth;
  const nh = img instanceof HTMLVideoElement ? img.videoHeight : img instanceof HTMLCanvasElement ? img.height : img.naturalHeight;
  if (!nw || !nh) return;
  const k = Math.max(w / nw, h / nh) * zoom;
  const iw = nw * k, ih = nh * k;
  const maxDx = (iw - w) / 2;
  ctx.drawImage(img, x + (w - iw) / 2 + Math.max(-maxDx, Math.min(maxDx, dx)), y + (h - ih) / 2, iw, ih);
}

/** Movimiento de la foto: zoom y paneo según el avance de la escena. */
function photoMotion(sc: Scene, local: number, W: number) {
  const p = local / clampSeconds(sc.seconds);
  switch (sc.photoMove) {
    case 'alejar': return { zoom: 1.16 - 0.14 * p, dx: 0 };
    case 'paneo': return { zoom: 1.14, dx: (p - 0.5) * W * 0.1 };
    case 'quieta': return { zoom: 1.02, dx: 0 };
    default: return { zoom: 1.02 + 0.14 * p, dx: 0 };
  }
}

/** La última prenda dibujada en una escena de foto: para agarrar su diseño en la vista previa. */
let lastPhoto: { id: string; img: HTMLImageElement | HTMLCanvasElement; x: number; y: number; w: number; h: number; zoom: number } | null = null;

/**
 * Dónde quedó en el lienzo la prenda de la escena y su diseño: `span` es cuánto mide la foto completa
 * (para pasar el arrastre a corrimiento del diseño) y `designRect` el diseño. Null si no se dibujó.
 */
export function photoSceneLayout(id: string): { span: [number, number]; designRect: { x: number; y: number; w: number; h: number } | null } | null {
  const p = lastPhoto;
  if (!p || p.id !== id) return null;
  const [cx0, cy0, cw, ch] = contentBox(p.img, 0.005);
  if (!cw || !ch) return null;
  const k = Math.min(p.w / cw, p.h / ch) * p.zoom;
  const ix = p.x + (p.w - cw * k) / 2, iy = p.y + p.h - ch * k;
  const fw = p.img instanceof HTMLCanvasElement ? p.img.width : p.img.naturalWidth;
  const fh = p.img instanceof HTMLCanvasElement ? p.img.height : p.img.naturalHeight;
  const dr = designRectOf(p.img);
  return { span: [fw * k, fh * k], designRect: dr ? { x: ix + (dr.x - cx0) * k, y: iy + (dr.y - cy0) * k, w: dr.w * k, h: dr.h * k } : null };
}

/**
 * Escena de foto de producto: el producto recortado y en grande (protagonista), o la foto a pantalla
 * completa. Si la foto no se puede recortar (trae una escena), va en una tarjeta grande flotando.
 */
function photoScene(ctx: CanvasRenderingContext2D, s: PieceSpec, sc: Scene, local: number, img: HTMLImageElement | HTMLCanvasElement | null, W: number, H: number, cut: HTMLImageElement | HTMLCanvasElement | null = null, ownBg = false) {
  const base = bgOf(s, sc);
  if (!ownBg) {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, W, H);
  }
  if (!img || !(img instanceof HTMLCanvasElement ? img.width : img.naturalWidth)) return;
  const m = photoMotion(sc, local, W);
  if (sc.photoFit === 'completa') {
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
    coverAt(ctx, img, 0, 0, W, H, m.zoom, m.dx);
    ctx.restore();
    return;
  }
  const hero = cut && cut.width ? cut : hasTransparency(img) ? img : quickCutout(img);
  const textTop = sc.textPos === 'arriba';
  const tall = H > W * 1.2;
  if (hero) {
    // Escenario: luz del color de acento detrás del producto, el nombre de la marca enorme y tenue, y el piso.
    const cy = textTop ? H * 0.62 : H * 0.42;
    const glow = ctx.createRadialGradient(W / 2, cy, 10, W / 2, cy, Math.max(W, H) * 0.6);
    glow.addColorStop(0, rgba(s.brand.accent, 0.42));
    glow.addColorStop(0.55, rgba(s.brand.accent, 0.1));
    glow.addColorStop(1, rgba(s.brand.accent, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);
    const word = (s.brand.name || '').toUpperCase();
    if (word) {
      ctx.save();
      ctx.globalAlpha = 0.07;
      ctx.fillStyle = isDark(base) ? '#ffffff' : '#000000';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const size = Math.min(W * 0.34, (W * 1.15) / Math.max(1, word.length * 0.62));
      ctx.font = `900 ${Math.round(size)}px ${HEADING}`;
      ctx.fillText(word, W / 2 + m.dx * 0.4, cy);
      ctx.restore();
    }
    // El producto ocupa casi todo el ancho y lo que deja el texto, flotando despacio.
    const bw = W * 0.94, bh = H * (tall ? 0.58 : 0.64);
    const by = (textTop ? H * 0.3 : H * 0.1) + Math.sin(local * 1.3) * H * 0.006;
    ctx.save();
    ctx.translate(m.dx * 0.5, 0);
    drawCutout(ctx, hero, (W - bw) / 2, by, bw, bh, { zoom: m.zoom });
    lastPhoto = { id: sc.id, img: hero, x: (W - bw) / 2 + m.dx * 0.5, y: by, w: bw, h: bh, zoom: m.zoom };
    ctx.restore();
    return;
  }
  // Foto con escena: de fondo desenfocada (si la escena no tiene fondo propio) y en una tarjeta grande encima.
  if (!ownBg) {
    ctx.save();
    ctx.filter = 'blur(48px)';
    ctx.globalAlpha = 0.5;
    coverAt(ctx, img, 0, 0, W, H, 1.35, -m.dx);
    ctx.restore();
    ctx.fillStyle = rgba(base, 0.55);
    ctx.fillRect(0, 0, W, H);
  }
  const cw = Math.min(W * 0.88, (H * 0.66) / 1.15);
  const ch = cw * 1.15;
  const cy = (textTop ? H * 0.6 : H * 0.4) - ch / 2 + Math.sin(local * 1.3) * 8;
  const cx = (W - cw) / 2;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.38)';
  ctx.shadowBlur = 70;
  ctx.shadowOffsetY = 34;
  ctx.fillStyle = '#ffffff';
  rr(ctx, cx, cy, cw, ch, 36);
  ctx.fill();
  ctx.restore();
  ctx.save();
  rr(ctx, cx, cy, cw, ch, 36);
  ctx.clip();
  coverAt(ctx, img, cx, cy, cw, ch, m.zoom, m.dx * 0.5);
  ctx.restore();
}

/** Escena de texto: fondo de la marca con luces suaves y el ícono de marca de agua. */
function textScene(ctx: CanvasRenderingContext2D, s: PieceSpec, sc: Scene, local: number, W: number, H: number, designs: HTMLImageElement[] = []) {
  const b = s.brand;
  const base = bgOf(s, sc);
  const dark = isDark(base);
  // Fondos con estilo (los mismos del diseñador de posts), con un giro lento para que tengan vida.
  if (sc.textBg === 'malla' || sc.textBg === 'rayas' || sc.textBg === 'mosaicoMarca' || sc.textBg === 'mosaicoDisenos') {
    const style = sc.textBg;
    paintBackground(ctx, 0, 0, W, H, {
      style, base, ink: style === 'rayas' ? b.primary : b.accent, accent: style === 'malla' ? b.paper : b.accent,
      density: style === 'malla' ? 0.55 : style === 'rayas' ? 0.08 : style === 'mosaicoMarca' ? 0.12 : 0.2,
      size: style === 'rayas' ? 70 : 150, angle: -18 + local * 3, grain: true,
      logo: (dark ? b.iconOnDark ?? b.icon ?? b.logoOnDark : b.icon ?? b.logo) ?? null, brandName: b.name, designs,
    });
    return;
  }
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, W, H);
  const glowColor = sc.textBg === 'acento' ? b.primary : b.accent;
  const blob = (x: number, y: number, r: number, a: number) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rgba(glowColor, a));
    g.addColorStop(1, rgba(glowColor, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  };
  blob(W * (0.2 + 0.08 * Math.sin(local * 0.7)), H * (0.25 + 0.05 * Math.cos(local * 0.5)), W * 0.75, 0.28);
  blob(W * (0.85 - 0.06 * Math.cos(local * 0.6)), H * (0.8 - 0.04 * Math.sin(local * 0.8)), W * 0.7, 0.22);
  const icon = dark ? b.iconOnDark ?? b.icon : b.icon;
  if (icon && icon.naturalWidth) {
    const ih = Math.min(W, H) * 0.9, iw = (icon.naturalWidth / icon.naturalHeight) * ih;
    ctx.save();
    ctx.globalAlpha = 0.06;
    ctx.translate(W * 0.78, H * 0.82);
    ctx.rotate(-0.18 + local * 0.03);
    ctx.drawImage(icon, -iw / 2, -ih / 2, iw, ih);
    ctx.restore();
  }
}

/** Fondo propio de la escena (si lo tiene): estilo como en los posts, o una foto. Devuelve si lo pintó. */
function sceneBackground(ctx: CanvasRenderingContext2D, s: PieceSpec, scenes: Scene[], sc: Scene, local: number, a: SceneAssets, W: number, H: number): boolean {
  const g = sc.bg;
  if (!g) return false;
  const b = s.brand;
  if (g.style === 'foto') {
    ctx.fillStyle = g.base;
    ctx.fillRect(0, 0, W, H);
    const img = g.image ? a.images[g.image] ?? null : null;
    if (img && img.naturalWidth) {
      const p = local / clampSeconds(sc.seconds);
      coverAt(ctx, img, 0, 0, W, H, g.move ? 1.03 + 0.07 * p : 1, 0);
    }
    if (g.dim > 0) { ctx.fillStyle = `rgba(0,0,0,${g.dim})`; ctx.fillRect(0, 0, W, H); }
    return true;
  }
  const dark = isDark(g.base);
  const designs = g.style === 'mosaicoDisenos'
    ? Array.from(new Set(scenes.flatMap((x) => (x.design?.image ? [x.design.image] : [])))).map((u) => a.images[u]).filter((i): i is HTMLImageElement => !!i && i.naturalWidth > 0)
    : [];
  paintBackground(ctx, 0, 0, W, H, {
    style: g.style, base: g.base, ink: g.ink, accent: g.accent, density: g.density, size: g.size,
    angle: g.angle + (g.move ? local * 3 : 0), grain: g.grain,
    logo: (dark ? b.iconOnDark ?? b.icon ?? b.logoOnDark : b.icon ?? b.logo) ?? null, brandName: b.name, designs,
  });
  return true;
}

/** Contenido de una escena (sin los textos) o del cierre (j = scenes.length). */
function drawSceneBody(ctx: CanvasRenderingContext2D, s: PieceSpec, scenes: Scene[], j: number, local: number, a: SceneAssets, W: number, H: number) {
  const sc = scenes[j];
  if (!sc) { endCard(ctx, s, W, H, local / END_SECONDS); return; }
  if (sc.kind === 'foto') {
    // Foto de producto, o la foto de una plantilla personalizable con el diseño montado en su zona.
    const img = sc.photoSource === 'plantilla' ? a.mockups[sc.id] ?? null : sc.product?.image ? a.images[sc.product.image] ?? null : null;
    const cutUrl = sc.photoSource !== 'plantilla' && sc.product?.image ? a.cutouts?.[sc.product.image] : null;
    const own = sceneBackground(ctx, s, scenes, sc, local, a, W, H);
    photoScene(ctx, s, sc, local, img, W, H, cutUrl ? a.images[cutUrl] ?? null : null, own);
    return;
  }
  if (sc.kind === 'texto' && sceneBackground(ctx, s, scenes, sc, local, a, W, H)) return;
  if (sc.kind === 'texto') {
    // El mosaico de diseños usa los diseños puestos en las escenas del video.
    const designs = sc.textBg === 'mosaicoDisenos'
      ? Array.from(new Set(scenes.flatMap((x) => (x.design?.image ? [x.design.image] : [])))).map((u) => a.images[u]).filter((i): i is HTMLImageElement => !!i && i.naturalWidth > 0)
      : [];
    textScene(ctx, s, sc, local, W, H, designs);
    return;
  }
  if (!sceneBackground(ctx, s, scenes, sc, local, a, W, H)) {
    ctx.fillStyle = bgOf(s, sc);
    ctx.fillRect(0, 0, W, H);
  }
  if (sc.kind === 'clip') {
    // Clip propio a pantalla completa (el cuadro lo deja listo syncClips), con el movimiento elegido.
    const v = clipVideo(sc.clip?.id);
    if (v && v.readyState >= 2) {
      const m = sc.photoMove === 'quieta' ? { zoom: 1, dx: 0 } : photoMotion(sc, local, W);
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
      coverAt(ctx, v, 0, 0, W, H, m.zoom, m.dx);
      ctx.restore();
    }
    return;
  }
  if (a.slots[j % 2] === j) frameCover(ctx, a.frames[j % 2], W, H);
}

/** Líneas de texto centradas con su animación de entrada (t = segundos desde que empieza). */
function animLines(ctx: CanvasRenderingContext2D, lines: string[], cx: number, y: number, lh: number, anim: Scene['textAnim'], t: number, alpha: number) {
  if (t < 0 || alpha <= 0) return;
  const outer = ctx.globalAlpha;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  let shown = Infinity;
  if (anim === 'escribir') shown = Math.floor(t * 24);
  let used = 0;
  lines.forEach((line, li) => {
    const lw = ctx.measureText(line).width;
    const x0 = cx - lw / 2;
    const ly = y + li * lh;
    const lt = t - li * 0.12;
    switch (anim) {
      case 'escribir': {
        const n = Math.max(0, Math.min(line.length, shown - used));
        used += line.length;
        if (!n) return;
        ctx.globalAlpha = outer * alpha;
        ctx.fillText(line.slice(0, n), x0, ly);
        if (n < line.length || (li === lines.length - 1 && Math.floor(t * 2.4) % 2 === 0 && t < line.length / 24 + 1.2)) {
          const cw = ctx.measureText(line.slice(0, n)).width;
          ctx.fillRect(x0 + cw + 6, ly + lh * 0.08, Math.max(4, lh * 0.06), lh * 0.78);
        }
        return;
      }
      case 'letras': {
        for (let k = 0; k < line.length; k++) {
          const ak = ease((lt - k * 0.035) * 4);
          if (ak <= 0) break;
          const off = ctx.measureText(line.slice(0, k)).width;
          ctx.globalAlpha = outer * alpha * ak;
          ctx.fillText(line[k], x0 + off, ly + (1 - ak) * lh * 0.45);
        }
        return;
      }
      case 'pop': {
        const k = backOut(lt * 2.6);
        ctx.save();
        ctx.globalAlpha = outer * alpha * clamp01(lt * 5);
        ctx.translate(cx, ly + lh / 2);
        ctx.scale(0.55 + 0.45 * k, 0.55 + 0.45 * k);
        ctx.fillText(line, -lw / 2, -lh / 2);
        ctx.restore();
        return;
      }
      case 'deslizar': {
        const k = ease(lt * 2.4);
        ctx.globalAlpha = outer * alpha * k;
        ctx.fillText(line, x0 - (1 - k) * 160, ly);
        return;
      }
      case 'ninguna':
        ctx.globalAlpha = outer * alpha;
        ctx.fillText(line, x0, ly);
        return;
      default: { // subir
        const k = ease(lt * 2.2);
        ctx.globalAlpha = outer * alpha * k;
        ctx.fillText(line, x0, ly + (1 - k) * 46);
      }
    }
  });
  ctx.globalAlpha = outer;
}

/** Corta un texto en líneas que caben en un ancho. */
function splitLines(ctx: CanvasRenderingContext2D, text: string, maxW: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; } else line = test;
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) { lines.length = maxLines; lines[maxLines - 1] = lines[maxLines - 1].replace(/\s*\S*$/, '…'); }
  return lines;
}

/** Precio de una escena: el de la foto del producto o el "desde" de la prenda 3D. */
function scenePrice(sc: Scene, a: SceneAssets): PieceItem | null {
  if (!sc.showPrice) return null;
  if (sc.kind === 'foto' && sc.photoSource === 'plantilla' && sc.templateId != null && a.templates[sc.templateId]) return { name: '', image: null, price: a.templates[sc.templateId].price };
  if (sc.kind === 'foto' && sc.product?.price != null) return { name: sc.product.name, image: null, price: sc.product.price, listPrice: sc.product.listPrice, discountPercent: sc.product.discountPercent };
  if (sc.kind === '3d' && sc.templateId != null && a.templates[sc.templateId]) return { name: '', image: null, price: a.templates[sc.templateId].price };
  return null;
}

/** Etiqueta, título, subtítulo y precio de una escena, con su animación y en su posición. */
function sceneText(ctx: CanvasRenderingContext2D, s: PieceSpec, sc: Scene, local: number, alpha: number, W: number, H: number, ctaRoom: boolean, price: PieceItem | null) {
  if (alpha <= 0 || (!sc.title && !sc.subtitle && !sc.badge && !price)) return;
  const b = s.brand;
  const dark = isDark(bgOf(s, sc));
  const big = sc.kind === 'texto';
  const maxW = W - 150;
  // Medidas del bloque.
  let tSize = sc.title ? posterSize(ctx, sc.title, maxW, big ? 128 : 88) : 0;
  const maxTitleLines = big ? 3 : 2;
  font(ctx, 800, tSize || 10, 'heading');
  // El título completo, achicando la letra hasta que quepa en sus líneas (sin cortarlo).
  while (sc.title && tSize > 48 && splitLines(ctx, up(sc.title), maxW, 99).length > maxTitleLines) {
    tSize -= 6;
    font(ctx, 800, tSize, 'heading');
  }
  const tLines = sc.title ? splitLines(ctx, up(sc.title), maxW, maxTitleLines) : [];
  const tLh = tSize * 1.02;
  font(ctx, 500, big ? 44 : 38);
  const sLines = sc.subtitle ? splitLines(ctx, sc.subtitle, W - 200, 2) : [];
  const sLh = big ? 54 : 48;
  const badgeH = sc.badge ? 64 + 22 : 0;
  const priceH = price ? (price.listPrice && price.price != null && price.listPrice > price.price ? 92 : 78) : 0;
  const blockH = badgeH + tLines.length * tLh + (sLines.length ? 14 + sLines.length * sLh : 0) + (priceH ? 18 + priceH : 0);
  const logoRoom = 190;
  let y = sc.textPos === 'arriba' ? logoRoom + 20 : sc.textPos === 'centro' ? (H - blockH) / 2 : (ctaRoom ? H - 196 : H - 110) - blockH;
  y = Math.max(logoRoom, y);
  const fg = dark ? '#ffffff' : b.primary;
  ctx.save();
  ctx.globalAlpha = alpha;
  // Etiqueta.
  if (sc.badge) {
    const k = backOut(local * 2.8);
    ctx.save();
    ctx.globalAlpha = alpha * clamp01(local * 5);
    ctx.translate(W / 2, y + 32);
    ctx.scale(0.6 + 0.4 * k, 0.6 + 0.4 * k);
    pill(ctx, up(sc.badge), 0, -32, 32, dark ? b.accent : b.primary, dark ? b.primary : '#ffffff', 'center');
    ctx.restore();
    y += badgeH;
  }
  // Título.
  if (tLines.length) {
    font(ctx, 800, tSize, 'heading');
    ctx.fillStyle = fg;
    animLines(ctx, tLines, W / 2, y, tLh, sc.textAnim, local - (sc.badge ? 0.15 : 0), 1);
    y += tLines.length * tLh;
  }
  const typed = sc.textAnim === 'escribir' ? tLines.join('').length / 24 : 0;
  // Subtítulo.
  if (sLines.length) {
    y += 14;
    font(ctx, 500, big ? 44 : 38);
    ctx.fillStyle = dark ? 'rgba(255,255,255,0.82)' : '#4b4b4b';
    animLines(ctx, sLines, W / 2, y, sLh, sc.textAnim === 'letras' || sc.textAnim === 'escribir' ? 'subir' : sc.textAnim, local - 0.25 - typed, 1);
    y += sLines.length * sLh;
  }
  // Precio.
  if (price && price.price != null) {
    y += 18;
    const k = ease((local - 0.4 - typed) * 2.5);
    ctx.globalAlpha = alpha * k;
    const strike = price.listPrice && price.listPrice > price.price;
    if (sc.kind === '3d') {
      font(ctx, 700, 46);
      ctx.fillStyle = dark ? b.accent : b.primary;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText('desde ' + money(price.price), W / 2, y + (1 - k) * 20);
    } else {
      font(ctx, 800, 70);
      let w = ctx.measureText(money(price.price)).width;
      if (strike) { font(ctx, 500, 42); w += ctx.measureText(money(price.listPrice!)).width + 25; }
      priceRow(ctx, price, (W - w) / 2, y + (1 - k) * 20, 70, dark ? b.accent : b.primary, dark ? 'rgba(255,255,255,0.6)' : '#888');
    }
  }
  ctx.restore();
  ctx.textAlign = 'left';
}

/** Velos arriba y abajo (sobre el 3D y las fotos) para que se lean el logo y los textos. */
function veils(ctx: CanvasRenderingContext2D, base: string, W: number, H: number, amount: number) {
  if (amount <= 0) return;
  ctx.save();
  ctx.globalAlpha = amount;
  const topG = ctx.createLinearGradient(0, 0, 0, 280);
  topG.addColorStop(0, rgba(base, 0.85));
  topG.addColorStop(1, rgba(base, 0));
  ctx.fillStyle = topG;
  ctx.fillRect(0, 0, W, 280);
  const h = Math.min(620, H * 0.42);
  const botG = ctx.createLinearGradient(0, H - h, 0, H);
  botG.addColorStop(0, rgba(base, 0));
  botG.addColorStop(0.45, rgba(base, 0.8));
  botG.addColorStop(1, rgba(base, 0.95));
  ctx.fillStyle = botG;
  ctx.fillRect(0, H - h, W, h);
  ctx.restore();
}

const veilOf = (sc: Scene | undefined) => (!sc ? 0 : sc.kind === 'texto' ? 0 : sc.kind === 'foto' && sc.photoFit === 'tarjeta' ? 0.35 : 1);

/**
 * Cuadro del video por escenas en el segundo `time`. Cada escena se pinta en su capa (la 3D con el
 * cuadro de su maniquí, la foto con su movimiento, el texto sobre la marca) y la transición mezcla
 * las dos capas. Encima van los velos, el logo, los textos de cada escena (el que sale se va antes de
 * que entre el nuevo), el botón y, al final, el cierre con el logo.
 */
export function drawScenes(ctx: CanvasRenderingContext2D, s: PieceSpec, scenes: Scene[], opts: VideoOptions, a: SceneAssets, time: number) {
  setBrandFonts(s.brand);
  const W = ctx.canvas.width, H = ctx.canvas.height;
  const b = s.brand;
  const n = scenes.length;
  ctx.fillStyle = bgOf(s, scenes[0] ?? null);
  ctx.fillRect(0, 0, W, H);
  if (!n) return;
  const f = frameAt(scenes, opts.endCard, time);
  const { starts, body } = layout(scenes, opts.endCard);
  const startOf = (j: number) => (j === n ? body : starts[j]);
  const tr = f.transition;
  const p = tr ? clamp01(tr.p) : 0;
  const style = { accent: b.accent, primary: b.primary, base: b.primary, dark: s.stage === 'oscuro' };

  // 1. Escenas (con la transición si hay).
  if (!tr) {
    drawSceneBody(ctx, s, scenes, f.index, f.local, a, W, H);
  } else {
    a.layers.forEach((l) => { if (l.width !== W || l.height !== H) { l.width = W; l.height = H; } });
    const [la, lb] = a.layers;
    const ca = la.getContext('2d')!, cb = lb.getContext('2d')!;
    drawSceneBody(ca, s, scenes, tr.from, time - startOf(tr.from), a, W, H);
    drawSceneBody(cb, s, scenes, tr.to, time - startOf(tr.to), a, W, H);
    composite(ctx, la, lb, tr.kind, p, style);
  }

  // 2. Velos, logo y textos (no en el cierre, que trae los suyos).
  const shown = tr ? (p < 0.5 ? tr.from : tr.to) : f.index;
  const endWeight = tr ? (tr.to === n ? p : tr.from === n ? 1 - p : 0) : f.index === n ? 1 : 0;
  const veilAmount = tr ? veilOf(scenes[tr.from]) * (1 - p) + veilOf(scenes[tr.to]) * p : veilOf(scenes[f.index]);
  // El velo toma el color del fondo de la escena (el del escenario o el propio), así los textos contrastan.
  const stageBase = scenes[shown] ? bgOf(s, scenes[shown]) : s.stage === 'oscuro' ? b.primary : b.paper;
  veils(ctx, stageBase, W, H, veilAmount);
  if (opts.logo && endWeight < 1) {
    ctx.save();
    ctx.globalAlpha = 1 - endWeight;
    logo(ctx, b, isDark(bgOf(s, scenes[Math.min(shown, n - 1)])), W / 2, 80, 60, 'center');
    ctx.restore();
  }
  const last = n - 1;
  const ctaRoom = !opts.endCard && !!s.cta;
  if (tr) {
    if (tr.from < n) sceneText(ctx, s, scenes[tr.from], time - starts[tr.from], Math.max(0, 1 - p * 2), W, H, ctaRoom && tr.from === last, scenePrice(scenes[tr.from], a));
    if (tr.to < n) sceneText(ctx, s, scenes[tr.to], Math.max(0, time - starts[tr.to]), Math.max(0, p * 2 - 1), W, H, ctaRoom && tr.to === last, scenePrice(scenes[tr.to], a));
  } else if (f.index < n) {
    sceneText(ctx, s, scenes[f.index], f.local, 1, W, H, ctaRoom && f.index === last, scenePrice(scenes[f.index], a));
  }
  if (ctaRoom && f.index === last) {
    const dark = isDark(bgOf(s, scenes[last]));
    ctx.globalAlpha = tr ? clamp01(p * 2 - 1) : ease(f.local * 2);
    pill(ctx, s.cta, W / 2, H - 150, 36, dark ? b.accent : b.primary, dark ? b.primary : '#ffffff', 'center');
    ctx.globalAlpha = 1;
  }

  // 3. Velos de transición que tapan todo (escena, logo y textos).
  if (tr && (tr.kind === 'destello' || tr.kind === 'cortina')) {
    drawCover(ctx, tr.kind, p, style, style.dark ? b.icon : b.iconOnDark ?? b.icon);
  }
}
