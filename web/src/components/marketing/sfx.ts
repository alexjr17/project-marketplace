/**
 * Sonidos de las transiciones del video. Se sintetizan en el navegador (Web Audio, sin archivos ni
 * derechos de autor) y se mezclan en el video al exportar. Cada transición tiene varios sonidos que
 * le van (el primero es el recomendado); el usuario o la IA eligen uno por transición.
 *
 * `lead`: cuántos segundos antes del corte arranca el sonido, para que su golpe caiga en el corte
 * (un whoosh suena más fuerte en la mitad; un riser crece hasta el corte).
 */
import { layout, type Scene, type Transition } from './timeline';

export type SoundId =
  | 'whoosh' | 'swoosh' | 'swipe' | 'riser' | 'impacto' | 'pop' | 'click' | 'glitch' | 'obturador' | 'brillo' | 'campana' | 'bajo' | 'cinta' | 'burbuja'
  | 'subdrop' | 'reverso' | 'chasquido' | 'blip' | 'zap';

export const SOUNDS: { value: SoundId; label: string; hint: string; seconds: number; lead: number }[] = [
  { value: 'whoosh', label: 'Whoosh', hint: 'Aire que pasa rápido', seconds: 0.7, lead: 0.35 },
  { value: 'swoosh', label: 'Swoosh suave', hint: 'Un paso de aire corto y suave', seconds: 0.45, lead: 0.18 },
  { value: 'swipe', label: 'Swipe', hint: 'Deslizar rápido, brillante', seconds: 0.28, lead: 0.1 },
  { value: 'riser', label: 'Subida', hint: 'Crece hasta el corte', seconds: 1.0, lead: 0.95 },
  { value: 'impacto', label: 'Impacto', hint: 'Golpe grave', seconds: 0.9, lead: 0 },
  { value: 'pop', label: 'Pop', hint: 'Burbuja que revienta', seconds: 0.16, lead: 0.02 },
  { value: 'click', label: 'Clic', hint: 'Un clic seco', seconds: 0.06, lead: 0 },
  { value: 'glitch', label: 'Glitch', hint: 'Interferencia digital', seconds: 0.5, lead: 0.22 },
  { value: 'obturador', label: 'Obturador', hint: 'Cámara de fotos', seconds: 0.26, lead: 0.04 },
  { value: 'brillo', label: 'Brillo', hint: 'Destellos agudos, mágico', seconds: 0.9, lead: 0.08 },
  { value: 'campana', label: 'Campana', hint: 'Un "ding" limpio', seconds: 1.2, lead: 0 },
  { value: 'bajo', label: 'Caída de bajo', hint: 'Bajo que cae, para revelar', seconds: 1.0, lead: 0 },
  { value: 'cinta', label: 'Cinta que frena', hint: 'Como un casete que se detiene', seconds: 0.6, lead: 0.5 },
  { value: 'burbuja', label: 'Burbuja', hint: 'Sube suave y simpático', seconds: 0.22, lead: 0.05 },
  { value: 'subdrop', label: 'Sub drop', hint: 'Bajo profundo que cae, muy de reels', seconds: 1.4, lead: 0 },
  { value: 'reverso', label: 'Platillo en reversa', hint: 'Crece al revés y explota en el corte', seconds: 1.1, lead: 1.05 },
  { value: 'chasquido', label: 'Chasquido', hint: 'Un chasquido de dedos', seconds: 0.18, lead: 0.01 },
  { value: 'blip', label: 'Blip digital', hint: 'Dos tonos cortos de interfaz', seconds: 0.2, lead: 0.02 },
  { value: 'zap', label: 'Zap', hint: 'Rayo rápido que cae', seconds: 0.3, lead: 0.05 },
];

