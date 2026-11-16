/**
 * Línea de tiempo del editor de video, por pistas: escenas (bloques del largo de cada una, con las
 * transiciones sobre los cortes), textos y música (con su onda). Se recorta arrastrando el borde
 * derecho de un bloque (y el izquierdo en los clips), se reordena arrastrando el bloque, y un clic
 * en la regla o en una pista lleva la reproducción a ese segundo. Con zoom para afinar.
 */
import { useEffect, useLayoutEffect, useRef, useState, type MutableRefObject, type PointerEvent as RPointerEvent } from 'react';
import { Box, Clapperboard, Image as ImageIcon, Maximize2, Music, Type, ZoomIn, ZoomOut } from 'lucide-react';
import {
  clampSeconds, END_SECONDS, layout, maxSeconds, SCENE_MIN, TRANSITIONS, type Scene, type SceneKind,
} from './timeline';
import type { StudioMusic } from './VideoEditor';

const KIND: Record<SceneKind, { icon: typeof Box; cls: string; label: string }> = {
  '3d': { icon: Box, cls: 'bg-sky-800/90 border-sky-500/60', label: '3D' },
  foto: { icon: ImageIcon, cls: 'bg-emerald-800/90 border-emerald-500/60', label: 'Foto' },
  texto: { icon: Type, cls: 'bg-amber-700/90 border-amber-400/60', label: 'Texto' },
  clip: { icon: Clapperboard, cls: 'bg-violet-800/90 border-violet-500/60', label: 'Clip' },
};

const TRACK_H = { scenes: 64, text: 30, music: 40 };

const thumbOf = (s: Scene) => (s.kind === 'clip' ? s.clip?.thumb : s.kind === 'foto' ? s.product?.image : s.kind === '3d' ? s.design?.image : null) ?? null;

const fmt = (t: number) => `${Math.floor(t / 60)}:${(t % 60).toFixed(0).padStart(2, '0')}`;

