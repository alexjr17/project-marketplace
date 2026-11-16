/**
 * Texto artístico para estampar: el texto con su fuente, color, contorno, sombra y forma (recto, arco,
 * puente, círculo u onda), dibujado como imagen (PNG transparente) del tamaño que se pida. Lo usan el
 * personalizador de la tienda (texto del cliente), los diseños con nombre editable y el estudio.
 *
 * Es para estampar en DTF: colores sólidos y contorno, sin sombras ni difuminados (no imprimen bien).
 *
 * El acomodo de las letras es puro (recibe cómo medir cada letra), así se prueba sin navegador.
 */

export type TextShape = 'recto' | 'arco' | 'puente' | 'circulo' | 'onda';

export interface TextSpec {
  text: string;
  /** Familia (de TEXT_FONTS). */
  font: string;
  weight: number;
  italic: boolean;
  color: string;
  /** Solo para el texto recto de varias líneas. */
  align: 'left' | 'center' | 'right';
  upper: boolean;
  /** Espacio entre letras, en % del tamaño de la letra (-10..60). */
  spacing: number;
  /** Alto de línea (texto recto de varias líneas). */
  lineHeight: number;
  shape: TextShape;
  /** Cuánto se curva (arco, puente y onda): 0..100. */
  curve: number;
  /** Contorno: grosor en % del tamaño de la letra (0 = sin contorno). */
  outline: { color: string; width: number } | null;
}

export const DEFAULT_TEXT: TextSpec = {
  text: 'Tu texto',
  font: 'Anton',
  weight: 400,
  italic: false,
  color: '#111111',
  align: 'center',
  upper: false,
  spacing: 2,
  lineHeight: 1.05,
  shape: 'recto',
  curve: 45,
  outline: null,
};

/** Estilos listos para empezar (se pueden ajustar después). */
export const TEXT_STYLES: { label: string; spec: Partial<TextSpec> }[] = [
  { label: 'Clásico', spec: { font: 'Anton', weight: 400, italic: false, upper: true, shape: 'recto', spacing: 4, outline: null } },
  { label: 'Universitario', spec: { font: 'Graduate', upper: true, shape: 'arco', curve: 40, spacing: 6, outline: { color: '#FFFFFF', width: 7 } } },
  { label: 'Firma', spec: { font: 'Great Vibes', upper: false, shape: 'recto', spacing: 0, outline: null } },
  { label: 'Navidad', spec: { font: 'Mountains of Christmas', weight: 700, upper: false, color: '#C62828', shape: 'arco', curve: 30, spacing: 2, outline: { color: '#FFFFFF', width: 6 } } },
  { label: 'Retro', spec: { font: 'Bangers', upper: true, color: '#F9A825', shape: 'arco', curve: 25, spacing: 4, outline: { color: '#C62828', width: 8 } } },
  { label: 'Divertido', spec: { font: 'Luckiest Guy', upper: true, color: '#F9A825', shape: 'onda', curve: 45, spacing: 3, outline: { color: '#111111', width: 8 } } },
];

export interface TextFont {
  family: string;
  /** Pesos que existen en Google Fonts (el primero es el normal). */
  weights: number[];
  italic?: boolean;
  group: 'Impacto' | 'Elegantes' | 'Manuscritas' | 'Navidad' | 'Divertidas' | 'Deportivas' | 'Clásicas';
}

/** Fuentes elegidas para estampar (se ven bien grandes y en tela). */
export const TEXT_FONTS: TextFont[] = [
  { family: 'Anton', weights: [400], group: 'Impacto' },
  { family: 'Bebas Neue', weights: [400], group: 'Impacto' },
  { family: 'Oswald', weights: [400, 700], group: 'Impacto' },
  { family: 'Archivo Black', weights: [400], group: 'Impacto' },
  { family: 'Montserrat', weights: [500, 800], italic: true, group: 'Clásicas' },
  { family: 'Poppins', weights: [500, 800], italic: true, group: 'Clásicas' },
  { family: 'Playfair Display', weights: [500, 800], italic: true, group: 'Elegantes' },
  { family: 'Cinzel', weights: [500, 800], group: 'Elegantes' },
  { family: 'Abril Fatface', weights: [400], group: 'Elegantes' },
  { family: 'Great Vibes', weights: [400], group: 'Manuscritas' },
  { family: 'Dancing Script', weights: [500, 700], group: 'Manuscritas' },
  { family: 'Pacifico', weights: [400], group: 'Manuscritas' },
  { family: 'Satisfy', weights: [400], group: 'Manuscritas' },
  { family: 'Lobster', weights: [400], group: 'Manuscritas' },
  { family: 'Mountains of Christmas', weights: [400, 700], group: 'Navidad' },
  { family: 'Berkshire Swash', weights: [400], group: 'Navidad' },
  { family: 'Henny Penny', weights: [400], group: 'Navidad' },
  { family: 'Emilys Candy', weights: [400], group: 'Navidad' },
  { family: 'Fredoka', weights: [500, 700], group: 'Divertidas' },
  { family: 'Bangers', weights: [400], group: 'Divertidas' },
  { family: 'Luckiest Guy', weights: [400], group: 'Divertidas' },
  { family: 'Permanent Marker', weights: [400], group: 'Divertidas' },
  { family: 'Graduate', weights: [400], group: 'Deportivas' },
  { family: 'Alfa Slab One', weights: [400], group: 'Deportivas' },
  { family: 'Black Ops One', weights: [400], group: 'Deportivas' },
];