/** Sonidos que le van a cada transición; el primero es el recomendado. */
export const TRANSITION_SOUNDS: Record<Transition, SoundId[]> = {
  corte: ['click', 'impacto', 'obturador', 'chasquido', 'pop', 'subdrop'],
  fundido: ['swoosh', 'brillo', 'campana', 'reverso'],
  color: ['swoosh', 'bajo', 'campana', 'subdrop'],
  desenfoque: ['whoosh', 'swoosh', 'brillo', 'reverso'],
  barrido: ['swipe', 'whoosh', 'swoosh', 'zap'],
  empujar: ['whoosh', 'swipe', 'swoosh', 'chasquido'],
  deslizar: ['swoosh', 'burbuja', 'swipe', 'blip'],
  diagonal: ['swipe', 'whoosh', 'swoosh', 'zap'],
  zoom: ['whoosh', 'riser', 'impacto', 'reverso', 'subdrop'],
  remolino: ['whoosh', 'riser', 'cinta', 'zap'],
  circulo: ['pop', 'burbuja', 'brillo', 'blip'],
  persiana: ['obturador', 'click', 'swipe', 'chasquido'],
  glitch: ['glitch', 'click', 'cinta', 'blip', 'zap'],
  mosaico: ['glitch', 'pop', 'burbuja', 'blip'],
  destello: ['obturador', 'brillo', 'impacto', 'subdrop'],
  cortina: ['whoosh', 'bajo', 'impacto', 'reverso'],
};

export const isSound = (v: unknown): v is SoundId => SOUNDS.some((s) => s.value === v);
export const recommendedSound = (t: Transition): SoundId => TRANSITION_SOUNDS[t][0];
export const soundInfo = (id: SoundId) => SOUNDS.find((s) => s.value === id)!;

/** Momentos del video en que suena cada transición (el golpe cae en el corte). */
export function sfxCues(scenes: Scene[], endCard: boolean): { sound: SoundId; at: number }[] {
  const { starts, body } = layout(scenes, endCard);
  const out: { sound: SoundId; at: number }[] = [];
  scenes.forEach((s, i) => {
    const hasNext = i < scenes.length - 1 || endCard;
    if (!hasNext || !isSound(s.sound)) return;
    const cut = i < scenes.length - 1 ? starts[i + 1] : body;
    out.push({ sound: s.sound, at: Math.max(0, cut - soundInfo(s.sound).lead) });
  });
  return out;
}

// ─── Síntesis ───────────────────────────────────────────────────────────────────────────────────

const RATE = 44100;
const cache = new Map<SoundId, Promise<AudioBuffer>>();

function noiseBuffer(ctx: BaseAudioContext, seconds: number, seed = 7) {
  const b = ctx.createBuffer(1, Math.ceil(seconds * ctx.sampleRate), ctx.sampleRate);
  const d = b.getChannelData(0);
  let x = seed;
  for (let i = 0; i < d.length; i++) { x = (x * 16807) % 2147483647; d[i] = (x / 2147483647) * 2 - 1; }
  return b;
}

function noise(ctx: BaseAudioContext, seconds: number, seed?: number) {
  const s = ctx.createBufferSource();
  s.buffer = noiseBuffer(ctx, seconds, seed);
  return s;
}

/** Envolvente: sube a `peak` en `at` y baja a cero al final. */
function env(g: GainNode, t0: number, at: number, end: number, peak: number, curve: 'lin' | 'exp' = 'lin') {
  g.gain.setValueAtTime(0.0001, t0);
  if (curve === 'exp') g.gain.exponentialRampToValueAtTime(peak, t0 + Math.max(0.005, at));
  else g.gain.linearRampToValueAtTime(peak, t0 + Math.max(0.005, at));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + end);
}

/** Respuesta de una sala pequeña (ruido que se apaga), para darle aire a los sonidos. */
function roomImpulse(ctx: BaseAudioContext, seconds = 0.9) {
  const b = ctx.createBuffer(2, Math.ceil(seconds * ctx.sampleRate), ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch);
    let x = 91 + ch * 7;
    for (let i = 0; i < d.length; i++) { x = (x * 16807) % 2147483647; d[i] = ((x / 2147483647) * 2 - 1) * Math.pow(1 - i / d.length, 2.6); }
  }
  return b;
}

