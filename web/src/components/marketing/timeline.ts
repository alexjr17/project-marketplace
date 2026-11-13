/**
 * Línea de tiempo del video 3D por escenas: cada escena tiene su diseño, color, movimiento de cámara,
 * textos y la transición hacia la siguiente. Sin React ni Three.js: se puede probar aparte.
 *
 * Se graban con DOS maniquíes 3D que se turnan (escena par en uno, impar en el otro): mientras uno
 * se ve, el otro ya carga la escena siguiente, y durante la transición se ven los dos.
 */

export type Motion = 'giro' | 'revelar' | 'frente' | 'espalda' | 'vaiven' | 'acercar';
export type Transition = 'corte' | 'fundido' | 'barrido' | 'zoom' | 'destello' | 'cortina';

export const MOTIONS: { value: Motion; label: string; hint: string }[] = [
  { value: 'giro', label: 'Giro completo', hint: 'Da la vuelta entera' },
  { value: 'revelar', label: 'Revelar', hint: 'Empieza de espalda y gira hasta el frente' },
  { value: 'frente', label: 'Frente', hint: 'Quieto de frente, acercándose despacio' },
  { value: 'espalda', label: 'Espalda', hint: 'Quieto de espalda, acercándose despacio' },
  { value: 'vaiven', label: 'Vaivén', hint: 'Se mueve de lado a lado' },
  { value: 'acercar', label: 'Acercar al diseño', hint: 'La cámara se acerca al pecho' },
];

export const TRANSITIONS: { value: Transition; label: string }[] = [
  { value: 'fundido', label: 'Fundido' },
  { value: 'barrido', label: 'Barrido' },
  { value: 'zoom', label: 'Zoom' },
  { value: 'destello', label: 'Destello' },
  { value: 'cortina', label: 'Cortina' },
  { value: 'corte', label: 'Corte' },
];

/** Diseño puesto en una zona de la prenda. */
export interface SceneDesign {
  id: number;
  name: string;
  image: string;
}

export interface Scene {
  id: string;
  design: SceneDesign | null;
  /** Zona de la plantilla donde va el diseño (id); null = la primera del frente. */
  zoneId: number | null;
  /** Tamaño del diseño dentro de la zona (0.4..1). */
  size: number;
  color: string;
  motion: Motion;
  seconds: number;
  title: string;
  subtitle: string;
  /** Transición hacia la escena siguiente (la última no la usa). */
  transition: Transition;
}

/** Duración de cada transición (s) y del cierre con el logo. */
export const TRANSITION_SECONDS = 0.7;
export const END_SECONDS = 2.4;
export const SCENE_MIN = 2;
export const SCENE_MAX = 10;
export const MAX_SCENES = 8;

let seq = 0;
export const newSceneId = () => `s${Date.now().toString(36)}${(seq++).toString(36)}`;

export function newScene(base?: Partial<Scene>): Scene {
  return {
    id: newSceneId(), design: null, zoneId: null, size: 0.85, color: '#FFFFFF', motion: 'giro', seconds: 4,
    title: '', subtitle: '', transition: 'fundido', ...base,
  };
}

export const clampSeconds = (s: number) => Math.min(SCENE_MAX, Math.max(SCENE_MIN, Number.isFinite(s) ? s : 4));

/** Inicio de cada escena y duración total (con el cierre si va). */
export function layout(scenes: Scene[], endCard: boolean) {
  const starts: number[] = [];
  let t = 0;
  for (const s of scenes) { starts.push(t); t += clampSeconds(s.seconds); }
  return { starts, body: t, total: t + (endCard && scenes.length ? END_SECONDS : 0) };
}

export interface Frame {
  /** Escena que se ve (índice); -1 = cierre. */
  index: number;
  /** Segundos dentro de la escena. */
  local: number;
  /** Si hay transición en curso: de qué escena a cuál, avance 0..1 y tipo. */
  transition: { from: number; to: number; p: number; kind: Transition } | null;
  /** Avance 0..1 del cierre (solo en el cierre). */
  end: number;
}

/**
 * Qué se ve en el segundo `t`. La transición entre la escena i y la i+1 está centrada en el corte
 * (media antes y media después); la última escena entra al cierre con un fundido.
 */
export function frameAt(scenes: Scene[], endCard: boolean, t: number): Frame {
  const { starts, body } = layout(scenes, endCard);
  if (!scenes.length) return { index: -1, local: 0, transition: null, end: 0 };
  if (t >= body && endCard) return { index: -1, local: t - body, transition: null, end: Math.min(1, (t - body) / END_SECONDS) };
  const tt = Math.min(Math.max(0, t), body - 1e-6);
  let i = scenes.length - 1;
  while (i > 0 && starts[i] > tt) i--;
  const local = tt - starts[i];
  const half = TRANSITION_SECONDS / 2;
  // Entrando desde la anterior.
  if (i > 0 && local < half && scenes[i - 1].transition !== 'corte') {
    return { index: i, local, transition: { from: i - 1, to: i, p: (local + half) / TRANSITION_SECONDS, kind: scenes[i - 1].transition }, end: 0 };
  }
  // Saliendo hacia la siguiente.
  const len = clampSeconds(scenes[i].seconds);
  if (i < scenes.length - 1 && len - local < half && scenes[i].transition !== 'corte') {
    return { index: i, local, transition: { from: i, to: i + 1, p: (local - (len - half)) / TRANSITION_SECONDS, kind: scenes[i].transition }, end: 0 };
  }
  return { index: i, local, transition: null, end: 0 };
}

/** Qué escena muestra cada uno de los dos maniquíes en el segundo `t` (precarga la siguiente). */
export function slotsAt(scenes: Scene[], endCard: boolean, t: number): [number, number] {
  const f = frameAt(scenes, endCard, t);
  const slots: [number, number] = [-1, -1];
  if (!scenes.length) return slots;
  const i = f.index === -1 ? scenes.length - 1 : f.index;
  slots[i % 2] = i;
  const other = f.transition ? (f.transition.from === i ? f.transition.to : f.transition.from) : i + 1 < scenes.length ? i + 1 : i - 1;
  if (other >= 0 && other < scenes.length) slots[other % 2] = other;
  return slots;
}

const ease = (x: number) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);

/**
 * Movimiento de la escena en su segundo `local`: giro del modelo (radianes desde el frente) y
 * acercamiento de la cámara (1 = encuadre normal). Continuo también antes de 0 y después del final,
 * para que se vea bien durante las transiciones.
 */
export function motionAt(motion: Motion, local: number, seconds: number): { turn: number; zoom: number } {
  const len = clampSeconds(seconds);
  const p = local / len;
  switch (motion) {
    case 'giro': return { turn: (Math.PI * 2 * local) / Math.max(len, 4), zoom: 1 };
    case 'revelar': return { turn: Math.PI * (1 - ease(Math.min(1, Math.max(0, p / 0.8)))), zoom: 1 + 0.08 * Math.max(0, p) };
    case 'frente': return { turn: Math.sin(local * 0.6) * 0.12, zoom: 1.05 + 0.15 * Math.max(0, p) };
    case 'espalda': return { turn: Math.PI + Math.sin(local * 0.6) * 0.12, zoom: 1.05 + 0.15 * Math.max(0, p) };
    case 'vaiven': return { turn: Math.sin(local * 1.4) * 0.7, zoom: 1 };
    case 'acercar': return { turn: Math.sin(local * 0.5) * 0.1, zoom: 1 + 0.65 * ease(Math.min(1, Math.max(0, p))) };
  }
}
