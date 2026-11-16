/**
 * Admin → Imágenes de diseño → editor de diseños a pantalla completa. Capas de imagen (cualquier
 * formato), SVG (cada color se cambia directo) y texto (todas las fuentes y formas; "lo cambia el
 * cliente" = nombre editable). Mover, escalar, girar, voltear, ordenar, duplicar, centrar y quitar el
 * fondo blanco. Al guardar: PNG en alta calidad para producción, miniatura y las capas para volver a
 * editarlo.
 *
 * Modo cliente (personalizador de la tienda): el mismo editor sin los datos del catálogo; "Usar en mi
 * prenda" devuelve la imagen (vista y alta calidad) y las capas, sin guardar nada en la galería.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import {
  AlignCenterHorizontal, AlignCenterVertical, ArrowDown, ArrowUp, Copy, Database, Eye, EyeOff, FlipHorizontal, FlipVertical,
  ImagePlus, Layers, Plus, Redo2, RotateCw, Save, Shapes, Trash2, Type, Undo2, Wand2, X,
} from 'lucide-react';
import { Button, Field, Switch, TextInput, toast } from '../../ui';
import { StudioShell, FitBox, ToolbarSep } from '../../marketing/StudioShell';
import { useHistory } from '../../marketing/useHistory';
import { TextStyleEditor } from '../../customizer/TextTools';
import { DEFAULT_TEXT, loadTextFont, measureText, textImage, type TextSpec } from '../../../lib/textArt';
import { isSvg, recolorSvg, sanitizeSvg, svgColors, svgSize, svgUrl } from '../../../lib/svgColors';
import { assetUrl } from '../../../utils/assetUrl';
import { customizerService } from '../../../services/customizer.service';
import { designImagesService, type DesignImage } from '../../../services/design-images.service';
import {
  ARTBOARDS, emptyData, exportPng, fitBox, fromDesign, newId, removeWhiteBg, toTextFields, toUploadable,
  type DLayer, type EditorData, type TextLayer,
} from './model';

type Tab = 'agregar' | 'capas' | 'datos';
const RAIL = [
  { id: 'agregar', label: 'Agregar', title: 'Agregar al diseño', icon: Plus },
  { id: 'capas', label: 'Capas', title: 'Capas', icon: Layers },
  { id: 'datos', label: 'Datos', title: 'Datos del diseño', icon: Database },
] as const;

/** "/uploads/…" (la API a veces devuelve la dirección completa). */
const toPath = (url: string) => { const i = url.indexOf('/uploads/'); return i >= 0 ? url.slice(i) : url; };

const readText = (f: File) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsText(f); });
const readData = (f: File) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(f); });
const naturalAspect = (src: string) => new Promise<number>((res) => { const i = new Image(); i.onload = () => res(i.naturalWidth / Math.max(1, i.naturalHeight)); i.onerror = () => res(1); i.src = src; });

const kindIcon = (l: DLayer) => (l.kind === 'text' ? Type : l.kind === 'svg' ? Shapes : ImagePlus);

function Range({ label, value, min, max, step = 1, suffix = '', onChange }: { label: string; value: number; min: number; max: number; step?: number; suffix?: string; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="flex items-center justify-between text-xs text-gray-600 mb-1">{label}<span className="font-medium text-gray-900 tabular-nums">{Math.round(value)}{suffix}</span></span>
      <input type="range" min={min} max={max} step={step} value={value} aria-label={label} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-[rgb(var(--app-600))]" />
    </label>
  );
}

/** Lo que devuelve el editor en modo cliente. */
export interface StudioResult { preview: string; original: string; width: number; height: number; data: EditorData }

