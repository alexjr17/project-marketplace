/**
 * Transiciones del video por escenas: mezclan dos cuadros completos (la escena que sale, A, y la que
 * entra, B) en el lienzo según el avance p (0..1). Las de "velo" (destello y cortina) se dibujan
 * aparte, encima de todo, con `drawCover`.
 */
import type { Transition } from './timeline';

type Src = HTMLCanvasElement;

export interface TransitionStyle {
  accent: string;
  primary: string;
  /** Color de fondo de la marca para el fundido de color. */
  base: string;
  dark: boolean;
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const inOut = (x: number) => { const t = clamp01(x); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
const out3 = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);
/** Cuánto pesa el efecto: 0 en los extremos y 1 en el corte. */
const peak = (p: number) => Math.sin(clamp01(p) * Math.PI);

function draw(ctx: CanvasRenderingContext2D, src: Src, x = 0, y = 0, zoom = 1, W = src.width, H = src.height) {
  if (zoom === 1) { ctx.drawImage(src, x, y, W, H); return; }
  const w = W * zoom, h = H * zoom;
  ctx.drawImage(src, x + (W - w) / 2, y + (H - h) / 2, w, h);
}

/** Lienzo auxiliar reutilizado (para el mosaico). */
let scratch: HTMLCanvasElement | null = null;
function tiny(w: number, h: number) {
  if (!scratch) scratch = document.createElement('canvas');
  if (scratch.width !== w || scratch.height !== h) { scratch.width = w; scratch.height = h; }
  return scratch;
}

function blurred(ctx: CanvasRenderingContext2D, src: Src, px: number, alpha = 1, zoom = 1) {
  const W = ctx.canvas.width, H = ctx.canvas.height;
  ctx.save();
  ctx.globalAlpha = alpha;
  if (px > 0.5) ctx.filter = `blur(${px.toFixed(1)}px)`;
  draw(ctx, src, 0, 0, zoom, W, H);
  ctx.restore();
}

/** Números pseudoaleatorios fijos por semilla (el glitch se ve igual al grabar y en la vista previa). */
function rand(seed: number) {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/** Mezcla A → B. Devuelve true si la transición necesita el velo de encima (`drawCover`). */
export function composite(ctx: CanvasRenderingContext2D, A: Src, B: Src, kind: Transition, pRaw: number, st: TransitionStyle): boolean {
  const W = ctx.canvas.width, H = ctx.canvas.height;
  const p = clamp01(pRaw);
  const e = inOut(p);
  switch (kind) {
    case 'corte':
      draw(ctx, p < 0.5 ? A : B, 0, 0, 1, W, H);
      return false;
    case 'color': {
      // Funde al color de la marca y sale de él.
      draw(ctx, p < 0.5 ? A : B, 0, 0, 1, W, H);
      ctx.fillStyle = st.base;
      ctx.globalAlpha = p < 0.5 ? out3(p * 2) : 1 - out3((p - 0.5) * 2);
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
      return false;
    }
    case 'desenfoque':
      blurred(ctx, A, 28 * clamp01(p * 2), 1, 1 + 0.04 * e);
      blurred(ctx, B, 28 * clamp01(2 - p * 2), e, 1.04 - 0.04 * e);
      return false;
    case 'barrido': {
      draw(ctx, A, 0, 0, 1, W, H);
      const x = e * W;
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, x, H); ctx.clip(); draw(ctx, B, 0, 0, 1, W, H); ctx.restore();
      ctx.fillStyle = st.accent;
      ctx.fillRect(x - 12, 0, 24 * peak(p) + 2, H);
      return false;
    }
    case 'empujar': {
      // La nueva empuja a la anterior hacia la izquierda, con una estela de movimiento.
      const x = -e * W;
      const blur = 14 * peak(p);
      ctx.save(); if (blur > 0.5) ctx.filter = `blur(${blur.toFixed(1)}px)`;
      draw(ctx, A, x, 0, 1, W, H);
      draw(ctx, B, x + W, 0, 1, W, H);
      ctx.restore();
      return false;
    }
    case 'deslizar': {
      // La nueva sube por encima; la anterior se aleja y se oscurece.
      draw(ctx, A, 0, 0, 1 - 0.08 * e, W, H);
      ctx.fillStyle = `rgba(0,0,0,${0.45 * e})`;
      ctx.fillRect(0, 0, W, H);
      const y = H * (1 - out3(p));
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.45)';
      ctx.shadowBlur = 60;
      ctx.beginPath(); ctx.roundRect(0, y, W, H + 60, 48 * (1 - out3(p))); ctx.clip();
      draw(ctx, B, 0, y, 1, W, H);
      ctx.restore();
      return false;
    }
    case 'diagonal': {
      draw(ctx, A, 0, 0, 1, W, H);
      // Borde diagonal que cruza de abajo a la izquierda hacia arriba a la derecha.
      const span = W + H * 0.6;
      const edge = -H * 0.6 + e * (span + H * 0.6);
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(0, H); ctx.lineTo(edge + H * 0.6, H); ctx.lineTo(edge, 0); ctx.lineTo(0, 0);
      ctx.closePath(); ctx.clip();
      draw(ctx, B, 0, 0, 1.06 - 0.06 * e, W, H);
      ctx.restore();
      ctx.save();
      ctx.strokeStyle = st.accent;
      ctx.lineWidth = 26 * peak(p);
      ctx.beginPath(); ctx.moveTo(edge, 0); ctx.lineTo(edge + H * 0.6, H); ctx.stroke();
      ctx.restore();
      return false;
    }
    case 'zoom':
      // Atraviesa la escena: la anterior se agranda y se desenfoca; la nueva llega desde más cerca.
      blurred(ctx, B, 16 * (1 - e), 1, 1.25 - 0.25 * out3(p));
      blurred(ctx, A, 16 * e, 1 - e, 1 + 0.6 * e);
      return false;
    case 'remolino': {
      // Paneo rápido: copias corridas a los lados (estela), con el cambio en el centro.
      const src = p < 0.5 ? A : B;
      const k = peak(p);
      const dir = p < 0.5 ? -1 : 1;
      const offset = (p < 0.5 ? out3(p * 2) : 1 - out3((p - 0.5) * 2)) * W * 0.18 * dir;
      draw(ctx, src, offset, 0, 1, W, H);
      ctx.save();
      for (let i = 1; i <= 5; i++) {
        ctx.globalAlpha = 0.16 * k;
        draw(ctx, src, offset + dir * i * W * 0.05 * k, 0, 1, W, H);
        draw(ctx, src, offset - dir * i * W * 0.05 * k, 0, 1, W, H);
      }
      ctx.restore();
      return false;
    }
    case 'circulo': {
      draw(ctx, A, 0, 0, 1 + 0.08 * e, W, H);
      const r = out3(p) * Math.hypot(W, H) * 0.55;
      ctx.save();
      ctx.beginPath(); ctx.arc(W / 2, H * 0.48, Math.max(0.1, r), 0, Math.PI * 2); ctx.clip();
      draw(ctx, B, 0, 0, 1.1 - 0.1 * out3(p), W, H);
      ctx.restore();
      if (p < 0.98) {
        ctx.strokeStyle = st.accent;
        ctx.lineWidth = 18 * peak(p);
        ctx.beginPath(); ctx.arc(W / 2, H * 0.48, Math.max(0.1, r), 0, Math.PI * 2); ctx.stroke();
      }
      return false;
    }
    case 'persiana': {
      draw(ctx, A, 0, 0, 1, W, H);
      const bands = 9;
      const bh = H / bands;
      ctx.save();
      ctx.beginPath();
      for (let i = 0; i < bands; i++) {
        const k = out3(p * 1.7 - i * 0.07);
        if (k > 0) ctx.rect(0, i * bh, W, bh * k + 1);
      }
      ctx.clip();
      draw(ctx, B, 0, 0, 1, W, H);
      ctx.restore();
      return false;
    }
    case 'glitch': {
      const src = p < 0.5 ? A : B;
      const k = peak(p);
      draw(ctx, src, 0, 0, 1, W, H);
      const step = Math.floor(p * 24);
      // Franjas corridas.
      for (let i = 0; i < 9; i++) {
        const r = rand(step * 31 + i);
        if (r > 0.25 + 0.6 * (1 - k)) {
          const y = rand(step * 17 + i * 3) * H;
          const h = 20 + rand(step * 7 + i) * 140 * k;
          const dx = (rand(step * 5 + i * 11) - 0.5) * W * 0.3 * k;
          ctx.drawImage(src, 0, y * (src.height / H), src.width, h * (src.height / H), dx, y, W, h);
        }
      }
      // Separación de color: copias teñidas corridas.
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = 0.35 * k;
      ctx.fillStyle = st.accent;
      for (let i = 0; i < 3; i++) {
        const y = rand(step * 13 + i) * H;
        ctx.fillRect(0, y, W, 6 + rand(step + i) * 30 * k);
      }
      ctx.restore();
      ctx.save();
      ctx.globalAlpha = 0.5 * k;
      ctx.globalCompositeOperation = 'lighter';
      draw(ctx, src, 14 * k, 0, 1, W, H);
      ctx.restore();
      return false;
    }
    case 'mosaico': {
      const src = p < 0.5 ? A : B;
      const k = peak(p);
      const block = Math.max(1, Math.round(4 + k * 70));
      if (block <= 1.5) { draw(ctx, src, 0, 0, 1, W, H); return false; }
      const w = Math.max(2, Math.round(W / block)), h = Math.max(2, Math.round(H / block));
      const c = tiny(w, h);
      const cx = c.getContext('2d')!;
      cx.imageSmoothingEnabled = true;
      cx.clearRect(0, 0, w, h);
      cx.drawImage(src, 0, 0, w, h);
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(c, 0, 0, W, H);
      ctx.restore();
      return false;
    }
    case 'destello':
    case 'cortina':
      draw(ctx, p < 0.5 ? A : B, 0, 0, 1, W, H);
      return true;
    default: // fundido
      draw(ctx, A, 0, 0, 1, W, H);
      ctx.globalAlpha = e;
      draw(ctx, B, 0, 0, 1, W, H);
      ctx.globalAlpha = 1;
      return false;
  }
}

