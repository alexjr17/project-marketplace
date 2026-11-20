/**
 * Línea de tiempo del video por escenas. Cada escena es de un tipo:
 * - 3d: una prenda personalizable en el escenario 3D, con su diseño, color y movimiento de cámara;
 * - foto: la foto de un producto (de la tienda o de una colección) con movimiento lento;
 * - texto: una pantalla de texto sobre los colores de la marca;
 * - clip: un video propio subido en el momento, recortado (desde qué segundo y cuánto dura).
 * Cada escena tiene sus textos (con animación y posición) y la transición hacia la siguiente, con su
 * duración. Al final puede ir el cierre con el logo. Sin React ni Three.js: se puede probar aparte.
 *
 * Las escenas 3D se graban con DOS maniquíes que se turnan (escena par en uno, impar en el otro):
 * mientras uno se ve, el otro ya carga la escena 3D siguiente, y durante la transición se ven los dos.
 */

export type SceneKind = '3d' | 'foto' | 'texto' | 'clip';
export type Motion =
  | 'giro' | 'giroRapido' | 'revelar' | 'orbita' | 'heroe' | 'frente' | 'espalda' | 'perfil' | 'vaiven' | 'acercar' | 'detalle'
  | 'flotar' | 'giroFlotando' | 'rebote' | 'balanceo' | 'caida' | 'pirueta';
export type PhotoMove = 'acercar' | 'alejar' | 'paneo' | 'quieta';
export type PhotoFit = 'tarjeta' | 'completa';
export type TextAnim = 'subir' | 'pop' | 'deslizar' | 'escribir' | 'letras' | 'ninguna';
export type TextPos = 'abajo' | 'centro' | 'arriba';
export type TextBg = 'marca' | 'acento' | 'claro' | 'malla' | 'rayas' | 'mosaicoMarca' | 'mosaicoDisenos';
export type Transition =
  | 'corte' | 'fundido' | 'color' | 'barrido' | 'empujar' | 'deslizar' | 'zoom' | 'remolino' | 'circulo'
  | 'persiana' | 'diagonal' | 'desenfoque' | 'glitch' | 'mosaico' | 'destello' | 'cortina';

export const SCENE_KINDS: { value: SceneKind; label: string; hint: string }[] = [
  { value: '3d', label: 'Prenda 3D', hint: 'Una prenda personalizable en el escenario 3D' },
  { value: 'foto', label: 'Foto de producto', hint: 'La foto de un producto con movimiento de cámara' },
  { value: 'texto', label: 'Texto', hint: 'Una pantalla con un mensaje sobre los colores de la marca' },
  { value: 'clip', label: 'Clip de video', hint: 'Un video tuyo, recortado' },
];

export const MOTIONS: { value: Motion; label: string; hint: string; speed?: boolean }[] = [
  { value: 'giro', label: 'Giro completo', hint: 'Da la vuelta entera', speed: true },
  { value: 'giroRapido', label: 'Giro rápido', hint: 'Dos vueltas que arrancan y frenan suave', speed: true },
  { value: 'revelar', label: 'Revelar', hint: 'Empieza de espalda y gira hasta el frente' },
  { value: 'orbita', label: 'Órbita', hint: 'La cámara rodea la prenda subiendo y bajando', speed: true },
  { value: 'heroe', label: 'Plano héroe', hint: 'Cámara baja mirando hacia arriba, girando despacio' },
  { value: 'frente', label: 'Frente', hint: 'Quieto de frente, acercándose despacio' },
  { value: 'espalda', label: 'Espalda', hint: 'Quieto de espalda, acercándose despacio' },
  { value: 'perfil', label: 'Perfil', hint: 'De lado, con un leve vaivén' },
  { value: 'vaiven', label: 'Vaivén', hint: 'Se mueve de lado a lado', speed: true },
  { value: 'acercar', label: 'Acercar al diseño', hint: 'La cámara se acerca al pecho' },
  { value: 'detalle', label: 'Detalle', hint: 'Primer plano del diseño, recorriéndolo despacio' },
  { value: 'flotar', label: 'Flotar', hint: 'La prenda flota suave en el aire, meciéndose', speed: true },
  { value: 'giroFlotando', label: 'Giro flotando', hint: 'Da la vuelta mientras sube y baja suave', speed: true },
  { value: 'rebote', label: 'Rebote', hint: 'Salta con energía y cae suave', speed: true },
  { value: 'balanceo', label: 'Balanceo', hint: 'Se mece de lado a lado, como colgada de un gancho', speed: true },
  { value: 'caida', label: 'Caída', hint: 'Entra cayendo desde arriba, rebota y queda flotando' },
  { value: 'pirueta', label: 'Pirueta', hint: 'Una vuelta rápida con un saltito y queda de frente' },
];