export function DesignStudio({ design, categories = [], seasons = [], onClose, onSaved, mode = 'admin', initial, onApply }: {
  design: DesignImage | null;
  categories?: string[];
  seasons?: string[];
  onClose: () => void;
  onSaved?: () => void;
  /** 'cliente': en la tienda (sin datos del catálogo; devuelve el diseño con onApply). */
  mode?: 'admin' | 'cliente';
  /** Capas con las que abre (modo cliente). */
  initial?: EditorData | null;
  onApply?: (r: StudioResult) => void;
}) {
  const client = mode === 'cliente';
  const hist = useHistory<EditorData>(emptyData);
  const { value: data, set, reset } = hist;
  const [sel, setSel] = useState<string | null>(null);
  // En el celular abre con el lienzo a la vista (el panel se abre desde el riel).
  const [tab, setTab] = useState<Tab | null>(() => (typeof window !== 'undefined' && window.innerWidth < 1024 ? null : 'agregar'));
  const [meta, setMeta] = useState({
    name: design?.name ?? '', category: design?.category ?? '', season: design?.season ?? '', tags: design?.tags?.join(', ') ?? '', isActive: design?.isActive ?? true,
  });
  const [saving, setSaving] = useState<string | null>(null);
  const [ready, setReady] = useState(!design && !initial);
  const [svgCode, setSvgCode] = useState('');
  const [tol, setTol] = useState(28);
  const fileRef = useRef<HTMLInputElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.2);

  // Abrir: las capas guardadas o, si es un diseño viejo, su imagen y sus textos como capas.
  useEffect(() => {
    if (initial) { reset(initial); setReady(true); return; }
    if (!design) return;
    let alive = true;
    const saved = (design as DesignImage & { editorData?: EditorData | null }).editorData;
    (saved?.layers ? Promise.resolve(saved) : fromDesign(design)).then((d) => { if (alive) { reset(d); setReady(true); } });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [design, reset]);

  const A = data.artboard;
  const layer = data.layers.find((l) => l.id === sel) ?? null;
  const patch = useCallback((id: string, p: Partial<DLayer>, merge?: string) => {
    set((d) => ({ ...d, layers: d.layers.map((l) => (l.id === id ? ({ ...l, ...p } as DLayer) : l)) }), merge);
  }, [set]);
  const add = (l: DLayer) => { set((d) => ({ ...d, layers: [...d.layers, l] })); setSel(l.id); };
  const remove = (id: string) => { set((d) => ({ ...d, layers: d.layers.filter((l) => l.id !== id) })); setSel(null); };
  const move = (id: string, dir: 1 | -1) => set((d) => {
    const i = d.layers.findIndex((l) => l.id === id), j = i + dir;
    if (i < 0 || j < 0 || j >= d.layers.length) return d;
    const layers = [...d.layers];
    [layers[i], layers[j]] = [layers[j], layers[i]];
    return { ...d, layers };
  });

  // Vista previa de cada texto (se vuelve a dibujar al cambiar).
  const [textUrls, setTextUrls] = useState<Record<string, { key: string; url: string }>>({});
  useEffect(() => {
    let alive = true;
    const texts = data.layers.filter((l): l is TextLayer => l.kind === 'text');
    const t = window.setTimeout(async () => {
      const next: Record<string, { key: string; url: string }> = {};
      for (const l of texts) {
        const key = JSON.stringify(l.spec);
        next[l.id] = textUrls[l.id]?.key === key ? textUrls[l.id] : { key, url: (await textImage(l.spec, 1000)).url };
      }
      if (alive) setTextUrls(next);
    }, 120);
    return () => { alive = false; window.clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.layers]);

  // Escala del lienzo en pantalla.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setScale(el.clientWidth / A.w));
    ro.observe(el);
    return () => ro.disconnect();
  }, [A.w, ready]);

  // ── Agregar ──
  const addFiles = async (files: FileList | File[]) => {
    for (const f of Array.from(files).slice(0, 8)) {
      try {
        if (f.type === 'image/svg+xml' || /\.svg$/i.test(f.name)) {
          const svg = sanitizeSvg(await readText(f));
          if (!isSvg(svg)) throw new Error('El archivo no es un SVG válido');
          const { w, h } = svgSize(svg);
          add({ id: newId(), name: f.name.replace(/\.[^.]+$/, ''), kind: 'svg', svg, colors: {}, ...fitBox(A, w / h), rot: 0, flipX: false, flipY: false });
        } else {
          if (f.size > 40 * 1024 * 1024) throw new Error('La imagen pesa más de 40 MB');
          const src = await readData(f);
          const aspect = await naturalAspect(src);
          add({ id: newId(), name: f.name.replace(/\.[^.]+$/, ''), kind: 'image', src, ...fitBox(A, aspect), rot: 0, flipX: false, flipY: false });
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : `No se pudo abrir ${f.name}`);
      }
    }
  };
  const addSvgCode = () => {
    const svg = sanitizeSvg(svgCode);
    if (!isSvg(svg)) { toast.error('Pega el código de un SVG (empieza con <svg …>)'); return; }
    const { w, h } = svgSize(svg);
    add({ id: newId(), name: 'SVG', kind: 'svg', svg, colors: {}, ...fitBox(A, w / h), rot: 0, flipX: false, flipY: false });
    setSvgCode('');
  };
  const addText = async (editable: boolean) => {
    const spec: TextSpec = editable
      ? { ...DEFAULT_TEXT, text: 'Sofía', font: 'Mountains of Christmas', weight: 700, color: '#C62828', shape: 'arco', curve: 25, outline: { color: '#FFFFFF', width: 6 } }
      : { ...DEFAULT_TEXT, text: 'Tu texto' };
    await loadTextFont(spec.font);
    const m = measureText(spec);
    const w = A.w * 0.55, h = w / (m.width / m.height);
    add({
      id: newId(), name: editable ? 'Nombre' : 'Texto', kind: 'text', spec, editable: editable ? { label: 'Nombre', maxLength: 14 } : null,
      x: (A.w - w) / 2, y: editable ? Math.min(A.h * 0.72, A.h * 0.96 - h) : (A.h - h) / 2, w, h, rot: 0, flipX: false, flipY: false,
    });
  };
  /** Cambiar el texto o su estilo: la letra conserva su tamaño y el centro no se mueve. */
  const setText = async (l: TextLayer, p: Partial<TextSpec>, merge?: string) => {
    const spec = { ...l.spec, ...p };
    await loadTextFont(spec.font);
    const a = measureText(l.spec), b = measureText(spec);
    const w = l.w * (b.width / Math.max(1, a.width)), h = w / (b.width / b.height);
    patch(l.id, { spec, w, h, x: l.x + (l.w - w) / 2, y: l.y + (l.h - h) / 2 } as Partial<DLayer>, merge);
  };
  const changeArtboard = (key: string) => {
    const nb = ARTBOARDS.find((x) => x.key === key)!;
    const k = Math.min(nb.w / A.w, nb.h / A.h);
    const ox = (nb.w - A.w * k) / 2, oy = (nb.h - A.h * k) / 2;
    set((d) => ({ ...d, artboard: nb, layers: d.layers.map((l) => ({ ...l, x: ox + l.x * k, y: oy + l.y * k, w: l.w * k, h: l.h * k })) }));
  };

  // ── Arrastrar, escalar y girar en el lienzo ──
  const drag = useRef<{ id: string; mode: 'move' | 'size' | 'rot'; px: number; py: number; l: DLayer; cx: number; cy: number } | null>(null);
  const onDown = (e: RPointerEvent, l: DLayer, mode: 'move' | 'size' | 'rot') => {
    e.preventDefault();
    e.stopPropagation();
    setSel(l.id);
    const r = stageRef.current!.getBoundingClientRect();
    drag.current = { id: l.id, mode, px: e.clientX, py: e.clientY, l, cx: r.left + (l.x + l.w / 2) * scale, cy: r.top + (l.y + l.h / 2) * scale };
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };
  const onMove = (e: RPointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const l = d.l;
    if (d.mode === 'move') {
      patch(d.id, { x: l.x + (e.clientX - d.px) / scale, y: l.y + (e.clientY - d.py) / scale }, `mover:${d.id}`);
    } else if (d.mode === 'size') {
      // Desde el centro, sin deformar.
      const r0 = Math.hypot(d.px - d.cx, d.py - d.cy), r1 = Math.hypot(e.clientX - d.cx, e.clientY - d.cy);
      const k = Math.max(0.05, r1 / Math.max(1, r0));
      const w = l.w * k, h = l.h * k;
      patch(d.id, { w, h, x: l.x + (l.w - w) / 2, y: l.y + (l.h - h) / 2 }, `escalar:${d.id}`);
    } else {
      const a = (Math.atan2(e.clientY - d.cy, e.clientX - d.cx) * 180) / Math.PI + 90;
      const snap = Math.abs(a % 45) < 4 ? Math.round(a / 45) * 45 : a;
      patch(d.id, { rot: Math.round(((snap + 540) % 360) - 180) }, `girar:${d.id}`);
    }
  };

  // Teclado: borrar, mover con flechas, deshacer y rehacer.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('input, textarea, select, [contenteditable]')) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) { hist.redo(); } else { hist.undo(); } return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); hist.redo(); return; }
      if (!layer) return;
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); remove(layer.id); }
      const step = e.shiftKey ? 50 : 10;
      const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0, dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
      if (dx || dy) { e.preventDefault(); patch(layer.id, { x: layer.x + dx, y: layer.y + dy }, `flecha:${layer.id}`); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // ── Guardar ──
  const apply = async () => {
    if (!data.layers.some((l) => !l.hidden)) { toast.error('Agrega al menos una imagen o un texto'); return; }
    try {
      setSaving('Preparando tu diseño…');
      const [preview, original] = await Promise.all([exportPng(data, 900), exportPng(data, Math.max(A.w, A.h))]);
      const k = Math.max(A.w, A.h);
      onApply?.({ preview, original, width: Math.round((A.w / k) * 3000), height: Math.round((A.h / k) * 3000), data });
    } catch {
      toast.error('No se pudo preparar el diseño. Si usaste una imagen de otra página, súbela desde tu equipo.');
    } finally {
      setSaving(null);
    }
  };

  const save = async () => {
    if (client) { await apply(); return; }
    if (!meta.name.trim()) { setTab('datos'); toast.error('Ponle un nombre al diseño'); return; }
    if (!data.layers.some((l) => !l.hidden)) { toast.error('Agrega al menos una imagen, un SVG o un texto'); return; }
    try {
      // 1) Las imágenes nuevas se suben al servidor.
      setSaving('Subiendo las imágenes…');
      const layers: DLayer[] = [];
      for (const l of data.layers) {
        if (l.kind === 'image' && l.src.startsWith('data:')) layers.push({ ...l, src: toPath(await customizerService.uploadDesignImage(await toUploadable(l.src))) });
        else layers.push(l);
      }
      const final: EditorData = { ...data, layers };
      // 2) El PNG de producción (sin los textos que cambia el cliente) y la miniatura (con el ejemplo).
      setSaving('Preparando el archivo de alta calidad…');
      const print = toPath(await customizerService.uploadDesignImage(await exportPng(final, Math.max(A.w, A.h), { skipEditable: true })));
      const thumb = await exportPng(final, 300);
      setSaving('Guardando…');
      const body = {
        name: meta.name.trim(), category: meta.category.trim() || undefined, season: meta.season.trim() || null,
        tags: meta.tags.split(',').map((t) => t.trim()).filter(Boolean), isActive: meta.isActive,
        thumbnailUrl: thumb, fullUrl: print, printUrl: print, textFields: toTextFields(final), editorData: final,
      };
      if (design) await designImagesService.update(design.id, body);
      else await designImagesService.create(body);
      toast.success(design ? 'Diseño guardado' : 'Diseño creado');
      onSaved?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo guardar el diseño');
    } finally {
      setSaving(null);
    }
  };

  const ordered = useMemo(() => [...data.layers].reverse(), [data.layers]);
  const pct = (v: number, of: number) => Math.round((v / of) * 100);

  const panel = (
    <>
      {tab === 'agregar' && (
        <div className="space-y-4">
          <input ref={fileRef} type="file" multiple accept="image/*,.svg" className="hidden" aria-label="Subir imagen o SVG"
            onChange={(e) => { if (e.target.files) void addFiles(e.target.files); e.target.value = ''; }} />
          <button type="button" onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); void addFiles(e.dataTransfer.files); }}
            className="w-full rounded-xl border-2 border-dashed border-gray-300 p-5 text-center hover:border-app-400 hover:bg-app-50/40">
            <ImagePlus className="w-7 h-7 mx-auto text-gray-400" />
            <span className="block mt-2 text-sm font-medium text-gray-900">Subir imagen o SVG</span>
            <span className="block text-xs text-gray-500">PNG, JPG, WEBP, GIF, AVIF… o SVG (sus colores se cambian aquí). También puedes arrastrarlos.</span>
          </button>
          {client ? (
            <Button variant="secondary" fullWidth icon={<Type className="w-4 h-4" />} onClick={() => void addText(false)}>Agregar texto</Button>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="secondary" icon={<Type className="w-4 h-4" />} onClick={() => void addText(false)}>Texto</Button>
                <Button variant="secondary" icon={<Wand2 className="w-4 h-4" />} onClick={() => void addText(true)}>Nombre editable</Button>
              </div>
              <p className="text-xs text-gray-500">El <b>nombre editable</b> lo cambia el cliente al personalizar (ej. su nombre en un diseño navideño). Los demás textos quedan fijos en el diseño.</p>
            </>
          )}
          <div>
            <p className="text-xs font-medium text-gray-700 mb-1">Pegar código SVG</p>
            <textarea value={svgCode} onChange={(e) => setSvgCode(e.target.value)} rows={3} aria-label="Código SVG" placeholder="<svg …>…</svg>"
              className="w-full rounded-lg border border-gray-300 px-2.5 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-app-200" />
            <Button size="sm" variant="ghost" icon={<Shapes className="w-4 h-4" />} onClick={addSvgCode} disabled={!svgCode.trim()}>Agregar el SVG</Button>
          </div>
        </div>
      )}
      {tab === 'capas' && (
        <ul className="space-y-1">
          {!ordered.length && <li className="text-sm text-gray-500">Aún no hay capas.</li>}
          {ordered.map((l) => {
            const Icon = kindIcon(l);
            return (
              <li key={l.id} className={`flex items-center gap-1.5 rounded-lg border px-2 py-1.5 ${l.id === sel ? 'border-app-400 bg-app-50/60' : 'border-gray-200'}`}>
                <button type="button" onClick={() => setSel(l.id)} className="flex-1 min-w-0 flex items-center gap-2 text-left">
                  <Icon className="w-4 h-4 text-gray-500 flex-shrink-0" />
                  <span className="truncate text-sm text-gray-900">{l.kind === 'text' ? l.spec.text || 'Texto' : l.name}</span>
                  {l.kind === 'text' && l.editable && <span className="text-[10px] font-semibold text-app-700">editable</span>}
                </button>
                <button type="button" title={l.hidden ? 'Mostrar' : 'Ocultar'} aria-label={l.hidden ? 'Mostrar' : 'Ocultar'} onClick={() => patch(l.id, { hidden: !l.hidden })} className="p-1 rounded text-gray-500 hover:bg-gray-100">
                  {l.hidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <button type="button" title="Subir" aria-label="Subir" onClick={() => move(l.id, 1)} className="p-1 rounded text-gray-500 hover:bg-gray-100"><ArrowUp className="w-4 h-4" /></button>
                <button type="button" title="Bajar" aria-label="Bajar" onClick={() => move(l.id, -1)} className="p-1 rounded text-gray-500 hover:bg-gray-100"><ArrowDown className="w-4 h-4" /></button>
              </li>
            );
          })}
        </ul>
      )}
      {tab === 'datos' && (
        <div className="space-y-3">
          <Field label="Nombre" required htmlFor="ds-name"><TextInput id="ds-name" value={meta.name} onChange={(e) => setMeta({ ...meta, name: e.target.value })} placeholder="Ej: Reno navideño" /></Field>
          <Field label="Categoría" htmlFor="ds-cat">
            <TextInput id="ds-cat" value={meta.category} onChange={(e) => setMeta({ ...meta, category: e.target.value })} list="ds-cats" placeholder="Ej: Navidad" />
            <datalist id="ds-cats">{categories.map((c) => <option key={c} value={c} />)}</datalist>
          </Field>
          <Field label="Temporada" htmlFor="ds-season" hint="Sale como filtro en la galería (ej. navidad).">
            <TextInput id="ds-season" value={meta.season} onChange={(e) => setMeta({ ...meta, season: e.target.value })} list="ds-seasons" placeholder="navidad" />
            <datalist id="ds-seasons">{[...new Set(['navidad', ...seasons])].map((s) => <option key={s} value={s} />)}</datalist>
          </Field>
          <Field label="Etiquetas" htmlFor="ds-tags" hint="Separadas por coma."><TextInput id="ds-tags" value={meta.tags} onChange={(e) => setMeta({ ...meta, tags: e.target.value })} /></Field>
          <Switch checked={meta.isActive} onChange={(v) => setMeta({ ...meta, isActive: v })} label="Activo" description="Solo los activos salen en el personalizador." />
        </div>
      )}
    </>
  );

  const inspector = !layer ? (
    <div className="space-y-3 text-sm text-gray-600">
      <p>{client ? 'Tu diseño sobre fondo transparente: lo que pongas aquí va en la prenda.' : `Lienzo de impresión de ${A.w} × ${A.h} px, fondo transparente.`}</p>
      <p>Haz clic en una capa para editarla: arrástrala para moverla, la esquina para cambiar su tamaño y el círculo de arriba para girarla.</p>
      <p className="text-xs text-gray-500">Atajos: flechas para mover (Mayús: más), Supr para quitar, Ctrl+Z / Ctrl+Y.</p>
      {!client && <p className="text-xs text-amber-700">Para DTF: colores sólidos y contorno; evita sombras y transparencias a medias.</p>}
    </div>
  ) : (
    <div className="space-y-4">
      <Range label="Tamaño" value={pct(layer.w, A.w)} min={3} max={160} suffix="%" onChange={(v) => {
        const w = (v / 100) * A.w, h = w * (layer.h / layer.w);
        patch(layer.id, { w, h, x: layer.x + (layer.w - w) / 2, y: layer.y + (layer.h - h) / 2 }, `tam:${layer.id}`);
      }} />
      <Range label="Giro" value={layer.rot} min={-180} max={180} suffix="°" onChange={(v) => patch(layer.id, { rot: v }, `rot:${layer.id}`)} />
      <div className="grid grid-cols-4 gap-1.5">
        <button type="button" title="Centrar a lo ancho" aria-label="Centrar a lo ancho" onClick={() => patch(layer.id, { x: (A.w - layer.w) / 2 })} className="grid place-items-center h-9 rounded-lg border border-gray-300 hover:bg-gray-50"><AlignCenterHorizontal className="w-4 h-4" /></button>
        <button type="button" title="Centrar a lo alto" aria-label="Centrar a lo alto" onClick={() => patch(layer.id, { y: (A.h - layer.h) / 2 })} className="grid place-items-center h-9 rounded-lg border border-gray-300 hover:bg-gray-50"><AlignCenterVertical className="w-4 h-4" /></button>
        <button type="button" title="Voltear horizontal" aria-label="Voltear horizontal" aria-pressed={layer.flipX} onClick={() => patch(layer.id, { flipX: !layer.flipX })} className={`grid place-items-center h-9 rounded-lg border ${layer.flipX ? 'border-app-600 bg-app-50 text-app-700' : 'border-gray-300 hover:bg-gray-50'}`}><FlipHorizontal className="w-4 h-4" /></button>
        <button type="button" title="Voltear vertical" aria-label="Voltear vertical" aria-pressed={layer.flipY} onClick={() => patch(layer.id, { flipY: !layer.flipY })} className={`grid place-items-center h-9 rounded-lg border ${layer.flipY ? 'border-app-600 bg-app-50 text-app-700' : 'border-gray-300 hover:bg-gray-50'}`}><FlipVertical className="w-4 h-4" /></button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Button size="sm" variant="secondary" icon={<ArrowUp className="w-4 h-4" />} onClick={() => move(layer.id, 1)}>Adelante</Button>
        <Button size="sm" variant="secondary" icon={<ArrowDown className="w-4 h-4" />} onClick={() => move(layer.id, -1)}>Atrás</Button>
        <Button size="sm" variant="secondary" icon={<Copy className="w-4 h-4" />} onClick={() => add({ ...layer, id: newId(), x: layer.x + 60, y: layer.y + 60 })}>Duplicar</Button>
        <Button size="sm" variant="ghost" className="!text-red-600 hover:!bg-red-50" icon={<Trash2 className="w-4 h-4" />} onClick={() => remove(layer.id)}>Quitar</Button>
      </div>

      {layer.kind === 'image' && (
        <div className="rounded-lg border border-gray-200 p-3 space-y-2">
          <p className="text-sm font-medium text-gray-900">Quitar fondo blanco</p>
          <p className="text-xs text-gray-500">Borra el blanco que toca los bordes (lo blanco de adentro se queda).</p>
          <Range label="Qué tan blanco" value={tol} min={4} max={80} onChange={setTol} />
          <Button size="sm" variant="secondary" icon={<Wand2 className="w-4 h-4" />} onClick={async () => {
            try { patch(layer.id, { src: await removeWhiteBg(layer.src, tol) }); } catch { toast.error('No se pudo procesar la imagen'); }
          }}>Quitar el fondo</Button>
        </div>
      )}

      {layer.kind === 'svg' && (
        <div className="rounded-lg border border-gray-200 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-900">Colores del SVG</p>
            {Object.keys(layer.colors).length > 0 && <button type="button" onClick={() => patch(layer.id, { colors: {} })} className="text-xs text-app-700 hover:underline">Restablecer</button>}
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {svgColors(layer.svg).map((c) => {
              const cur = layer.colors[c] ?? c;
              return (
                <label key={c} className="flex items-center gap-2 rounded-lg border border-gray-200 px-2 py-1.5 cursor-pointer hover:border-gray-400">
                  <span className="relative w-7 h-7 rounded-md ring-1 ring-black/15 flex-shrink-0" style={{ background: cur }}>
                    <input type="color" value={cur} aria-label={`Cambiar el color ${c}`} onChange={(e) => patch(layer.id, { colors: { ...layer.colors, [c]: e.target.value.toUpperCase() } }, `color:${layer.id}:${c}`)}
                      className="absolute inset-0 opacity-0 cursor-pointer" />
                  </span>
                  <span className="text-[11px] font-mono text-gray-600">{cur}{cur !== c && <span className="block text-gray-400 line-through">{c}</span>}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {layer.kind === 'text' && (
        <div className="space-y-3">
          <label className="block">
            <span className="text-xs font-medium text-gray-600">{layer.editable ? 'Texto de ejemplo' : 'Texto'}</span>
            <textarea value={layer.spec.text} rows={2} maxLength={layer.editable?.maxLength ?? 80} aria-label="Texto"
              onChange={(e) => void setText(layer, { text: e.target.value }, `texto:${layer.id}`)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-app-200 resize-none" />
          </label>
          {!client && <div className="rounded-lg bg-gray-50 p-2.5 space-y-2">
            <Switch checked={!!layer.editable} onChange={(v) => patch(layer.id, { editable: v ? { label: 'Nombre', maxLength: Math.max(layer.spec.text.length, 14) } : null, ...(v ? { rot: 0 } : {}) } as Partial<DLayer>)}
              label="Lo cambia el cliente" description="Ej. su nombre: el cliente lo escribe al personalizar." />
            {layer.editable && (
              <div className="grid grid-cols-2 gap-2">
                <label className="block"><span className="text-xs text-gray-600">Qué es</span>
                  <input value={layer.editable.label} maxLength={40} aria-label="Qué es el texto editable" onChange={(e) => patch(layer.id, { editable: { ...layer.editable!, label: e.target.value } } as Partial<DLayer>)}
                    className="mt-1 w-full h-8 rounded-md border border-gray-300 px-2 text-sm" /></label>
                <label className="block"><span className="text-xs text-gray-600">Máx. de letras</span>
                  <input type="number" min={1} max={40} value={layer.editable.maxLength} aria-label="Máximo de letras" onChange={(e) => patch(layer.id, { editable: { ...layer.editable!, maxLength: Math.max(1, Math.min(40, Number(e.target.value) || 1)) } } as Partial<DLayer>)}
                    className="mt-1 w-full h-8 rounded-md border border-gray-300 px-2 text-sm" /></label>
              </div>
            )}
            {layer.editable && <p className="text-[11px] text-gray-500">El texto editable no se gira (el nombre del cliente se dibuja derecho dentro de su caja).</p>}
          </div>}
          <TextStyleEditor spec={layer.spec} sample={layer.spec.text.split('\n')[0] || 'Texto'} onBegin={() => {}} onChange={(p) => void setText(layer, p)} multiLine={layer.spec.text.includes('\n')} />
        </div>
      )}
    </div>
  );

  const srcOf = (l: DLayer) => (l.kind === 'image' ? (l.src.startsWith('data:') ? l.src : assetUrl(l.src)) : l.kind === 'svg' ? svgUrl(recolorSvg(l.svg, l.colors)) : textUrls[l.id]?.url);

  const stage = (
    <FitBox w={A.w} h={A.h} pad={40}>
      <div ref={stageRef} className="absolute inset-0 shadow-xl ring-1 ring-black/10 select-none touch-none"
        style={{ background: 'repeating-conic-gradient(#e5e7eb 0% 25%, #fff 0% 50%) 50% / 24px 24px' }}
        onPointerMove={onMove} onPointerUp={() => { drag.current = null; }} onPointerDown={() => setSel(null)}>
        {data.layers.map((l) => (l.hidden ? null : (
          <div key={l.id} onPointerDown={(e) => onDown(e, l, 'move')} role="button" tabIndex={0} aria-label={`Capa ${l.kind === 'text' ? l.spec.text : l.name}`}
            className="absolute cursor-move"
            style={{ left: l.x * scale, top: l.y * scale, width: l.w * scale, height: l.h * scale, transform: `rotate(${l.rot}deg) scale(${l.flipX ? -1 : 1}, ${l.flipY ? -1 : 1})` }}>
            {srcOf(l) && <img src={srcOf(l)} alt="" draggable={false} className="w-full h-full object-contain pointer-events-none" />}
          </div>
        )))}
        {layer && !layer.hidden && (
          <div className="absolute pointer-events-none" style={{ left: layer.x * scale, top: layer.y * scale, width: layer.w * scale, height: layer.h * scale, transform: `rotate(${layer.rot}deg)` }}>
            <div className={`absolute inset-0 border-2 ${layer.kind === 'text' && layer.editable ? 'border-dashed border-amber-500' : 'border-app-600'}`} />
            {layer.kind === 'text' && layer.editable && <span className="absolute -top-6 left-0 px-1.5 rounded bg-amber-500 text-white text-[10px] font-semibold">{layer.editable.label} · lo cambia el cliente</span>}
            <span onPointerDown={(e) => onDown(e, layer, 'size')} aria-label="Cambiar el tamaño" className="pointer-events-auto absolute -right-2.5 -bottom-2.5 w-5 h-5 rounded-full bg-white ring-2 ring-app-600 cursor-nwse-resize" />
            {!(layer.kind === 'text' && layer.editable) && (
              <span onPointerDown={(e) => onDown(e, layer, 'rot')} aria-label="Girar" className="pointer-events-auto absolute left-1/2 -top-9 -ml-3 w-6 h-6 rounded-full bg-white ring-2 ring-app-600 grid place-items-center cursor-grab">
                <RotateCw className="w-3.5 h-3.5 text-app-700" />
              </span>
            )}
          </div>
        )}
      </div>
    </FitBox>
  );

  return (
    <div className="fixed inset-0 z-[90] bg-gray-100 overflow-y-auto lg:overflow-hidden" role="dialog" aria-modal="true" aria-label="Editor de diseños">
      <StudioShell
        fullHeight
        label="Editor de diseños"
        toolbar={(
          <>
            <span className="text-sm font-semibold text-gray-900 px-1">{client ? 'Edita tu diseño' : design ? 'Editar diseño' : 'Nuevo diseño'}</span>
            <ToolbarSep />
            <button type="button" title="Deshacer (Ctrl+Z)" aria-label="Deshacer" onClick={hist.undo} disabled={!hist.canUndo} className="grid place-items-center w-9 h-9 rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-40"><Undo2 className="w-4 h-4" /></button>
            <button type="button" title="Rehacer (Ctrl+Y)" aria-label="Rehacer" onClick={hist.redo} disabled={!hist.canRedo} className="grid place-items-center w-9 h-9 rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-40"><Redo2 className="w-4 h-4" /></button>
            {!client && <ToolbarSep />}
            {!client && <div className="flex rounded-lg bg-gray-100 p-0.5" role="radiogroup" aria-label="Tamaño del lienzo">
              {ARTBOARDS.map((b) => (
                <button key={b.key} type="button" role="radio" aria-checked={A.key === b.key} onClick={() => changeArtboard(b.key)}
                  className={`px-2.5 h-8 rounded-md text-xs ${A.key === b.key ? 'bg-white shadow-sm font-medium text-gray-900' : 'text-gray-600'}`}>{b.label}</button>
              ))}
            </div>}
          </>
        )}
        actions={(
          <>
            {saving && <span className="text-xs text-gray-500">{saving}</span>}
            <Button variant="secondary" icon={<X className="w-4 h-4" />} onClick={onClose} disabled={!!saving}>Cancelar</Button>
            <Button icon={<Save className="w-4 h-4" />} onClick={save} isLoading={!!saving} disabled={!ready}>{client ? 'Usar en mi prenda' : 'Guardar'}</Button>
          </>
        )}
        rail={RAIL.filter((r) => !client || r.id !== 'datos').map((r) => ({ id: r.id, label: r.label, icon: r.icon }))} active={tab} onActive={(id) => setTab(id as Tab | null)}
        panelTitle={RAIL.find((r) => r.id === tab)?.title ?? ''} panel={panel}
        stage={ready ? stage : <div className="absolute inset-0 grid place-items-center text-sm text-gray-500">Abriendo el diseño…</div>}
        inspectorTitle={layer ? (layer.kind === 'text' ? (layer.editable ? 'Nombre editable' : 'Texto') : layer.kind === 'svg' ? 'SVG' : 'Imagen') : 'Lienzo'}
        inspector={inspector}
      />
    </div>
  );
}
