/**
 * Maniquíes 3D del personalizador (portada, editor avanzado y editor de zonas del admin).
 *
 * Cada .glb trae dos piezas con su material: "camiseta" (se recolorea) y "maniqui" (grafito, con su
 * base). Ya vienen con la línea de cuello, la caída del ruedo y las mangas y paneles lisos para
 * estampar, así que se ven igual en cualquier visor .glb. Versión web comprimida en public/models;
 * completa (para otros programas) en recursos/maniquies. La versión 1 queda en recursos/maniquies/v1.
 *
 * Cada plantilla del admin elige su maniquí en "Modelo 3D" (columna products.model3d). Las claves de
 * MODELS_3D deben coincidir con TemplateController::MODELS_3D en la API.
 *
 * Coordenadas: cada vista (frente, espalda, mangas) es un "escenario" cuadrado que ocupa todo el
 * recuadro 3D cuando el maniquí mira esa vista. Las zonas de la BD y los diseños se guardan en % de
 * ese escenario, igual que en el editor con fotos.
 */
/** Clave del maniquí: 'basica', 'oversize' (del sistema) o la de uno generado en Admin → Modelos 3D ('m12'). */
export type Model3D = string;

/** Vistas del maniquí. Las mangas se nombran desde quien lleva puesta la camiseta. */
export type View3D = 'front' | 'back' | 'rightSleeve' | 'leftSleeve';
export const VIEWS_3D: { id: View3D; label: string }[] = [
  { id: 'front', label: 'Frente' },
  { id: 'back', label: 'Espalda' },
  { id: 'rightSleeve', label: 'Manga der.' },
  { id: 'leftSleeve', label: 'Manga izq.' },
];

export interface ModelConfig {
  label: string;
  /** Modelo 3D (.glb). */
  model: string;
  /** Foto fija mientras carga el 3D. */
  poster: string;
  /** Por encima de esta altura (fracción del alto, 0 = abajo) todo es maniquí: cabeza y cuello. */
  headFrom: number;
  /** Debajo de esta altura todo es tela. */
  bodyTop: number;
  /** Escote: altura del borde del cuello adelante y atrás (fracciones del alto). */
  collarFront: number;
  collarBack: number;
  /**
   * Forma del escote entre la espalda y el frente: 1 = baja parejo; 2 = se mantiene alto a los
   * costados y solo baja adelante.
   */
  collarCurve: number;
  /** Altura del escote a los costados (opcional; si está, reemplaza la curva). */
  collarSide?: number;
  /**
   * Medir el escote en la malla (la canaleta entre el resorte y el cuello) en vez de usar solo las
   * alturas. Donde no hay canaleta clara se usan `collarSide` y `collarBack`.
   */
  collarFromMesh?: boolean;
  /** Altura del ruedo: por debajo, lo que es maniquí (piernas o palo) se quita y va la base común. */
  hem: number;
  /** Corte recto: todo lo que quede por debajo se quita (piernas que asoman bajo el ruedo). 0 = sin corte. */
  cut: number;
  /** Altura del centro de la manga (fracción del alto), para medir qué tan afuera está. */
  sleeveY: number;
  /**
   * Modelo por piezas: el .glb trae la camiseta y el maniquí (con su base) como materiales
   * "camiseta" y "maniqui". La tela sale del material, sin reglas de altura ni recortes, y la base es
   * la del modelo. Las alturas de escote, ruedo y corte no se usan.
   */
  parts?: boolean;
  /**
   * Con patrón de costura (v2): el .glb trae las piezas de la camiseta aplanadas (TEXCOORD_0) y el
   * estampado se pinta sobre la tela misma, no se proyecta: no se estira, no se corta ni queda por
   * debajo en ningún pliegue, y mide lo mismo en cualquier zona.
   */
  uv?: boolean;
  /**
   * Área que ocupa cada pieza del patrón en la vista del editor ([x, y, ancho, alto] en % del
   * escenario). Con "Piezas del modelo" cada zona es su pieza entera; el estampado se recorta a la pieza.
   */
  pieces?: Record<View3D, [number, number, number, number]>;
  /**
   * Objeto completo (gorra, bolso, taza…): todo el modelo es tela, sin maniquí, palo ni recortes, y
   * los lados se miran de frente (sin buscar mangas).
   */
  object?: boolean;
  /** Con maniquí de cabeza o de piernas: por encima de esta altura es tela; por debajo, maniquí. */
  clothFrom?: number;
  /**
   * Tela por color (cabeza o piernas): lo que en la textura del modelo es más claro que esto
   * (luminancia 0..1) es la prenda (sale blanca en la foto estándar); lo demás, el maniquí grafito.
   */
  lightFrom?: number;
}

/** Maniquíes del sistema: siempre están, con sus ajustes finos en el código. */
export const SYSTEM_MODELS_3D = ['basica', 'oversize'] as const;

/**
 * Registro de maniquíes: los del sistema y, cuando se cargan (`loadModels3D`), los publicados en
 * Admin → Modelos 3D. Los generados se pintan como la versión 1: la tela se separa del maniquí por
 * alturas (`headFrom`, `bodyTop`, escote, ruedo) y el estampado se proyecta.
 */