/** Velos que tapan todo (escena, logo y textos): destello y cortina de la marca. */
export function drawCover(ctx: CanvasRenderingContext2D, kind: Transition, pRaw: number, st: TransitionStyle, icon: HTMLImageElement | null | undefined) {
  const W = ctx.canvas.width, H = ctx.canvas.height;
  const p = clamp01(pRaw);
  if (kind === 'destello') {
    const a = Math.pow(1 - Math.abs(p - 0.5) * 2, 1.5);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = st.dark ? st.accent : '#ffffff';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
    return;
  }
  if (kind === 'cortina') {
    // Un panel de la marca sube tapando la escena y sigue subiendo destapando la nueva.
    const top = p < 0.5 ? H * (1 - inOut(p * 2)) : 0;
    const bottom = p < 0.5 ? H : H * (1 - inOut((p - 0.5) * 2));
    ctx.fillStyle = st.dark ? st.accent : st.primary;
    ctx.fillRect(0, top, W, bottom - top);
    // Franja del otro color en el borde que avanza.
    ctx.fillStyle = st.dark ? st.primary : st.accent;
    if (p < 0.5) ctx.fillRect(0, top - 18, W, 18);
    else ctx.fillRect(0, bottom, W, 18);
    if (icon && icon.naturalWidth && bottom - top > 300) {
      const ih = Math.min(200, H * 0.12), iw = (icon.naturalWidth / icon.naturalHeight) * ih;
      ctx.drawImage(icon, W / 2 - iw / 2, (top + bottom) / 2 - ih / 2, iw, ih);
    }
  }
}