/** Sonidos con aire (se les agrega un poco de sala). */
const AIRY: SoundId[] = ['whoosh', 'swoosh', 'riser', 'brillo', 'campana', 'reverso', 'subdrop', 'impacto', 'zap'];

function synth(ctx: OfflineAudioContext, id: SoundId) {
  const out = ctx.createGain();
  out.connect(ctx.destination);
  if (AIRY.includes(id)) {
    const verb = ctx.createConvolver();
    verb.buffer = roomImpulse(ctx);
    const wet = ctx.createGain();
    wet.gain.value = id === 'brillo' || id === 'campana' ? 0.3 : 0.18;
    out.connect(verb).connect(wet).connect(ctx.destination);
  }
  const T = soundInfo(id).seconds;
  const filteredNoise = (type: BiquadFilterType, f0: number, f1: number, fEnd: number, q: number, peakAt: number, peak: number, seed?: number) => {
    const n = noise(ctx, T, seed);
    const f = ctx.createBiquadFilter();
    f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, 0);
    f.frequency.exponentialRampToValueAtTime(f1, Math.max(0.01, peakAt));
    f.frequency.exponentialRampToValueAtTime(fEnd, T);
    const g = ctx.createGain();
    env(g, 0, peakAt, T, peak);
    n.connect(f).connect(g).connect(out);
    n.start(0);
  };
  const tone = (type: OscillatorType, f0: number, f1: number, start: number, dur: number, peak: number, attack = 0.005) => {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, start);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), start + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, 0);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(peak, start + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.connect(g).connect(out);
    o.start(start);
    o.stop(start + dur + 0.02);
  };
  switch (id) {
    case 'whoosh': filteredNoise('bandpass', 250, 2600, 500, 1.2, 0.35, 1.4); break;
    case 'swoosh': filteredNoise('bandpass', 600, 3800, 1200, 1.6, 0.18, 0.9); break;
    case 'swipe': filteredNoise('highpass', 1800, 7000, 3000, 0.8, 0.1, 0.8); break;
    case 'riser': {
      filteredNoise('bandpass', 300, 5000, 6000, 2, 0.95, 0.9);
      tone('sawtooth', 180, 1400, 0, 0.98, 0.12, 0.6);
      break;
    }
    case 'impacto': {
      tone('sine', 85, 32, 0, 0.85, 1, 0.004);
      filteredNoise('lowpass', 900, 200, 80, 0.7, 0.01, 0.9, 11);
      break;
    }
    case 'pop': tone('sine', 1100, 180, 0, 0.14, 0.9, 0.002); break;
    case 'click': filteredNoise('highpass', 3000, 5000, 4000, 0.7, 0.003, 1, 3); break;
    case 'glitch': {
      for (let k = 0; k < 9; k++) {
        const st = k * 0.05, f = [220, 880, 330, 1320, 165, 660, 990, 440, 1760][k];
        tone('square', f, f * 0.98, st, 0.04, 0.25, 0.001);
      }
      filteredNoise('bandpass', 1500, 2500, 800, 3, 0.2, 0.5, 5);
      break;
    }
    case 'obturador': {
      [0, 0.09].forEach((st, k) => {
        const n = noise(ctx, 0.05, 17 + k);
        const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 3200; f.Q.value = 2;
        const g = ctx.createGain(); env(g, st, 0.003, 0.05, 1.2);
        n.connect(f).connect(g).connect(out); n.start(st);
      });
      break;
    }
    case 'brillo': {
      [2093, 2637, 3136, 3951, 4186].forEach((f, k) => tone('sine', f, f, k * 0.07, 0.55, 0.22, 0.003));
      break;
    }
    case 'campana': {
      tone('sine', 1320, 1320, 0, 1.15, 0.5, 0.003);
      tone('sine', 2640, 2640, 0, 0.7, 0.18, 0.003);
      tone('sine', 3960, 3960, 0, 0.35, 0.08, 0.003);
      break;
    }
    case 'bajo': tone('sine', 140, 38, 0, 0.98, 1, 0.01); break;
    case 'cinta': {
      tone('sawtooth', 420, 30, 0, 0.58, 0.25, 0.01);
      filteredNoise('lowpass', 3000, 300, 60, 0.7, 0.02, 0.3, 23);
      break;
    }
    case 'burbuja': tone('sine', 280, 1300, 0, 0.2, 0.7, 0.01); break;
    case 'subdrop': {
      tone('sine', 95, 26, 0, 1.35, 1, 0.006);
      tone('triangle', 190, 52, 0, 0.5, 0.25, 0.004);
      filteredNoise('highpass', 4000, 6000, 5000, 0.7, 0.003, 0.4, 29);
      break;
    }
    case 'reverso': {
      // Ruido brillante que crece y se corta de golpe en el corte (como un platillo al revés).
      const n = noise(ctx, T, 37);
      const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.setValueAtTime(1500, 0); f.frequency.exponentialRampToValueAtTime(6000, T);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, 0);
      g.gain.exponentialRampToValueAtTime(1, T - 0.04);
      g.gain.linearRampToValueAtTime(0.0001, T);
      n.connect(f).connect(g).connect(out); n.start(0);
      tone('sine', 220, 880, 0, T - 0.03, 0.15, T * 0.9);
      break;
    }
    case 'chasquido': {
      filteredNoise('bandpass', 2600, 2400, 2000, 4, 0.004, 1.6, 41);
      tone('sine', 1800, 900, 0, 0.05, 0.25, 0.001);
      break;
    }
    case 'blip': {
      tone('square', 1200, 1200, 0, 0.06, 0.18, 0.002);
      tone('square', 1800, 1800, 0.08, 0.08, 0.18, 0.002);
      break;
    }
    case 'zap': {
      tone('sawtooth', 2400, 140, 0, 0.28, 0.35, 0.002);
      tone('sine', 1200, 90, 0, 0.26, 0.4, 0.002);
      break;
    }
  }
}