export const MODELS_3D: Record<Model3D, ModelConfig> = {
  basica: {
    label: 'Básica',
    model: '/models/camiseta-basica.glb',
    poster: '/models/camiseta-basica.png',
    headFrom: 0.767, bodyTop: 0.681, collarFront: 0.748, collarBack: 0.76, collarCurve: 1, hem: 0.143, cut: 0,
    sleeveY: 0.655,
    parts: true,
    uv: true,
    pieces: { front: [35.2, 27, 29.2, 56.2], back: [35.8, 25.5, 29, 57.8], rightSleeve: [38.5, 26.8, 17.5, 21.8], leftSleeve: [43.8, 27, 17.5, 22] },
  },
  oversize: {
    label: 'Oversize',
    model: '/models/camiseta-oversize.glb',
    poster: '/models/camiseta-oversize.png',
    headFrom: 0.771, bodyTop: 0.685, collarFront: 0.74, collarBack: 0.765, collarCurve: 2, hem: 0.107, cut: 0,
    sleeveY: 0.585,
    parts: true,
    uv: true,
    pieces: { front: [33.5, 27.5, 33, 60], back: [32, 25, 35.2, 62.5], rightSleeve: [40.5, 27.8, 15.8, 31.8], leftSleeve: [46.8, 28, 15.5, 31.5] },
  },
};

export const isModel3D = (v: unknown): v is Model3D => typeof v === 'string' && Object.prototype.hasOwnProperty.call(MODELS_3D, v);

export type ModelKind = 'maniqui' | 'cabeza' | 'piernas' | 'objeto';

/** Ajustes de la tela de un maniquí generado (lo que guarda la API en `config`). */
export interface GeneratedModelConfig {
  /**
   * maniqui: prenda de arriba en el torso (se separa por alturas: cabeza, escote, ruedo); cabeza (gorra)
   * y piernas (pantalón): tela por encima de `clothFrom`; objeto: todo es tela.
   */
  kind: ModelKind;
  /** Cabeza y piernas: separar la tela por color de la textura o por altura. */
  split: 'color' | 'altura';
  lightFrom: number;
  clothFrom: number;
  headFrom: number; bodyTop: number; collarFront: number; collarBack: number; collarCurve: number;
  hem: number; cut: number; sleeveY: number;
}

/** Maniquí publicado tal como lo da `GET /mannequin-models/public`. */
export interface PublishedModel3D { key: string; name: string; model: string; poster: string | null; config: GeneratedModelConfig }

/** Config del motor 3D para un maniquí generado. */
export function generatedConfig(name: string, model: string, poster: string | null, c: GeneratedModelConfig): ModelConfig {
  if (c.kind && c.kind !== 'maniqui') {
    // Alturas fuera de rango: nada es cabeza ni se recorta abajo; el maniquí y su base vienen en el
    // modelo. Cabeza y piernas separan tela y maniquí por `clothFrom`.
    return {
      label: name, model, poster: poster || MODELS_3D.basica.poster, object: true,
      clothFrom: c.kind === 'objeto' || c.split !== 'altura' ? undefined : c.clothFrom,
      lightFrom: c.kind !== 'objeto' && c.split !== 'altura' ? c.lightFrom : undefined,
      headFrom: 2, bodyTop: 2, collarFront: 2, collarBack: 2, collarCurve: 1, hem: -1, cut: 0, sleeveY: 0.5,
    };
  }
  return {
    label: name, model, poster: poster || MODELS_3D.basica.poster,
    headFrom: c.headFrom, bodyTop: c.bodyTop, collarFront: c.collarFront, collarBack: c.collarBack,
    collarCurve: c.collarCurve, hem: c.hem, cut: c.cut, sleeveY: c.sleeveY,
  };
}

/** Agrega (o actualiza) maniquíes generados al registro. */
export function registerModels3D(list: PublishedModel3D[]) {
  for (const m of list) {
    if ((SYSTEM_MODELS_3D as readonly string[]).includes(m.key)) continue;
    MODELS_3D[m.key] = generatedConfig(m.name, m.model, m.poster, m.config);
  }
}

/** Color del maniquí (grafito de la marca): contrasta con camisetas claras y oscuras. */
export const MANNEQUIN_COLOR = '#6E6C6D';

/** Cámara de la escena: el escenario de cada vista se calcula con ella. */
export const CAMERA = { distance: 4.3, fov: 35 };

/** Giro del maniquí para mostrar cada vista de frente a la cámara. */
export const VIEW_ANGLE: Record<View3D, number> = { front: 0, back: Math.PI, rightSleeve: Math.PI / 2, leftSleeve: -Math.PI / 2 };

const plain = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Vista 3D de un tipo de zona de la BD (frente, bolsillo, espalda, manga-derecha…). Lo que no se
 * reconoce va al frente.
 */
export function view3DOf(zoneTypeSlug: string | null | undefined): View3D {
  const s = plain(zoneTypeSlug || '');
  if (/espalda|back|traser/.test(s)) return 'back';
  if (/(manga|sleeve).*(izq|left)|(izq|left).*(manga|sleeve)/.test(s)) return 'leftSleeve';
  if (/manga|sleeve|side|lado|lateral/.test(s)) return 'rightSleeve';
  return 'front';
}