export const PHOTO_MOVES: { value: PhotoMove; label: string }[] = [
  { value: 'acercar', label: 'Acercar' },
  { value: 'alejar', label: 'Alejar' },
  { value: 'paneo', label: 'Paneo de lado' },
  { value: 'quieta', label: 'Quieta' },
];

export const TEXT_ANIMS: { value: TextAnim; label: string }[] = [
  { value: 'subir', label: 'Subir' },
  { value: 'pop', label: 'Rebote' },
  { value: 'deslizar', label: 'Deslizar' },
  { value: 'escribir', label: 'Máquina de escribir' },
  { value: 'letras', label: 'Letra por letra' },
  { value: 'ninguna', label: 'Sin animación' },
];

export const TEXT_POSITIONS: { value: TextPos; label: string }[] = [
  { value: 'abajo', label: 'Abajo' },
  { value: 'centro', label: 'Centro' },
  { value: 'arriba', label: 'Arriba' },
];

export const TEXT_BGS: { value: TextBg; label: string }[] = [
  { value: 'marca', label: 'Color de la marca' },
  { value: 'acento', label: 'Acento' },
  { value: 'claro', label: 'Claro' },
  { value: 'malla', label: 'Malla de color' },
  { value: 'rayas', label: 'Rayas' },
  { value: 'mosaicoMarca', label: 'Mosaico de la marca' },
  { value: 'mosaicoDisenos', label: 'Mosaico de diseños' },
];

export const TRANSITIONS: { value: Transition; label: string; group: 'suave' | 'movimiento' | 'efecto' }[] = [
  { value: 'fundido', label: 'Fundido', group: 'suave' },
  { value: 'color', label: 'Fundido al color de la marca', group: 'suave' },
  { value: 'desenfoque', label: 'Desenfoque', group: 'suave' },
  { value: 'corte', label: 'Corte directo', group: 'suave' },
  { value: 'barrido', label: 'Barrido', group: 'movimiento' },
  { value: 'empujar', label: 'Empujar', group: 'movimiento' },
  { value: 'deslizar', label: 'Deslizar hacia arriba', group: 'movimiento' },
  { value: 'diagonal', label: 'Diagonal', group: 'movimiento' },
  { value: 'zoom', label: 'Zoom', group: 'movimiento' },
  { value: 'remolino', label: 'Remolino (giro rápido)', group: 'movimiento' },
  { value: 'circulo', label: 'Círculo', group: 'efecto' },
  { value: 'persiana', label: 'Persiana', group: 'efecto' },
  { value: 'glitch', label: 'Glitch', group: 'efecto' },
  { value: 'mosaico', label: 'Mosaico', group: 'efecto' },
  { value: 'destello', label: 'Destello', group: 'efecto' },
  { value: 'cortina', label: 'Cortina de la marca', group: 'efecto' },
];

/** Sonido recomendado de cada transición (la lista completa está en sfx.ts). */
export const TRANSITION_SOUND_DEFAULT: Record<Transition, string> = {
  corte: 'click', fundido: 'swoosh', color: 'swoosh', desenfoque: 'whoosh', barrido: 'swipe', empujar: 'whoosh', deslizar: 'swoosh',
  diagonal: 'swipe', zoom: 'whoosh', remolino: 'whoosh', circulo: 'pop', persiana: 'obturador', glitch: 'glitch', mosaico: 'glitch',
  destello: 'obturador', cortina: 'whoosh',
};

/** Diseño puesto en una zona de la prenda. */
export interface SceneDesign {
  id: number;
  name: string;
  image: string;
}

/** Producto de una escena de foto. */
export interface SceneProduct {
  id: number;
  name: string;
  image: string | null;
  price?: number;
  listPrice?: number;
  discountPercent?: number;
}

