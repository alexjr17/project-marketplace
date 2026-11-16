/**
 * SVG editables en el editor de diseños: se limpian (sin scripts ni eventos), se leen sus colores y se
 * cambian uno por uno sin perder el vector (se dibujan nítidos al tamaño de impresión).
 */

const NAMED: Record<string, string> = {
  black: '#000000', white: '#FFFFFF', red: '#FF0000', green: '#008000', blue: '#0000FF', yellow: '#FFFF00', orange: '#FFA500',
  purple: '#800080', pink: '#FFC0CB', gray: '#808080', grey: '#808080', brown: '#A52A2A', gold: '#FFD700', silver: '#C0C0C0',
  navy: '#000080', maroon: '#800000', olive: '#808000', teal: '#008080', lime: '#00FF00', aqua: '#00FFFF', fuchsia: '#FF00FF',
};

/** Color de CSS → #RRGGBB (o null si no es un color sólido que se pueda cambiar). */
export function toHex(raw: string): string | null {
  const c = raw.trim().toLowerCase();
  if (NAMED[c]) return NAMED[c];
  let m = c.match(/^#([0-9a-f]{3})$/);
  if (m) return ('#' + m[1].split('').map((x) => x + x).join('')).toUpperCase();
  m = c.match(/^#([0-9a-f]{6})([0-9a-f]{2})?$/);
  if (m) return ('#' + m[1]).toUpperCase();
  m = c.match(/^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/);
  if (m) return '#' + [m[1], m[2], m[3]].map((v) => Math.min(255, Number(v)).toString(16).padStart(2, '0')).join('').toUpperCase();
  return null;
}

/** Quita lo que no es dibujo: scripts, eventos (on…), enlaces javascript: y contenido HTML incrustado. */
export function sanitizeSvg(src: string): string {
  return src
    .replace(/<\?xml[^>]*>/gi, '')
    .replace(/<!DOCTYPE[^>]*>/gi, '')
    .replace(/<script[\s\S]*?<\/script\s*>/gi, '')
    .replace(/<script[^>]*\/>/gi, '')
    .replace(/<foreignObject[\s\S]*?<\/foreignObject\s*>/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|xlink:href)\s*=\s*("|')\s*javascript:[^"']*\2/gi, '$1="#"')
    .trim();
}

/** ¿Es un SVG? */
export const isSvg = (src: string) => /<svg[\s>]/i.test(src);

// Colores en atributos (fill="…", stroke="…", stop-color="…") y en estilos (fill:…;).
const ATTR = /\b(fill|stroke|stop-color|color)\s*=\s*("([^"]*)"|'([^']*)')/gi;
const STYLE = /\b(fill|stroke|stop-color|color)\s*:\s*([^;"'}]+)/gi;

/** Colores sólidos que usa el SVG (en el orden en que aparecen, sin repetir). */
export function svgColors(src: string): string[] {
  const out: string[] = [];
  const add = (v: string) => { const h = toHex(v); if (h && !out.includes(h)) out.push(h); };
  for (const m of src.matchAll(ATTR)) add(m[3] ?? m[4] ?? '');
  for (const m of src.matchAll(STYLE)) add(m[2]);
  // Sin colores puestos, el SVG se pinta de negro: ese es su color.
  if (!out.length) out.push('#000000');
  return out;
}

/** El SVG con cada color cambiado según el mapa (#original → #nuevo). */
export function recolorSvg(src: string, map: Record<string, string>): string {
  const pick = (v: string) => { const h = toHex(v); return h && map[h] && map[h] !== h ? map[h] : null; };
  let out = src
    .replace(ATTR, (all, prop: string, _q: string, a?: string, b?: string) => { const n = pick(a ?? b ?? ''); return n ? `${prop}="${n}"` : all; })
    .replace(STYLE, (all, prop: string, v: string) => { const n = pick(v); return n ? `${prop}:${n}` : all; });
  // El negro "por defecto" (sin fill): se le pone el color al SVG completo.
  if (map['#000000'] && map['#000000'] !== '#000000' && !/\bfill\s*[=:]/i.test(src)) {
    out = out.replace(/<svg\b/i, `<svg fill="${map['#000000']}"`);
  }
  return out;
}

/** Tamaño natural del SVG (width/height o viewBox). */
export function svgSize(src: string): { w: number; h: number } {
  const tag = src.match(/<svg\b[^>]*>/i)?.[0] ?? '';
  const num = (n: string) => Number((tag.match(new RegExp(`\\b${n}\\s*=\\s*["']?([\\d.]+)`)) ?? [])[1]) || 0;
  const vb = tag.match(/viewBox\s*=\s*["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/i);
  const w = num('width') || Number(vb?.[1]) || 512, h = num('height') || Number(vb?.[2]) || 512;
  return { w, h };
}

/** El SVG como imagen (data URL) para dibujarlo. Asegura width/height para que se dibuje a escala. */
export function svgUrl(src: string): string {
  const { w, h } = svgSize(src);
  let s = src;
  if (!/<svg\b[^>]*\bwidth\s*=/i.test(s)) s = s.replace(/<svg\b/i, `<svg width="${w}"`);
  if (!/<svg\b[^>]*\bheight\s*=/i.test(s)) s = s.replace(/<svg\b/i, `<svg height="${h}"`);
  if (!/xmlns\s*=/.test(s)) s = s.replace(/<svg\b/i, '<svg xmlns="http://www.w3.org/2000/svg"');
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
}
