/**
 * Estudio de contenido: carga de fotos para el lienzo y grabación de video.
 *
 * Las fotos de la API (/uploads) traen permisos CORS; las de afuera (catálogo de prueba, enlaces) se
 * piden por la API (proxy) para que el lienzo no quede "manchado" y se pueda exportar.
 */
import { http } from '../../lib/http';

const cache = new Map<string, Promise<HTMLImageElement | null>>();

function fromSrc(src: string, cors: boolean): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    if (cors) img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** Foto lista para dibujar (o null si no se pudo). Queda en caché por URL. */
export function loadImage(url: string | null | undefined): Promise<HTMLImageElement | null> {
  if (!url) return Promise.resolve(null);
  let p = cache.get(url);
  if (!p) {
    if (url.startsWith('data:') || url.startsWith('blob:')) p = fromSrc(url, false);
    else if (url.includes('/uploads/') || url.startsWith('/')) p = fromSrc(url, true);
    else {
      p = http.blob('/messaging/marketing/image', { params: { url } })
        .then((b) => fromSrc(URL.createObjectURL(b), false))
        .catch(() => null);
    }
    cache.set(url, p);
  }
  return p;
}

/** Formato de video que graba este navegador (MP4 primero: es el que pide Instagram). */
export function videoMime(withAudio = false): string | null {
  if (typeof MediaRecorder === 'undefined') return null;
  const list = withAudio
    ? ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4;codecs=avc1,opus', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
    : ['video/mp4;codecs=avc1.42E01E', 'video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  for (const m of list) {
    if (MediaRecorder.isTypeSupported(m)) return m;
  }
  return null;
}

/** Música de fondo del video: el audio ya decodificado, desde qué segundo suena y su volumen. */
export interface VideoMusic {
  buffer: AudioBuffer;
  /** Segundo de la canción en el que empieza el video. */
  offset: number;
  /** 0..1 */
  volume: number;
}

/** Decodifica un archivo de audio (MP3, M4A, WAV, OGG) para la música del video. */
export async function decodeAudio(file: Blob): Promise<AudioBuffer> {
  const ctx = new AudioContext();
  try {
    return await ctx.decodeAudioData(await file.arrayBuffer());
  } finally {
    void ctx.close();
  }
}

/** Segundos de entrada y salida suave de la música. */
const FADE_IN = 0.4;
const FADE_OUT = 1.6;

/** Efectos de sonido del video: cada uno con su audio y el segundo en que suena. */
export interface VideoSfx {
  cues: { buffer: AudioBuffer; at: number }[];
  /** 0..1 */
  volume: number;
}

/** Voz del narrador: sus audios con el segundo en que empiezan, el volumen y si baja la música. */
export interface VideoVoice {
  cues: { buffer: AudioBuffer; at: number }[];
  volume: number;
  duck: boolean;
}

/**
 * Graba un lienzo en tiempo real: `draw(segundo)` pinta cada cuadro durante `seconds` segundos.
 * Con música (entra y sale suave), voz del narrador (la música baja mientras habla) y efectos de
 * sonido, los mezcla en el video. Devuelve el video
 * (Blob) y avisa el avance (0..1).
 */
export function recordCanvas(
  canvas: HTMLCanvasElement,
  seconds: number,
  draw: (time: number) => void,
  onProgress?: (p: number) => void,
  music?: VideoMusic | null,
  sfx?: VideoSfx | null,
  voice?: VideoVoice | null,
): Promise<Blob> {
  const hasSfx = !!sfx && sfx.cues.length > 0 && sfx.volume > 0;
  const hasVoice = !!voice && voice.cues.length > 0 && voice.volume > 0;
  const withAudio = !!music || hasSfx || hasVoice;
  const mime = videoMime(withAudio);
  if (!mime) return Promise.reject(new Error('Este navegador no puede grabar video. Usa Chrome o Edge actualizados.'));
  const stream = canvas.captureStream(30);
  let audio: { ctx: AudioContext; dest: MediaStreamAudioDestinationNode; sources: AudioBufferSourceNode[] } | null = null;
  if (withAudio) {
    const actx = new AudioContext();
    const dest = actx.createMediaStreamDestination();
    dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
    audio = { ctx: actx, dest, sources: [] };
  }
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 12_000_000, audioBitsPerSecond: 192_000 });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  const stopAudio = () => {
    if (!audio) return;
    audio.sources.forEach((src) => { try { src.stop(); } catch { /* ya paró */ } });
    void audio.ctx.close();
  };
  return new Promise((resolve, reject) => {
    rec.onstop = () => { stopAudio(); resolve(new Blob(chunks, { type: mime.split(';')[0] })); };
    rec.onerror = () => { stopAudio(); reject(new Error('No se pudo grabar el video')); };
    draw(0);
    const begin = async () => {
      if (audio) {
        await audio.ctx.resume();
        const now = audio.ctx.currentTime + 0.05;
        if (music) {
          const src = audio.ctx.createBufferSource();
          src.buffer = music.buffer;
          src.loop = music.buffer.duration - music.offset < seconds;
          const gain = audio.ctx.createGain();
          const g = gain.gain;
          g.setValueAtTime(0, now);
          g.linearRampToValueAtTime(music.volume, now + FADE_IN);
          g.setValueAtTime(music.volume, now + Math.max(FADE_IN, seconds - FADE_OUT));
          g.linearRampToValueAtTime(0, now + seconds);
          // La música baja al 30 % mientras habla el narrador.
          const duck = audio.ctx.createGain();
          duck.gain.setValueAtTime(1, now);
          if (hasVoice && voice?.duck) {
            for (const c of [...voice.cues].sort((a, b) => a.at - b.at)) {
              const a = now + Math.max(0, c.at - 0.2), b = now + c.at + c.buffer.duration;
              duck.gain.setValueAtTime(1, a);
              duck.gain.linearRampToValueAtTime(0.3, a + 0.2);
              duck.gain.setValueAtTime(0.3, b);
              duck.gain.linearRampToValueAtTime(1, b + 0.35);
            }
          }
          src.connect(gain).connect(duck).connect(audio.dest);
          src.start(now, Math.min(music.offset, Math.max(0, music.buffer.duration - 0.1)));
          audio.sources.push(src);
        }
        if (hasVoice && voice) {
          const bus = audio.ctx.createGain();
          bus.gain.value = voice.volume;
          bus.connect(audio.dest);
          for (const c of voice.cues) {
            if (c.at >= seconds) continue;
            const src = audio.ctx.createBufferSource();
            src.buffer = c.buffer;
            src.connect(bus);
            src.start(now + c.at);
            audio.sources.push(src);
          }
        }
        if (hasSfx && sfx) {
          const bus = audio.ctx.createGain();
          bus.gain.value = sfx.volume;
          bus.connect(audio.dest);
          for (const c of sfx.cues) {
            if (c.at >= seconds) continue;
            const src = audio.ctx.createBufferSource();
            src.buffer = c.buffer;
            src.connect(bus);
            src.start(now + c.at);
            audio.sources.push(src);
          }
        }
      }
      rec.start(250);
      const start = performance.now();
      const tick = () => {
        const t = (performance.now() - start) / 1000;
        draw(Math.min(t, seconds));
        onProgress?.(Math.min(1, t / seconds));
        if (t < seconds) requestAnimationFrame(tick);
        else setTimeout(() => rec.stop(), 120);
      };
      requestAnimationFrame(tick);
    };
    begin().catch(reject);
  });
}