/** Video propio de una escena (queda solo en el navegador: el archivo no se sube). */
export interface SceneClip {
  id: string;
  name: string;
  /** Duración total del archivo (s). */
  duration: number;
  /** Primer cuadro, para la línea de tiempo. */
  thumb: string | null;
}

export interface Scene {
  id: string;
  kind: SceneKind;
  // ── Prenda 3D
  /** Plantilla personalizable (con modelo 3D) de la escena. */
  templateId: number | null;
  design: SceneDesign | null;
  /** Zona de la plantilla donde va el diseño (id); null = la primera del frente. */
  zoneId: number | null;
  /** Tamaño del diseño dentro de la zona (0.3..1). */
  size: number;
  /** Corrimiento del diseño en la prenda con fotos (fracción de la foto). */
  offsetX: number;
  offsetY: number;
  color: string;
  motion: Motion;
  /** Velocidad de los movimientos continuos (giro, órbita, vaivén). */
  speed: number;
  // ── Foto
  product: SceneProduct | null;
  /** De dónde sale la foto: un producto, o una plantilla personalizable con el diseño montado en su zona. */
  photoSource: 'producto' | 'plantilla';
  photoMove: PhotoMove;
  photoFit: PhotoFit;
  // ── Texto
  textBg: TextBg;
  /** Fondo propio de la escena (cualquier tipo), con la misma libertad que en los posts; null: el de la plantilla. */
  bg: SceneBg | null;
  /** Elementos movidos a mano en la vista previa: corrimiento (fracción del ancho y alto) y tamaño. */
  moves: Partial<Record<MoveKey, ElemMove>>;
  // ── Clip de video
  clip: SceneClip | null;
  /** Desde qué segundo del clip empieza la escena. */
  clipStart: number;
  // ── Textos de la escena (en todas)
  title: string;
  subtitle: string;
  /** Etiqueta corta arriba (ej.: NUEVO, -20 %). */
  badge: string;
  textAnim: TextAnim;
  textPos: TextPos;
  showPrice: boolean;
  seconds: number;
  /** Transición hacia la escena siguiente (o hacia el cierre) y su duración. */
  transition: Transition;
  transitionSeconds: number;
  /** Sonido de la transición (ver sfx.ts); null = sin sonido. */
  sound: string | null;
  /** Lo que dice el narrador durante la escena. */
  narration: string;
}

export const TRANSITION_SECONDS = 0.7;
export const TRANSITION_MIN = 0.3;
export const TRANSITION_MAX = 1.5;
export const END_SECONDS = 2.4;
export const SCENE_MIN = 1.5;
export const SCENE_MAX = 30;
/** Máximo de las escenas que no son clips (los clips pueden durar más). */
export const SCENE_MAX_STILL = 12;
export const MAX_SCENES = 12;
export const SPEED_MIN = 0.5;
export const SPEED_MAX = 2;

let seq = 0;
export const newSceneId = () => `s${Date.now().toString(36)}${(seq++).toString(36)}`;

/** Elementos de la escena que se pueden mover en la vista previa. */
export type MoveKey = 'prenda' | 'etiqueta' | 'titulo' | 'subtitulo' | 'precio' | 'boton';
export const MOVE_KEYS: MoveKey[] = ['prenda', 'etiqueta', 'titulo', 'subtitulo', 'precio', 'boton'];
/** Corrimiento (fracción del ancho y del alto del video) y tamaño (1 = el de la plantilla). */
export interface ElemMove { x: number; y: number; s: number }
export function elemMoveOf(v: unknown): ElemMove | null {
  if (!v || typeof v !== 'object') return null;
  const r = v as Record<string, unknown>;
  return { x: num(r.x, -1, 1, 0), y: num(r.y, -1, 1, 0), s: num(r.s, 0.3, 3, 1) };
}

