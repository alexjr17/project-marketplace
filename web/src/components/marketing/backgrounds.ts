/**
 * Fondos de las piezas (posts y videos): color, degradado, malla de color (manchas suaves), rayas,
 * mosaico de la marca (su ícono o logo repetido y girado) y mosaico de diseños (los diseños de las
 * prendas personalizadas repetidos). Opcional: textura de grano encima, para un acabado editorial.
 * Lo usan el diseñador por capas (capa "pattern") y las pantallas de texto del video.
 */
import { printable } from './mockup';

export type BgStyle = 'color' | 'degradado' | 'malla' | 'rayas' | 'mosaicoMarca' | 'mosaicoDisenos' | 'nieve' | 'bastones' | 'esferas' | 'copos' | 'luces' | 'pinos' | 'estrellas';

/** Fondos navideños (salen juntos en los selectores). */
export const XMAS_STYLES: BgStyle[] = ['nieve', 'bastones', 'esferas', 'copos', 'luces', 'pinos', 'estrellas'];

/** Colores con los que arranca cada fondo navideño (fondo, dibujo y acento); después se cambian. */
export const XMAS_COLORS: Partial<Record<BgStyle, { base: string; ink: string; accent: string; density: number; size: number; angle: number }>> = {
  nieve: { base: '#7C0F18', ink: '#FFFFFF', accent: '#E3C46B', density: 0.45, size: 150, angle: 0 },
  bastones: { base: '#FFFFFF', ink: '#C62828', accent: '#2E7D32', density: 0.85, size: 120, angle: -35 },
  esferas: { base: '#0F4D32', ink: '#C62828', accent: '#E3C46B', density: 0.75, size: 170, angle: -12 },
  copos: { base: '#0D2A4A', ink: '#FFFFFF', accent: '#9FD3F5', density: 0.4, size: 170, angle: 8 },
  luces: { base: '#0B1F16', ink: '#FF5252', accent: '#FFD54F', density: 0.55, size: 120, angle: 0 },
  pinos: { base: '#F4ECDD', ink: '#1B5E3A', accent: '#E3A93B', density: 0.6, size: 150, angle: 0 },
  estrellas: { base: '#0F1B3D', ink: '#FFFFFF', accent: '#E3C46B', density: 0.55, size: 150, angle: 0 },
};

export const BG_STYLES: { value: BgStyle; label: string; hint: string }[] = [
  { value: 'color', label: 'Color', hint: 'Un color liso de la marca' },
  { value: 'degradado', label: 'Degradado', hint: 'De un color a otro en diagonal' },
  { value: 'malla', label: 'Malla de color', hint: 'Manchas suaves de color difuminadas' },
  { value: 'rayas', label: 'Rayas', hint: 'Rayas diagonales finas' },
  { value: 'mosaicoMarca', label: 'Mosaico de la marca', hint: 'El logo de la marca repetido' },
  { value: 'mosaicoDisenos', label: 'Mosaico de diseños', hint: 'Los diseños de tus prendas repetidos' },
  { value: 'nieve', label: 'Nieve', hint: 'Navidad: copos de nieve cayendo' },
  { value: 'bastones', label: 'Bastón de caramelo', hint: 'Navidad: rayas diagonales de bastón' },
  { value: 'esferas', label: 'Esferas', hint: 'Navidad: esferas de colores con su brillo' },
  { value: 'copos', label: 'Copos grandes', hint: 'Navidad: copos de nieve dibujados en mosaico' },
  { value: 'luces', label: 'Luces', hint: 'Navidad: guirnalda de luces y destellos' },
  { value: 'pinos', label: 'Pinos', hint: 'Navidad: arbolitos de Navidad en mosaico' },
  { value: 'estrellas', label: 'Estrellas', hint: 'Navidad: estrellas doradas y destellos' },
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

/** Copo de nieve de 6 puntas con ramitas. */
function snowflake(ctx: CanvasRenderingContext2D, px: number, py: number, r: number, rot: number) {
  ctx.lineWidth = Math.max(1.5, r * 0.12);
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let a = 0; a < 6; a++) {
    const t = rot + (a * Math.PI) / 3, cx = Math.cos(t), sy = Math.sin(t);
    ctx.moveTo(px, py); ctx.lineTo(px + cx * r, py + sy * r);
    for (const f of [0.55, 0.8]) {
      const bx = px + cx * r * f, by = py + sy * r * f, b = r * (f === 0.55 ? 0.28 : 0.18);
      ctx.moveTo(bx, by); ctx.lineTo(bx + Math.cos(t + 0.7) * b, by + Math.sin(t + 0.7) * b);
      ctx.moveTo(bx, by); ctx.lineTo(bx + Math.cos(t - 0.7) * b, by + Math.sin(t - 0.7) * b);
    }
  }
  ctx.stroke();
}