export function EditorTimeline({
  scenes, endCard, selectedId, onSelect, onChange, onSeek, playheadRef, music, onTransition,
}: {
  scenes: Scene[];
  endCard: boolean;
  selectedId: string | null;
  onSelect: (id: string, preview?: boolean) => void;
  onChange: (s: Scene[], merge?: string) => void;
  onSeek: (t: number) => void;
  playheadRef: MutableRefObject<HTMLDivElement | null>;
  music: StudioMusic | null;
  /** Clic en una transición: abre su panel. */
  onTransition: (sceneId: string) => void;
}) {
  const { starts, total } = layout(scenes, endCard);
  const scroller = useRef<HTMLDivElement>(null);
  const [pxps, setPxps] = useState(70);
  /** Si el usuario usó el zoom, la línea de tiempo deja de ajustarse sola al ancho. */
  const [zoomed, setZoomed] = useState(false);
  const width = Math.max(1, total * pxps);

  // La línea de tiempo cabe en el ancho disponible (hasta que el usuario haga zoom).
  const fit = () => {
    const w = scroller.current?.clientWidth ?? 800;
    setPxps(Math.min(220, Math.max(18, (w - 24) / Math.max(1, total))));
  };
  useLayoutEffect(() => {
    if (zoomed || !total) return;
    fit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total, zoomed]);

  // ─── Arrastres (recortar o mover) ──────────────────────────────────────────
  const drag = useRef<null | { kind: 'trimR' | 'trimL' | 'move'; i: number; x0: number; scenes: Scene[]; moved: boolean }>(null);
  const [moving, setMoving] = useState<{ i: number; dx: number } | null>(null);

  const startDrag = (e: RPointerEvent, kind: 'trimR' | 'trimL' | 'move', i: number) => {
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    drag.current = { kind, i, x0: e.clientX, scenes, moved: false };
  };
  const onMove = (e: RPointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x0;
    if (Math.abs(dx) > 4) d.moved = true;
    const sc = d.scenes[d.i];
    const dt = Math.round((dx / pxps) * 10) / 10;
    if (d.kind === 'trimR') {
      const seconds = Math.min(maxSeconds(sc), Math.max(SCENE_MIN, clampSeconds(sc.seconds) + dt));
      onChange(d.scenes.map((s, j) => (j === d.i ? { ...s, seconds } : s)), `${sc.id}:trim`);
    } else if (d.kind === 'trimL' && sc.kind === 'clip' && sc.clip) {
      // Recorta el inicio del clip: el final queda donde estaba.
      const end = sc.clipStart + clampSeconds(sc.seconds);
      const clipStart = Math.min(end - SCENE_MIN, Math.max(0, sc.clipStart + dt));
      onChange(d.scenes.map((s, j) => (j === d.i ? { ...s, clipStart, seconds: end - clipStart } : s)), `${sc.id}:trimL`);
    } else if (d.kind === 'move' && d.moved) {
      setMoving({ i: d.i, dx });
    }
  };
  const endDrag = (e: RPointerEvent) => {
    const d = drag.current;
    drag.current = null;
    setMoving(null);
    if (!d) return;
    if (d.kind === 'move') {
      const sc = d.scenes[d.i];
      if (!d.moved) { onSelect(sc.id, true); return; }
      // Nueva posición: según dónde quedó el centro del bloque.
      const { starts: st } = layout(d.scenes, false);
      const center = st[d.i] + clampSeconds(sc.seconds) / 2 + (e.clientX - d.x0) / pxps;
      // Va después de todas las otras escenas cuyo centro quedó antes que el suyo.
      const to = d.scenes.filter((x, j) => j !== d.i && st[j] + clampSeconds(x.seconds) / 2 < center).length;
      if (to !== d.i) {
        const next = d.scenes.filter((_, j) => j !== d.i);
        next.splice(to, 0, sc);
        onChange(next);
      }
      onSelect(sc.id);
    }
  };

  const seekFrom = (e: RPointerEvent<HTMLDivElement>) => {
    const box = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    onSeek(Math.min(total - 0.01, Math.max(0, (e.clientX - box.left) / pxps)));
  };

  // ─── Onda de la música ─────────────────────────────────────────────────────
  const wave = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = wave.current;
    if (!c || !music) return;
    const w = Math.max(1, Math.round(width));
    c.width = w;
    c.height = TRACK_H.music - 10;
    const ctx = c.getContext('2d')!;
    ctx.clearRect(0, 0, c.width, c.height);
    const data = music.buffer.getChannelData(0);
    const sr = music.buffer.sampleRate;
    const bars = Math.floor(w / 3);
    const peaks: number[] = [];
    for (let b = 0; b < bars; b++) {
      const t0 = music.offset + (b / bars) * total;
      const i0 = Math.floor(t0 * sr) % data.length;
      const n = Math.max(1, Math.floor((total / bars) * sr));
      let peak = 0;
      for (let k = 0; k < n; k += 32) peak = Math.max(peak, Math.abs(data[(i0 + k) % data.length]));
      peaks.push(peak);
    }
    // Normalizada: la parte más fuerte ocupa toda la pista.
    const top = Math.max(0.01, ...peaks);
    ctx.fillStyle = 'rgba(167, 243, 208, 0.85)';
    peaks.forEach((pk, b) => {
      const h = Math.max(1, (pk / top) * c.height);
      ctx.fillRect(b * 3, (c.height - h) / 2, 2, h);
    });
  }, [music, width, total]);

  // Marcas de la regla.
  const step = pxps >= 120 ? 0.5 : pxps >= 45 ? 1 : pxps >= 22 ? 2 : 5;
  const ticks: number[] = [];
  for (let t = 0; t <= total + 1e-6; t += step) ticks.push(Math.round(t * 10) / 10);

  return (
    <div className="rounded-xl bg-gray-900 ring-1 ring-white/10 text-gray-300 select-none">
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-white/10">
        <p className="text-xs font-medium text-gray-400">Línea de tiempo · arrastra el borde de una escena para cambiar su duración y el bloque para moverla</p>
        <div className="flex items-center gap-1">
          <button type="button" title="Alejar" aria-label="Alejar la línea de tiempo" onClick={() => { setZoomed(true); setPxps((p) => Math.max(18, p / 1.4)); }} className="p-1.5 rounded-md hover:bg-white/10"><ZoomOut className="w-4 h-4" /></button>
          <button type="button" title="Acercar" aria-label="Acercar la línea de tiempo" onClick={() => { setZoomed(true); setPxps((p) => Math.min(260, p * 1.4)); }} className="p-1.5 rounded-md hover:bg-white/10"><ZoomIn className="w-4 h-4" /></button>
          <button type="button" title="Ajustar al ancho" aria-label="Ajustar la línea de tiempo al ancho" onClick={() => { setZoomed(false); fit(); }} className="p-1.5 rounded-md hover:bg-white/10"><Maximize2 className="w-4 h-4" /></button>
        </div>
      </div>
      <div className="flex">
        {/* Nombres de las pistas */}
        <div className="w-20 flex-shrink-0 border-r border-white/10 text-[11px] text-gray-400">
          <div className="h-7" />
          <div className="flex items-center gap-1.5 px-2" style={{ height: TRACK_H.scenes }}><Clapperboard className="w-3.5 h-3.5" />Escenas</div>
          <div className="flex items-center gap-1.5 px-2" style={{ height: TRACK_H.text }}><Type className="w-3.5 h-3.5" />Textos</div>
          <div className="flex items-center gap-1.5 px-2" style={{ height: TRACK_H.music }}><Music className="w-3.5 h-3.5" />Música</div>
        </div>
        <div ref={scroller} className="flex-1 overflow-x-auto overflow-y-hidden" onPointerMove={onMove} onPointerUp={endDrag} onPointerCancel={endDrag}>
          <div className="relative px-3" style={{ width: width + 24 }}>
            <div className="relative" style={{ width }}>
              {/* Regla */}
              <div
                role="slider" tabIndex={0} aria-label="Recorrer el video" aria-valuemin={0} aria-valuemax={Math.round(total)}
                className="relative h-7 cursor-pointer border-b border-white/10"
                onPointerDown={(e) => { (e.currentTarget as Element).setPointerCapture?.(e.pointerId); seekFrom(e); }}
                onPointerMove={(e) => { if (e.buttons === 1 && !drag.current) seekFrom(e); }}
              >
                {ticks.map((t) => (
                  <span key={t} className="absolute bottom-0 pointer-events-none" style={{ left: t * pxps }}>
                    <span className={`block w-px ${Number.isInteger(t / (step * 2)) ? 'h-3 bg-gray-500' : 'h-1.5 bg-gray-600'}`} />
                    {Number.isInteger(t / (step * 2)) && <span className="absolute -top-4 left-1 text-[10px] text-gray-500 tabular-nums">{fmt(t)}</span>}
                  </span>
                ))}
              </div>

              {/* Pista de escenas */}
              <div className="relative" style={{ height: TRACK_H.scenes }} onPointerDown={(e) => { if (e.target === e.currentTarget) seekFrom(e); }}>
                {scenes.map((s, i) => {
                  const k = KIND[s.kind];
                  const Icon = k.icon;
                  const len = clampSeconds(s.seconds);
                  const th = thumbOf(s);
                  const sel = s.id === selectedId;
                  const dx = moving?.i === i ? moving.dx : 0;
                  return (
                    <div
                      key={s.id}
                      className={`absolute top-1.5 bottom-1.5 rounded-lg border overflow-hidden cursor-grab active:cursor-grabbing ${k.cls} ${sel ? 'ring-2 ring-app-400 z-10' : ''} ${dx ? 'opacity-80 z-20 shadow-2xl' : ''}`}
                      style={{ left: starts[i] * pxps + 1, width: Math.max(8, len * pxps - 2), transform: dx ? `translateX(${dx}px)` : undefined }}
                      onPointerDown={(e) => startDrag(e, 'move', i)}
                      title={`Escena ${i + 1} · ${k.label} · ${len} s`}
                    >
                      {th && <div className="absolute inset-0 opacity-40" style={{ backgroundImage: `url("${th}")`, backgroundSize: 'auto 100%', backgroundRepeat: 'repeat-x' }} />}
                      <div className="relative flex items-center gap-1 px-2 pt-1 text-[11px] font-medium text-white whitespace-nowrap">
                        <Icon className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{i + 1}. {s.kind === 'foto' ? s.product?.name ?? 'Foto' : s.kind === 'clip' ? s.clip?.name ?? 'Clip' : s.kind === 'texto' ? s.title || 'Texto' : k.label}</span>
                      </div>
                      <span className="relative block px-2 text-[10px] text-white/70 tabular-nums">{len.toFixed(1)} s</span>
                      {s.kind === 'clip' && (
                        <span
                          className="absolute left-0 inset-y-0 w-2 cursor-ew-resize bg-white/0 hover:bg-white/40" aria-label="Recortar el inicio del clip"
                          onPointerDown={(e) => startDrag(e, 'trimL', i)}
                        />
                      )}
                      <span
                        className="absolute right-0 inset-y-0 w-2 cursor-ew-resize bg-white/10 hover:bg-white/50" aria-label="Cambiar la duración"
                        onPointerDown={(e) => startDrag(e, 'trimR', i)}
                      />
                    </div>
                  );
                })}
                {/* Transiciones sobre los cortes */}
                {scenes.map((s, i) => {
                  if (i === scenes.length - 1 && !endCard) return null;
                  if (s.transition === 'corte') return null;
                  const cut = (i + 1 < scenes.length ? starts[i + 1] : layout(scenes, false).body) * pxps;
                  const w = Math.max(14, s.transitionSeconds * pxps);
                  return (
                    <button
                      key={`t${s.id}`} type="button" title={`Transición: ${TRANSITIONS.find((t) => t.value === s.transition)?.label} (${s.transitionSeconds.toFixed(1)} s)`}
                      aria-label={`Transición después de la escena ${i + 1}`}
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={() => onTransition(s.id)}
                      className="absolute top-1/2 -translate-y-1/2 z-30 h-5 rounded-full bg-white/90 text-gray-900 text-[10px] font-semibold shadow ring-1 ring-black/20 hover:bg-app-200 px-1 overflow-hidden whitespace-nowrap"
                      style={{ left: cut - w / 2, width: w }}
                    >
                      {w > 46 ? TRANSITIONS.find((t) => t.value === s.transition)?.label.split(' ')[0] : '⇄'}{s.sound ? ' ♪' : ''}
                    </button>
                  );
                })}
                {endCard && (
                  <div
                    className="absolute top-1.5 bottom-1.5 rounded-lg border border-dashed border-white/30 bg-white/5 text-[11px] text-gray-400 grid place-items-center"
                    style={{ left: layout(scenes, false).body * pxps + 1, width: END_SECONDS * pxps - 2 }}
                  >
                    Cierre
                  </div>
                )}
              </div>

              {/* Pista de textos */}
              <div className="relative border-t border-white/5" style={{ height: TRACK_H.text }} onPointerDown={(e) => { if (e.target === e.currentTarget) seekFrom(e); }}>
                {scenes.map((s, i) => (s.title || s.subtitle || s.badge) && (
                  <button
                    key={s.id} type="button" onClick={() => onSelect(s.id, true)}
                    className={`absolute top-1 bottom-1 rounded-md px-2 text-left text-[11px] truncate ${s.id === selectedId ? 'bg-app-500 text-white' : 'bg-white/15 text-gray-200 hover:bg-white/25'}`}
                    style={{ left: starts[i] * pxps + 1, width: Math.max(8, clampSeconds(s.seconds) * pxps - 2) }}
                  >
                    {[s.badge, s.title, s.subtitle].filter(Boolean).join(' · ')}
                  </button>
                ))}
              </div>

              {/* Pista de música */}
              <div className="relative border-t border-white/5" style={{ height: TRACK_H.music }} onPointerDown={(e) => seekFrom(e)}>
                {music
                  ? <div className="absolute inset-x-0 top-1 bottom-1 rounded-md bg-emerald-900/60 ring-1 ring-emerald-500/40 overflow-hidden"><canvas ref={wave} className="absolute left-0 top-1 h-[calc(100%-8px)]" style={{ width }} aria-hidden="true" /><span className="absolute left-2 top-0.5 text-[10px] text-emerald-200">{music.name}</span></div>
                  : <p className="absolute inset-0 flex items-center px-2 text-[11px] text-gray-500 pointer-events-none">Sin música: agrégala en la pestaña Audio.</p>}
              </div>

              {/* Cabezal de reproducción */}
              <div ref={playheadRef} className="absolute top-0 bottom-0 w-px bg-app-400 pointer-events-none z-40" style={{ left: 0, opacity: 0 }}>
                <span className="absolute -top-0 -left-1.5 w-3 h-3 rotate-45 bg-app-400 rounded-sm" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
