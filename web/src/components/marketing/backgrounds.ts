/**
 * Fondos de las piezas (posts y videos): color, degradado, malla de color (manchas suaves), rayas,
 * mosaico de la marca (su ícono o logo repetido y girado) y mosaico de diseños (los diseños de las
 * prendas personalizadas repetidos). Opcional: textura de grano encima, para un acabado editorial.
 * Lo usan el diseñador por capas (capa "pattern") y las pantallas de texto del video.
 */
import { printable } from './mockup';

export type BgStyle = 'color' | 'degradado' | 'malla' | 'rayas' | 'mosaicoMarca' | 'mosaicoDisenos';

export const BG_STYLES: { value: BgStyle; label: string; hint: string }[] = [
  { value: 'color', label: 'Color', hint: 'Un color liso de la marca' },
  { value: 'degradado', label: 'Degradado', hint: 'De un color a otro en diagonal' },
  { value: 'malla', label: 'Malla de color', hint: 'Manchas suaves de color difuminadas' },
  { value: 'rayas', label: 'Rayas', hint: 'Rayas diagonales finas' },
  { value: 'mosaicoMarca', label: 'Mosaico de la marca', hint: 'El logo de la marca repetido' },
  { value: 'mosaicoDisenos', label: 'Mosaico de diseños', hint: 'Los diseños de tus prendas repetidos' },
];

type Src = HTMLImageElement | HTMLCanvasElement;

export interface BgSpec {
  style: BgStyle;
  /** Color de fondo y color de la tinta (rayas, degradado, mosaico sin logo). */
  base: string;
  ink: string;
  /** Tercer color para la malla. */
  accent: string;
  /** Cuánto se nota el dibujo (0..1). */
  density: number;
  /** Tamaño de cada pieza del mosaico o separación de las rayas (px del lienzo). */
  size: number;
  /** Giro del mosaico o de las rayas (grados). */
  angle: number;
  grain: boolean;
  /** Logo para el mosaico de la marca (la versión que contrasta con el fondo). */
  logo: Src | null;
  /** Nombre de la marca (si no hay logo). */
  brandName: string;
  /** Diseños para el mosaico de diseños. */
  designs: Src[];
}

const dimsOf = (s: Src) => (s instanceof HTMLImageElement ? [s.naturalWidth, s.naturalHeight] : [s.width, s.height]);

/** ¿El color es oscuro? */
export function darkColor(hex: string) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6), 16);
  if (!Number.isFinite(n)) return true;
  return 0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255) < 140;
}

