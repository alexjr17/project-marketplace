/**
 * Camisetas 3D de la portada, puestas en un maniquí de medio cuerpo (cabeza sin facciones).
 *
 * Cómo se hicieron (todo con IA, por API):
 *  1. Foto de estudio de cada camiseta en el maniquí con FLUX.1-schnell (licencia Apache 2.0).
 *  2. Modelo 3D a partir de esa foto con Hunyuan3D 2.1 (Tencent, licencia Tencent Hunyuan Community).
 *  3. Simplificado a ~40 mil caras con gltf-transform.
 *  4. Máscara (PNG) sacada de la misma foto: blanco = tela de la camiseta, negro = maniquí. Con ella
 *     la página tiñe solo la camiseta del color elegido; el maniquí queda en carbón.
 *
 * Para cambiarlas por las del proveedor: generar el .glb y la máscara con una foto de su camiseta
 * en maniquí y reemplazar los archivos de public/models.
 */
export type Fit = 'basica' | 'oversize';

/** Zonas de estampado. Las mangas se nombran desde quien lleva puesta la camiseta. */
export type Zone = 'front' | 'back' | 'rightSleeve' | 'leftSleeve';
export const ZONES: { id: Zone; label: string }[] = [
  { id: 'front', label: 'Frente' },
  { id: 'back', label: 'Espalda' },
  { id: 'rightSleeve', label: 'Manga der.' },
  { id: 'leftSleeve', label: 'Manga izq.' },
];

export interface FitModel {
  label: string;
  /** Modelo 3D (.glb). */
  model: string;
  /** Máscara alineada con la vista de frente del modelo (blanco = camiseta). */
  mask: string;
  /** Foto fija mientras carga el 3D. */
  poster: string;
  /** Por encima de esta altura (fracción del alto, 0 = abajo) todo es maniquí: cabeza y cuello. */
  headFrom: number;
  /** Debajo de esta altura todo es tela. */
  bodyTop: number;
  /** Escote: altura del borde del cuello adelante y atrás (fracciones del alto). */
  collarFront: number;
  collarBack: number;
  /** Altura del ruedo: por debajo, lo que es maniquí (piernas o palo) se quita y va la base común. */
  hem: number;
  /** Corte recto: todo lo que quede por debajo se quita (piernas que asoman bajo el ruedo). 0 = sin corte. */
  cut: number;
  /** Zona de estampado del pecho (y de la espalda): centro y tamaño en fracciones del alto del modelo. */
  print: { centerY: number; w: number; h: number };
  /** Estampado de manga: altura del centro y lado del cuadrado, en fracciones del alto. */
  sleeve: { centerY: number; size: number };
}

export const FITS: Record<Fit, FitModel> = {
  basica: {
    label: 'Básica',
    model: '/models/camiseta-basica.glb',
    mask: '/models/camiseta-basica-mascara.png',
    poster: '/models/camiseta-basica.png',
    headFrom: 0.767,
    bodyTop: 0.681,
    collarFront: 0.75,
    collarBack: 0.775,
    hem: 0.143,
    cut: 0,
    print: { centerY: 0.585, w: 0.2, h: 0.24 },
    sleeve: { centerY: 0.655, size: 0.07 },
  },
  oversize: {
    label: 'Oversize',
    model: '/models/camiseta-oversize.glb',
    mask: '/models/camiseta-oversize-mascara.png',
    poster: '/models/camiseta-oversize.png',
    headFrom: 0.771,
    bodyTop: 0.685,
    collarFront: 0.739,
    collarBack: 0.769,
    hem: 0.107,
    cut: 0.112,
    print: { centerY: 0.575, w: 0.23, h: 0.27 },
    sleeve: { centerY: 0.585, size: 0.08 },
  },
};

/**
 * Posición del diseño dentro de su zona: `x` y `y` van de -1 a 1 (borde a borde del espacio libre)
 * y `scale` es el tamaño respecto al máximo de la zona. Así el diseño nunca sale de la zona.
 */
export interface PrintLayout { x: number; y: number; scale: number }
// Arranca al 70 % de la zona: hay espacio para moverlo y se puede agrandar hasta el 100 %.
export const DEFAULT_LAYOUT: PrintLayout = { x: 0, y: -1, scale: 0.7 };
export const LAYOUT_LIMITS = { minScale: 0.3, maxScale: 1, step: 0.25, scaleStep: 0.1 };

/**
 * Ancho de la zona en pantalla, como fracción del ancho del recuadro 3D (alto del maniquí 2.4 y
 * cámara que muestra ~2.71 de alto). Se usa para que el arrastre siga al cursor 1:1.
 */
export function zoneScreenFraction(fit: Fit, zone: Zone): number {
  const cfg = FITS[fit];
  const w = zone === 'front' || zone === 'back' ? cfg.print.w : cfg.sleeve.size;
  return (w * 2.4) / 2.71;
}

/** Mueve o escala dentro de los límites de la zona. */
export function nudgeLayout(l: PrintLayout, move: { dx?: number; dy?: number; ds?: number }): PrintLayout {
  const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
  return {
    x: clamp(l.x + (move.dx ?? 0), -1, 1),
    y: clamp(l.y + (move.dy ?? 0), -1, 1),
    scale: clamp(Math.round((l.scale + (move.ds ?? 0)) * 100) / 100, LAYOUT_LIMITS.minScale, LAYOUT_LIMITS.maxScale),
  };
}

/** Color del maniquí (grafito de la marca): contrasta con camisetas claras y oscuras. */
export const MANNEQUIN_COLOR = '#6E6C6D';