/** Estrella de 5 puntas. */
function star(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, rot = -Math.PI / 2) {
  ctx.beginPath();
  for (let k = 0; k < 10; k++) {
    const rr = k % 2 ? r * 0.45 : r, a = rot + (k * Math.PI) / 5;
    ctx.lineTo(cx + rr * Math.cos(a), cy + rr * Math.sin(a));
  }
  ctx.closePath();
  ctx.fill();
}

/** Números al azar pero siempre iguales (el fondo no cambia entre cuadros). */
function seeded(seed: number) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
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
    case 'nieve': {
      // Copos de nieve: puntos de varios tamaños (más chicos y tenues al fondo) y algunos copos de 6 puntas.
      ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
      let seed = 7;
      const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
      const n = Math.round((w * h) / 9000 * (0.25 + 1.5 * k));
      const scale = Math.max(0.5, s.size / 150);
      for (let i = 0; i < n; i++) {
        const px = x + rnd() * w, py = y + rnd() * h, depth = rnd();
        const r = (1.5 + depth * depth * 7) * scale;
        ctx.globalAlpha = 0.25 + depth * 0.65;
        ctx.fillStyle = s.ink;
        ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.strokeStyle = s.ink;
      ctx.lineCap = 'round';
      const flakes = Math.round(n / 22);
      for (let i = 0; i < flakes; i++) {
        const px = x + rnd() * w, py = y + rnd() * h, r = (10 + rnd() * 22) * scale, rot = rnd() * Math.PI;
        ctx.globalAlpha = 0.35 + rnd() * 0.45;
        ctx.lineWidth = Math.max(1.5, r * 0.12);
        ctx.beginPath();
        for (let a = 0; a < 6; a++) {
          const t = rot + (a * Math.PI) / 3, cx = Math.cos(t), sy = Math.sin(t);
          ctx.moveTo(px, py); ctx.lineTo(px + cx * r, py + sy * r);
          // Ramitas.
          const bx = px + cx * r * 0.55, by = py + sy * r * 0.55, b = r * 0.28;
          ctx.moveTo(bx, by); ctx.lineTo(bx + Math.cos(t + 0.7) * b, by + Math.sin(t + 0.7) * b);
          ctx.moveTo(bx, by); ctx.lineTo(bx + Math.cos(t - 0.7) * b, by + Math.sin(t - 0.7) * b);
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      break;
    }
    case 'bastones': {
      // Rayas de bastón de caramelo: una ancha y una fina, en diagonal.
      ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
      ctx.translate(x + w / 2, y + h / 2);
      ctx.rotate(((s.angle || -35) * Math.PI) / 180);
      const R = Math.hypot(w, h);
      const step = Math.max(40, s.size * 0.9);
      for (let i = -R; i < R; i += step) {
        ctx.globalAlpha = 0.35 + 0.65 * k;
        ctx.fillStyle = s.ink;
        ctx.fillRect(i, -R, step * 0.38, R * 2);
        ctx.fillStyle = s.accent;
        ctx.fillRect(i + step * 0.55, -R, step * 0.1, R * 2);
      }
      ctx.globalAlpha = 1;
      break;
    }
    case 'esferas': {
      // Esferas en mosaico, de dos colores, con su tapita y su brillo.
      ctx.globalAlpha = 0.3 + 0.7 * k;
      tile(ctx, x, y, w, h, s.size, s.angle, (i, cx, cy, size) => {
        const r = size * 0.32 * (i % 3 === 0 ? 1 : 0.78);
        ctx.fillStyle = i % 2 ? s.ink : s.accent;
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.beginPath(); ctx.ellipse(cx - r * 0.35, cy - r * 0.35, r * 0.28, r * 0.18, -0.6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#C9A227';
        ctx.fillRect(cx - r * 0.2, cy - r - r * 0.22, r * 0.4, r * 0.26);
      });
      break;
    }
    case 'copos': {
      ctx.strokeStyle = s.ink;
      ctx.globalAlpha = 0.18 + 0.7 * k;
      tile(ctx, x, y, w, h, s.size, s.angle, (i, cx, cy, size) => snowflake(ctx, cx, cy, size * (i % 3 === 0 ? 0.42 : 0.28), (i % 5) * 0.2));
      break;
    }
    case 'luces': {
      // Guirnalda: un cable ondulado arriba con focos de colores y destellos suaves por el fondo.
      ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
      const rnd = seeded(11);
      const glowN = Math.round(18 + 40 * k);
      const cols = [s.ink, s.accent, '#FFD54F', '#4FC3F7', '#FF5252'];
      for (let i = 0; i < glowN; i++) {
        const gx = x + rnd() * w, gy = y + rnd() * h, gr = (20 + rnd() * 70) * Math.max(0.5, s.size / 150);
        const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
        g.addColorStop(0, rgba(cols[i % cols.length], 0.45));
        g.addColorStop(1, rgba(cols[i % cols.length], 0));
        ctx.fillStyle = g;
        ctx.fillRect(gx - gr, gy - gr, gr * 2, gr * 2);
      }
      const amp = h * 0.035, y0 = y + h * 0.07, n = Math.max(6, Math.round(w / Math.max(60, s.size)));
      ctx.strokeStyle = 'rgba(20,40,20,0.85)';
      ctx.lineWidth = Math.max(2, w * 0.003);
      ctx.beginPath();
      for (let i = 0; i <= 60; i++) { const t = i / 60; ctx.lineTo(x + t * w, y0 + Math.sin(t * Math.PI * n) * amp); }
      ctx.stroke();
      for (let i = 0; i < n * 2; i++) {
        const t = (i + 0.5) / (n * 2), bx = x + t * w, by = y0 + Math.sin(t * Math.PI * n) * amp;
        const r = Math.max(6, w * 0.012), col = cols[i % cols.length];
        const g = ctx.createRadialGradient(bx, by + r, 0, bx, by + r, r * 4);
        g.addColorStop(0, rgba(col, 0.7)); g.addColorStop(1, rgba(col, 0));
        ctx.fillStyle = g; ctx.fillRect(bx - r * 4, by - r * 3, r * 8, r * 8);
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.ellipse(bx, by + r * 1.2, r * 0.7, r, 0, 0, Math.PI * 2); ctx.fill();
      }
      break;
    }
    case 'pinos': {
      ctx.globalAlpha = 0.25 + 0.7 * k;
      tile(ctx, x, y, w, h, s.size, s.angle, (i, cx, cy, size) => {
        const t = size * (i % 3 === 0 ? 0.5 : 0.38);
        ctx.fillStyle = s.ink;
        for (let lv = 0; lv < 3; lv++) {
          const ty = cy - t * 0.6 + lv * t * 0.42, half = t * (0.28 + lv * 0.16);
          ctx.beginPath(); ctx.moveTo(cx, ty - t * 0.3); ctx.lineTo(cx - half, ty + t * 0.3); ctx.lineTo(cx + half, ty + t * 0.3); ctx.closePath(); ctx.fill();
        }
        ctx.fillRect(cx - t * 0.07, cy + t * 0.55, t * 0.14, t * 0.2);
        ctx.fillStyle = s.accent;
        star(ctx, cx, cy - t * 0.92, t * 0.14);
      });
      break;
    }
    case 'estrellas': {
      ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
      const rnd = seeded(5);
      const n = Math.round((w * h) / 26000 * (0.3 + 1.4 * k));
      const sc = Math.max(0.5, s.size / 150);
      for (let i = 0; i < n; i++) {
        const sx = x + rnd() * w, sy = y + rnd() * h, depth = rnd();
        ctx.globalAlpha = 0.3 + depth * 0.7;
        ctx.fillStyle = i % 4 ? s.accent : s.ink;
        if (i % 3 === 0) star(ctx, sx, sy, (8 + depth * 22) * sc, rnd() * Math.PI);
        else {
          // Destello de 4 puntas.
          const r = (4 + depth * 12) * sc;
          ctx.beginPath(); ctx.moveTo(sx, sy - r); ctx.lineTo(sx + r * 0.25, sy); ctx.lineTo(sx, sy + r); ctx.lineTo(sx - r * 0.25, sy); ctx.closePath(); ctx.fill();
          ctx.beginPath(); ctx.moveTo(sx - r, sy); ctx.lineTo(sx, sy + r * 0.25); ctx.lineTo(sx + r, sy); ctx.lineTo(sx, sy - r * 0.25); ctx.closePath(); ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
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
