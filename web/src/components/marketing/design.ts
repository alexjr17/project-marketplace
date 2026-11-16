/**
 * Diseñador de piezas fijas (post e historia) por capas: fondo, fotos, formas, textos y logo. Cada
 * plantilla es una lista de capas que después se editan una por una (mover, tamaño, color, fuente...).
 *
 * Los textos y las fotos pueden ir "vinculados" a los datos de la pieza (título, subtítulo, botón,
 * precio, código, foto del producto 1, 2...): si cambia lo que se promociona o la IA reescribe los
 * textos, el diseño se actualiza solo. Si el usuario escribe encima, la capa se desvincula.
 *
 * Medidas en píxeles del lienzo (1080 de ancho). Sin React: se puede probar aparte.
 */
import type { SceneDesign } from './timeline';
import type { BgStyle } from './backgrounds';

export type DesignRatio = '1:1' | '4:5' | '9:16';
export const DESIGN_RATIOS: { value: DesignRatio; label: string; hint: string }[] = [
  { value: '1:1', label: '1:1', hint: 'Post cuadrado' },
  { value: '4:5', label: '4:5', hint: 'Post vertical: el que más ocupa en el feed' },
  { value: '9:16', label: '9:16', hint: 'Historia' },
];
export const designSize = (r: DesignRatio): [number, number] => (r === '1:1' ? [1080, 1080] : r === '4:5' ? [1080, 1350] : [1080, 1920]);

/** A qué dato va atado un texto. */
export type TextBind = 'title' | 'subtitle' | 'cta' | 'price' | 'listPrice' | 'discount' | 'promo' | 'code' | 'name' | 'brand' | 'slogan';
export const TEXT_BINDS: { value: TextBind; label: string }[] = [
  { value: 'title', label: 'Título' }, { value: 'subtitle', label: 'Subtítulo' }, { value: 'cta', label: 'Botón' },
  { value: 'price', label: 'Precio' }, { value: 'listPrice', label: 'Precio antes' }, { value: 'discount', label: 'Descuento' },
  { value: 'promo', label: 'Oferta' }, { value: 'code', label: 'Código del cupón' }, { value: 'name', label: 'Nombre del producto' },
  { value: 'brand', label: 'Nombre de la marca' }, { value: 'slogan', label: 'Lema de la marca' },
];

/** Colores de la marca por nombre (la capa guarda el nombre: cambia si cambia la marca). */
export type BrandColor = 'primary' | 'accent' | 'paper' | 'white' | 'black';
export type Paint = BrandColor | `#${string}`;

/** Vista de la prenda: frente, espalda o manga (lado). */
export type MockView = 'front' | 'back' | 'side';
export const MOCK_VIEWS: { value: MockView; label: string }[] = [
  { value: 'front', label: 'Frente' }, { value: 'back', label: 'Espalda' }, { value: 'side', label: 'Manga' },
];

/**
 * Prenda personalizable con su diseño. Sin plantilla (null) usa la personalizable elegida en Productos.
 * La foto es la de la vista (o la zona elegida); si la plantilla no tiene fotos y es 3D, sale del
 * maniquí 3D girado a esa vista.
 */
export interface PieceMock {
  templateId: number | null;
  zoneId: number | null;
  view?: MockView;
  design: SceneDesign | null;
  size: number;
  /** Color de la prenda (solo en 3D). */
  color?: string;
  /** Acercar a la zona del diseño (en la manga, para que el diseño se vea). */
  closeUp?: boolean;
  /** Con acercamiento: recorte de una región de la foto (en %), en vez de la zona (cuello, tela). */
  crop?: { x: number; y: number; w: number; h: number } | null;
  /** Zona preferida por nombre cuando no se eligió una (ej.: "pecho" para el logo del pecho). */
  zoneHint?: string;
  /** Corrimiento del diseño desde el centro de su zona (fracción del ancho y alto de la foto). */
  offset?: { x: number; y: number };
}

interface Base {
  id: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  opacity: number;
  /** Giro en grados (alrededor del centro). */
  rotation?: number;
  hidden?: boolean;
  locked?: boolean;
}

export interface TextLayer extends Base {
  type: 'text';
  text: string;
  bind: TextBind | null;
  /** De qué producto sale (precio, nombre): 0, 1, 2... */
  item: number;
  font: 'heading' | 'body';
  size: number;
  weight: number;
  color: Paint;
  align: 'left' | 'center' | 'right';
  upper: boolean;
  lineHeight: number;
  letterSpacing: number;
  maxLines: number;
  /** Solo se muestra si este dato tiene valor. */
  showIf?: TextBind;
  /** Fondo detrás del texto (como etiqueta o botón). */
  bg: Paint | null;
  radius: number;
  strike: boolean;
  shadow: boolean;
  /** Solo el contorno de las letras (tipografía hueca). */
  outline?: boolean;
}

export interface ImageLayer extends Base {
  type: 'image';
  /** URL de la foto, o null si sale del producto `item`. */
  src: string | null;
  /** Foto de una plantilla personalizable con un diseño montado en su zona (manda sobre src/item). */
  mock?: PieceMock | null;
  item: number;
  fit: 'cover' | 'contain';
  zoom: number;
  radius: number;
  shadow: boolean;
  border: Paint | null;
  /** Difumina los bordes de la foto (0..0.5) para que se funda con el fondo. */
  feather?: number;
  /** El producto sin su fondo, grande y con sombra (en vez de la foto en un recuadro). */
  cutout?: boolean;
  /** Dónde se apoya el producto recortado en su caja. */
  anchor?: 'bottom' | 'center';
}

export interface ShapeLayer extends Base {
  type: 'shape';
  shape: 'rect' | 'ellipse';
  fill: Paint;
  /** Degradado hacia otro color (y transparencia), de arriba a abajo. */
  fillTo: Paint | null;
  fillToAlpha: number;
  fillAlpha: number;
  radius: number;
  stroke: Paint | null;
  dashed: boolean;
}

export interface LogoLayer extends Base {
  type: 'logo';
  /** Completo (ícono y nombre), solo el nombre o solo el ícono. */
  kind: 'full' | 'wordmark' | 'icon';
  /** Sobre fondo claro u oscuro (elige la versión del logo). */
  onDark: boolean;
}

/** Fondo con estilo: malla de color, rayas, mosaico de la marca o de diseños (ver backgrounds.ts). */
export interface PatternLayer extends Base {
  type: 'pattern';
  style: BgStyle;
  base: Paint;
  ink: Paint;
  accent: Paint;
  density: number;
  size: number;
  angle: number;
  grain: boolean;
  /** Diseños elegidos para el mosaico (URL). */
  designs: string[];
  /** Suma al mosaico los diseños puestos en las prendas del post. */
  useMockDesigns: boolean;
}

/** Los colores disponibles de la prenda: mini prendas en cada color (o círculos) y "Disponible en N colores". */
export interface ColorsLayer extends Base {
  type: 'colors';
  style: 'prendas' | 'circulos';
  colors: string[];
  /** Muestra el texto "Disponible en N colores". */
  label: boolean;
  onDark: boolean;
}

export type Layer = TextLayer | ImageLayer | ShapeLayer | LogoLayer | PatternLayer | ColorsLayer;

export interface Design {
  ratio: DesignRatio;
  template: DesignTemplateId;
  layers: Layer[];
}

let seq = 0;
export const layerId = () => `l${Date.now().toString(36)}${(seq++).toString(36)}`;

export function textLayer(p: Partial<TextLayer>): TextLayer {
  return {
    id: layerId(), type: 'text', name: 'Texto', x: 80, y: 80, w: 920, h: 120, opacity: 1, text: '', bind: null, item: 0, font: 'heading', size: 96, weight: 800,
    color: 'white', align: 'left', upper: true, lineHeight: 1, letterSpacing: 0, maxLines: 3, bg: null, radius: 0, strike: false, shadow: false, ...p,
  };
}
export function imageLayer(p: Partial<ImageLayer>): ImageLayer {
  return { id: layerId(), type: 'image', name: 'Foto', x: 0, y: 0, w: 1080, h: 1080, opacity: 1, src: null, item: 0, fit: 'cover', zoom: 1, radius: 0, shadow: false, border: null, ...p };
}
export function shapeLayer(p: Partial<ShapeLayer>): ShapeLayer {
  return {
    id: layerId(), type: 'shape', name: 'Forma', x: 0, y: 0, w: 1080, h: 1080, opacity: 1, shape: 'rect', fill: 'primary', fillTo: null, fillToAlpha: 1, fillAlpha: 1,
    radius: 0, stroke: null, dashed: false, ...p,
  };
}
export function patternLayer(p: Partial<PatternLayer>): PatternLayer {
  return {
    id: layerId(), type: 'pattern', name: 'Fondo', x: 0, y: 0, w: 1080, h: 1080, opacity: 1, locked: true, style: 'malla', base: 'primary', ink: 'accent', accent: 'accent',
    density: 0.5, size: 150, angle: -18, grain: true, designs: [], useMockDesigns: true, ...p,
  };
}
export function colorsLayer(p: Partial<ColorsLayer>): ColorsLayer {
  return { id: layerId(), type: 'colors', name: 'Colores disponibles', x: 72, y: 860, w: 936, h: 150, opacity: 1, style: 'prendas', colors: [], label: true, onDark: true, ...p };
}
export function logoLayer(p: Partial<LogoLayer>): LogoLayer {
  return { id: layerId(), type: 'logo', name: 'Logo', x: 72, y: 64, w: 260, h: 64, opacity: 1, kind: 'full', onDark: true, ...p };
}