function rgba(hex: string, a: number) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.max(0, Math.min(1, a))})`;
}

let grainTile: HTMLCanvasElement | null = null;
/** Textura de grano (ruido fino), una sola vez. */
function grain(): HTMLCanvasElement {
  if (grainTile) return grainTile;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d')!;
  const d = x.createImageData(256, 256);
  let s = 12345;
  for (let i = 0; i < d.data.length; i += 4) {
    s = (s * 16807) % 2147483647;
    const v = (s / 2147483647) * 255;
    d.data[i] = d.data[i + 1] = d.data[i + 2] = v;
    d.data[i + 3] = 255;
  }
  x.putImageData(d, 0, 0);
  grainTile = c;
  return c;
}

/** Repite piezas (logo o diseños) en filas alternadas, girado, cubriendo el rectángulo. */
function tile(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, size: number, angle: number, draw: (i: number, cx: number, cy: number, s: number) => void) {
  const step = Math.max(40, size * 1.6);
  const R = Math.hypot(w, h) / 2 + step;
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate((angle * Math.PI) / 180);
  let i = 0;
  for (let row = -Math.ceil(R / step); row <= Math.ceil(R / step); row++) {
    const off = row % 2 ? step / 2 : 0;
    for (let col = -Math.ceil(R / step) - 1; col <= Math.ceil(R / step); col++) {
      draw(i++, col * step + off, row * step, size);
    }
  }
  ctx.restore();
}

/** Pinta el fondo en el rectángulo. */
export function paintBackground(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, s: BgSpec) {
  ctx.save();
  ctx.fillStyle = s.base;
  ctx.fillRect(x, y, w, h);
  const k = Math.max(0, Math.min(1, s.density));
  switch (s.style) {
    case 'degradado': {
      const a = (s.angle * Math.PI) / 180;
      const cx = x + w / 2, cy = y + h / 2, r = Math.hypot(w, h) / 2;
      const g = ctx.createLinearGradient(cx - Math.cos(a) * r, cy - Math.sin(a) * r, cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      g.addColorStop(0, s.base);
      g.addColorStop(1, rgba(s.ink, 0.35 + 0.65 * k));
      ctx.fillStyle = g;
      ctx.fillRect(x, y, w, h);
      break;
    }
    case 'malla': {
      // Manchas grandes y suaves de los colores de la marca.
      const blobs: [number, number, number, string][] = [
        [0.12, 0.18, 0.75, s.accent], [0.9, 0.25, 0.65, s.ink], [0.25, 0.9, 0.7, s.ink], [0.85, 0.85, 0.6, s.accent], [0.5, 0.5, 0.45, s.base],
      ];
      for (const [bx, by, br, col] of blobs) {
        const cx = x + bx * w, cy = y + by * h, rr = br * Math.max(w, h);
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rr);
        g.addColorStop(0, rgba(col, 0.25 + 0.6 * k));
        g.addColorStop(1, rgba(col, 0));
        ctx.fillStyle = g;
        ctx.fillRect(x, y, w, h);
      }
      break;
    }
    case 'rayas': {
      ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
      ctx.translate(x + w / 2, y + h / 2);
      ctx.rotate((s.angle * Math.PI) / 180);
      const R = Math.hypot(w, h);
      const gap = Math.max(10, s.size * 0.5);
      ctx.fillStyle = rgba(s.ink, 0.08 + 0.5 * k);
      for (let i = -R; i < R; i += gap) ctx.fillRect(i, -R, gap * 0.35, R * 2);
      break;
    }
    case 'mosaicoMarca': {
      ctx.globalAlpha = 0.06 + 0.5 * k;
      tile(ctx, x, y, w, h, s.size, s.angle, (_i, cx, cy, size) => {
        if (s.logo) {
          const [lw, lh] = dimsOf(s.logo);
          if (!lw || !lh) return;
          const f = Math.min(size / lw, size / lh);
          ctx.drawImage(s.logo, cx - (lw * f) / 2, cy - (lh * f) / 2, lw * f, lh * f);
        } else {
          ctx.fillStyle = s.ink;
          ctx.font = `800 ${size * 0.32}px Inter, system-ui, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(s.brandName.toUpperCase(), cx, cy);
        }
      });
      break;
    }
    case 'mosaicoDisenos': {
      const list = s.designs.map(printable).filter((d) => dimsOf(d)[0] > 0);
      // Sin diseños todavía: el mosaico de la marca, para que el fondo nunca quede vacío.
      if (!list.length) {
        ctx.restore();
        paintBackground(ctx, x, y, w, h, { ...s, style: 'mosaicoMarca', density: Math.min(k, 0.15), grain: false });
        ctx.save();
        break;
      }
      ctx.globalAlpha = 0.12 + 0.75 * k;
      tile(ctx, x, y, w, h, s.size, s.angle, (i, cx, cy, size) => {
        const d = list[(i * 7 + Math.floor(i / 3)) % list.length];
        const [dw, dh] = dimsOf(d);
        const f = Math.min(size / dw, size / dh);
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(((i % 5) - 2) * 0.12);
        ctx.drawImage(d, (-dw * f) / 2, (-dh * f) / 2, dw * f, dh * f);
        ctx.restore();
      });
      break;
    }
    default:
      break;
  }
  ctx.restore();
  if (s.grain) {
    ctx.save();
    ctx.globalAlpha = 0.07;
    ctx.globalCompositeOperation = 'overlay';
    const pat = ctx.createPattern(grain(), 'repeat');
    if (pat) { ctx.fillStyle = pat; ctx.fillRect(x, y, w, h); }
    ctx.restore();
  }
}
