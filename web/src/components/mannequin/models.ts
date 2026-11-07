/**
 * Maniquíes 3D del personalizador (portada, editor avanzado y editor de zonas del admin).
 *
 * Cómo se hicieron (todo con IA, por API):
 *  1. Foto de estudio de cada camiseta en el maniquí con FLUX.1-schnell (licencia Apache 2.0).
 *  2. Modelo 3D a partir de esa foto con Hunyuan3D 2.1 (Tencent, licencia Tencent Hunyuan Community).
 *  3. Simplificado a ~40 mil caras con gltf-transform.
 *
 * Cada plantilla del admin elige su maniquí en "Modelo 3D" (columna products.model3d). Las claves de
 * MODELS_3D deben coincidir con TemplateController::MODELS_3D en la API.
 *
 * Coordenadas: cada vista (frente, espalda, mangas) es un "escenario" cuadrado que ocupa todo el
 * recuadro 3D cuando el maniquí mira esa vista. Las zonas de la BD y los diseños se guardan en % de
 * ese escenario, igual que en el editor con fotos.
 */
export type Model3D = 'basica' | 'oversize';

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
}

export const MODELS_3D: Record<Model3D, ModelConfig> = {
  basica: {
    label: 'Básica',
    model: '/models/camiseta-basica.glb',
    poster: '/models/camiseta-basica.png',
    headFrom: 0.767,
    bodyTop: 0.681,
    collarFront: 0.748,
    collarBack: 0.76,
    collarSide: 0.764,
    collarFromMesh: true,
    collarCurve: 1,
    hem: 0.143,
    cut: 0,
    sleeveY: 0.655,
  },
  oversize: {
    label: 'Oversize',
    model: '/models/camiseta-oversize.glb',
    poster: '/models/camiseta-oversize.png',
    headFrom: 0.771,
    bodyTop: 0.685,
    collarFront: 0.74,
    collarBack: 0.765,
    collarCurve: 2,
    hem: 0.107,
    cut: 0.112,
    sleeveY: 0.585,
  },
};

export const isModel3D = (v: unknown): v is Model3D => typeof v === 'string' && v in MODELS_3D;

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