// ─── Plantillas ─────────────────────────────────────────────────────────────────────────────────

export type DesignTemplateId =
  | 'destacado' | 'oferta' | 'coleccion' | 'nuevo' | 'cupon' | 'personaliza' | 'minimal' | 'precio' | 'anuncio' | 'editorial'
  | 'resena' | 'encuesta' | 'top3' | 'regresiva' | 'collage' | 'beneficios' | 'outfit' | 'sticker'
  | 'bento' | 'contorno' | 'vidrio' | 'revista' | 'drop' | 'dividido' | 'dosVistas' | 'tresVistas' | 'coleccionPremium';

export type TemplateGroup = 'Personalizable' | 'Tendencia' | 'Venta' | 'Producto' | 'Interacción' | 'Marca';
export const TEMPLATE_GROUPS: TemplateGroup[] = ['Personalizable', 'Tendencia', 'Venta', 'Producto', 'Interacción', 'Marca'];
export const DESIGN_TEMPLATES: { id: DesignTemplateId; label: string; hint: string; group: TemplateGroup }[] = [
  { id: 'coleccionPremium', label: 'Colección premium', hint: 'Flyer de lujo: la espalda en grande, el frente y detalles de pecho, manga, cuello y tela', group: 'Personalizable' },
  { id: 'dosVistas', label: 'Frente y espalda', hint: 'La prenda personalizable por delante y por detrás, cada vista con su diseño', group: 'Personalizable' },
  { id: 'tresVistas', label: '3 vistas', hint: 'Frente, espalda y manga, cada una con su diseño', group: 'Personalizable' },
  { id: 'bento', label: 'Bento', hint: 'Mosaico de recuadros: foto, precio, mensaje y detalles', group: 'Tendencia' },
  { id: 'contorno', label: 'Tipografía', hint: 'El título enorme repetido en contorno detrás del producto', group: 'Tendencia' },
  { id: 'vidrio', label: 'Vidrio', hint: 'Tarjeta translúcida sobre un degradado de la marca', group: 'Tendencia' },
  { id: 'revista', label: 'Portada', hint: 'Como portada de revista: la marca arriba y titulares', group: 'Tendencia' },
  { id: 'drop', label: 'Drop', hint: 'Lanzamiento streetwear: número de drop y fecha', group: 'Tendencia' },
  { id: 'dividido', label: 'Dividido', hint: 'Mitad color con el mensaje, mitad foto', group: 'Tendencia' },
  { id: 'oferta', label: 'Oferta', hint: 'El descuento en grande', group: 'Venta' },
  { id: 'precio', label: 'Antes y ahora', hint: 'El precio de antes tachado y el nuevo', group: 'Venta' },
  { id: 'cupon', label: 'Cupón', hint: 'El código como un ticket', group: 'Venta' },
  { id: 'regresiva', label: 'Últimas horas', hint: 'Urgencia: la oferta se acaba', group: 'Venta' },
  { id: 'sticker', label: 'Sticker de precio', hint: 'Foto con el precio en un sello girado', group: 'Venta' },
  { id: 'destacado', label: 'Destacado', hint: 'Foto a sangre con el precio y el botón', group: 'Producto' },
  { id: 'nuevo', label: 'Nuevo', hint: 'Lanzamiento sobre fondo claro', group: 'Producto' },
  { id: 'minimal', label: 'Minimal', hint: 'Foto y texto con mucho aire', group: 'Producto' },
  { id: 'editorial', label: 'Editorial', hint: 'Foto completa con el título enorme arriba', group: 'Producto' },
  { id: 'coleccion', label: 'Colección', hint: 'Cuatro productos en cuadrícula', group: 'Producto' },
  { id: 'outfit', label: 'Look completo', hint: 'Las prendas del look, una sobre otra', group: 'Producto' },
  { id: 'collage', label: 'Collage', hint: 'Fotos tipo polaroid, algo giradas', group: 'Producto' },
  { id: 'encuesta', label: '¿Cuál prefieres?', hint: 'Dos productos frente a frente para que comenten', group: 'Interacción' },
  { id: 'top3', label: 'Top 3', hint: 'Los más vendidos en lista numerada', group: 'Interacción' },
  { id: 'resena', label: 'Reseña', hint: 'La opinión de un cliente con estrellas', group: 'Interacción' },
  { id: 'personaliza', label: 'Personaliza', hint: 'Invita a diseñar la prenda propia', group: 'Marca' },
  { id: 'beneficios', label: 'Beneficios', hint: 'Envío, cambios, pagos: por qué comprar', group: 'Marca' },
  { id: 'anuncio', label: 'Anuncio', hint: 'Un mensaje grande sobre la marca', group: 'Marca' },
];