/** Fondo propio de una escena: un estilo (como en los posts) o una foto (subida o creada con IA). */
export interface SceneBg {
  style: 'color' | 'degradado' | 'malla' | 'rayas' | 'mosaicoMarca' | 'mosaicoDisenos' | 'nieve' | 'bastones' | 'esferas' | 'copos' | 'luces' | 'pinos' | 'estrellas' | 'foto';
  base: string;
  ink: string;
  accent: string;
  density: number;
  size: number;
  angle: number;
  grain: boolean;
  /** El dibujo (o la foto) se mueve despacio durante la escena. */
  move: boolean;
  /** Foto de fondo (estilo "foto"). */
  image: string | null;
  /** Oscurecer la foto para que se lean los textos (0..0.7). */
  dim: number;
  /** Mosaico de diseños: los elegidos y si suma los de las prendas del video. */
  designs: string[];
  useSceneDesigns: boolean;
}
export const SCENE_BG_STYLES: SceneBg['style'][] = ['color', 'degradado', 'malla', 'rayas', 'mosaicoMarca', 'mosaicoDisenos', 'nieve', 'bastones', 'esferas', 'copos', 'luces', 'pinos', 'estrellas', 'foto'];
const HEX = /^#[0-9a-fA-F]{6}$/;
export function sceneBgOf(v: unknown): SceneBg | null {
  if (!v || typeof v !== 'object') return null;
  const r = v as Record<string, unknown>;
  const style = SCENE_BG_STYLES.includes(r.style as SceneBg['style']) ? (r.style as SceneBg['style']) : null;
  if (!style) return null;
  const hex = (x: unknown, d: string) => (typeof x === 'string' && HEX.test(x) ? x : d);
  return {
    style, base: hex(r.base, '#1F1D1E'), ink: hex(r.ink, '#ABD04C'), accent: hex(r.accent, '#ABD04C'),
    density: num(r.density, 0, 1, 0.5), size: num(r.size, 40, 400, 150), angle: num(r.angle, -90, 90, -18),
    grain: r.grain !== false, move: r.move !== false,
    image: typeof r.image === 'string' && r.image.length < 400 && !r.image.startsWith('data:') ? r.image : null,
    dim: num(r.dim, 0, 0.7, 0),
    designs: Array.isArray(r.designs) ? r.designs.filter((u): u is string => typeof u === 'string' && u.length < 400 && !u.startsWith('data:')).slice(0, 12) : [],
    useSceneDesigns: r.useSceneDesigns !== false,
  };
}

export function newScene(base?: Partial<Scene>): Scene {
  const transition = base?.transition ?? 'fundido';
  return {
    id: newSceneId(), kind: '3d', templateId: null, design: null, zoneId: null, size: 0.85, offsetX: 0, offsetY: 0, color: '#FFFFFF', motion: 'giro', speed: 1,
    product: null, photoSource: 'producto', photoMove: 'acercar', photoFit: 'tarjeta', textBg: 'marca', bg: null, moves: {}, clip: null, clipStart: 0,
    title: '', subtitle: '', badge: '', narration: '', textAnim: 'subir', textPos: 'abajo', showPrice: false,
    seconds: 4, transition: 'fundido', transitionSeconds: TRANSITION_SECONDS, sound: TRANSITION_SOUND_DEFAULT[transition], ...base,
  };
}

const pick = <T extends string>(v: unknown, list: { value: T }[], dflt: T): T => (list.some((o) => o.value === v) ? (v as T) : dflt);
const num = (v: unknown, min: number, max: number, dflt: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : dflt);
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');

