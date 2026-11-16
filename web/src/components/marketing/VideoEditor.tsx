/**
 * Editor de video por escenas, en el armazón del estudio (StudioShell):
 * - barra: Post / Video, deshacer/rehacer, agregar escena, textos con IA, ayuda IA, formato y exportar;
 * - riel: Producto (qué se muestra), Plantillas, Archivos (clips y fotos), Voz, Audio, Textos y Ajustes;
 * - centro, el monitor (el diseño de la prenda se arrastra con el video en pausa);
 * - derecha, las propiedades de la escena elegida (SceneInspector);
 * - abajo, los controles de reproducción y la línea de tiempo por pistas (EditorTimeline).
 * Atajos: espacio reproduce o pausa, ← → mueven 0,1 s (con Mayús 1 s), Supr quita la escena,
 * Ctrl+D la duplica y Ctrl+Z / Ctrl+Y deshacen y rehacen.
 */
import { useEffect, useRef, useState, type ChangeEvent, type MutableRefObject, type ReactNode } from 'react';
import {
  Box, Clapperboard, FolderOpen, Mic, Image as ImageIcon, LayoutTemplate, ShoppingBag, Music, Pause, Play, Plus, Redo2,
  Settings2, SkipBack, SkipForward, Sparkles, Trash2, Type, Undo2, Upload, Volume2, WandSparkles,
} from 'lucide-react';
import { FitBox, RatioSwitch, StudioShell, ToolbarSep, type RailItem } from './StudioShell';
import { ActionMenu, Button, Checkbox, Dialog, FormActions, IconButton, RadioGroup, Spinner, Switch, toast } from '../ui';
import { errorMessage } from '../../lib/http';
import type { SourceProduct, VideoAdvice } from '../../services/marketing.service';
import { isSound, playSound, SOUNDS, TRANSITION_SOUNDS } from './sfx';
import {
  clampSeconds, layout, MAX_SCENES, MOTIONS, newScene, newSceneId, TEXT_ANIMS, TRANSITIONS, type Scene, type SceneClip, type SceneKind, type SceneProduct,
} from './timeline';
import { buildStoryboard, canBuild, STORY_GROUPS, STORYBOARDS, type StoryboardId, type StoryContext } from './storyboards';
import { VIDEO_RATIOS, type VideoRatio } from './render';
import { createClip, decodeAudio } from './media';
import { SceneInspector, type InspectorSection } from './SceneInspector';
import { EditorTimeline } from './EditorTimeline';
import { AiImageDialog } from './AiImageDialog';
import { AiBackdropDialog } from './AiBackdropDialog';
import { NarrationPanel, type NarrationControls } from './NarrationPanel';

/** Música de fondo elegida (el archivo queda solo en el navegador; va dentro del video). */
export interface StudioMusic {
  name: string;
  url: string;
  buffer: AudioBuffer;
  offset: number;
  volume: number;
}

/** Archivo propio subido al editor: un clip de video o una foto. */
export type MediaItem = { type: 'video'; clip: SceneClip } | { type: 'image'; product: SceneProduct };

type BinTab = 'medios' | 'plantillas' | 'archivos' | 'voz' | 'audio' | 'publicar' | 'ajustes';
const RAIL: (RailItem & { id: BinTab; title: string })[] = [
  { id: 'medios', label: 'Producto', title: 'Qué vas a mostrar', icon: ShoppingBag },
  { id: 'plantillas', label: 'Plantillas', title: 'Plantillas de video', icon: LayoutTemplate },
  { id: 'archivos', label: 'Archivos', title: 'Mis archivos', icon: FolderOpen },
  { id: 'voz', label: 'Voz', title: 'Narrador', icon: Mic },
  { id: 'audio', label: 'Audio', title: 'Música y sonidos', icon: Music },
  { id: 'publicar', label: 'Textos', title: 'Textos y publicación', icon: Type },
  { id: 'ajustes', label: 'Ajustes', title: 'Ajustes del video', icon: Settings2 },
];