export const extOf = (mime: string) => (mime.includes('mp4') ? 'mp4' : mime.includes('webm') ? 'webm' : mime.includes('jpeg') ? 'jpg' : 'png');

// ─── Clips de video propios ─────────────────────────────────────────────────────────────────────

/** Videos subidos en el estudio (por id de clip). Quedan en memoria mientras la página está abierta. */
const clipVideos = new Map<string, HTMLVideoElement>();

export const clipVideo = (id: string | null | undefined) => (id ? clipVideos.get(id) ?? null : null);

/**
 * Prepara un video subido: queda listo para dibujarse en el lienzo (sin sonido) y devuelve su
 * duración y el primer cuadro para la línea de tiempo.
 */
export function createClip(file: File): Promise<{ id: string; name: string; duration: number; thumb: string | null }> {
  return new Promise((resolve, reject) => {
    const v = document.createElement('video');
    v.muted = true;
    v.playsInline = true;
    v.preload = 'auto';
    v.src = URL.createObjectURL(file);
    const fail = () => reject(new Error('No se pudo leer ese video. Prueba con MP4 (H.264) o WEBM.'));
    v.onerror = fail;
    v.onloadeddata = () => {
      const id = `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
      clipVideos.set(id, v);
      const finish = () => {
        let thumb: string | null = null;
        try {
          const c = document.createElement('canvas');
          c.width = 160;
          c.height = Math.max(1, Math.round((160 * v.videoHeight) / Math.max(1, v.videoWidth)));
          c.getContext('2d')!.drawImage(v, 0, 0, c.width, c.height);
          thumb = c.toDataURL('image/jpeg', 0.7);
        } catch { /* sin miniatura */ }
        v.onseeked = null;
        resolve({ id, name: file.name.replace(/\.[^.]+$/, ''), duration: Number.isFinite(v.duration) ? v.duration : 0, thumb });
      };
      // El primer cuadro real (algunos videos arrancan en negro).
      const toThumb = () => { v.onseeked = finish; v.currentTime = Math.min(0.5, (v.duration || 1) / 3); };
      if (Number.isFinite(v.duration) && v.duration > 0) { toThumb(); return; }
      // Los WEBM grabados en el navegador o el celular no traen la duración: se pide el final para que el navegador la calcule.
      v.ondurationchange = () => {
        if (!Number.isFinite(v.duration)) return;
        v.ondurationchange = null;
        toThumb();
      };
      v.currentTime = 1e101;
    };
  });
}

/**
 * Deja cada clip en el segundo que le toca: en vivo (reproduciendo o grabando) lo deja correr y solo
 * lo corrige si se desfasa; en pausa lo lleva al cuadro exacto. Los clips que no se ven se pausan.
 */
export function syncClips(want: Map<string, number>, live: boolean) {
  clipVideos.forEach((v, id) => {
    const t = want.get(id);
    if (t == null) { if (!v.paused) v.pause(); return; }
    const target = Math.max(0, Math.min(t, (v.duration || t) - 0.05));
    if (live) {
      if (v.paused) { v.currentTime = target; void v.play().catch(() => { /* sin reproducción automática */ }); }
      else if (Math.abs(v.currentTime - target) > 0.25) v.currentTime = target;
    } else {
      if (!v.paused) v.pause();
      if (Math.abs(v.currentTime - target) > 0.04 && !v.seeking) v.currentTime = target;
    }
  });
}