/** Capas de una plantilla para el tamaño pedido. */
export function buildDesign(id: DesignTemplateId, ratio: DesignRatio, opts?: { colors?: string[] | null }): Design {
  const [W, H] = designSize(ratio);
  const tall = H > W * 1.4;
  const mid = H > W && !tall; // 4:5
  const m = 72; // margen
  const L: Layer[] = [];
  const bg = (fill: Paint) => L.push(shapeLayer({ name: 'Fondo', fill, w: W, h: H, locked: true }));
  /** Fondo con estilo (malla, mosaico, rayas…) y grano. */
  const pat = (style: BgStyle, base: Paint, ink: Paint, extra?: Partial<PatternLayer>) => L.push(patternLayer({ style, base, ink, w: W, h: H, ...extra }));
  const logo = (onDark: boolean, center = false) => L.push(logoLayer({ onDark, x: center ? W / 2 - 150 : m, w: 300, y: tall ? 90 : 64 }));
  const cta = (y: number, color: Paint, bgc: Paint, x = m, align: TextLayer['align'] = 'left', w = 420) =>
    L.push(textLayer({ name: 'Botón', bind: 'cta', x, y, w, h: 84, font: 'body', size: 38, weight: 700, color, bg: bgc, radius: 999, upper: false, maxLines: 1, align }));
  const sq = !tall && !mid;
  /** Un valor por formato: cuadrado, 4:5 e historia. */
  const v = (a: number, b: number, c: number) => (tall ? c : mid ? b : a);
  /** El producto recortado (sin el fondo de su foto), grande y con sombra: el protagonista. */
  const hero = (x: number, y: number, w: number, h: number, p: Partial<ImageLayer> = {}) =>
    L.push(imageLayer({ name: 'Foto del producto', x, y, w, h, fit: 'contain', cutout: true, shadow: true, ...p }));
  /** Luz suave detrás del producto. */
  const glow = (cx: number, cy: number, r: number, fill: Paint = 'accent', a = 0.35) =>
    L.push(shapeLayer({ name: 'Luz', shape: 'ellipse', x: cx - r, y: cy - r, w: 2 * r, h: 2 * r, fill, fillAlpha: a, fillTo: fill, fillToAlpha: 0 }));
  // Colores disponibles (opcional): cada plantilla les reserva su franja y el producto cede ese espacio.
  const colors = opts?.colors?.length ? opts.colors : null;
  const CS = colors ? v(110, 120, 150) : 0;
  const strip = (x: number, y: number, w: number, h: number, onDark: boolean) => {
    if (colors) L.push(colorsLayer({ x, y, w, h, colors, onDark }));
  };

  switch (id) {
    case 'destacado': {
      pat('malla', 'primary', 'accent', { accent: 'accent', density: 0.5 });
      glow(W / 2, v(430, 520, 760), W * 0.62);
      L.push(textLayer({ name: 'Título de fondo', bind: 'title', x: -20, y: v(80, 100, 220), w: W + 40, h: v(330, 380, 560), size: v(180, 200, 240), weight: 900, color: 'accent', outline: true, opacity: 0.45, align: 'center', maxLines: 2, lineHeight: 0.86, locked: true }));
      logo(true);
      L.push(textLayer({ name: 'Descuento', bind: 'discount', x: W - m - 220, y: v(56, 56, 84), w: 220, h: 84, font: 'body', size: 44, weight: 800, color: 'primary', bg: 'accent', radius: 999, maxLines: 1, align: 'center' }));
      const hy = v(110, 130, 260), hh = v(640, 820, 1080) - CS;
      hero(16, hy, W - 32, hh);
      strip(m, hy + hh + 4, W - 2 * m, CS - 8, true);
      const ty = hy + hh + CS + v(10, 18, 40);
      L.push(textLayer({ name: 'Título', bind: 'title', x: m, y: ty, w: W - 2 * m, h: v(84, 100, 210), size: v(64, 76, 104), maxLines: v(1, 1, 2) }));
      if (!sq) L.push(textLayer({ name: 'Subtítulo', bind: 'subtitle', x: m, y: ty + v(0, 108, 220), w: W - 2 * m, h: 60, font: 'body', size: 36, weight: 500, upper: false, color: '#FFFFFFCC' as Paint, maxLines: 1 }));
      L.push(textLayer({ name: 'Precio', bind: 'price', x: m, y: H - v(110, 120, 200), w: 520, h: 84, font: 'body', size: v(64, 68, 80), weight: 900, color: 'accent', maxLines: 1 }));
      cta(H - v(112, 122, 200), 'primary', 'accent', W - m - 400, 'center', 400);
      break;
    }
    case 'oferta': {
      pat('malla', 'primary', 'accent', { accent: 'accent', density: 0.55 });
      logo(true, true);
      // El descuento enorme y el producto encima, tapándole la parte de abajo.
      L.push(textLayer({ name: 'Oferta', bind: 'promo', x: 20, y: v(110, 130, 250), w: W - 40, h: v(270, 300, 360), size: v(260, 290, 330), weight: 900, color: 'accent', align: 'center', maxLines: 1, letterSpacing: -6 }));
      glow(W / 2, v(600, 720, 1050), W * 0.55, 'accent', 0.3);
      const hy = v(250, 290, 470), hh = v(600, 760, 1040) - CS;
      hero(16, hy, W - 32, hh);
      strip(m, hy + hh + 4, W - 2 * m, CS - 8, true);
      L.push(textLayer({ name: 'Nombre', bind: 'title', x: m, y: hy + hh + CS + 6, w: W - 2 * m, h: 70, size: v(48, 56, 68), align: 'center', maxLines: 1 }));
      L.push(textLayer({ name: 'Precio', bind: 'price', x: m, y: hy + hh + CS + v(78, 88, 110), w: W - 2 * m, h: 80, font: 'body', size: v(60, 68, 84), weight: 900, color: 'accent', align: 'center', maxLines: 1 }));
      if (tall) cta(H - 200, 'primary', 'accent', W / 2 - 220, 'center', 440);
      break;
    }
    case 'coleccion': {
      pat('malla', 'paper', 'accent', { accent: 'white', density: 0.35 });
      logo(false);
      L.push(textLayer({ name: 'Título', bind: 'title', x: m, y: v(140, 150, 220), w: W - 2 * m, h: v(80, 100, 130), size: v(68, 80, 104), color: 'primary', maxLines: 1 }));
      const top = v(230, 260, 380), bottom = v(110, 130, 220) + CS, gap = 8;
      const cw = (W - 2 * 30 - gap) / 2, ch = (H - top - bottom - gap) / 2;
      for (let i = 0; i < 4; i++) {
        const x = 30 + (i % 2) * (cw + gap), y = top + Math.floor(i / 2) * (ch + gap);
        L.push(shapeLayer({ name: `Luz ${i + 1}`, shape: 'ellipse', x: x + cw * 0.1, y: y + ch * 0.12, w: cw * 0.8, h: ch * 0.8, fill: 'white', fillAlpha: 0.85, fillTo: 'white', fillToAlpha: 0 }));
        L.push(imageLayer({ name: `Foto ${i + 1}`, item: i, x, y, w: cw, h: ch - 10, fit: 'contain', cutout: true, shadow: true }));
        L.push(textLayer({ name: `Precio ${i + 1}`, bind: 'price', item: i, x: x + 10, y: y + ch - 62, w: 210, h: 50, font: 'body', size: 28, weight: 800, color: 'white', bg: 'primary', radius: 999, maxLines: 1, upper: false, align: 'center' }));
      }
      strip(30, top + 2 * ch + gap + 6, W - 60, CS - 10, false);
      cta(H - v(96, 112, 190), 'white', 'primary');
      L.push(textLayer({ name: 'Subtítulo', bind: 'subtitle', x: W / 2, y: H - v(82, 98, 176), w: W / 2 - m, h: 50, font: 'body', size: 30, weight: 500, color: '#5B5B5B' as Paint, align: 'right', upper: false, maxLines: 1 }));
      break;
    }
    case 'nuevo': {
      pat('malla', 'paper', 'accent', { accent: 'white', density: 0.45 });
      L.push(textLayer({ name: 'Fondo NUEVO', text: 'NUEVO', x: -40, y: v(170, 220, 420), w: W + 80, h: v(330, 360, 400), size: v(330, 350, 380), weight: 900, color: 'primary', outline: true, opacity: 0.22, align: 'center', maxLines: 1, letterSpacing: -8, locked: true }));
      logo(false, true);
      L.push(textLayer({ name: 'Etiqueta', text: 'NUEVO', x: W / 2 - 100, y: v(140, 150, 220), w: 200, h: 60, font: 'body', size: 28, weight: 800, color: 'primary', bg: 'accent', radius: 999, align: 'center', maxLines: 1, letterSpacing: 4 }));
      const hy = v(190, 230, 380), hh = v(660, 820, 1100) - CS;
      hero(16, hy, W - 32, hh);
      strip(m, hy + hh + 4, W - 2 * m, CS - 8, false);
      L.push(textLayer({ name: 'Título', bind: 'title', x: m, y: hy + hh + CS + 8, w: W - 2 * m, h: v(76, 90, 190), size: v(58, 68, 88), color: 'primary', align: 'center', maxLines: v(1, 1, 2) }));
      L.push(textLayer({ name: 'Precio', bind: 'price', x: m, y: hy + hh + CS + v(84, 100, 210), w: W - 2 * m, h: 70, font: 'body', size: v(52, 58, 68), weight: 800, color: 'primary', align: 'center', maxLines: 1 }));
      if (tall) cta(H - 140, 'white', 'primary', W / 2 - 220, 'center', 440);
      break;
    }
    case 'cupon': {
      pat('mosaicoMarca', 'accent', 'primary', { density: 0.12, size: 120, angle: -20 });
      logo(false);
      const tw = tall ? W - 2 * m : W * 0.58;
      L.push(textLayer({ name: 'Título', bind: 'title', x: m, y: v(150, 170, 240), w: tw, h: v(170, 200, 230), size: v(76, 88, 116), color: 'primary', maxLines: 2 }));
      const ty = v(360, 420, 520), th = v(330, 360, 400);
      // El producto grande al lado del ticket (abajo en historias); el ticket lo monta por encima.
      if (tall) hero(30, ty + th + 20 + CS, W - 60, H - (ty + th + 20 + CS) - 200);
      else hero(W * 0.52, v(150, 180, 0), W * 0.5, H - v(150, 180, 0) - v(130, 150, 0));
      L.push(shapeLayer({ name: 'Ticket', x: m, y: ty, w: tw, h: th, fill: 'primary', radius: 36 }));
      L.push(shapeLayer({ name: 'Borde del ticket', x: m + 22, y: ty + 22, w: tw - 44, h: th - 44, fill: 'primary', fillAlpha: 0, stroke: 'accent', dashed: true, radius: 24 }));
      L.push(textLayer({ name: 'Texto del ticket', text: 'Usa el código', x: m, y: ty + 52, w: tw, h: 46, font: 'body', size: 32, weight: 600, color: '#FFFFFFBF' as Paint, align: 'center', upper: false, maxLines: 1 }));
      L.push(textLayer({ name: 'Código', bind: 'code', x: m + 30, y: ty + 108, w: tw - 60, h: 120, size: 100, weight: 900, color: 'accent', align: 'center', maxLines: 1 }));
      L.push(textLayer({ name: 'Oferta', bind: 'promo', x: m, y: ty + th - 90, w: tw, h: 52, font: 'body', size: 40, weight: 700, color: 'white', align: 'center', maxLines: 1 }));
      L.push(textLayer({ name: 'Subtítulo', bind: 'subtitle', x: m, y: ty + th + 30 + CS, w: tall ? W - 2 * m : W * 0.42, h: 110, font: 'body', size: 34, weight: 600, color: 'primary', upper: false, maxLines: 2, lineHeight: 1.25, hidden: tall }));
      strip(m, ty + th + 16, tw, CS - 12, false);
      cta(H - v(120, 140, 170), 'white', 'primary');
      break;
    }
    case 'personaliza': {
      pat('mosaicoDisenos', 'primary', 'accent', { density: 0.18, size: 170, angle: -14 });
      glow(W / 2, v(470, 560, 820), W * 0.62, 'accent', 0.32);
      logo(true);
      const hy = v(110, 130, 230), hh = v(680, 840, 1150) - CS;
      hero(16, hy, W - 32, hh);
      strip(m, hy + hh + 4, W - 2 * m, CS - 8, true);
      L.push(textLayer({ name: 'Título', text: 'Diseña la tuya', x: m, y: hy + hh + CS + 6, w: W - 2 * m, h: v(90, 110, 130), size: v(76, 88, 116), maxLines: 1 }));
      if (!sq) L.push(textLayer({ name: 'Subtítulo', bind: 'subtitle', x: m, y: hy + hh + CS + v(0, 120, 150), w: W - 2 * m, h: 60, font: 'body', size: 36, weight: 500, upper: false, color: '#FFFFFFCC' as Paint, maxLines: 2 }));
      cta(H - v(110, 120, 170), 'primary', 'accent');
      L.push(textLayer({ name: 'Desde', bind: 'price', text: '', x: W / 2, y: H - v(100, 110, 160), w: W / 2 - m, h: 56, font: 'body', size: 44, weight: 800, color: 'accent', align: 'right', upper: false, maxLines: 1 }));
      break;
    }
    case 'minimal': {
      bg('white');
      if (tall || mid) {
        L.push(shapeLayer({ name: 'Bloque', x: 0, y: 0, w: W, h: H * 0.64, fill: 'paper' }));
        hero(30, v(0, 70, 120), W - 60, H * 0.64 - v(0, 70, 120) + 40 - CS);
        strip(m, H * 0.64 + 40 - CS, W - 2 * m, CS - 10, false);
        L.push(shapeLayer({ name: 'Línea', x: m, y: H * 0.64 + 80, w: 90, h: 8, fill: 'accent' }));
        L.push(textLayer({ name: 'Título', bind: 'title', x: m, y: H * 0.64 + 112, w: W - 2 * m, h: 190, size: tall ? 92 : 70, color: 'primary', maxLines: 2 }));
        L.push(textLayer({ name: 'Subtítulo', bind: 'subtitle', x: m, y: H * 0.64 + (tall ? 320 : 250), w: W - 2 * m, h: 90, font: 'body', size: 34, weight: 400, color: '#55534F' as Paint, upper: false, maxLines: 2, lineHeight: 1.3 }));
        L.push(textLayer({ name: 'Precio', bind: 'price', x: m, y: H - (tall ? 180 : 100), w: 500, h: 70, font: 'body', size: 54, weight: 800, color: 'primary', maxLines: 1 }));
        logo(false); L[L.length - 1] = { ...(L[L.length - 1] as LogoLayer), x: W - m - 300, y: H - (tall ? 172 : 94), onDark: false };
      } else {
        L.push(shapeLayer({ name: 'Bloque', x: 0, y: 0, w: W * 0.54, h: H, fill: 'paper' }));
        hero(10, 90, W * 0.66, H - 130 - CS);
        strip(30, H - 40 - CS, W * 0.5, CS - 10, false);
        logo(false); L[L.length - 1] = { ...(L[L.length - 1] as LogoLayer), x: W * 0.6, onDark: false };
        L.push(shapeLayer({ name: 'Línea', x: W * 0.68, y: 330, w: 80, h: 8, fill: 'accent' }));
        L.push(textLayer({ name: 'Título', bind: 'title', x: W * 0.68, y: 370, w: W * 0.32 - m, h: 260, size: 64, color: 'primary', maxLines: 3 }));
        L.push(textLayer({ name: 'Subtítulo', bind: 'subtitle', x: W * 0.68, y: 650, w: W * 0.32 - m, h: 140, font: 'body', size: 28, weight: 400, color: '#55534F' as Paint, upper: false, maxLines: 4, lineHeight: 1.3 }));
        L.push(textLayer({ name: 'Precio', bind: 'price', x: W * 0.68, y: 880, w: W * 0.32 - m, h: 70, font: 'body', size: 50, weight: 800, color: 'primary', maxLines: 1 }));
      }
      break;
    }
    case 'precio': {
      pat('malla', 'paper', 'accent', { accent: 'white', density: 0.3 });
      logo(false);
      L.push(textLayer({ name: 'Descuento', bind: 'discount', x: W - m - 230, y: v(56, 60, 110), w: 230, h: 90, font: 'body', size: 48, weight: 900, color: 'primary', bg: 'accent', radius: 999, align: 'center', maxLines: 1 }));
      const hy = v(110, 150, 250), hh = v(540, 720, 1000) - CS;
      glow(W / 2, hy + hh * 0.55, W * 0.5, 'white', 0.9);
      hero(16, hy, W - 32, hh);
      strip(m, hy + hh + 4, W - 2 * m, CS - 8, false);
      const y = hy + hh + CS + 14;
      L.push(textLayer({ name: 'Nombre', bind: 'title', x: m, y, w: W - 2 * m, h: v(70, 80, 170), size: v(52, 60, 72), color: 'primary', maxLines: v(1, 1, 2) }));
      const py = y + v(86, 100, 190);
      L.push(textLayer({ name: 'Antes', text: 'Antes', showIf: 'listPrice', x: m, y: py, w: 300, h: 40, font: 'body', size: 28, weight: 500, color: '#7A7873' as Paint, upper: false, maxLines: 1 }));
      L.push(textLayer({ name: 'Precio antes', bind: 'listPrice', x: m, y: py + 38, w: 420, h: 66, font: 'body', size: 52, weight: 600, color: '#7A7873' as Paint, strike: true, maxLines: 1 }));
      L.push(textLayer({ name: 'Ahora', text: 'Ahora', showIf: 'listPrice', x: W / 2, y: py, w: 300, h: 40, font: 'body', size: 28, weight: 700, color: 'primary', upper: false, maxLines: 1 }));
      L.push(textLayer({ name: 'Precio', bind: 'price', x: W / 2, y: py + 30, w: W / 2 - m, h: 96, font: 'body', size: 88, weight: 900, color: 'primary', maxLines: 1 }));
      if (!sq) cta(H - v(0, 110, 180), 'white', 'primary');
      break;
    }
    case 'anuncio': {
      pat('mosaicoMarca', 'primary', 'white', { density: 0.12, size: 140, angle: -22 });
      L.push(shapeLayer({ name: 'Franja', x: m, y: H / 2 - (tall ? 420 : 300) - CS, w: 120, h: 12, fill: 'accent' }));
      L.push(textLayer({ name: 'Mensaje', bind: 'title', x: m, y: H / 2 - (tall ? 380 : 260) - CS, w: W - 2 * m, h: tall ? 600 : 420, size: tall ? 150 : 120, weight: 900, maxLines: 4, lineHeight: 0.98 }));
      L.push(textLayer({ name: 'Subtítulo', bind: 'subtitle', x: m, y: H / 2 + (tall ? 260 : 190) - CS, w: W - 2 * m, h: 120, font: 'body', size: 42, weight: 500, color: '#FFFFFFCC' as Paint, upper: false, maxLines: 2, lineHeight: 1.25 }));
      strip(m, H - m - 64 - CS - 4, W - 2 * m - 140, CS - 10, true);
      L.push(logoLayer({ kind: 'icon', onDark: true, x: W - m - 120, y: H - m - 120, w: 120, h: 120, name: 'Ícono' }));
      L.push(logoLayer({ onDark: true, x: m, y: H - m - 64, w: 300, h: 64 }));
      break;
    }
    case 'editorial': {
      pat('malla', 'primary', 'accent', { accent: 'primary', density: 0.35 });
      L.push(textLayer({ name: 'Título', bind: 'title', x: m - 6, y: v(70, 90, 200), w: W - 2 * m + 12, h: v(420, 480, 660), size: v(170, 190, 230), weight: 900, maxLines: 3, lineHeight: 0.86, letterSpacing: -3 }));
      // El producto encima del título, tapándole la parte de abajo (como portada de moda).
      const hy = v(340, 420, 600);
      hero(W * 0.06, hy, W * 0.88, H - hy - v(110, 130, 220) - CS);
      strip(m, H - CS - 146, W - 2 * m, CS - 10, true);
      if (!sq) L.push(textLayer({ name: 'Subtítulo', bind: 'subtitle', x: m, y: H - v(0, 200, 330) - (colors ? CS + 40 : 0), w: W - 2 * m, h: 60, font: 'body', size: 34, weight: 500, upper: false, maxLines: 1, align: 'center' }));
      L.push(logoLayer({ onDark: true, x: m, y: H - m - 56, w: 260, h: 56 }));
      L.push(textLayer({ name: 'Precio', bind: 'price', x: W - m - 380, y: H - m - 76, w: 380, h: 76, font: 'body', size: 44, weight: 800, color: 'primary', bg: 'accent', radius: 999, align: 'center', upper: false, maxLines: 1 }));
      break;
    }
    case 'coleccionPremium': {
      pat('color', '#141414' as Paint, 'white');
      // Tarjeta de detalle: fondo apenas visible y la foto llenándola.
      const tile = (name: string, x: number, y: number, w: number, h: number, mock: PieceMock, fit: ImageLayer['fit'] = 'cover') => {
        L.push(shapeLayer({ name: `Marco ${name}`, x, y, w, h, fill: 'white', fillAlpha: 0.04, radius: 6, stroke: '#FFFFFF1F' as Paint }));
        L.push(imageLayer({ name, x: x + 2, y: y + 2, w: w - 4, h: h - 4, radius: 5, fit, mock }));
      };
      const pm = (p: Partial<PieceMock>): PieceMock => ({ templateId: null, zoneId: null, view: 'front', design: null, size: 0.9, ...p });
      const footer = H - (tall ? 150 : 96);
      if (!tall) {
        const g = 14, top = 40, colW = W * 0.2, colX = W - m * 0.5 - colW;
        const mainH = footer - top - 30 - CS;
        strip(m * 0.5, top + mainH + 10, colX - m, CS - 10, true);
        // Espalda en grande a la izquierda y frente a su derecha (como en un flyer de colección).
        // El frente arriba a la derecha y la espalda grande por delante, un poco encima (como un flyer de colección).
        L.push(imageLayer({ name: 'Vista FRENTE', x: W * 0.4, y: top, w: colX - W * 0.4 - g, h: mainH * 0.52, fit: 'contain', feather: 0.22, mock: pm({ zoneHint: 'pecho', size: 0.8 }) }));
        L.push(imageLayer({ name: 'Vista ESPALDA', x: -W * 0.03, y: top + mainH * 0.14, w: W * 0.64, h: mainH * 0.86, fit: 'contain', feather: 0.22, mock: pm({ view: 'back', size: 0.95 }) }));
        const th = (mainH - 3 * g) / 4;
        tile('Detalle PECHO', colX, top, colW, th, pm({ zoneHint: 'pecho', closeUp: true, size: 0.8 }));
        tile('Detalle MANGA', colX, top + (th + g), colW, th, pm({ view: 'side', closeUp: true, size: 0.85 }));
        tile('Detalle CUELLO', colX, top + 2 * (th + g), colW, th, pm({ closeUp: true, crop: { x: 33, y: 3, w: 34, h: 20 } }));
        tile('Detalle TELA', colX, top + 3 * (th + g), colW, th, pm({ closeUp: true, crop: { x: 42, y: 58, w: 14, h: 14 } }));
      } else {
        const g = 16, top = 130;
        L.push(logoLayer({ onDark: true, x: W / 2 - 130, y: 40, w: 260, h: 56 }));
        const bigH = 860 - CS;
        L.push(imageLayer({ name: 'Vista ESPALDA', x: 40, y: top, w: W - 80, h: bigH, fit: 'contain', feather: 0.18, mock: pm({ view: 'back', size: 0.95 }) }));
        strip(m, top + bigH + 4, W - 2 * m, CS - 8, true);
        const rowY = top + bigH + g + CS, rowH = footer - rowY - 30;
        const fw = (W - 2 * m - g) * 0.5;
        L.push(imageLayer({ name: 'Vista FRENTE', x: m - 20, y: rowY, w: fw + 20, h: rowH, fit: 'contain', feather: 0.2, mock: pm({ zoneHint: 'pecho', size: 0.8 }) }));
        const tw = (W - 2 * m - g - fw - g) / 2, th = (rowH - g) / 2, tx = m + fw + g;
        tile('Detalle PECHO', tx, rowY, tw, th, pm({ zoneHint: 'pecho', closeUp: true, size: 0.8 }));
        tile('Detalle MANGA', tx + tw + g, rowY, tw, th, pm({ view: 'side', closeUp: true, size: 0.85 }));
        tile('Detalle CUELLO', tx, rowY + th + g, tw, th, pm({ closeUp: true, crop: { x: 33, y: 3, w: 34, h: 20 } }));
        tile('Detalle TELA', tx + tw + g, rowY + th + g, tw, th, pm({ closeUp: true, crop: { x: 42, y: 58, w: 14, h: 14 } }));
      }
      // Pie: el nombre de la colección entre dos líneas.
      L.push(shapeLayer({ name: 'Línea izquierda', x: W * 0.2, y: footer + 30, w: W * 0.12, h: 2, fill: 'white', fillAlpha: 0.5 }));
      L.push(textLayer({ name: 'Colección', bind: 'title', x: W * 0.34, y: footer + 12, w: W * 0.32, h: 40, font: 'body', size: tall ? 30 : 24, weight: 500, color: 'white', align: 'center', letterSpacing: tall ? 8 : 6, maxLines: 1 }));
      L.push(shapeLayer({ name: 'Línea derecha', x: W * 0.68, y: footer + 30, w: W * 0.12, h: 2, fill: 'white', fillAlpha: 0.5 }));
      break;
    }
    case 'dosVistas':
    case 'tresVistas': {
      const three = id === 'tresVistas';
      if (three) pat('mosaicoDisenos', 'primary', 'accent', { density: 0.14, size: 160, angle: -16 });
      else pat('malla', 'paper', 'accent', { accent: 'white', density: 0.35 });
      const onDark = three;
      logo(onDark); L[L.length - 1] = { ...(L[L.length - 1] as LogoLayer), onDark };
      const fg: Paint = onDark ? 'white' : 'primary';
      const titleY = tall ? 200 : 146;
      L.push(textLayer({ name: 'Título', bind: 'title', x: m, y: titleY, w: W - 2 * m, h: tall ? 210 : 116, size: tall ? 100 : 58, color: fg, maxLines: 2 }));
      const top = titleY + (tall ? 230 : 120), bottom = H - (tall ? 220 : 130) - CS;
      const g = 8;
      // Cada vista grande y recortada (sin recuadro), con una luz detrás y la etiqueta de la vista.
      const card = (view: MockView, label: string, x: number, y: number, w: number, h: number) => {
        L.push(shapeLayer({ name: `Luz ${label}`, shape: 'ellipse', x: x + w * 0.08, y: y + h * 0.08, w: w * 0.84, h: h * 0.84, fill: onDark ? 'accent' : 'white', fillAlpha: onDark ? 0.22 : 0.9, fillTo: onDark ? 'accent' : 'white', fillToAlpha: 0 }));
        L.push(imageLayer({ name: `Vista ${label}`, x: x - 10, y, w: w + 20, h, fit: 'contain', cutout: view !== 'side', shadow: view !== 'side', anchor: 'center', radius: view === 'side' ? 32 : 0, mock: { templateId: null, zoneId: null, view, design: null, size: 0.85, closeUp: view === 'side' } }));
        L.push(textLayer({ name: `Etiqueta ${label}`, text: label, x: x + 8, y: y + 8, w: 220, h: 52, font: 'body', size: 24, weight: 800, color: 'primary', bg: 'accent', radius: 999, maxLines: 1, letterSpacing: 2, align: 'center' }));
      };
      const ah = bottom - top;
      if (!three) {
        if (tall) {
          const h = (ah - g) / 2;
          card('front', 'FRENTE', m, top, W - 2 * m, h);
          card('back', 'ESPALDA', m, top + h + g, W - 2 * m, h);
        } else {
          const w = (W - 2 * m - g) / 2;
          card('front', 'FRENTE', m, top, w, ah);
          card('back', 'ESPALDA', m + w + g, top, w, ah);
        }
      } else if (tall) {
        const h1 = ah * 0.56, h2 = ah - h1 - g, w2 = (W - 2 * m - g) / 2;
        card('front', 'FRENTE', m, top, W - 2 * m, h1);
        card('back', 'ESPALDA', m, top + h1 + g, w2, h2);
        card('side', 'MANGA', m + w2 + g, top + h1 + g, w2, h2);
      } else {
        const w1 = (W - 2 * m - g) * 0.58, w2 = W - 2 * m - g - w1, h2 = (ah - g) / 2;
        card('front', 'FRENTE', m, top, w1, ah);
        card('back', 'ESPALDA', m + w1 + g, top, w2, h2);
        card('side', 'MANGA', m + w1 + g, top + h2 + g, w2, h2);
      }
      strip(m, bottom + 6, W - 2 * m, CS - 10, onDark);
      L.push(textLayer({ name: 'Precio', bind: 'price', x: m, y: bottom + CS + (tall ? 60 : 40), w: 480, h: 80, font: 'body', size: tall ? 60 : 50, weight: 900, color: onDark ? 'accent' : 'primary', maxLines: 1 }));
      cta(bottom + CS + (tall ? 60 : 38), onDark ? 'primary' : 'white', onDark ? 'accent' : 'primary', W - m - 380, 'center', 380);
      break;
    }
    case 'bento': {
      pat('color', 'paper', 'primary');
      const g = 18, top = v(130, 150, 230), bottom = v(m, m, 180) + CS;
      const gw = W - 2 * m, gh = H - top - bottom;
      const bigW = gw * 0.6, smallW = gw - bigW - g, bigH = gh * 0.66;
      logo(false); L[L.length - 1] = { ...(L[L.length - 1] as LogoLayer), y: v(44, 50, 110), onDark: false };
      // Recuadro de color con el producto saliéndose por arriba.
      L.push(shapeLayer({ name: 'Recuadro foto', x: m, y: top, w: bigW, h: bigH, fill: 'accent', radius: 32 }));
      hero(m - 10, top - v(80, 100, 140), bigW + 20, bigH + v(70, 90, 130));
      const r1 = (bigH - g) / 2;
      L.push(shapeLayer({ name: 'Recuadro mensaje', x: m + bigW + g, y: top, w: smallW, h: r1, fill: 'primary', radius: 32 }));
      L.push(textLayer({ name: 'Título', bind: 'title', x: m + bigW + g + 24, y: top + 24, w: smallW - 48, h: r1 - 48, size: v(46, 54, 64), color: 'white', maxLines: 4, lineHeight: 0.98 }));
      L.push(shapeLayer({ name: 'Recuadro precio', x: m + bigW + g, y: top + r1 + g, w: smallW, h: r1, fill: 'white', radius: 32, stroke: '#00000012' as Paint }));
      L.push(textLayer({ name: 'Precio', bind: 'price', x: m + bigW + g + 16, y: top + r1 + g + r1 / 2 - 40, w: smallW - 32, h: 80, font: 'body', size: 60, weight: 900, color: 'primary', align: 'center', maxLines: 1 }));
      const rowY = top + bigH + g, rowH = gh - bigH - g;
      const tile = (gw - 2 * g) / 3;
      [1, 2].forEach((it, k) => {
        L.push(shapeLayer({ name: `Recuadro ${it + 1}`, x: m + k * (tile + g), y: rowY, w: tile, h: rowH, fill: 'white', radius: 28, stroke: '#00000012' as Paint }));
        L.push(imageLayer({ name: `Foto ${it + 1}`, item: it, x: m + k * (tile + g) + 8, y: rowY + 8, w: tile - 16, h: rowH - 16, fit: 'contain', cutout: true, shadow: true, anchor: 'center' }));
      });
      strip(m, H - bottom + 10, gw, CS - 14, false);
      L.push(shapeLayer({ name: 'Recuadro botón', x: m + 2 * (tile + g), y: rowY, w: tile, h: rowH, fill: 'primary', radius: 28 }));
      L.push(textLayer({ name: 'Subtítulo', bind: 'subtitle', x: m + 2 * (tile + g) + 20, y: rowY + 22, w: tile - 40, h: rowH - 120, font: 'body', size: 28, weight: 600, color: 'white', upper: false, maxLines: 3, lineHeight: 1.2 }));
      L.push(textLayer({ name: 'Botón', bind: 'cta', x: m + 2 * (tile + g) + 20, y: rowY + rowH - 84, w: tile - 40, h: 64, font: 'body', size: 28, weight: 700, color: 'primary', bg: 'accent', radius: 999, upper: false, align: 'center', maxLines: 1 }));
      break;
    }
    case 'contorno': {
      bg('primary');
      const rows = tall ? 7 : mid ? 5 : 4;
      const rh = H / rows;
      for (let i = 0; i < rows; i++) {
        L.push(textLayer({ name: `Fondo ${i + 1}`, bind: 'title', x: -40, y: i * rh + rh * 0.08, w: W + 80, h: rh, size: rh * 0.82, weight: 900, color: 'accent', outline: i % 2 === 0, opacity: i % 2 ? 0.9 : 0.55, maxLines: 1, align: 'center', locked: true }));
      }
      glow(W / 2, H * 0.48, W * 0.5, 'primary', 0.85);
      hero(0, H * v(0.1, 0.1, 0.14), W, H * v(0.74, 0.72, 0.64) - CS);
      strip(m, H * v(0.1, 0.1, 0.14) + H * v(0.74, 0.72, 0.64) - CS + 4, W - 2 * m, CS - 10, true);
      logo(true); L[L.length - 1] = { ...(L[L.length - 1] as LogoLayer), x: W / 2 - 150, y: v(30, 36, 90) };
      L.push(textLayer({ name: 'Precio', bind: 'price', x: W / 2 - 200, y: H * v(0.86, 0.85, 0.8), w: 400, h: 90, font: 'body', size: 52, weight: 800, color: 'primary', bg: 'accent', radius: 999, align: 'center', maxLines: 1 }));
      if (tall) cta(H - 200, 'accent', 'primary', W / 2 - 220, 'center', 440);
      break;
    }
    case 'vidrio': {
      pat('malla', 'primary', 'accent', { accent: 'white', density: 0.6 });
      const cx = m, cy = v(240, 300, 520), cw = W - 2 * m, ch = H - cy - v(m, m, 220);
      L.push(shapeLayer({ name: 'Tarjeta de vidrio', x: cx, y: cy, w: cw, h: ch, fill: 'white', fillAlpha: 0.14, radius: 48, stroke: '#FFFFFF66' as Paint }));
      // El producto se sale de la tarjeta por arriba.
      hero(cx, cy - v(200, 230, 360), cw, ch * 0.62 + v(200, 230, 360) - CS);
      strip(cx + 30, cy + ch * 0.62 - CS + 6, cw - 60, CS - 12, true);
      L.push(textLayer({ name: 'Título', bind: 'title', x: cx + 40, y: cy + ch * 0.62 + 24, w: cw - 80, h: v(70, 110, 190), size: v(54, 60, 78), maxLines: v(1, 2, 2) }));
      L.push(textLayer({ name: 'Precio', bind: 'price', x: cx + 40, y: cy + ch - 104, w: 420, h: 70, font: 'body', size: 54, weight: 800, color: 'accent', maxLines: 1 }));
      L.push(textLayer({ name: 'Botón', bind: 'cta', x: cx + cw - 40 - 320, y: cy + ch - 112, w: 320, h: 80, font: 'body', size: 34, weight: 700, color: 'primary', bg: 'white', radius: 999, upper: false, align: 'center', maxLines: 1 }));
      logo(true); L[L.length - 1] = { ...(L[L.length - 1] as LogoLayer), y: v(40, 50, 120) };
      break;
    }
    case 'revista': {
      pat('malla', 'paper', 'accent', { accent: 'white', density: 0.4 });
      L.push(textLayer({ name: 'Cabecera', bind: 'brand', x: 20, y: v(16, 30, 80), w: W - 40, h: v(200, 220, 240), size: v(200, 220, 240), weight: 900, color: 'primary', align: 'center', maxLines: 1, letterSpacing: -6 }));
      L.push(textLayer({ name: 'Edición', text: 'EDICIÓN ESPECIAL', x: m, y: v(210, 250, 320), w: 500, h: 40, font: 'body', size: 24, weight: 700, color: 'primary', letterSpacing: 6, maxLines: 1 }));
      // El producto tapa la parte de abajo de la cabecera, como en las portadas.
      const hy = v(130, 160, 230);
      hero(0, hy, W - (colors ? CS + 20 : 0), H - hy - v(20, 40, 120));
      strip(W - CS - 16, hy + v(90, 110, 200), CS, H * 0.45, false);
      L.push(textLayer({ name: 'Titular', bind: 'title', x: m, y: H - v(250, 300, 500), w: W * 0.52, h: v(170, 200, 300), size: v(60, 70, 92), color: 'primary', bg: null, maxLines: 3, lineHeight: 0.95 }));
      if (!sq) L.push(textLayer({ name: 'Bajada', bind: 'subtitle', x: m, y: H - v(0, 100, 200), w: W * 0.5, h: 70, font: 'body', size: 30, weight: 500, color: 'primary', upper: false, maxLines: 2, lineHeight: 1.25 }));
      L.push(textLayer({ name: 'Precio', bind: 'price', x: W - m - 280, y: H - v(120, 140, 220), w: 280, h: 80, font: 'body', size: 40, weight: 800, color: 'white', bg: 'primary', radius: 0, align: 'center', maxLines: 1 }));
      break;
    }
    case 'drop': {
      pat('rayas', 'black', 'white', { density: 0.04, size: 90, angle: -45 });
      L.push(textLayer({ name: 'Drop', text: 'DROP 01', x: m, y: v(50, 60, 160), w: W - 2 * m, h: 200, size: v(170, 180, 200), weight: 900, color: 'white', maxLines: 1, letterSpacing: -4 }));
      L.push(shapeLayer({ name: 'Línea', x: m, y: v(240, 250, 370), w: W - 2 * m, h: 6, fill: 'accent' }));
      glow(W / 2, v(600, 720, 1000), W * 0.55, 'accent', 0.22);
      const hy = v(190, 210, 330), hh = v(660, 820, 1200) - CS;
      hero(0, hy, W, hh);
      strip(m, hy + hh + 4, W - 2 * m, CS - 8, true);
      L.push(textLayer({ name: 'Nombre', bind: 'title', x: m, y: H - v(200, 230, 330), w: W * 0.56, h: v(110, 120, 150), size: v(40, 46, 64), color: 'white', maxLines: 2 }));
      L.push(textLayer({ name: 'Fecha', text: 'Viernes · 7 p. m.', x: W - m - 360, y: H - v(196, 226, 316), w: 360, h: 70, font: 'body', size: 34, weight: 800, color: 'black', bg: 'accent', radius: 999, upper: false, align: 'center', maxLines: 1 }));
      L.push(logoLayer({ onDark: true, x: m, y: H - m - 56, w: 260, h: 56 }));
      L.push(textLayer({ name: 'Unidades', text: 'Unidades limitadas', x: W - m - 420, y: H - m - 48, w: 420, h: 44, font: 'body', size: 28, weight: 600, color: '#FFFFFFAA' as Paint, upper: false, align: 'right', maxLines: 1 }));
      break;
    }
    case 'dividido': {
      pat('malla', 'accent', 'white', { accent: 'accent', density: 0.4 });
      if (tall || mid) {
        const split = H * 0.46;
        L.push(shapeLayer({ name: 'Bloque', x: 0, y: split, w: W, h: H - split, fill: 'primary' }));
        L.push(logoLayer({ onDark: false, x: m, y: v(0, 50, 100), w: 240, h: 56 }));
        L.push(textLayer({ name: 'Título', bind: 'title', x: m, y: v(0, 130, 200), w: W - 2 * m, h: split * 0.42, size: tall ? 120 : 92, color: 'primary', maxLines: 2, lineHeight: 0.95 }));
        // El producto cruza la línea entre los dos colores.
        hero(16, split * 0.62, W - 32, H - split * 0.62 - v(0, 120, 200) - CS);
        strip(m, H - v(0, 120, 200) - CS + 4, W - 2 * m, CS - 10, true);
        L.push(textLayer({ name: 'Precio', bind: 'price', x: m, y: H - v(0, 100, 170), w: 420, h: 80, font: 'body', size: 56, weight: 900, color: 'accent', maxLines: 1 }));
        L.push(textLayer({ name: 'Botón', bind: 'cta', x: W - m - 340, y: H - v(0, 104, 174), w: 340, h: 84, font: 'body', size: 34, weight: 700, color: 'primary', bg: 'accent', radius: 999, upper: false, align: 'center', maxLines: 1 }));
      } else {
        const split = W * 0.46;
        L.push(shapeLayer({ name: 'Bloque', x: split, y: 0, w: W - split, h: H, fill: 'primary' }));
        L.push(logoLayer({ onDark: false, x: m, y: 60, w: 240, h: 56 }));
        L.push(textLayer({ name: 'Título', bind: 'title', x: m, y: 200, w: split * 0.62, h: 420, size: 82, color: 'primary', maxLines: 4, lineHeight: 0.95 }));
        hero(split * 0.55, 60, W - split * 0.55 + 10, H - 100);
        strip(m, 640, split - m - 20, CS, false);
        L.push(textLayer({ name: 'Precio', bind: 'price', x: m, y: H - 250, w: split - m, h: 80, font: 'body', size: 56, weight: 900, color: 'primary', maxLines: 1 }));
        L.push(textLayer({ name: 'Botón', bind: 'cta', x: m, y: H - 150, w: 320, h: 84, font: 'body', size: 32, weight: 700, color: 'accent', bg: 'primary', radius: 999, upper: false, align: 'center', maxLines: 1 }));
      }
      break;
    }
    case 'resena': {
      pat('malla', 'paper', 'accent', { accent: 'white', density: 0.3 });
      logo(false);
      const cw = tall ? W - 2 * m : W * 0.6, cy = v(150, 170, 230), ch = v(560, 640, 760);
      L.push(shapeLayer({ name: 'Tarjeta', x: m, y: cy, w: cw, h: ch, fill: 'white', radius: 40, stroke: '#00000014' as Paint }));
      L.push(textLayer({ name: 'Estrellas', text: '★★★★★', x: m + 44, y: cy + 44, w: cw - 88, h: 64, font: 'body', size: 54, weight: 400, color: 'accent', upper: false, maxLines: 1, letterSpacing: 6 }));
      L.push(textLayer({ name: 'Opinión', text: '“Me encantó la calidad y el diseño quedó perfecto. Ya pedí otra.”', x: m + 44, y: cy + 130, w: cw - 88, h: ch - 250, font: 'heading', size: tall ? 62 : 46, weight: 700, color: 'primary', upper: false, maxLines: 7, lineHeight: 1.16 }));
      L.push(textLayer({ name: 'Cliente', text: 'Laura M. · Cliente verificada', x: m + 44, y: cy + ch - 92, w: cw - 88, h: 48, font: 'body', size: 28, weight: 600, color: '#55534F' as Paint, upper: false, maxLines: 1 }));
      // El producto reseñado, grande, apoyado junto a la tarjeta.
      if (tall) hero(40, cy + ch + 20 + CS, W - 80, H - cy - ch - 230 - CS);
      else hero(W * 0.48, v(200, 240, 0), W * 0.54, H - v(200, 240, 0) - v(120, 150, 0));
      strip(m, cy + ch + 16, cw, CS - 10, false);
      L.push(textLayer({ name: 'Título', bind: 'title', x: m, y: H - v(110, 130, 180), w: tall ? W - 2 * m : W * 0.5, h: 80, size: v(44, 52, 64), color: 'primary', maxLines: 1, align: tall ? 'center' : 'left' }));
      break;
    }
    case 'encuesta': {
      pat('color', 'primary', 'accent');
      L.push(shapeLayer({ name: 'Mitad B', x: W / 2, y: 0, w: W / 2, h: H, fill: 'accent' }));
      L.push(textLayer({ name: 'Pregunta', text: '¿Cuál prefieres?', x: W / 2 - 380, y: v(50, 60, 170), w: 760, h: 100, size: v(64, 70, 84), weight: 900, color: 'primary', bg: 'white', radius: 999, align: 'center', maxLines: 1 }));
      const top = v(170, 190, 330), ch = H - top - v(210, 240, 330) - CS;
      ['A', 'B'].forEach((k, i) => {
        const x = i * (W / 2);
        L.push(imageLayer({ name: `Opción ${k}`, item: i, x: x + 6, y: top, w: W / 2 - 12, h: ch, fit: 'contain', cutout: true, shadow: true }));
        L.push(textLayer({ name: `Letra ${k}`, text: k, x: x + W / 4 - 50, y: top + ch + 10, w: 100, h: 100, size: 64, weight: 900, color: i ? 'accent' : 'primary', bg: i ? 'primary' : 'accent', radius: 999, align: 'center', maxLines: 1 }));
        L.push(textLayer({ name: `Nombre ${k}`, bind: 'name', item: i, x: x + 24, y: top + ch + 118, w: W / 2 - 48, h: 46, font: 'body', size: 30, weight: 700, color: i ? 'primary' : 'white', upper: false, align: 'center', maxLines: 1 }));
      });
      strip(m, top + ch + 170, W - 2 * m, CS - 14, true);
      L.push(textLayer({ name: 'VS', text: 'VS', x: W / 2 - 60, y: top + ch / 2 - 60, w: 120, h: 120, size: 52, weight: 900, color: 'primary', bg: 'white', radius: 999, align: 'center', maxLines: 1 }));
      if (!sq) L.push(textLayer({ name: 'Llamado', text: 'Comenta A o B 👇', x: W / 2 - 300, y: H - v(0, 80, 140), w: 600, h: 64, font: 'body', size: 36, weight: 700, color: 'primary', bg: 'white', radius: 999, upper: false, align: 'center', maxLines: 1 }));
      break;
    }
    case 'top3': {
      pat('malla', 'paper', 'accent', { accent: 'white', density: 0.35 });
      logo(false);
      L.push(textLayer({ name: 'Título', text: 'Top 3 de la semana', x: m, y: v(130, 140, 220), w: W - 2 * m, h: v(80, 100, 220), size: v(66, 78, 104), color: 'primary', maxLines: v(1, 1, 2) }));
      // Podio: el 1 en el centro y más grande; el 2 y el 3 a los lados.
      const hy = v(230, 260, 470), hh = H - hy - v(170, 200, 300) - CS;
      const side = hh * 0.74, sw = W * 0.4;
      const spots: [number, number, number, number, number][] = [
        [W * 0.24, hy, W * 0.52, hh, 0], [-W * 0.02, hy + hh - side, sw, side, 1], [W * 0.62, hy + hh - side, sw, side, 2],
      ];
      [spots[1], spots[2], spots[0]].forEach(([x, y, w, h, i]) => {
        L.push(textLayer({ name: `Número ${i + 1}`, text: String(i + 1), x: x + (i ? w * 0.5 - 70 : w * 0.05), y: y - (i ? 40 : 10), w: 140, h: 170, size: i ? 150 : 200, weight: 900, color: 'accent', outline: i > 0, maxLines: 1, align: 'center' }));
        L.push(imageLayer({ name: `Foto ${i + 1}`, item: i, x, y, w, h, fit: 'contain', cutout: true, shadow: true }));
      });
      strip(m, hy + hh + 6, W - 2 * m, CS - 12, false);
      [1, 0, 2].forEach((i, col) => {
        const x = col * (W / 3) + 16, w = W / 3 - 32, y = H - v(150, 180, 270);
        L.push(textLayer({ name: `Nombre ${i + 1}`, bind: 'name', item: i, x, y, w, h: 44, font: 'body', size: 28, weight: 700, color: 'primary', upper: false, align: 'center', maxLines: 1 }));
        L.push(textLayer({ name: `Precio ${i + 1}`, bind: 'price', item: i, x, y: y + 50, w, h: 46, font: 'body', size: 34, weight: 800, color: '#55534F' as Paint, align: 'center', maxLines: 1 }));
      });
      break;
    }
    case 'regresiva': {
      pat('rayas', 'accent', 'primary', { density: 0.08, size: 70, angle: -35 });
      L.push(textLayer({ name: 'Aviso', text: 'ÚLTIMAS HORAS', x: m, y: v(60, 80, 200), w: W - 2 * m, h: 70, font: 'body', size: 40, weight: 800, color: 'primary', letterSpacing: 8, align: 'center', maxLines: 1 }));
      L.push(textLayer({ name: 'Oferta', bind: 'promo', x: 20, y: v(130, 160, 290), w: W - 40, h: v(250, 280, 320), size: v(230, 260, 300), weight: 900, color: 'primary', align: 'center', maxLines: 1, letterSpacing: -6 }));
      const hy = v(280, 330, 540);
      hero(16, hy, W - 32, H - hy - v(150, 180, 300) - CS);
      L.push(shapeLayer({ name: 'Franja', x: 0, y: H - v(150, 170, 330), w: W, h: v(150, 170, 330), fill: 'primary' }));
      strip(m, H - v(150, 170, 330) - CS, W - 2 * m, CS - 8, false);
      L.push(textLayer({ name: 'Cierre', text: 'Termina hoy a medianoche', x: m, y: H - v(110, 128, 300), w: W - 2 * m, h: 70, font: 'body', size: v(40, 44, 48), weight: 700, color: 'accent', upper: false, align: 'center', maxLines: 1 }));
      if (tall) cta(H - 160, 'primary', 'accent', W / 2 - 220, 'center', 440);
      break;
    }
    case 'collage': {
      bg('paper');
      const pw = tall ? 560 : mid ? 470 : 420, ph = pw * 1.18;
      const spots: [number, number, number][] = tall
        ? [[90, 260, -6], [W - 90 - pw, 520, 5], [140, 980, 3]]
        : mid ? [[70, 120, -6], [W - 70 - pw, 300, 5], [200, 720, 2]] : [[60, 120, -6], [W - 60 - pw, 200, 6], [W / 2 - pw / 2, 520, -2]];
      // Con colores, la franja va arriba y las fotos bajan.
      spots.forEach(([x, y0, rot], i) => {
        const y = y0 + (colors ? CS : 0);
        L.push(shapeLayer({ name: `Marco ${i + 1}`, x: x - 20, y: y - 20, w: pw + 40, h: ph + 110, fill: 'white', rotation: rot, radius: 6, stroke: '#00000010' as Paint }));
        L.push(imageLayer({ name: `Foto ${i + 1}`, item: i, x, y, w: pw, h: ph, rotation: rot }));
      });
      strip(m, v(36, 40, 100), W - 2 * m - 290, CS - 10, false);
      L.push(textLayer({ name: 'Título', bind: 'title', x: m, y: H - (tall ? 300 : 170), w: W - 2 * m, h: 120, size: tall ? 80 : 60, color: 'primary', bg: 'accent', radius: 18, maxLines: 2, align: 'center' }));
      L.push(logoLayer({ onDark: false, x: W - m - 260, y: tall ? 110 : 40, w: 260 }));
      break;
    }
    case 'beneficios': {
      pat('mosaicoMarca', 'primary', 'white', { density: 0.07, size: 110, angle: -18 });
      logo(true);
      L.push(textLayer({ name: 'Título', text: '¿Por qué comprar con nosotros?', x: m, y: v(150, 160, 230), w: W - 2 * m, h: v(170, 220, 300), size: v(64, 72, 96), maxLines: 3 }));
      const list = ['Envío a todo el país', 'Cambios fáciles', 'Paga como quieras', 'Diseños únicos'];
      const top = v(360, 430, 600), row = v(120, 150, colors ? 140 : 190), tw = tall ? W - 2 * m - 120 : W * 0.5 - m;
      list.forEach((t, i) => {
        L.push(textLayer({ name: `Check ${i + 1}`, text: '✓', x: m, y: top + i * row, w: 84, h: 84, size: 48, weight: 900, color: 'primary', bg: 'accent', radius: 999, align: 'center', maxLines: 1, upper: false }));
        L.push(textLayer({ name: `Beneficio ${i + 1}`, text: t, x: m + 108, y: top + i * row + 12, w: tw, h: 60, font: 'body', size: v(36, 40, 46), weight: 700, upper: false, maxLines: 1 }));
      });
      // El producto grande a la derecha (abajo en historias).
      if (tall) hero(60, top + 4 * row + 10 + CS, W - 120, H - (top + 4 * row + 10 + CS) - 220);
      else hero(W * 0.5, top - 60, W * 0.52, H - top + 60 - v(130, 150, 0));
      strip(m, top + 4 * row + 4, tall ? W - 2 * m : W * 0.5 - m, CS - 10, true);
      cta(H - v(110, 120, 190), 'primary', 'accent');
      break;
    }
    case 'outfit': {
      pat('malla', 'paper', 'accent', { accent: 'white', density: 0.3 });
      L.push(textLayer({ name: 'Título', text: 'Look completo', x: m, y: v(70, 90, 170), w: W * 0.42, h: 200, size: v(80, 88, 104), color: 'primary', maxLines: 2 }));
      L.push(textLayer({ name: 'Subtítulo', bind: 'subtitle', x: m, y: v(270, 300, 420), w: W * 0.36, h: colors ? 110 : 160, font: 'body', size: 32, weight: 400, color: '#55534F' as Paint, upper: false, maxLines: 4, lineHeight: 1.3 }));
      // Las prendas del look grandes y encimadas en diagonal, cada una con su precio.
      const spots: [number, number, number, number][] = [
        [W * 0.42, 20, W * 0.58, H * 0.46], [W * 0.02, H * 0.36 + CS, W * 0.56, H * 0.5 - CS * 0.6], [W * 0.5, H * 0.44, W * 0.5, H * 0.52],
      ];
      spots.forEach(([x, y, w, h], i) => {
        L.push(imageLayer({ name: `Prenda ${i + 1}`, item: i, x, y, w, h, fit: 'contain', cutout: true, shadow: true, anchor: 'center' }));
        L.push(textLayer({ name: `Precio ${i + 1}`, bind: 'price', item: i, x: x + w / 2 - 110, y: y + h - 56, w: 220, h: 50, font: 'body', size: 28, weight: 800, color: 'white', bg: 'primary', radius: 999, upper: false, align: 'center', maxLines: 1 }));
      });
      strip(m, H * 0.36 + 6, W * 0.38, CS - 10, false);
      L.push(logoLayer({ onDark: false, x: m, y: H - m - 64 }));
      break;
    }
    case 'sticker': {
      pat('malla', 'primary', 'accent', { accent: 'accent', density: 0.45 });
      glow(W / 2, H * 0.45, W * 0.6, 'accent', 0.3);
      logo(true);
      const hy = v(90, 110, 220);
      hero(10, hy, W - 20, H - hy - v(200, 230, 340) - CS);
      strip(m, H - v(200, 230, 340) - CS + 4, W - 2 * m, CS - 10, true);
      const d = v(300, 320, 380), sy = v(80, 100, 260);
      L.push(shapeLayer({ name: 'Sello', shape: 'ellipse', x: W - m - d, y: sy, w: d, h: d, fill: 'accent', rotation: -12 }));
      L.push(textLayer({ name: 'Sello: texto', text: 'SOLO', x: W - m - d, y: sy + d * 0.22, w: d, h: 50, font: 'body', size: 34, weight: 800, color: 'primary', align: 'center', maxLines: 1, rotation: -12 }));
      L.push(textLayer({ name: 'Sello: precio', bind: 'price', x: W - m - d + 20, y: sy + d * 0.38, w: d - 40, h: 100, font: 'heading', size: 72, weight: 900, color: 'primary', align: 'center', maxLines: 1, rotation: -12 }));
      L.push(textLayer({ name: 'Título', bind: 'title', x: m, y: H - v(190, 220, 330), w: W - 2 * m - v(0, 0, 0), h: v(80, 100, 130), size: v(68, 80, 104), maxLines: 1 }));
      cta(H - v(100, 112, 180), 'primary', 'accent');
      break;
    }
  }
  // Fondos, sombras y velos decorativos quedan bloqueados: un clic encima elige el texto o la foto.
  return { ratio, template: id, layers: L.map((l) => ((l.type === 'shape' || l.type === 'pattern') && /^(Fondo|Sombra|Velo|Luz)/.test(l.name) ? { ...l, locked: true } : l)) };
}