/** Escena completa y válida a partir de datos sueltos (guardados, de la IA o de un guion). */
export function normalizeScene(raw: Partial<Scene> | Record<string, unknown>): Scene {
  const r = raw as Record<string, unknown>;
  const d = newScene();
  return {
    ...d,
    id: typeof r.id === 'string' && r.id ? r.id : d.id,
    kind: pick(r.kind, SCENE_KINDS, '3d'),
    templateId: typeof r.templateId === 'number' ? r.templateId : null,
    design: r.design && typeof r.design === 'object' ? (r.design as SceneDesign) : null,
    zoneId: typeof r.zoneId === 'number' ? r.zoneId : null,
    size: num(r.size, 0.3, 2, d.size),
    offsetX: num(r.offsetX, -0.5, 0.5, 0),
    offsetY: num(r.offsetY, -0.5, 0.5, 0),
    color: typeof r.color === 'string' && /^#[0-9a-f]{3,8}$/i.test(r.color) ? r.color : d.color,
    motion: pick(r.motion, MOTIONS, 'giro'),
    speed: num(r.speed, SPEED_MIN, SPEED_MAX, 1),
    product: r.product && typeof r.product === 'object' ? (r.product as SceneProduct) : null,
    photoSource: r.photoSource === 'plantilla' ? 'plantilla' : 'producto',
    photoMove: pick(r.photoMove, PHOTO_MOVES, 'acercar'),
    photoFit: r.photoFit === 'completa' ? 'completa' : 'tarjeta',
    textBg: pick(r.textBg, TEXT_BGS, 'marca'),
    bg: sceneBgOf(r.bg),
    moves: Object.fromEntries(MOVE_KEYS.flatMap((k) => {
      const m = elemMoveOf((r.moves as Record<string, unknown> | undefined)?.[k]);
      return m ? [[k, m]] : [];
    })),
    clip: r.clip && typeof r.clip === 'object' ? (r.clip as SceneClip) : null,
    clipStart: num(r.clipStart, 0, 3600, 0),
    title: str(r.title, 60),
    subtitle: str(r.subtitle, 90),
    badge: str(r.badge, 18),
    narration: str(r.narration, 300),
    textAnim: pick(r.textAnim, TEXT_ANIMS, 'subir'),
    textPos: pick(r.textPos, TEXT_POSITIONS, 'abajo'),
    showPrice: r.showPrice === true,
    seconds: clampSeconds(typeof r.seconds === 'number' ? r.seconds : d.seconds),
    transition: pick(r.transition, TRANSITIONS, 'fundido'),
    transitionSeconds: num(r.transitionSeconds, TRANSITION_MIN, TRANSITION_MAX, TRANSITION_SECONDS),
    sound: typeof r.sound === 'string' && r.sound ? r.sound.slice(0, 20) : r.sound === null ? null : d.sound,
  };
}

export const clampSeconds = (s: number) => Math.min(SCENE_MAX, Math.max(SCENE_MIN, Number.isFinite(s) ? s : 4));
/** Máximo de una escena: los clips hasta donde dura el archivo. */
export const maxSeconds = (s: Scene) => (s.kind === 'clip' && s.clip ? Math.max(SCENE_MIN, s.clip.duration - s.clipStart) : SCENE_MAX_STILL);
const trSeconds = (s: Scene) => Math.min(TRANSITION_MAX, Math.max(TRANSITION_MIN, Number.isFinite(s.transitionSeconds) ? s.transitionSeconds : TRANSITION_SECONDS));

/** Inicio de cada escena, fin de las escenas (= inicio del cierre) y duración total. */
export function layout(scenes: Scene[], endCard: boolean) {
  const starts: number[] = [];
  let t = 0;
  for (const s of scenes) { starts.push(t); t += clampSeconds(s.seconds); }
  return { starts, body: t, total: t + (endCard && scenes.length ? END_SECONDS : 0) };
}

export interface Frame {
  /** Escena que se ve (índice); scenes.length = el cierre. */
  index: number;
  /** Segundos dentro de la escena (o del cierre). */
  local: number;
  /** Si hay transición en curso: de qué escena a cuál (scenes.length = el cierre), avance 0..1, tipo y duración. */
  transition: { from: number; to: number; p: number; kind: Transition; seconds: number } | null;
  /** Avance 0..1 del cierre (solo en el cierre). */
  end: number;
}

/**
 * Qué se ve en el segundo `t`. La transición entre la escena i y la i+1 (o el cierre) está centrada en
 * el corte: la mitad antes y la mitad después.
 */