/** Sonido listo para mezclar (queda en caché). */
export function soundBuffer(id: SoundId): Promise<AudioBuffer> {
  let p = cache.get(id);
  if (!p) {
    const ctx = new OfflineAudioContext(1, Math.ceil(soundInfo(id).seconds * RATE) + 2048, RATE);
    synth(ctx, id);
    p = ctx.startRendering();
    cache.set(id, p);
  }
  return p;
}

let previewCtx: AudioContext | null = null;
/** Reproduce ya un audio (la voz del narrador en la vista previa). Devuelve cómo detenerlo. */
export async function playBuffer(buffer: AudioBuffer, volume = 1, offset = 0): Promise<() => void> {
  if (!previewCtx) previewCtx = new AudioContext();
  if (previewCtx.state === 'suspended') await previewCtx.resume();
  const src = previewCtx.createBufferSource();
  src.buffer = buffer;
  const g = previewCtx.createGain();
  g.gain.value = volume;
  src.connect(g).connect(previewCtx.destination);
  src.start(0, Math.max(0, offset));
  return () => { try { src.stop(); } catch { /* ya terminó */ } };
}

/** Suena ya (vista previa del editor). */
export async function playSound(id: SoundId, volume = 0.8) {
  if (!previewCtx) previewCtx = new AudioContext();
  if (previewCtx.state === 'suspended') await previewCtx.resume();
  const buf = await soundBuffer(id);
  const src = previewCtx.createBufferSource();
  src.buffer = buf;
  const g = previewCtx.createGain();
  g.gain.value = volume;
  src.connect(g).connect(previewCtx.destination);
  src.start();
}