/**
 * Lleva un diseño editado a otro formato: rearma la plantilla con la distribución de ese formato y le
 * pasa lo que el usuario cambió en cada capa (textos, colores, fotos, diseños, visibilidad). Las capas
 * que agregó se escalan al nuevo alto y van encima; las que quitó no vuelven.
 */
export function reflowDesign(d: Design, ratio: DesignRatio, opts?: { colors?: string[] | null }): Design {
  const had = d.layers.find((l): l is ColorsLayer => l.type === 'colors');
  const colors = opts && 'colors' in opts ? opts.colors ?? null : had?.colors ?? null;
  const built = buildDesign(d.template, ratio, { colors });
  const old = new Map(d.layers.map((l) => [l.name, l]));
  const builtNames = new Set(built.layers.map((l) => l.name));
  const keep = (n: Layer, o: Layer): Layer => {
    const common = { id: o.id, hidden: o.hidden, locked: o.locked, opacity: o.opacity };
    if (n.type === 'text' && o.type === 'text') {
      return { ...n, ...common, text: o.text, bind: o.bind, item: o.item, font: o.font, weight: o.weight, color: o.color, upper: o.upper, bg: o.bg, strike: o.strike, outline: o.outline, shadow: o.shadow, letterSpacing: o.letterSpacing, showIf: o.showIf };
    }
    if (n.type === 'image' && o.type === 'image') return { ...n, ...common, src: o.src, item: o.item, mock: o.mock ?? n.mock, fit: o.fit, zoom: o.zoom, border: o.border, shadow: o.shadow };
    if (n.type === 'shape' && o.type === 'shape') return { ...n, ...common, shape: o.shape, fill: o.fill, fillTo: o.fillTo, fillAlpha: o.fillAlpha, fillToAlpha: o.fillToAlpha, stroke: o.stroke, dashed: o.dashed };
    if (n.type === 'logo' && o.type === 'logo') return { ...n, ...common, kind: o.kind, onDark: o.onDark };
    if (n.type === 'colors' && o.type === 'colors') return { ...n, ...common, style: o.style, label: o.label };
    if (n.type === 'pattern' && o.type === 'pattern') return { ...n, ...common, style: o.style, base: o.base, ink: o.ink, accent: o.accent, density: o.density, size: o.size, angle: o.angle, grain: o.grain, designs: o.designs, useMockDesigns: o.useMockDesigns };
    return n;
  };
  // Los colores disponibles van siempre que se pidan (aunque antes no estuvieran).
  const layers: Layer[] = built.layers.filter((n) => old.has(n.name) || n.type === 'colors').map((n) => (old.has(n.name) ? keep(n, old.get(n.name)!) : n));
  const added = d.layers.filter((l) => !builtNames.has(l.name) && l.type !== 'colors');
  return { ...built, layers: [...layers, ...resizeDesign({ ...d, layers: added }, ratio).layers] };
}

/** Lleva un diseño a otro formato conservando las capas: escala las posiciones al nuevo alto. */
export function resizeDesign(d: Design, ratio: DesignRatio): Design {
  const [, H0] = designSize(d.ratio);
  const [, H1] = designSize(ratio);
  const k = H1 / H0;
  return {
    ...d, ratio,
    layers: d.layers.map((l) => {
      // El fondo y las fotos a sangre cubren el lienzo nuevo completo.
      const full = l.y <= 1 && l.h >= H0 - 2;
      return full ? { ...l, h: H1 } : { ...l, y: Math.round(l.y * k), h: l.type === 'text' ? l.h : Math.round(l.h * k) };
    }),
  };
}