export function frameAt(scenes: Scene[], endCard: boolean, t: number): Frame {
  const n = scenes.length;
  if (!n) return { index: 0, local: 0, transition: null, end: 0 };
  const { starts, body, total } = layout(scenes, endCard);
  const withEnd = endCard;
  const tt = Math.min(Math.max(0, t), total - 1e-6);
  const segStart = (i: number) => (i === n ? body : starts[i]);
  const segLen = (i: number) => (i === n ? END_SECONDS : clampSeconds(scenes[i].seconds));
  let i = withEnd && tt >= body ? n : n - 1;
  while (i > 0 && i <= n && segStart(i) > tt) i--;
  const local = tt - segStart(i);
  const end = i === n ? Math.min(1, local / END_SECONDS) : 0;
  // Entrando desde la anterior.
  if (i > 0) {
    const prev = scenes[i - 1];
    const half = trSeconds(prev) / 2;
    if (local < half && prev.transition !== 'corte') {
      return { index: i, local, transition: { from: i - 1, to: i, p: (local + half) / (half * 2), kind: prev.transition, seconds: half * 2 }, end };
    }
  }
  // Saliendo hacia la siguiente (o al cierre).
  const hasNext = i < n - 1 || (i === n - 1 && withEnd);
  if (i < n && hasNext) {
    const half = trSeconds(scenes[i]) / 2;
    const len = segLen(i);
    if (len - local < half && scenes[i].transition !== 'corte') {
      return { index: i, local, transition: { from: i, to: i + 1, p: (local - (len - half)) / (half * 2), kind: scenes[i].transition, seconds: half * 2 }, end };
    }
  }
  return { index: i, local, transition: null, end };
}

/**
 * Qué escena 3D muestra cada uno de los dos maniquíes en el segundo `t`: las que se ven (la escena
 * i va en el maniquí i % 2) y, en el maniquí libre, la próxima escena 3D que le toque (precarga).
 */
export function slotsAt(scenes: Scene[], endCard: boolean, t: number): [number, number] {
  const slots: [number, number] = [-1, -1];
  const n = scenes.length;
  if (!n) return slots;
  const f = frameAt(scenes, endCard, t);
  const is3d = (j: number) => j >= 0 && j < n && scenes[j].kind === '3d';
  const cur = Math.min(f.index, n - 1);
  const visible = [f.index, f.transition ? (f.transition.from === f.index ? f.transition.to : f.transition.from) : -1];
  for (const j of visible) if (is3d(j)) slots[j % 2] = j;
  for (const k of [0, 1] as const) {
    if (slots[k] !== -1) continue;
    let j = cur + 1;
    while (j < n && !(is3d(j) && j % 2 === k)) j++;
    if (j < n) { slots[k] = j; continue; }
    // Nada más adelante: se queda con la última que mostró (no se descarga).
    j = cur;
    while (j >= 0 && !(is3d(j) && j % 2 === k)) j--;
    slots[k] = j;
  }
  return slots;
}

const ease = (x: number) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

export interface MotionState {
  /** Giro del modelo (radianes desde el frente). */
  turn: number;
  /** Acercamiento de la cámara (1 = encuadre normal). */
  zoom: number;
  /** Altura de la cámara: -1 baja (mirando hacia arriba) .. 1 alta. */
  lift: number;
  /** La prenda sube o baja (unidades de la escena; 0 = en su lugar). */
  rise?: number;
  /** La prenda se inclina de lado (radianes). */
  tilt?: number;
}

/**
 * Movimiento de la escena en su segundo `local`. Continuo también antes de 0 y después del final,
 * para que se vea bien durante las transiciones.
 */
