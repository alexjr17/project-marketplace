/**
 * Diseñador de posts e historias por capas, en el armazón del estudio (StudioShell):
 * - barra: Post / Video, deshacer/rehacer, formato (1:1, 4:5, 9:16) y descargar, guardar o publicar;
 * - riel: Producto (qué se muestra), Plantillas, Fondo, Elementos, Archivos, Capas y Textos;
 * - centro: el lienzo, donde se elige una capa con un clic, se mueve arrastrando y se cambia de tamaño
 *   con las esquinas (con guías al centro y a los bordes); el diseño de la prenda se agarra y se mueve;
 * - derecha: las propiedades de la capa elegida (LayerInspector).
 * Atajos: flechas mueven 1 px (con Mayús 10), Supr quita, Ctrl+D duplica, Ctrl+Z / Ctrl+Y, Esc suelta.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ChangeEvent, type CSSProperties, type PointerEvent as RPointerEvent, type ReactNode } from 'react';
import {
  Circle, Eye, EyeOff, LayoutGrid, MousePointerClick, Palette, Shapes, Shirt, Sparkles, FolderOpen, Image as ImageIcon, Layers, LayoutTemplate, Lock, ShoppingBag, Plus, Redo2, Square, Tag, Type, Undo2, Upload,
} from 'lucide-react';
import { Button, toast } from '../ui';
import { FitBox, RatioSwitch, StudioShell, ToolbarSep, type RailItem } from './StudioShell';
import {
  buildDesign, DESIGN_RATIOS, DESIGN_TEMPLATES, designSize, imageLayer, layerId, logoLayer, patternLayer, shapeLayer, TEMPLATE_GROUPS, textLayer,
  type ColorsLayer, type Design, type DesignRatio, type ImageLayer, type Layer, type Paint,
} from './design';
import { drawDesign, hitLayer, textOf, type Box as LBox, type DesignData } from './designRender';
import { BG_STYLES, type BgStyle } from './backgrounds';
import { LayerInspector } from './LayerInspector';
import { AiImageDialog } from './AiImageDialog';
import { AiBackdropDialog } from './AiBackdropDialog';
import type { SceneProduct } from './timeline';
import type { SourceProduct } from '../../services/marketing.service';

type Tab = 'producto' | 'plantillas' | 'fondo' | 'elementos' | 'fotos' | 'capas' | 'publicar';
const RAIL: (RailItem & { id: Tab; title: string })[] = [
  { id: 'producto', label: 'Producto', title: 'Qué vas a mostrar', icon: ShoppingBag },
  { id: 'plantillas', label: 'Plantillas', title: 'Plantillas', icon: LayoutTemplate },
  { id: 'fondo', label: 'Fondo', title: 'Fondo', icon: Palette },
  { id: 'elementos', label: 'Elementos', title: 'Agregar elementos', icon: Shapes },
  { id: 'fotos', label: 'Archivos', title: 'Mis fotos', icon: FolderOpen },
  { id: 'capas', label: 'Capas', title: 'Capas', icon: Layers },
  { id: 'publicar', label: 'Textos', title: 'Textos y publicación', icon: Type },
];
const TYPE_ICON = { text: Type, image: ImageIcon, shape: Square, logo: Tag, pattern: LayoutGrid, colors: Palette } as const;
type Handle = 'nw' | 'ne' | 'sw' | 'se' | 'e' | 'w';
const SNAP = 12;

export function DesignEditor({
  design, onChange, onTemplate, data, history, sourcePanel, publishPanel, exportActions, products, photos, onPhotos, onRatio, mockTemplates, defaultMockTemplate, onGarment, resolve, onMoveDesign,
  modeSwitch, menu, onboarding, hasSubject, panelReq = 0,
}: {
  design: Design;
  onChange: (d: Design, merge?: string) => void;
  /** Cambiar de plantilla (se puede deshacer). */
  onTemplate: (d: Design) => void;
  data: DesignData | null;
  history: { undo: () => void; redo: () => void; canUndo: boolean; canRedo: boolean };
  sourcePanel: ReactNode;
  publishPanel: ReactNode;
  exportActions: ReactNode;
  products: SceneProduct[];
  photos: SceneProduct[];
  onPhotos: (p: SceneProduct[]) => void;
  onRatio: (r: DesignRatio) => void;
  /** Personalizables que se pueden mostrar con diseño (con fotos y zonas, o 3D). */
  mockTemplates: SourceProduct[];
  /** La que se usa cuando la capa no elige otra (la de Productos). */
  defaultMockTemplate: SourceProduct | null;
  /** Abre "Prenda en 4 vistas con IA". */
  onGarment: () => void;
  /** Adapta la plantilla a lo que se eligió (productos, sus fotos o la personalizable): solo para dibujar. */
  resolve?: (d: Design) => Design;
  /** Mover el diseño de una zona de la personalizable (cuando la capa usa el diseño de "Qué se muestra"). */
  onMoveDesign?: (zoneId: number, offset: { x: number; y: number }) => void;
  /** Interruptor Post / Video y menú (marca, calendario, cuentas de IA), en la barra. */
  modeSwitch: ReactNode;
  menu: ReactNode;
  /** Primer paso sobre el lienzo cuando aún no se eligió qué mostrar. */
  onboarding: ReactNode;
  /** Ya se eligió qué mostrar. */
  hasSubject: boolean;
  /** Cada vez que cambia, se abre el panel de Producto (desde el primer paso). */
  panelReq?: number;
}) {
  const [W, H] = designSize(design.ratio);
  const [tab, setTab] = useState<Tab | null>(() => (hasSubject ? 'plantillas' : 'producto'));
  const [seenReq, setSeenReq] = useState(panelReq);
  if (panelReq !== seenReq) { setSeenReq(panelReq); setTab('producto'); }
  const [sel, setSel] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boxesRef = useRef<Record<string, LBox>>({});
  const [boxes, setBoxes] = useState<Record<string, LBox>>({});
  const [scale, setScale] = useState(0.5);
  const [guides, setGuides] = useState<{ v: number[]; h: number[] }>({ v: [], h: [] });
  const layers = design.layers;
  const selected = layers.find((l) => l.id === sel) ?? null;
  /** La plantilla como se ve (adaptada a lo elegido): de ahí sale la prenda con su diseño. */
  const shown = useMemo(() => (resolve ? resolve(design) : design), [design, resolve]);
  /** Colores disponibles activos: las plantillas se arman con su lugar para ellos. */
  const colorsKey = (design.layers.find((l): l is ColorsLayer => l.type === 'colors')?.colors ?? []).join(',');
  const showColors = useMemo(() => (colorsKey ? colorsKey.split(',') : null), [colorsKey]);
  const shownSel = shown.layers.find((l) => l.id === sel) ?? null;

  // Dibujo del lienzo (con recuadros donde falta una foto).
  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx || !data) return;
    const bx = drawDesign(ctx, shown, data, true);
    boxesRef.current = bx;
    // El recuadro de la selección se acomoda en el cuadro siguiente.
    const raf = requestAnimationFrame(() => setBoxes(bx));
    return () => cancelAnimationFrame(raf);
  }, [shown, data, W, H]);

  // Escala del lienzo en pantalla (para la selección encima).
  useLayoutEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ro = new ResizeObserver(() => setScale(c.clientWidth / W));
    ro.observe(c);
    setScale(c.clientWidth / W);
    return () => ro.disconnect();
  }, [W, H]);

  // Vistas previas de las plantillas con los datos reales.
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!data || tab !== 'plantillas') return;
    let alive = true;
    const t = window.setTimeout(() => {
      const big = document.createElement('canvas');
      big.width = W; big.height = H;
      const small = document.createElement('canvas');
      small.width = 216; small.height = Math.round((216 * H) / W);
      const bctx = big.getContext('2d')!, sctx = small.getContext('2d')!;
      const out: Record<string, string> = {};
      for (const tpl of DESIGN_TEMPLATES) {
        if (!alive) return;
        const built = buildDesign(tpl.id, design.ratio, { colors: showColors });
        drawDesign(bctx, resolve ? resolve(built) : built, data, true);
        sctx.clearRect(0, 0, small.width, small.height);
        sctx.drawImage(big, 0, 0, small.width, small.height);
        out[tpl.id] = small.toDataURL('image/jpeg', 0.78);
      }
      if (alive) setThumbs(out);
    }, 350);
    return () => { alive = false; window.clearTimeout(t); };
  }, [data, design.ratio, W, H, tab, resolve, showColors]);

  // ─── Cambios a las capas ──────────────────────────────────────────────────
  const setLayers = (next: Layer[], merge?: string) => onChange({ ...design, layers: next }, merge);
  const patchLayer = (id: string, p: Partial<Layer>, merge?: string) =>
    setLayers(layers.map((l) => (l.id === id ? ({ ...l, ...p } as Layer) : l)), merge ? `${id}:${merge}` : undefined);
  const addLayer = (l: Layer) => { setLayers([...layers, l]); setSel(l.id); };
  const duplicate = (id: string) => {
    const i = layers.findIndex((l) => l.id === id);
    if (i < 0) return;
    const c = { ...layers[i], id: layerId(), name: `${layers[i].name} (copia)`, x: layers[i].x + 30, y: layers[i].y + 30, locked: false } as Layer;
    setLayers([...layers.slice(0, i + 1), c, ...layers.slice(i + 1)]);
    setSel(c.id);
  };
  const remove = (id: string) => { setLayers(layers.filter((l) => l.id !== id)); setSel(null); };
  const arrange = (id: string, to: 'front' | 'up' | 'down' | 'back') => {
    const i = layers.findIndex((l) => l.id === id);
    if (i < 0) return;
    const next = [...layers];
    const [it] = next.splice(i, 1);
    const j = to === 'front' ? next.length : to === 'back' ? 0 : Math.max(0, Math.min(next.length, i + (to === 'up' ? 1 : -1)));
    next.splice(j, 0, it);
    setLayers(next);
  };

  const add = (what: 'title' | 'text' | 'tag' | 'cta' | 'price' | 'rect' | 'circle' | 'photo' | 'logo' | 'icon') => {
    const cx = W / 2, cy = H / 2;
    switch (what) {
      case 'title': return addLayer(textLayer({ name: 'Título', text: 'Escribe tu título', x: 80, y: cy - 80, w: W - 160, h: 160, size: 110, color: 'primary', align: 'center', maxLines: 2 }));
      case 'text': return addLayer(textLayer({ name: 'Texto', text: 'Escribe aquí tu texto', x: 120, y: cy, w: W - 240, h: 120, font: 'body', size: 44, weight: 500, upper: false, color: 'primary', align: 'center', lineHeight: 1.25 }));
      case 'tag': return addLayer(textLayer({ name: 'Etiqueta', text: 'NUEVO', x: cx - 130, y: cy - 40, w: 260, h: 80, font: 'body', size: 34, weight: 800, color: 'primary', bg: 'accent', radius: 999, align: 'center', maxLines: 1 }));
      case 'cta': return addLayer(textLayer({ name: 'Botón', bind: 'cta', x: cx - 220, y: H - 220, w: 440, h: 90, font: 'body', size: 40, weight: 700, color: 'white', bg: 'primary', radius: 999, upper: false, align: 'center', maxLines: 1 }));
      case 'price': return addLayer(textLayer({ name: 'Precio', bind: 'price', x: cx - 250, y: cy, w: 500, h: 100, font: 'body', size: 80, weight: 900, color: 'primary', align: 'center', maxLines: 1 }));
      case 'rect': return addLayer(shapeLayer({ name: 'Rectángulo', x: cx - 250, y: cy - 150, w: 500, h: 300, fill: 'accent', radius: 24 }));
      case 'circle': return addLayer(shapeLayer({ name: 'Círculo', shape: 'ellipse', x: cx - 160, y: cy - 160, w: 320, h: 320, fill: 'accent' }));
      case 'photo': return addLayer(imageLayer({ name: 'Foto del producto', x: cx - 300, y: cy - 360, w: 600, h: 720, radius: 32 }));
      case 'logo': return addLayer(logoLayer({ x: cx - 150, y: 80, onDark: false }));
      case 'icon': return addLayer(logoLayer({ name: 'Ícono', kind: 'icon', x: cx - 70, y: cy - 70, w: 140, h: 140, onDark: false }));
    }
  };

  // ─── Lienzo: elegir, mover y cambiar de tamaño ──────────────────────────────
  const drag = useRef<null | { mode: 'move' | 'design' | Handle; id: string; sx: number; sy: number; orig: Layer; box: LBox; moved: boolean }>(null);
  const canMoveDesign = (l: Layer | null | undefined): l is ImageLayer => !!l && l.type === 'image' && !!l.mock?.design;
  const toDesign = (e: { clientX: number; clientY: number }) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  };
  const onDown = (e: RPointerEvent<HTMLDivElement>) => {
    const p = toDesign(e);
    const hit = hitLayer(layers, boxesRef.current, p.x, p.y);
    setSel(hit?.id ?? null);
    if (!hit) return;
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    const view = shown.layers.find((l) => l.id === hit.id) ?? hit;
    // Agarrar el diseño mueve el diseño; agarrar la prenda (fuera del diseño) mueve la imagen.
    const dr = boxesRef.current[hit.id]?.designRect;
    const pad = 14;
    const onDesign = !!dr && p.x >= dr.x - pad && p.x <= dr.x + dr.w + pad && p.y >= dr.y - pad && p.y <= dr.y + dr.h + pad;
    const moveDesign = canMoveDesign(view) && onDesign;
    drag.current = { mode: moveDesign ? 'design' : 'move', id: hit.id, sx: e.clientX, sy: e.clientY, orig: moveDesign ? view : hit, box: boxesRef.current[hit.id], moved: false };
  };
  const onHandle = (e: RPointerEvent, mode: Handle) => {
    if (!selected) return;
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    drag.current = { mode, id: selected.id, sx: e.clientX, sy: e.clientY, orig: selected, box: boxesRef.current[selected.id], moved: false };
  };
  const onMove = (e: RPointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const r = canvasRef.current!.getBoundingClientRect();
    const dx = ((e.clientX - d.sx) / r.width) * W, dy = ((e.clientY - d.sy) / r.height) * H;
    if (Math.abs(dx) + Math.abs(dy) > 2) d.moved = true;
    if (!d.moved) return;
    const o = d.orig;
    if (d.mode === 'design') {
      // El diseño se corre dentro de su zona; cerca del centro se queda centrado.
      const span = boxesRef.current[d.id]?.span;
      if (!canMoveDesign(o) || !span || !span[0] || !span[1]) return;
      const m = o.mock!;
      const fit = (v: number) => { const c = Math.max(-0.5, Math.min(0.5, v)); return Math.abs(c) < 0.006 ? 0 : Math.round(c * 1000) / 1000; };
      const off = { x: fit((m.offset?.x ?? 0) + dx / span[0]), y: fit((m.offset?.y ?? 0) + dy / span[1]) };
      // La capa con su propio diseño guarda la posición; si el diseño es el de la zona, va en la zona (todas las plantillas).
      const own = layers.find((l) => l.id === d.id);
      if (own?.type === 'image' && own.mock?.design) patchLayer(d.id, { mock: { ...own.mock, offset: off } }, 'mockoff');
      else if (onMoveDesign && m.zoneId != null) onMoveDesign(m.zoneId, off);
      else if (own?.type === 'image' && own.mock) patchLayer(d.id, { mock: { ...own.mock, offset: off } }, 'mockoff');
      return;
    }
    if (d.mode === 'move') {
      let x = o.x + dx, y = o.y + dy;
      const bw = d.box?.w ?? o.w, bh = d.box?.h ?? o.h;
      const offX = (d.box?.x ?? o.x) - o.x;
      const v: number[] = [], h: number[] = [];
      // Guías: centro y bordes del lienzo.
      const cx = x + offX + bw / 2, cy = y + bh / 2;
      if (Math.abs(cx - W / 2) < SNAP) { x = W / 2 - bw / 2 - offX; v.push(W / 2); }
      else if (Math.abs(x + offX) < SNAP) { x = -offX; v.push(0); }
      else if (Math.abs(x + offX + bw - W) < SNAP) { x = W - bw - offX; v.push(W); }
      if (Math.abs(cy - H / 2) < SNAP) { y = H / 2 - bh / 2; h.push(H / 2); }
      else if (Math.abs(y) < SNAP) { y = 0; h.push(0); }
      else if (Math.abs(y + bh - H) < SNAP) { y = H - bh; h.push(H); }
      setGuides({ v, h });
      patchLayer(d.id, { x: Math.round(x), y: Math.round(y) }, 'drag');
      return;
    }
    // Cambiar de tamaño desde una esquina o un lado (la esquina opuesta queda fija).
    let { x, y, w, h } = o;
    if (d.mode.includes('e')) w = Math.max(20, o.w + dx);
    if (d.mode.includes('w')) { w = Math.max(20, o.w - dx); x = o.x + o.w - w; }
    if (d.mode === 'se' || d.mode === 'sw') h = Math.max(20, o.h + dy);
    if (d.mode === 'ne' || d.mode === 'nw') { h = Math.max(20, o.h - dy); y = o.y + o.h - h; }
    if (o.type === 'text') {
      // En los textos, las esquinas agrandan la letra; los lados solo el ancho.
      if (d.mode === 'e' || d.mode === 'w') patchLayer(d.id, { x: Math.round(x), w: Math.round(w) }, 'resize');
      else {
        const k = w / o.w;
        patchLayer(d.id, { x: Math.round(x), y: d.mode.startsWith('n') ? Math.round(o.y + (d.box?.h ?? o.h) * (1 - k)) : o.y, w: Math.round(w), size: Math.max(12, Math.round(o.size * k)) }, 'resize');
      }
      return;
    }
    if (e.shiftKey || o.type === 'logo') {
      // Mayús (y el logo): sin deformar.
      const k = Math.max(w / o.w, h / o.h);
      w = o.w * k; h = o.h * k;
      if (d.mode.includes('w')) x = o.x + o.w - w;
      if (d.mode.startsWith('n')) y = o.y + o.h - h;
    }
    patchLayer(d.id, { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) }, 'resize');
  };
  const onUp = () => { drag.current = null; setGuides({ v: [], h: [] }); };

  // Atajos de teclado.
  const keys = useRef({ sel, layers, patchLayer, remove, duplicate, history });
  useEffect(() => { keys.current = { sel, layers, patchLayer, remove, duplicate, history }; });
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
        else if (key === 'd' && k.sel) { e.preventDefault(); k.duplicate(k.sel); }
        return;
      }
      if (!k.sel) return;
      const l = k.layers.find((x) => x.id === k.sel);
      if (!l) return;
      if (key === 'delete' || key === 'backspace') { e.preventDefault(); k.remove(l.id); }
      else if (key === 'escape') setSel(null);
      else if (key.startsWith('arrow')) {
        e.preventDefault();
        const n = e.shiftKey ? 10 : 1;
        const p = key === 'arrowleft' ? { x: l.x - n } : key === 'arrowright' ? { x: l.x + n } : key === 'arrowup' ? { y: l.y - n } : { y: l.y + n };
        k.patchLayer(l.id, p, 'nudge');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ─── Mis fotos ─────────────────────────────────────────────────────────────
  const fileRef = useRef<HTMLInputElement>(null);
  const [ai, setAi] = useState(false);
  const onFiles = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    const added: SceneProduct[] = [];
    files.forEach((f, i) => {
      if (!f.type.startsWith('image/')) { toast.error(`${f.name}: solo fotos`); return; }
      if (f.size > 15 * 1024 * 1024) { toast.error(`${f.name}: pesa más de 15 MB`); return; }
      added.push({ id: -Date.now() - i, name: f.name.replace(/\.[^.]+$/, ''), image: URL.createObjectURL(f) });
    });
    if (added.length) onPhotos([...added, ...photos]);
  };

  const box = selected ? boxes[selected.id] : null;
  /** Capa de fondo (la primera, si es un fondo: color, con estilo o una foto). */
  const bg = (layers[0]?.type === 'shape' || layers[0]?.type === 'pattern' || layers[0]?.type === 'image') && layers[0].name === 'Fondo' ? layers[0] : null;
  const [backdropOpen, setBackdropOpen] = useState(false);
  /** Diseños que lleva la prenda en este post (para el fondo con IA). */
  const designUrls = Array.from(new Set(layers.flatMap((x) => (x.type === 'image' && x.mock?.design?.image ? [x.mock.design.image] : x.type === 'pattern' ? x.designs : []))));
  /** Pone una foto (creada con IA) como fondo de todo el post. */
  const setPhotoBackground = (url: string) => {
    const l = imageLayer({ name: 'Fondo', src: url, x: 0, y: 0, w: W, h: H, fit: 'cover', locked: true });
    setLayers(bg ? [l, ...layers.slice(1)] : [l, ...layers]);
    setSel(null);
  };
  /** Cambia el estilo del fondo (o lo agrega si el diseño no tiene) y lo deja elegido para afinarlo. */
  const setBackground = (style: BgStyle) => {
    const basePaint: Paint = bg ? (bg.type === 'pattern' ? bg.base : bg.type === 'shape' ? bg.fill : 'primary') : 'primary';
    const prev = bg?.type === 'pattern' ? bg : null;
    const l = patternLayer({
      ...(prev ?? {}), id: prev?.id ?? layerId(), style, base: basePaint, w: W, h: H, x: 0, y: 0,
      ink: prev?.ink ?? (basePaint === 'accent' ? 'primary' : 'accent'), accent: prev?.accent ?? 'accent',
      density: prev?.density ?? (style === 'mosaicoMarca' ? 0.12 : style === 'mosaicoDisenos' ? 0.2 : style === 'rayas' ? 0.08 : 0.5),
    });
    setLayers(bg ? [l, ...layers.slice(1)] : [l, ...layers]);
    setSel(l.id);
  };
  const toolBtn = 'inline-flex items-center gap-1.5 rounded-lg px-2.5 h-9 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-40 disabled:hover:bg-transparent';
  const handles: { h: Handle; cls: string; style: (b: LBox) => CSSProperties }[] = [
    { h: 'nw', cls: 'cursor-nwse-resize', style: () => ({ left: -6, top: -6 }) },
    { h: 'ne', cls: 'cursor-nesw-resize', style: () => ({ right: -6, top: -6 }) },
    { h: 'sw', cls: 'cursor-nesw-resize', style: () => ({ left: -6, bottom: -6 }) },
    { h: 'se', cls: 'cursor-nwse-resize', style: () => ({ right: -6, bottom: -6 }) },
    { h: 'w', cls: 'cursor-ew-resize', style: () => ({ left: -5, top: 'calc(50% - 8px)', height: 16, width: 10 }) },
    { h: 'e', cls: 'cursor-ew-resize', style: () => ({ right: -5, top: 'calc(50% - 8px)', height: 16, width: 10 }) },
  ];

  const sec = RAIL.find((r) => r.id === tab);
  const rail = RAIL.map((r) => ({ ...r, dot: r.id === 'producto' && !hasSubject }));
  const ELEMENTS: { k: Parameters<typeof add>[0]; label: string; icon: typeof Type }[] = [
    { k: 'title', label: 'Título', icon: Type }, { k: 'text', label: 'Texto', icon: Type }, { k: 'tag', label: 'Etiqueta', icon: Tag },
    { k: 'cta', label: 'Botón', icon: Square }, { k: 'price', label: 'Precio', icon: Tag }, { k: 'photo', label: 'Foto del producto', icon: ImageIcon },
    { k: 'rect', label: 'Rectángulo', icon: Square }, { k: 'circle', label: 'Círculo', icon: Circle }, { k: 'logo', label: 'Logo', icon: Tag }, { k: 'icon', label: 'Ícono de la marca', icon: Tag },
  ];

  return (
    <>
      {backdropOpen && (
        <AiBackdropDialog designUrls={designUrls} ratio={design.ratio} onClose={() => setBackdropOpen(false)}
          onUse={(img) => { onPhotos([{ id: -Date.now(), name: `Fondo IA: ${img.name}`, image: img.url }, ...photos]); setPhotoBackground(img.url); }} />
      )}
      <StudioShell
        label="Diseñador de piezas"
        toolbar={(
          <>
            {modeSwitch}
            <ToolbarSep />
            <button type="button" className={toolBtn} title="Deshacer (Ctrl+Z)" aria-label="Deshacer (Ctrl+Z)" onClick={history.undo} disabled={!history.canUndo}><Undo2 className="w-4 h-4" /></button>
            <button type="button" className={toolBtn} title="Rehacer (Ctrl+Y)" aria-label="Rehacer (Ctrl+Y)" onClick={history.redo} disabled={!history.canRedo}><Redo2 className="w-4 h-4" /></button>
            <ToolbarSep />
            <RatioSwitch label="Formato de la pieza" value={design.ratio} onChange={onRatio} options={DESIGN_RATIOS.map((r) => ({ value: r.value, label: `${r.value} ${r.value === '9:16' ? 'Historia' : 'Post'}`, hint: r.hint }))} />
          </>
        )}
        actions={<>{exportActions}{menu}</>}
        rail={rail} active={tab} onActive={(id) => setTab(id as Tab | null)}
        panelTitle={sec?.title ?? ''}
        panel={(
          <>
            {tab === 'producto' && sourcePanel}
            {tab === 'plantillas' && (
              <div className="space-y-4">
                <p className="text-xs text-gray-500">Se arman con lo que promocionas y los colores de tu marca. Después cambias lo que quieras.</p>
                {TEMPLATE_GROUPS.map((g) => (
                  <div key={g}>
                    <p className="text-xs font-semibold text-gray-700 mb-1.5">{g}</p>
                    <div className="grid grid-cols-2 gap-2">
                      {DESIGN_TEMPLATES.filter((t) => t.group === g).map((t) => (
                        <button
                          key={t.id} type="button" title={t.hint} aria-pressed={design.template === t.id}
                          onClick={() => { onTemplate(buildDesign(t.id, design.ratio, { colors: showColors })); setSel(null); }}
                          className={`group rounded-lg overflow-hidden border-2 text-left transition-colors ${design.template === t.id ? 'border-app-600' : 'border-gray-200 hover:border-app-300'}`}
                        >
                          <span className="block bg-gray-100" style={{ aspectRatio: `${W} / ${H}` }}>
                            {thumbs[t.id] && <img src={thumbs[t.id]} alt="" className="w-full h-full object-cover" />}
                          </span>
                          <span className="block px-1.5 py-1 text-[11px] font-medium text-gray-800 truncate">{t.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {tab === 'fondo' && (
              <div className="space-y-4">
          {data && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-1.5">Fondo</p>
              <div className="grid grid-cols-2 gap-1.5">
                {BG_STYLES.map((st) => {
                  const on = bg?.type === 'pattern' ? bg.style === st.value : st.value === 'color' && !!bg;
                  return (
                    <button key={st.value} type="button" title={st.hint} aria-pressed={on} onClick={() => setBackground(st.value)}
                      className={`rounded-lg border px-2 py-1.5 text-xs text-left ${on ? 'border-app-600 bg-app-50 text-app-800 font-medium' : 'border-gray-200 text-gray-700 hover:border-app-300'}`}>
                      {st.label}
                    </button>
                  );
                })}
              </div>
              <p className="mt-1.5 text-xs text-gray-500">Elige uno y afínalo: colores, densidad, tamaño, giro, grano y qué diseños usar.</p>
              <Button className="w-full mt-2" variant="outline" icon={<Sparkles className="w-4 h-4" />} onClick={() => setBackdropOpen(true)}>Fondo profesional con IA</Button>
              <p className="mt-1 text-xs text-gray-500">Una escenografía que combina con los diseños de la prenda.</p>
            </div>
          )}
              </div>
            )}
            {tab === 'elementos' && (
              <div className="grid grid-cols-2 gap-2">
                {ELEMENTS.map((e) => {
                  const Icon = e.icon;
                  return (
                    <button key={e.k} type="button" onClick={() => add(e.k)}
                      className="flex flex-col items-center gap-1.5 rounded-xl border border-gray-200 px-2 py-3 text-xs font-medium text-gray-700 hover:border-app-300 hover:bg-app-50/40">
                      <Icon className="w-5 h-5 text-app-600" />{e.label}
                    </button>
                  );
                })}
              </div>
            )}
            {tab === 'fotos' && (
              <div className="space-y-3">
                <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={onFiles} aria-label="Subir fotos" />
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="secondary" icon={<Upload className="w-4 h-4" />} onClick={() => fileRef.current?.click()}>Subir fotos</Button>
                  <Button variant="secondary" icon={<Sparkles className="w-4 h-4" />} onClick={() => setAi(true)}>Crear con IA</Button>
                </div>
                <Button className="w-full" variant="outline" icon={<Shirt className="w-4 h-4" />} onClick={onGarment}>Prenda en 4 vistas (IA)</Button>
                {ai && (
                  <AiImageDialog initialKind="fondo" onClose={() => setAi(false)} onUse={(img) => {
                    const p: SceneProduct = { id: -Date.now(), name: img.name, image: img.url };
                    onPhotos([p, ...photos]);
                    // La imagen nueva entra como fondo (detrás de todo, encima del color de fondo).
                    const l = imageLayer({ name: `IA: ${img.name}`, src: img.url, x: 0, y: 0, w: W, h: H });
                    const at = layers[0]?.name === 'Fondo' ? 1 : 0;
                    setLayers([...layers.slice(0, at), l, ...layers.slice(at)]);
                    setSel(l.id);
                  }} />
                )}
                <p className="text-xs text-gray-500">Quedan en este navegador mientras diseñas; van dentro de la imagen final.</p>
                <div className="grid grid-cols-2 gap-2">
                  {photos.map((p) => (
                    <div key={p.id} className="relative rounded-lg overflow-hidden ring-1 ring-gray-200">
                      {p.image && <img src={p.image} alt="" className="w-full aspect-square object-cover" />}
                      <button type="button" title="Agregar al diseño" aria-label={`Agregar ${p.name} al diseño`}
                        onClick={() => addLayer(imageLayer({ name: p.name, src: p.image, x: W / 2 - 300, y: H / 2 - 300, w: 600, h: 600, radius: 24 }))}
                        className="absolute right-1 top-1 rounded-full bg-app-600 text-white p-1 shadow hover:bg-app-700"><Plus className="w-3.5 h-3.5" /></button>
                    </div>
                  ))}
                </div>
                {!photos.length && <p className="text-sm text-gray-500 text-center py-6">Aún no has subido fotos.</p>}
              </div>
            )}
            {tab === 'capas' && (
              <ul className="space-y-1">
                {[...layers].reverse().map((l) => {
                  const Icon = TYPE_ICON[l.type];
                  return (
                    <li key={l.id}>
                      <div className={`flex items-center gap-2 rounded-lg px-2 py-1.5 ${l.id === sel ? 'bg-app-50 ring-1 ring-app-300' : 'hover:bg-gray-50'}`}>
                        <button type="button" className="flex-1 min-w-0 flex items-center gap-2 text-left" onClick={() => setSel(l.id)}>
                          <Icon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <span className={`text-sm truncate ${l.hidden ? 'text-gray-400' : 'text-gray-800'}`}>{l.name}</span>
                        </button>
                        <button type="button" className="p-1 text-gray-400 hover:text-gray-700" title={l.hidden ? 'Mostrar' : 'Ocultar'} aria-label={`${l.hidden ? 'Mostrar' : 'Ocultar'} ${l.name}`} onClick={() => patchLayer(l.id, { hidden: !l.hidden })}>{l.hidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                        <button type="button" className={`p-1 ${l.locked ? 'text-gray-700' : 'text-gray-300 hover:text-gray-700'}`} title={l.locked ? 'Desbloquear' : 'Bloquear'} aria-label={`${l.locked ? 'Desbloquear' : 'Bloquear'} ${l.name}`} onClick={() => patchLayer(l.id, { locked: !l.locked })}><Lock className="w-4 h-4" /></button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            {tab === 'publicar' && publishPanel}
          </>
        )}
        stage={(
          <>
            <FitBox w={W} h={H}>
              <canvas ref={canvasRef} width={W} height={H} className="block w-full h-full rounded-sm shadow-[0_12px_40px_rgb(0_0_0/0.18)] bg-white" aria-label="Vista previa de la pieza" />
            <div
              className="absolute inset-0 cursor-default touch-none"
              onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
              onDoubleClick={() => { if (selected?.type === 'text') document.getElementById('ly-text')?.focus(); }}
              aria-label="Lienzo: clic para elegir, arrastra para mover"
            >
              {guides.v.map((x) => <div key={`v${x}`} className="absolute top-0 bottom-0 w-px bg-fuchsia-400 pointer-events-none" style={{ left: x * scale }} />)}
              {guides.h.map((y) => <div key={`h${y}`} className="absolute left-0 right-0 h-px bg-fuchsia-400 pointer-events-none" style={{ top: y * scale }} />)}
              {selected && box && !selected.hidden && (
                <div
                  className={`absolute ring-2 ${selected.locked ? 'ring-gray-400' : 'ring-app-400'} pointer-events-none`}
                  style={{ left: box.x * scale, top: box.y * scale, width: box.w * scale, height: box.h * scale, transform: selected.rotation ? `rotate(${selected.rotation}deg)` : undefined }}
                >
                  {!selected.locked && handles.map((hd) => (
                    <span
                      key={hd.h} className={`absolute w-3 h-3 rounded-sm bg-white ring-2 ring-app-500 pointer-events-auto ${hd.cls}`}
                      style={hd.style(box)} onPointerDown={(e) => onHandle(e, hd.h)}
                    />
                  ))}
                  <span className="absolute -top-6 left-0 rounded bg-app-600 px-1.5 py-0.5 text-[10px] leading-none text-white whitespace-nowrap">{selected.name}{selected.locked ? ' · bloqueada' : ''}</span>
                  {canMoveDesign(shownSel) && !selected.locked && !!box?.designRect && (
                    <>
                      {/* El diseño se marca con una línea punteada: se agarra de ahí para moverlo. */}
                      <span className="absolute border border-dashed border-white/90 ring-1 ring-black/30 rounded-sm pointer-events-none"
                        style={{ left: (box.designRect.x - box.x) * scale, top: (box.designRect.y - box.y) * scale, width: box.designRect.w * scale, height: box.designRect.h * scale }} />
                      <span className="absolute -top-6 right-0 rounded bg-black/70 px-1.5 py-0.5 text-[10px] leading-none text-white whitespace-nowrap">Arrastra el diseño o la prenda</span>
                    </>
                  )}
                </div>
              )}
            </div>
            </FitBox>
            {onboarding && <div className="absolute inset-0 z-10 grid place-items-center p-6 bg-gray-100/70 backdrop-blur-[2px]">{onboarding}</div>}
          </>
        )}
        inspectorTitle={selected ? <span className="truncate">{selected.name}</span> : <span className="inline-flex items-center gap-2"><MousePointerClick className="w-4 h-4 text-gray-400" />Lienzo</span>}
        inspector={selected && data ? (
            <LayerInspector
              key={selected.id}
              layer={selected} brand={data.brand} W={W} H={H}
              patch={(p, merge) => patchLayer(selected.id, p, merge)}
              onArrange={(to) => arrange(selected.id, to)} onDuplicate={() => duplicate(selected.id)} onRemove={() => remove(selected.id)}
              products={products} photos={photos} boundText={selected.type === 'text' ? textOf(selected, data) : ''}
              mockTemplates={mockTemplates} defaultMockTemplate={defaultMockTemplate}
              onDesignAll={(d) => setLayers(layers.map((x) => (x.type === 'image' && x.mock ? { ...x, mock: { ...x.mock, design: d } } : x)))}
            />
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">Haz clic en un elemento para editarlo, arrástralo para moverlo y usa las esquinas para cambiar su tamaño. Doble clic en un texto para escribir.</p>
            <div className="grid grid-cols-2 gap-2">
              <Button size="sm" variant="secondary" icon={<Palette className="w-4 h-4" />} onClick={() => setTab('fondo')}>Fondo</Button>
              <Button size="sm" variant="secondary" icon={<Plus className="w-4 h-4" />} onClick={() => setTab('elementos')}>Agregar</Button>
            </div>
            <p className="text-xs text-gray-500">Atajos: flechas para mover (Mayús: 10 px), Supr para quitar, Ctrl+D para duplicar, Ctrl+Z para deshacer.</p>
          </div>
        )}
      />
    </>
  );
}