export const TEXT_SHAPES: { value: TextShape; label: string }[] = [
  { value: 'recto', label: 'Recto' }, { value: 'arco', label: 'Arco' }, { value: 'puente', label: 'Puente' },
  { value: 'circulo', label: 'Círculo' }, { value: 'onda', label: 'Onda' },
];

export const fontOf = (family: string): TextFont => TEXT_FONTS.find((f) => f.family === family) ?? TEXT_FONTS[0];

/** Peso más cercano que tiene la fuente. */
export const weightFor = (family: string, wanted: number) => fontOf(family).weights.reduce((a, b) => (Math.abs(b - wanted) < Math.abs(a - wanted) ? b : a));

const requested = new Set<string>();

/** Carga la fuente (todas sus variantes) desde Google Fonts y espera a que esté lista. */
export async function loadTextFont(family: string): Promise<void> {
  const f = fontOf(family);
  if (!requested.has(f.family)) {
    requested.add(f.family);
    const axis = f.italic
      ? `ital,wght@${[0, 1].flatMap((i) => f.weights.map((w) => `${i},${w}`)).join(';')}`
      : `wght@${f.weights.join(';')}`;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(f.family).replace(/%20/g, '+')}:${axis}&display=swap`;
    document.head.appendChild(link);
    await new Promise((r) => { link.onload = r; link.onerror = r; setTimeout(r, 5000); });
  }
  try {
    await Promise.all(f.weights.map((w) => document.fonts.load(`${w} 64px "${f.family}"`)));
  } catch { /* queda la fuente de respaldo */ }
}

/** Carga todas las fuentes del selector (para las muestras). */
export function loadAllTextFonts(): Promise<void> {
  return Promise.all(TEXT_FONTS.map((f) => loadTextFont(f.family))).then(() => undefined);
}

// ─── Acomodo de las letras ───────────────────────────────────────────────────

/** Una letra ya ubicada: su punto en la línea base (centro de la letra), su giro y su ancho. */
export interface Glyph { ch: string; x: number; y: number; rot: number; w: number }
export interface Layout { glyphs: Glyph[]; box: { x: number; y: number; w: number; h: number } }

/** Tamaño base con el que se acomoda (luego se escala al dibujar). */
export const BASE = 100;
/** Alto de la letra sobre la línea base y bajo ella (proporción del tamaño). */
const ASC = 0.8, DESC = 0.24;

/** Ubica cada letra según la forma. `measure` da el ancho de una letra con la fuente a tamaño BASE. */
export function layoutText(spec: Pick<TextSpec, 'text' | 'upper' | 'spacing' | 'lineHeight' | 'align' | 'shape' | 'curve'>, measure: (ch: string) => number): Layout {
  const raw = spec.upper ? spec.text.toLocaleUpperCase('es') : spec.text;
  const gap = (spec.spacing / 100) * BASE;
  const widthOf = (s: string) => [...s].reduce((sum, ch) => sum + measure(ch) + gap, 0) - (s.length ? gap : 0);
  const glyphs: Glyph[] = [];

  if (spec.shape === 'recto') {
    const lines = raw.split('\n');
    const widths = lines.map(widthOf);
    const max = Math.max(1, ...widths);
    const lh = BASE * spec.lineHeight;
    lines.forEach((line, i) => {
      let x = spec.align === 'left' ? 0 : spec.align === 'right' ? max - widths[i] : (max - widths[i]) / 2;
      for (const ch of line) {
        const w = measure(ch);
        glyphs.push({ ch, x: x + w / 2, y: i * lh, rot: 0, w });
        x += w + gap;
      }
    });
  } else {
    // Las formas curvas van en una sola línea.
    const line = raw.replace(/\s*\n\s*/g, ' ');
    const L = Math.max(1, widthOf(line));
    const chars = [...line];
    let t = -L / 2;
    const at = (cb: (mid: number, w: number, ch: string) => void) => {
      for (const ch of chars) {
        const w = measure(ch);
        cb(t + w / 2, w, ch);
        t += w + gap;
      }
    };
    if (spec.shape === 'onda') {
      // Una onda y media a lo largo del texto.
      const amp = (spec.curve / 100) * BASE * 0.55;
      const k = (Math.PI * 3) / L;
      at((m, w, ch) => glyphs.push({ ch, x: m, y: amp * Math.sin(k * m), rot: Math.atan(amp * k * Math.cos(k * m)), w }));
    } else {
      // Arco (por arriba), puente (por abajo) o círculo cerrado.
      const span = spec.shape === 'circulo'
        ? Math.PI * 2 * (L / (L + BASE * 0.6))
        : Math.max(0.05, (spec.curve / 100) * Math.PI * 1.6);
      const R = L / span;
      const top = spec.shape !== 'puente';
      at((m, w, ch) => {
        const a = m / R;
        glyphs.push(top
          ? { ch, x: R * Math.sin(a), y: -R * Math.cos(a), rot: a, w }
          : { ch, x: R * Math.sin(a), y: R * Math.cos(a), rot: -a, w });
      });
    }
  }

  // Caja que ocupa todo (cada letra girada, con su alto).
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const g of glyphs) {
    if (g.ch === ' ') continue;
    const c = Math.cos(g.rot), s = Math.sin(g.rot);
    for (const [px, py] of [[-g.w / 2, -BASE * ASC], [g.w / 2, -BASE * ASC], [-g.w / 2, BASE * DESC], [g.w / 2, BASE * DESC]]) {
      const X = g.x + px * c - py * s, Y = g.y + px * s + py * c;
      x0 = Math.min(x0, X); x1 = Math.max(x1, X); y0 = Math.min(y0, Y); y1 = Math.max(y1, Y);
    }
  }
  if (!Number.isFinite(x0)) return { glyphs, box: { x: 0, y: -BASE * ASC, w: BASE, h: BASE * (ASC + DESC) } };
  return { glyphs, box: { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } };
}

// ─── Dibujo ──────────────────────────────────────────────────────────────────

export const cssFont = (spec: Pick<TextSpec, 'font' | 'weight' | 'italic'>, px: number) =>
  `${spec.italic && fontOf(spec.font).italic ? 'italic ' : ''}${weightFor(spec.font, spec.weight)} ${px}px "${spec.font}", Impact, sans-serif`;

/**
 * Dibuja el texto en un lienzo transparente cuyo lado mayor mide `maxSide` px (sin el margen del
 * contorno y la sombra, que se suma). Devuelve el lienzo (vacío si no hay texto).
 */
/** El texto acomodado con la fuente real, y su caja completa (con contorno) en unidades. */
export function measureText(spec: TextSpec) {
  const probe = document.createElement('canvas').getContext('2d')!;
  probe.font = cssFont(spec, BASE);
  const cache = new Map<string, number>();
  const measure = (ch: string) => {
    if (!cache.has(ch)) cache.set(ch, probe.measureText(ch).width);
    return cache.get(ch)!;
  };
  const { glyphs, box } = layoutText(spec, measure);
  const stroke = spec.outline && spec.outline.width > 0 ? (spec.outline.width / 100) * BASE : 0;
  const pad = stroke + BASE * 0.06;
  return { glyphs, box, stroke, pad, width: box.w + pad * 2, height: box.h + pad * 2 };
}

export function renderText(spec: TextSpec, maxSide: number): HTMLCanvasElement {
  const { glyphs, box, stroke, pad } = measureText(spec);
  const k = maxSide / Math.max(box.w, box.h, 1);
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil((box.w + pad * 2) * k));
  c.height = Math.max(1, Math.ceil((box.h + pad * 2) * k));
  const ctx = c.getContext('2d')!;
  ctx.scale(k, k);
  ctx.translate(pad - box.x, pad - box.y);
  ctx.font = cssFont(spec, BASE);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;
  const each = (draw: (g: Glyph) => void) => {
    for (const g of glyphs) {
      if (g.ch === ' ') continue;
      ctx.save();
      ctx.translate(g.x, g.y);
      ctx.rotate(g.rot);
      draw(g);
      ctx.restore();
    }
  };
  // 1) Contorno, 2) relleno encima: el contorno queda por fuera de la letra.
  if (stroke) {
    ctx.strokeStyle = spec.outline!.color;
    ctx.lineWidth = stroke * 2;
    each((g) => ctx.strokeText(g.ch, 0, 0));
  }
  ctx.fillStyle = spec.color;
  each((g) => ctx.fillText(g.ch, 0, 0));
  return c;
}

/** Texto listo para usar: la imagen (data URL PNG) y sus medidas. */
export async function textImage(spec: TextSpec, maxSide: number): Promise<{ url: string; width: number; height: number; units: number }> {
  await loadTextFont(spec.font);
  const c = renderText(spec, maxSide);
  // Ancho en unidades de letra: para que al cambiar el texto la letra conserve su tamaño.
  return { url: c.toDataURL('image/png'), width: c.width, height: c.height, units: measureText(spec).width };
}

/** Lo que se ve del texto en una línea (para listas): "Sofía · Arco · Pacifico". */
export const textLabel = (spec: Pick<TextSpec, 'text' | 'shape' | 'font'>) =>
  `${spec.text.replace(/\s+/g, ' ').trim() || 'Texto'}`;