export function motionAt(motion: Motion, local: number, seconds: number, speed = 1): MotionState {
  const len = clampSeconds(seconds);
  const p = local / len;
  const v = Math.min(SPEED_MAX, Math.max(SPEED_MIN, speed || 1));
  switch (motion) {
    case 'giro': return { turn: (Math.PI * 2 * local * v) / Math.max(len, 4), zoom: 1, lift: 0 };
    case 'giroRapido': return { turn: Math.PI * 4 * Math.round(v * 2) / 2 * ease(clamp01(p)), zoom: 1.04, lift: 0 };
    case 'revelar': return { turn: Math.PI * (1 - ease(clamp01(p / 0.8))), zoom: 1 + 0.08 * Math.max(0, p), lift: 0 };
    case 'orbita': return { turn: (Math.PI * 2 * local * v) / Math.max(len, 5), zoom: 1.02, lift: Math.sin((local * v * Math.PI * 2) / Math.max(len, 5)) * 0.8 };
    case 'heroe': return { turn: -0.5 + 1 * clamp01(p) + Math.min(0, p) * 0.5, zoom: 1.08 + 0.1 * Math.max(0, p), lift: -0.95 + 0.25 * clamp01(p) };
    case 'frente': return { turn: Math.sin(local * 0.6) * 0.12, zoom: 1.05 + 0.15 * Math.max(0, p), lift: 0 };
    case 'espalda': return { turn: Math.PI + Math.sin(local * 0.6) * 0.12, zoom: 1.05 + 0.15 * Math.max(0, p), lift: 0 };
    case 'perfil': return { turn: Math.PI / 2 + Math.sin(local * 0.7) * 0.15, zoom: 1.06 + 0.1 * Math.max(0, p), lift: 0.1 };
    case 'vaiven': return { turn: Math.sin(local * 1.4 * v) * 0.7, zoom: 1, lift: 0 };
    case 'acercar': return { turn: Math.sin(local * 0.5) * 0.1, zoom: 1 + 0.65 * ease(clamp01(p)), lift: 0 };
    case 'detalle': return { turn: -0.32 + 0.64 * ease(clamp01(p)) + Math.min(0, p) * 0.3, zoom: 2.05 + 0.15 * Math.max(0, p), lift: 0.05 };
    // La prenda sola (sin maniquí) se anima en el aire.
    case 'flotar': return { turn: Math.sin(local * 0.55 * v) * 0.35, zoom: 1.02, lift: 0, rise: Math.sin(local * 1.6 * v) * 0.06, tilt: Math.sin(local * 1.1 * v) * 0.045 };
    case 'giroFlotando': return { turn: (Math.PI * 2 * local * v) / Math.max(len, 4), zoom: 1, lift: 0, rise: Math.sin(local * 1.8 * v) * 0.07, tilt: Math.sin(local * 0.9 * v) * 0.03 };
    case 'rebote': {
      const k = (local * 1.7 * v) % 1;
      const hop = 4 * k * (1 - k);
      return { turn: Math.sin(local * 0.7) * 0.2, zoom: 1, lift: 0, rise: hop * 0.16, tilt: Math.sin(local * 1.7 * v * Math.PI * 2) * 0.03 };
    }
    case 'balanceo': return { turn: Math.sin(local * 0.6 * v) * 0.18, zoom: 1.02, lift: 0, rise: -Math.abs(Math.sin(local * 1.8 * v)) * 0.02, tilt: Math.sin(local * 1.8 * v) * 0.16 };
    case 'caida': {
      // Cae (0..0.45 s), rebota dos veces y queda flotando.
      const t = Math.max(0, local);
      const fall = t < 0.45 ? 1.3 * (1 - (t / 0.45) ** 2) : 0;
      const bounce = t >= 0.45 && t < 1.25 ? Math.abs(Math.sin(((t - 0.45) / 0.8) * Math.PI * 2)) * 0.12 * (1 - (t - 0.45) / 0.8) : 0;
      const float = t >= 1.25 ? Math.sin((t - 1.25) * 1.6) * 0.05 : 0;
      return { turn: Math.sin(t * 0.5) * 0.15, zoom: 1.02, lift: 0, rise: fall + bounce + float, tilt: t < 1.25 ? Math.sin(t * 9) * 0.05 * (1 - t / 1.25) : 0 };
    }
    case 'pirueta': {
      // Una vuelta rápida con saltito (0.2..1.4 s) y luego de frente, flotando.
      const q = clamp01((local - 0.2) / 1.2);
      return { turn: Math.PI * 2 * ease(q), zoom: 1.02, lift: 0, rise: Math.sin(q * Math.PI) * 0.14 + (q >= 1 ? Math.sin((local - 1.4) * 1.6) * 0.04 : 0), tilt: Math.sin(q * Math.PI * 2) * 0.06 };
    }
  }
}

/**
 * Giro extra de una escena 3D durante una transición "remolino": la que sale acelera la vuelta y la
 * que entra llega girando y frena.
 */
export function transitionTurn(scenes: Scene[], endCard: boolean, t: number, j: number): number {
  const tr = frameAt(scenes, endCard, t).transition;
  if (!tr || tr.kind !== 'remolino') return 0;
  const p = clamp01(tr.p);
  if (j === tr.from) return Math.PI * 1.6 * p * p;
  if (j === tr.to) return -Math.PI * 1.6 * (1 - p) * (1 - p);
  return 0;
}