export function VideoEditor({
  preview, sourcePanel, publishPanel, exportActions, info,
  playing, onTogglePlay, timecodeRef, timeRef,
  scenes, onChange, selectedId, onSelect, endCard, onEndCard, logo, onLogo, ratio, onRatio, stage, onStage,
  templates, defaultTemplate, photoTemplates, products, story, onStoryboard, playheadRef, onPreview, onSeek,
  history, music, onMusic, onAiScenes, aiBusy, palette, media, onMedia, sfxOn, onSfxOn, sfxVolume, onSfxVolume, onAskAdvice, narration, prompter,
  modeSwitch, menu, onboarding, hasSubject, size, panelReq = 0,
}: {
  preview: ReactNode;
  sourcePanel: ReactNode;
  publishPanel: ReactNode;
  exportActions: ReactNode;
  info: ReactNode;
  playing: boolean;
  onTogglePlay: () => void;
  timecodeRef: MutableRefObject<HTMLSpanElement | null>;
  /** Segundo que se está viendo (lo actualiza la vista previa). */
  timeRef: MutableRefObject<number>;
  scenes: Scene[];
  onChange: (s: Scene[], merge?: string) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  endCard: boolean;
  onEndCard: (v: boolean) => void;
  logo: boolean;
  onLogo: (v: boolean) => void;
  ratio: VideoRatio;
  onRatio: (v: VideoRatio) => void;
  stage: 'claro' | 'oscuro';
  onStage: (v: 'claro' | 'oscuro') => void;
  templates: SourceProduct[];
  defaultTemplate: SourceProduct | null;
  /** Plantillas personalizables con fotos y zonas (montaje 2D). */
  photoTemplates: SourceProduct[];
  products: SceneProduct[];
  story: StoryContext;
  onStoryboard: (id: StoryboardId) => void;
  playheadRef: MutableRefObject<HTMLDivElement | null>;
  onPreview: (id: string) => void;
  onSeek: (t: number) => void;
  history: { undo: () => void; redo: () => void; canUndo: boolean; canRedo: boolean };
  music: StudioMusic | null;
  onMusic: (m: StudioMusic | null) => void;
  onAiScenes: () => void;
  aiBusy: boolean;
  /** Colores de la marca (para los fondos de las escenas). */
  palette: { label: string; hex: string }[];
  media: MediaItem[];
  onMedia: (m: MediaItem[]) => void;
  /** Sonidos de las transiciones. */
  sfxOn: boolean;
  onSfxOn: (v: boolean) => void;
  sfxVolume: number;
  onSfxVolume: (v: number) => void;
  /** Pide a la IA que revise el video. */
  onAskAdvice: () => Promise<VideoAdvice>;
  /** Narrador: guion, voz IA, mi voz. */
  narration: NarrationControls;
  /** Grabando mi voz: cuenta regresiva y teleprompter sobre el monitor. */
  prompter: { countdown: number | null; active: boolean };
  /** Interruptor Post / Video y menú (marca, calendario, cuentas de IA), en la barra. */
  modeSwitch: ReactNode;
  menu: ReactNode;
  /** Primer paso sobre el monitor cuando aún no se eligió qué mostrar. */
  onboarding: ReactNode;
  hasSubject: boolean;
  /** Tamaño del video (ancho, alto). */
  size: [number, number];
  /** Cada vez que cambia, se abre el panel de Producto (desde el primer paso). */
  panelReq?: number;
}) {
  const { starts, total } = layout(scenes, endCard);
  const idx = Math.max(0, scenes.findIndex((s) => s.id === selectedId));
  const sc = scenes[idx];
  const canAdd = scenes.length < MAX_SCENES;
  const [bin, setBin] = useState<BinTab | null>(() => (hasSubject ? 'plantillas' : 'medios'));
  const [seenReq, setSeenReq] = useState(panelReq);
  if (panelReq !== seenReq) { setSeenReq(panelReq); setBin('medios'); }
  const [section, setSection] = useState<InspectorSection>('escena');
  const clips = media.flatMap((m) => (m.type === 'video' ? [m.clip] : []));
  const userPhotos = media.flatMap((m) => (m.type === 'image' ? [m.product] : []));
  const allProducts = [...userPhotos, ...products];

  const [promptLine, setPromptLine] = useState<{ now: string; next: string }>({ now: '', next: '' });
  useEffect(() => {
    if (!prompter.active) return;
    const id = window.setInterval(() => {
      const t = timeRef.current;
      let i = starts.findIndex((st, j) => t >= st && t < st + clampSeconds(scenes[j].seconds));
      if (i < 0) i = scenes.length - 1;
      const next = scenes.slice(i + 1).find((x) => x.narration.trim())?.narration ?? '';
      setPromptLine({ now: scenes[i]?.narration ?? '', next });
    }, 100);
    return () => window.clearInterval(id);
  }, [prompter.active, scenes, starts, timeRef]);

  const patch = (p: Partial<Scene>, merge?: string) => onChange(scenes.map((s, i) => (i === idx ? { ...s, ...p } : s)), merge ? `${sc.id}:${merge}` : undefined);

  /** Escena nueva después de la elegida. */
  const insert = (n: Scene) => {
    if (!canAdd) { toast.error(`Máximo ${MAX_SCENES} escenas`); return; }
    onChange([...scenes.slice(0, idx + 1), n, ...scenes.slice(idx + 1)]);
    onSelect(n.id);
    onPreview(n.id);
  };
  const add = (kind: SceneKind) => {
    const last = scenes[idx];
    const tpl = defaultTemplate ?? templates[0] ?? null;
    const base: Partial<Scene> = { kind, transition: last?.transition ?? 'fundido' };
    if (kind === '3d') Object.assign(base, { templateId: last?.kind === '3d' ? last.templateId : tpl?.id ?? null, color: last?.kind === '3d' ? last.color : tpl?.colors?.[0] ?? '#FFFFFF', motion: 'revelar', zoneId: last?.kind === '3d' ? last.zoneId : null });
    if (kind === 'foto') {
      const used = new Set(scenes.map((s) => s.product?.id));
      const pr = allProducts.find((p) => !used.has(p.id)) ?? allProducts[0] ?? null;
      Object.assign(base, { product: pr, title: pr?.name ?? '', seconds: 3, showPrice: pr?.price != null, badge: pr?.discountPercent ? `-${pr.discountPercent}%` : '' });
    }
    if (kind === 'texto') Object.assign(base, { title: 'Tu mensaje', textPos: 'centro', textAnim: 'letras', seconds: 2.5 });
    if (kind === 'clip') {
      const c = clips[0];
      if (!c) { setBin('archivos'); toast.info('Primero sube un video en "Mis archivos"'); return; }
      Object.assign(base, { clip: c, clipStart: 0, photoMove: 'quieta', seconds: Math.min(c.duration, 6) });
    }
    insert(newScene(base));
  };
  const duplicate = () => insert({ ...sc, id: newSceneId() });
  const remove = () => {
    if (scenes.length <= 1) return;
    const next = scenes.filter((_, i) => i !== idx);
    onChange(next);
    onSelect(next[Math.max(0, idx - 1)].id);
  };
  const moveTo = (from: number, to: number) => {
    if (from === to || to < 0 || to >= scenes.length) return;
    const next = [...scenes];
    const [it] = next.splice(from, 1);
    next.splice(to, 0, it);
    onChange(next);
  };
  /** El diseño de esta escena en todas las escenas de prenda (3D o personalizable con fotos). */
  const applyDesignAll = () => onChange(scenes.map((s) => (s.kind === '3d' || (s.kind === 'foto' && s.photoSource === 'plantilla') ? { ...s, design: sc.design, size: sc.size, offsetX: sc.offsetX, offsetY: sc.offsetY } : s)));
  /** Fotos para el fondo de una escena: tus archivos y las creadas con IA. */
  const bgPhotos = media.flatMap((m) => (m.type === 'image' && m.product.image ? [{ name: m.product.name, url: m.product.image }] : []));
  const applyBgAll = () => onChange(scenes.map((s) => (s.kind === 'clip' ? s : { ...s, bg: sc.bg ? { ...sc.bg } : null })));
  const uploadBg = (f: File) => {
    if (!f.type.startsWith('image/')) { toast.error('Elige una foto'); return; }
    const url = URL.createObjectURL(f);
    onMedia([{ type: 'image', product: { id: -Date.now(), name: f.name.replace(/\.[^.]+$/, ''), image: url } }, ...media]);
    if (sc?.bg) patch({ bg: { ...sc.bg, style: 'foto', image: url } });
  };
  const applyTransitionAll = () => onChange(scenes.map((s) => ({ ...s, transition: sc.transition, transitionSeconds: sc.transitionSeconds, sound: sc.sound })));

  // ─── Ayuda IA ─────────────────────────────────────────────────────────────
  const [advice, setAdvice] = useState<VideoAdvice | null>(null);
  const [asking, setAsking] = useState(false);
  const [picked, setPicked] = useState<Record<number, boolean>>({});
  const ask = async () => {
    setAsking(true);
    try {
      const a = await onAskAdvice();
      setAdvice(a);
      setPicked(Object.fromEntries(a.scenes.map((x) => [x.index, true])));
    } catch (e) {
      toast.error(errorMessage(e, 'La IA no pudo revisar el video'));
    } finally {
      setAsking(false);
    }
  };
  const applyAdvice = (only?: number) => {
    if (!advice) return;
    const byIndex = new Map(advice.scenes.map((x) => [x.index, x]));
    onChange(scenes.map((s, i) => {
      const a = byIndex.get(i);
      if (!a || (only !== undefined ? only !== i : !picked[i])) return s;
      return {
        ...s,
        transition: a.transition as Scene['transition'], transitionSeconds: a.transitionSeconds, sound: a.sound,
        textAnim: a.textAnim as Scene['textAnim'], seconds: Math.min(s.kind === 'clip' && s.clip ? s.clip.duration - s.clipStart : a.seconds, a.seconds),
        ...(s.kind === '3d' && a.motion ? { motion: a.motion as Scene['motion'] } : {}),
      };
    }));
    if (only === undefined) { setAdvice(null); toast.success('Recomendaciones aplicadas. Puedes deshacerlas con Ctrl+Z.'); }
  };
  const lbl = {
    tr: (v: string) => TRANSITIONS.find((t) => t.value === v)?.label ?? v,
    snd: (v: string | null) => (v ? SOUNDS.find((t) => t.value === v)?.label ?? v : 'Sin sonido'),
    anim: (v: string) => TEXT_ANIMS.find((t) => t.value === v)?.label ?? v,
    mot: (v: string) => MOTIONS.find((t) => t.value === v)?.label ?? v,
  };

  /** Ir a la escena anterior o siguiente según el segundo actual. */
  const jump = (d: -1 | 1) => {
    const t = timeRef.current;
    let i = starts.findIndex((s, j) => t >= s && t < s + clampSeconds(scenes[j].seconds));
    if (i < 0) i = scenes.length - 1;
    const j = Math.min(scenes.length - 1, Math.max(0, d < 0 && t - starts[i] > 0.6 ? i : i + d));
    onSelect(scenes[j].id);
    onSeek(starts[j] + 0.05);
  };

  // Atajos de teclado (fuera de los campos).
  const keys = useRef({ onTogglePlay, remove, duplicate, onSeek, history, total });
  useEffect(() => { keys.current = { onTogglePlay, remove, duplicate, onSeek, history, total }; });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return;
      if (el?.closest('[role="dialog"]')) return;
      const k = keys.current;
      const key = e.key.toLowerCase();
      if (e.ctrlKey || e.metaKey) {
        if (key === 'z' && !e.shiftKey) { e.preventDefault(); k.history.undo(); }
        else if (key === 'y' || (key === 'z' && e.shiftKey)) { e.preventDefault(); k.history.redo(); }
        else if (key === 'd') { e.preventDefault(); k.duplicate(); }
        return;
      }
      if (key === ' ' && el?.tagName !== 'BUTTON') { e.preventDefault(); k.onTogglePlay(); }
      else if (key === 'delete') { e.preventDefault(); k.remove(); }
      else if (key === 'arrowleft' || key === 'arrowright') {
        e.preventDefault();
        const d = (e.shiftKey ? 1 : 0.1) * (key === 'arrowleft' ? -1 : 1);
        k.onSeek(Math.min(k.total - 0.01, Math.max(0, timeRef.current + d)));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [timeRef]);

  // ─── Mis archivos ─────────────────────────────────────────────────────────
  const fileRef = useRef<HTMLInputElement>(null);
  const [ai, setAi] = useState(false);
  const [backdrop, setBackdrop] = useState(false);
  /** Fondo con IA para la escena elegida. */
  const [bgAi, setBgAi] = useState(false);
  const [uploading, setUploading] = useState(false);
  const onFiles = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (!files.length) return;
    setUploading(true);
    const added: MediaItem[] = [];
    for (const f of files) {
      try {
        if (f.type.startsWith('video/')) {
          if (f.size > 300 * 1024 * 1024) { toast.error(`${f.name}: el video pesa más de 300 MB`); continue; }
          added.push({ type: 'video', clip: await createClip(f) });
        } else if (f.type.startsWith('image/')) {
          if (f.size > 15 * 1024 * 1024) { toast.error(`${f.name}: la foto pesa más de 15 MB`); continue; }
          added.push({ type: 'image', product: { id: -Date.now() - added.length, name: f.name.replace(/\.[^.]+$/, ''), image: URL.createObjectURL(f) } });
        } else toast.error(`${f.name}: solo videos o fotos`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : `No se pudo leer ${f.name}`);
      }
    }
    setUploading(false);
    if (added.length) onMedia([...added, ...media]);
  };
  const addMedia = (m: MediaItem) => {
    if (m.type === 'video') insert(newScene({ kind: 'clip', clip: m.clip, clipStart: 0, photoMove: 'quieta', seconds: Math.min(m.clip.duration, 6), transition: sc?.transition ?? 'fundido' }));
    else insert(newScene({ kind: 'foto', product: m.product, photoFit: 'completa', photoMove: 'acercar', seconds: 3, transition: sc?.transition ?? 'fundido' }));
  };

  // ─── Audio ────────────────────────────────────────────────────────────────
  const musicRef = useRef<HTMLInputElement>(null);
  const [loadingMusic, setLoadingMusic] = useState(false);
  const onMusicFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('audio/')) { toast.error('Elige un archivo de audio (MP3, M4A, WAV u OGG)'); return; }
    if (file.size > 20 * 1024 * 1024) { toast.error('El audio pesa más de 20 MB'); return; }
    setLoadingMusic(true);
    try {
      const buffer = await decodeAudio(file);
      if (music) URL.revokeObjectURL(music.url);
      onMusic({ name: file.name.replace(/\.[^.]+$/, ''), url: URL.createObjectURL(file), buffer, offset: 0, volume: 0.8 });
    } catch {
      toast.error('No se pudo leer ese audio');
    } finally {
      setLoadingMusic(false);
    }
  };

  const toolBtn = 'inline-flex items-center gap-1.5 rounded-lg px-2.5 h-9 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-40 disabled:hover:bg-transparent';

  const secTitle = RAIL.find((r) => r.id === bin)?.title ?? '';
  const rail = RAIL.map((r) => ({ ...r, dot: r.id === 'medios' && !hasSubject }));

  return (
    <>
      {bgAi && sc && (
        <AiBackdropDialog
          designUrls={Array.from(new Set(scenes.flatMap((x) => (x.design?.image ? [x.design.image] : []))))} ratio={ratio}
          onClose={() => setBgAi(false)}
          onUse={(img) => {
            onMedia([{ type: 'image', product: { id: -Date.now(), name: `Fondo IA: ${img.name}`, image: img.url } }, ...media]);
            patch({ bg: { ...(sc.bg ?? { base: palette[0]?.hex ?? '#1F1D1E', ink: '#ABD04C', accent: '#F3F3EE', density: 0.5, size: 150, angle: -18, grain: false, move: true, dim: 0 }), style: 'foto', image: img.url } as Scene['bg'] });
          }}
        />
      )}
      <StudioShell
        label="Editor de video"
        toolbar={(
          <>
            {modeSwitch}
            <ToolbarSep />
            <button type="button" className={toolBtn} title="Deshacer (Ctrl+Z)" aria-label="Deshacer (Ctrl+Z)" onClick={history.undo} disabled={!history.canUndo}><Undo2 className="w-4 h-4" /></button>
            <button type="button" className={toolBtn} title="Rehacer (Ctrl+Y)" aria-label="Rehacer (Ctrl+Y)" onClick={history.redo} disabled={!history.canRedo}><Redo2 className="w-4 h-4" /></button>
            <ToolbarSep />
            <ActionMenu
              trigger={<button type="button" className={toolBtn} disabled={!canAdd}><Plus className="w-4 h-4" />Escena</button>}
              items={[
                { label: 'Prenda 3D', icon: <Box className="w-4 h-4" />, onClick: () => add('3d'), disabled: !templates.length },
                { label: 'Foto de producto', icon: <ImageIcon className="w-4 h-4" />, onClick: () => add('foto') },
                { label: 'Texto', icon: <Type className="w-4 h-4" />, onClick: () => add('texto') },
                { label: 'Clip de video', icon: <Clapperboard className="w-4 h-4" />, onClick: () => add('clip') },
              ]}
            />
            <button type="button" className={toolBtn} onClick={onAiScenes} disabled={aiBusy}>{aiBusy ? <Spinner /> : <Sparkles className="w-4 h-4" />}Textos con IA</button>
            <button type="button" className={`${toolBtn} bg-app-50 text-app-700 hover:bg-app-100`} onClick={ask} disabled={asking}>{asking ? <Spinner /> : <WandSparkles className="w-4 h-4" />}Ayuda IA</button>
            <ToolbarSep />
            <RatioSwitch label="Formato del video" value={ratio} onChange={onRatio} options={VIDEO_RATIOS.map((r) => ({ value: r.value, label: r.value, hint: r.hint }))} />
          </>
        )}
        actions={<>{exportActions}{menu}</>}
        rail={rail} active={bin} onActive={(id) => setBin(id as BinTab | null)}
        panelTitle={secTitle}
        panel={(
          <>
            {bin === 'medios' && sourcePanel}
            {bin === 'plantillas' && (
              <div className="space-y-4">
                <p className="text-xs text-gray-500">Se arman con lo que eliges en Productos. Sirven para reels, historias y posts de video: el formato va arriba.</p>
                {STORY_GROUPS.map((g) => (
                  <div key={g}>
                    <p className="text-xs font-semibold text-gray-700 mb-1.5">{g}</p>
                    <div className="space-y-2">
                      {STORYBOARDS.filter((b) => b.group === g).map((b) => {
                        const ok = canBuild(b.id, story);
                        const preview = ok ? buildStoryboard(b.id, story) : [];
                        const secs = layout(preview, endCard).total;
                        return (
                          <button
                            key={b.id} type="button" disabled={!ok} onClick={() => onStoryboard(b.id)}
                            className="w-full rounded-lg border border-gray-200 p-2 text-left hover:border-app-400 hover:bg-app-50/40 disabled:opacity-50 disabled:hover:border-gray-200 disabled:hover:bg-transparent"
                          >
                            <span className="flex items-baseline justify-between gap-2">
                              <span className="text-sm font-medium text-gray-900">{b.label}</span>
                              {ok && <span className="text-[11px] text-gray-500 tabular-nums">{preview.length} escenas · {secs.toFixed(0)} s</span>}
                            </span>
                            <span className="block text-xs text-gray-500 mt-0.5">
                              {ok ? b.hint : b.needs === '3d' ? 'Elige una prenda personalizable con modelo 3D en Promoción' : b.needs === 'dosFotos' ? 'Elige al menos dos productos en Promoción' : 'Elige productos, una colección o una promoción'}
                            </span>
                            {ok && (
                              <span className="mt-1.5 flex h-2 rounded-full overflow-hidden gap-px" aria-hidden="true">
                                {preview.map((sc) => (
                                  <span key={sc.id} style={{ flex: `${clampSeconds(sc.seconds)} 0 0` }}
                                    className={sc.kind === '3d' ? 'bg-sky-500' : sc.kind === 'foto' ? 'bg-emerald-500' : sc.kind === 'clip' ? 'bg-violet-500' : 'bg-amber-500'} />
                                ))}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
                <p className="text-[11px] text-gray-500 flex flex-wrap gap-x-3 gap-y-1">
                  <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-sky-500" />3D</span>
                  <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" />Foto</span>
                  <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" />Texto</span>
                  <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-violet-500" />Clip</span>
                </p>
              </div>
            )}
            {bin === 'archivos' && (
              <div className="space-y-3">
                <input ref={fileRef} type="file" accept="video/*,image/*" multiple className="hidden" onChange={onFiles} aria-label="Subir videos o fotos" />
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="secondary" icon={<Upload className="w-4 h-4" />} isLoading={uploading} onClick={() => fileRef.current?.click()}>Subir</Button>
                  <Button variant="secondary" icon={<Sparkles className="w-4 h-4" />} onClick={() => setAi(true)}>Crear con IA</Button>
                </div>
                <Button className="w-full" variant="outline" icon={<Sparkles className="w-4 h-4" />} onClick={() => setBackdrop(true)}>Fondo profesional con IA</Button>
                {backdrop && (
                  <AiBackdropDialog
                    designUrls={Array.from(new Set(scenes.flatMap((x) => (x.design?.image ? [x.design.image] : []))))} ratio={ratio}
                    onClose={() => setBackdrop(false)}
                    onUse={(img) => onMedia([{ type: 'image', product: { id: -Date.now(), name: `Fondo IA: ${img.name}`, image: img.url } }, ...media])}
                  />
                )}
                {ai && <AiImageDialog initialKind="foto" onClose={() => setAi(false)} onUse={(img) => onMedia([{ type: 'image', product: { id: -Date.now(), name: img.name, image: img.url } }, ...media])} />}
                <p className="text-xs text-gray-500">Tus clips quedan en este navegador mientras editas; van dentro del video final (sin su sonido: usa la música).</p>
                {!media.length && <p className="text-sm text-gray-500 text-center py-6">Aún no has subido archivos.</p>}
                <div className="grid grid-cols-2 gap-2">
                  {media.map((m) => {
                    const key = m.type === 'video' ? m.clip.id : String(m.product.id);
                    const thumb = m.type === 'video' ? m.clip.thumb : m.product.image;
                    const name = m.type === 'video' ? m.clip.name : m.product.name;
                    return (
                      <div key={key} className="group relative rounded-lg overflow-hidden ring-1 ring-gray-200 bg-gray-900">
                        {thumb ? <img src={thumb} alt="" className="w-full aspect-video object-cover" /> : <div className="w-full aspect-video" />}
                        <span className="absolute left-1 top-1 rounded bg-black/60 px-1 text-[10px] text-white">{m.type === 'video' ? `${m.clip.duration.toFixed(1)} s` : 'Foto'}</span>
                        <p className="px-1.5 py-1 text-[11px] text-white truncate bg-gray-900">{name}</p>
                        <button
                          type="button" title="Agregar como escena" aria-label={`Agregar ${name} como escena`} onClick={() => addMedia(m)}
                          className="absolute right-1 top-1 rounded-full bg-app-600 text-white p-1 shadow hover:bg-app-700"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {bin === 'voz' && <NarrationPanel scenes={scenes} onChange={onChange} n={narration} total={total} />}
            {bin === 'audio' && (
              <div className="space-y-3">
                <input ref={musicRef} type="file" accept="audio/*" className="hidden" onChange={onMusicFile} aria-label="Subir música" />
                {!music ? (
                  <>
                    <Button className="w-full" variant="secondary" icon={<Upload className="w-4 h-4" />} isLoading={loadingMusic} onClick={() => musicRef.current?.click()}>Agregar música</Button>
                    <p className="text-xs text-gray-500">MP3, M4A, WAV u OGG. Entra y sale suave, y se mezcla en el video al exportar.</p>
                  </>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <Music className="w-4 h-4 text-app-600 flex-shrink-0" />
                      <span className="text-sm text-gray-800 truncate flex-1" title={music.name}>{music.name}</span>
                      <IconButton title="Cambiar música" onClick={() => musicRef.current?.click()}><Upload className="w-4 h-4" /></IconButton>
                      <IconButton title="Quitar música" tone="danger" onClick={() => { URL.revokeObjectURL(music.url); onMusic(null); }}><Trash2 className="w-4 h-4" /></IconButton>
                    </div>
                    <label className="block text-sm text-gray-700">
                      <span className="flex justify-between"><span>Empieza en</span><span className="tabular-nums">{Math.floor(music.offset / 60)}:{String(Math.floor(music.offset % 60)).padStart(2, '0')}</span></span>
                      <input type="range" min={0} max={Math.max(0, Math.floor(music.buffer.duration - 1))} step={0.5} value={music.offset} onChange={(e) => onMusic({ ...music, offset: Number(e.target.value) })} className="w-full accent-app-600" aria-label="Segundo de la canción en que empieza" />
                    </label>
                    <label className="block text-sm text-gray-700">
                      <span className="flex justify-between"><span>Volumen</span><span className="tabular-nums">{Math.round(music.volume * 100)}%</span></span>
                      <input type="range" min={0} max={1} step={0.05} value={music.volume} onChange={(e) => onMusic({ ...music, volume: Number(e.target.value) })} className="w-full accent-app-600" aria-label="Volumen de la música" />
                    </label>
                    <p className="text-xs text-gray-500">La canción dura {Math.round(music.buffer.duration)} s; el video, {total.toFixed(1)} s.</p>
                  </div>
                )}
                <div className="border-t border-gray-100 pt-3 space-y-3">
                  <Switch checked={sfxOn} onChange={onSfxOn} label="Sonidos de transición" description="Cada transición suena justo en el corte." />
                  {sfxOn && (
                    <>
                      <label className="block text-sm text-gray-700">
                        <span className="flex justify-between"><span>Volumen de los sonidos</span><span className="tabular-nums">{Math.round(sfxVolume * 100)}%</span></span>
                        <input type="range" min={0} max={1} step={0.05} value={sfxVolume} onChange={(e) => onSfxVolume(Number(e.target.value))} className="w-full accent-app-600" aria-label="Volumen de los sonidos de transición" />
                      </label>
                      <ul className="space-y-1">
                        {scenes.map((s, i) => (i < scenes.length - 1 || endCard) && (
                          <li key={s.id} className="flex items-center gap-2 text-xs text-gray-600">
                            <span className="w-14 flex-shrink-0">{i + 1} → {i < scenes.length - 1 ? i + 2 : 'cierre'}</span>
                            <span className="flex-1 truncate">{lbl.tr(s.transition)} · <b className="font-medium text-gray-800">{lbl.snd(s.sound)}</b></span>
                            {isSound(s.sound) && <button type="button" className="p-1 text-gray-400 hover:text-app-700" aria-label={`Escuchar el sonido de la transición ${i + 1}`} onClick={() => void playSound(s.sound as never, sfxVolume)}><Volume2 className="w-3.5 h-3.5" /></button>}
                          </li>
                        ))}
                      </ul>
                      <Button size="sm" variant="secondary" onClick={() => onChange(scenes.map((s) => ({ ...s, sound: TRANSITION_SOUNDS[s.transition][0] })))}>Usar el recomendado en cada transición</Button>
                    </>
                  )}
                </div>
              </div>
            )}
            {bin === 'publicar' && publishPanel}
            {bin === 'ajustes' && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <p className="text-sm font-medium text-gray-700">Escenario de las escenas 3D y fotos</p>
                  <RadioGroup variant="segmented" value={stage} onChange={onStage} options={[{ value: 'oscuro', label: 'Oscuro' }, { value: 'claro', label: 'Claro' }]} />
                </div>
                <Switch checked={logo} onChange={onLogo} label="Logo en las escenas" description="Arriba, en todas las escenas." />
                <Switch checked={endCard} onChange={onEndCard} label="Cierre con el logo" description="Al final, con el título, el subtítulo y el botón." />
              </div>
            )}
          </>
        )}
        stage={(
          <>
            <FitBox w={size[0]} h={size[1]}>
              {preview}
          {prompter.countdown != null && (
            <div className="absolute inset-0 grid place-items-center rounded-xl bg-black/60" aria-live="assertive">
              <div className="text-center text-white">
                <p className="text-8xl font-black tabular-nums">{prompter.countdown}</p>
                <p className="mt-2 text-sm text-white/80">Prepárate: el video arranca y se graba tu voz</p>
              </div>
            </div>
          )}
          {prompter.active && (
            <div className="absolute inset-x-3 bottom-3 rounded-xl bg-black/75 p-4 text-center" aria-live="polite">
              <p className="flex items-center justify-center gap-2 text-xs font-semibold text-red-400"><span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />Grabando tu voz</p>
              <p className="mt-1 text-2xl font-bold text-white leading-snug">{promptLine.now || '…'}</p>
              {promptLine.next && <p className="mt-1 text-sm text-white/50">Sigue: {promptLine.next}</p>}
            </div>
          )}
            </FitBox>
            {onboarding && <div className="absolute inset-0 z-10 grid place-items-center p-6 bg-gray-100/70 backdrop-blur-[2px]">{onboarding}</div>}
          </>
        )}
        inspectorTitle={sc ? <span className="truncate">Escena {idx + 1} · {({ '3d': 'Prenda 3D', foto: 'Foto', texto: 'Texto', clip: 'Clip' })[sc.kind]}</span> : 'Escena'}
        inspector={sc ? (
            <SceneInspector
              scene={sc} index={idx} count={scenes.length} endCard={endCard} patch={patch}
              templates={templates} defaultTemplate={defaultTemplate} photoTemplates={photoTemplates} products={allProducts} clips={clips} canAdd={canAdd}
              onMove={(d) => moveTo(idx, idx + d)} onDuplicate={duplicate} onRemove={remove} onApplyTransitionAll={applyTransitionAll} onApplyDesignAll={applyDesignAll}
              bgPalette={palette} bgPhotos={bgPhotos} onBgAi={() => setBgAi(true)} onBgApplyAll={applyBgAll} onBgUpload={uploadBg}
              section={section} onSection={setSection}
            />
        ) : <p className="text-sm text-gray-500">Agrega una escena para empezar.</p>}
        bottom={(
          <>
            <div className="flex flex-wrap items-center justify-center gap-2 px-3 py-2 border-b border-gray-100">
            <button type="button" className={toolBtn} title="Escena anterior" aria-label="Escena anterior" onClick={() => jump(-1)}><SkipBack className="w-4 h-4" /></button>
            <button
              type="button" onClick={onTogglePlay} aria-label={playing ? 'Pausar' : 'Reproducir'} title="Espacio"
              className="grid place-items-center w-11 h-11 rounded-full bg-app-600 text-white hover:bg-app-700 shadow"
            >
              {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
            </button>
            <button type="button" className={toolBtn} title="Escena siguiente" aria-label="Escena siguiente" onClick={() => jump(1)}><SkipForward className="w-4 h-4" /></button>
            <span className="ml-2 font-mono text-sm tabular-nums text-gray-900"><span ref={timecodeRef}>0:00.0</span><span className="text-gray-400"> / {Math.floor(total / 60)}:{(total % 60).toFixed(1).padStart(4, '0')}</span></span>
            <span className="ml-3 text-xs text-gray-400">{info}</span>
            </div>
            <EditorTimeline
              scenes={scenes} endCard={endCard} selectedId={sc?.id ?? null}
              onSelect={(id, prev) => { onSelect(id); if (prev) onPreview(id); }}
              onChange={onChange} onSeek={onSeek} playheadRef={playheadRef} music={music}
              onTransition={(id) => { onSelect(id); setSection('transicion'); }}
            />
          </>
        )}
      />

      {advice && (
        <Dialog
          open onClose={() => setAdvice(null)} size="lg" title="Ayuda IA: recomendaciones para tu video"
          description={advice.ai ? 'Revisado por la IA con lo que funciona hoy en reels e historias.' : 'La IA no respondió: son recomendaciones del editor según el tono.'}
          footer={(
            <FormActions>
              <Button variant="secondary" onClick={() => setAdvice(null)}>Cerrar</Button>
              <Button icon={<WandSparkles className="w-4 h-4" />} onClick={() => applyAdvice()} disabled={!Object.values(picked).some(Boolean)}>Aplicar las elegidas</Button>
            </FormActions>
          )}
        >
          <div className="space-y-4">
            <p className="text-sm text-gray-800">{advice.summary}</p>
            {advice.tips.length > 0 && (
              <ul className="space-y-1.5">
                {advice.tips.map((t, i) => <li key={i} className="flex gap-2 text-sm text-gray-700"><Sparkles className="w-4 h-4 text-app-600 flex-shrink-0 mt-0.5" />{t}</li>)}
              </ul>
            )}
            <div className="space-y-2">
              {advice.scenes.map((a) => {
                const s = scenes[a.index];
                if (!s) return null;
                const changes: string[] = [];
                if (a.transition !== s.transition) changes.push(`Transición: ${lbl.tr(s.transition)} → ${lbl.tr(a.transition)}`);
                if ((a.sound ?? null) !== (s.sound ?? null)) changes.push(`Sonido: ${lbl.snd(s.sound)} → ${lbl.snd(a.sound)}`);
                if (Math.abs(a.transitionSeconds - s.transitionSeconds) > 0.05) changes.push(`Duración de la transición: ${s.transitionSeconds.toFixed(1)} → ${a.transitionSeconds.toFixed(1)} s`);
                if (Math.abs(a.seconds - clampSeconds(s.seconds)) > 0.05) changes.push(`Duración: ${clampSeconds(s.seconds).toFixed(1)} → ${a.seconds.toFixed(1)} s`);
                if (a.textAnim !== s.textAnim) changes.push(`Texto: ${lbl.anim(s.textAnim)} → ${lbl.anim(a.textAnim)}`);
                if (s.kind === '3d' && a.motion && a.motion !== s.motion) changes.push(`Cámara: ${lbl.mot(s.motion)} → ${lbl.mot(a.motion)}`);
                return (
                  <div key={a.index} className="rounded-lg border border-gray-200 p-3">
                    <div className="flex items-start gap-3">
                      <Checkbox checked={!!picked[a.index]} disabled={!changes.length} onChange={(e) => setPicked((p) => ({ ...p, [a.index]: e.target.checked }))} label={`Escena ${a.index + 1}${s.title ? ` · "${s.title}"` : ''}`} description={a.reason} />
                      <div className="ml-auto flex gap-1">
                        {isSound(a.sound) && <IconButton title="Escuchar el sonido recomendado" onClick={() => void playSound(a.sound as never, sfxVolume)}><Volume2 className="w-4 h-4" /></IconButton>}
                        <Button size="sm" variant="ghost" disabled={!changes.length} onClick={() => applyAdvice(a.index)}>Aplicar</Button>
                      </div>
                    </div>
                    {changes.length ? (
                      <ul className="mt-2 ml-7 space-y-0.5 text-xs text-gray-600">{changes.map((c) => <li key={c}>{c}</li>)}</ul>
                    ) : <p className="mt-2 ml-7 text-xs text-gray-500">Así está bien.</p>}
                  </div>
                );
              })}
            </div>
          </div>
        </Dialog>
      )}
    </>
  );
}
