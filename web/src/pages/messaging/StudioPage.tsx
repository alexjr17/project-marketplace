/**
 * App Social → Estudio de contenido. Arma piezas para redes con la marca: elige qué promocionar
 * (producto, colección, promoción, diseño o prenda personalizable), el formato (post, historia, reel
 * rápido o video por escenas) y la plantilla; la IA escribe los textos. El video por escenas mezcla
 * prendas en 3D, fotos de productos y pantallas de texto, con transiciones, música y guiones listos
 * (ver SceneEditor). Se descarga, se guarda en la biblioteca y se publica o programa en Facebook e
 * Instagram (ver CalendarPage).
 */
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import type { SourceZone } from '../../services/marketing.service';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CalendarClock, Check, CloudOff, Download, FilePlus2, Film, FolderOpen, Loader2, Image as ImageIcon, LayoutGrid, MoreVertical, Palette, Pause, Play, Save, Send, Shirt, ShoppingBag, Sparkles, Tag, Wand2, X } from 'lucide-react';
import {
  ActionMenu, Badge, Button, Card, CardTitle, Checkbox, Dialog, Field, FormActions, Page, PageHeader, RadioGroup, SearchInput,
  SelectInput, Spinner, Switch, TextArea, TextInput, toast,
} from '../../components/ui';
import { errorMessage } from '../../lib/http';
import { useBrandKit } from '../../components/marketing/brand';
import {
  drawReel, drawScenes, drawStill, photoSceneLayout, reelLength, sceneElements, sizeOf, TEMPLATES, videoSize, type Format, type PieceItem, type PieceSpec, type TemplateId, type VideoRatio,
} from '../../components/marketing/render';
import { clampSeconds as clampSecondsOf, frameAt, layout, motionAt, newScene, slotsAt, transitionTurn, type ElemMove, type MoveKey, type Scene, type SceneDesign, type SceneProduct } from '../../components/marketing/timeline';
import { buildStoryboard, canBuild, colorScenes, type StoryboardId, type StoryContext } from '../../components/marketing/storyboards';
import { sceneArt } from '../../components/marketing/sceneArt';
import { VideoEditor, type MediaItem, type StudioMusic } from '../../components/marketing/VideoEditor';
import { useHistory } from '../../components/marketing/useHistory';
import { composeMockup, hasPhotoViews, photoZones, viewImageOf, zoneCrop } from '../../components/marketing/mockup';
import { isSound, playBuffer, playSound, sfxCues, soundBuffer } from '../../components/marketing/sfx';
import type { NarratorSettings } from '../../components/marketing/NarrationPanel';
import { DictateButton } from '../../components/marketing/DictateButton';
import { appendText } from '../../components/marketing/dictation';
import { DesignEditor } from '../../components/marketing/DesignEditor';
import { StudioModeSwitch, ToolbarSep } from '../../components/marketing/StudioShell';
import { ProjectsDialog } from '../../components/marketing/ProjectsDialog';
import { ago, persistLocal, thumbOf } from '../../components/marketing/projectStore';
import { GarmentViewsDialog } from '../../components/marketing/GarmentViewsDialog';
import { SubjectPanel } from '../../components/marketing/SubjectPanel';
import { buildDesign, designSize, reflowDesign, type ColorsLayer, type ContentKind, type Design, type DesignRatio, type MockView, type PieceMock } from '../../components/marketing/design';
import { canonicalView } from '../../components/customizer/customizerModel';
import { defaultPlan, garmentSubject, garmentZones, layoutZones, productSubject, resolveDesign, type GarmentPlan, type Subject, type ZoneChoice } from '../../components/marketing/pieces';
import type { Mannequin3DHandle } from '../../components/mannequin/Mannequin3D';
import { drawDesign, type DesignData } from '../../components/marketing/designRender';
import { decodeAudio, extOf, loadImage, recordCanvas, syncClips, videoMime } from '../../components/marketing/media';
import { AiAccountsCard } from '../../components/marketing/AiAccountsCard';
import { isModel3D, view3DOf, type View3D } from '../../components/mannequin/models';
import { useModels3D } from '../../components/mannequin/useModels3D';
import {
  marketingService, type CopyTone, type Creative, type ProjectFormat, type StudioProjectSummary, type SourceCollection, type SourceDesign, type SourceProduct, type SourcePromotion, type SourceType,
} from '../../services/marketing.service';

const Mannequin3D = lazy(() => import('../../components/mannequin/Mannequin3D'));

const SOURCES: { value: SourceType; label: string }[] = [
  { value: 'producto', label: 'Productos' },
  { value: 'coleccion', label: 'Colección' },
  { value: 'promocion', label: 'Promoción' },
  { value: 'plantilla', label: 'Personalizables' },
];

/** Primer paso del estudio: qué se va a mostrar. */
const START_OPTIONS: { value: SourceType; label: string; hint: string; icon: typeof Film }[] = [
  { value: 'producto', label: 'Productos', hint: 'Uno (con sus fotos) o varios de la tienda', icon: ShoppingBag },
  { value: 'plantilla', label: 'Personalizable', hint: 'La prenda con tus diseños, por zonas y colores', icon: Shirt },
  { value: 'coleccion', label: 'Colección', hint: 'Los productos de una colección', icon: LayoutGrid },
  { value: 'promocion', label: 'Promoción', hint: 'Una oferta o cupón con sus productos', icon: Tag },
];

/** Dos estudios: Post (imagen: post 1:1 o 4:5 e historia 9:16) y Video (reels, historias y posts de video). */
const FORMATS: { value: Format; label: string }[] = [
  { value: 'post', label: 'Post' },
  { value: 'video360', label: 'Video' },
];


const TONES: { value: CopyTone; label: string }[] = [
  { value: 'cercano', label: 'Cercano' }, { value: 'urgente', label: 'Urgente' }, { value: 'elegante', label: 'Elegante' },
  { value: 'divertido', label: 'Divertido' }, { value: 'inspirador', label: 'Inspirador' },
];

/** Plantilla sugerida para cada fuente. */
const SUGGESTED: Record<SourceType, TemplateId> = { producto: 'destacado', coleccion: 'coleccion', promocion: 'oferta', diseno: 'personaliza', plantilla: 'personaliza' };

const MAX_ITEMS: Record<SourceType, number> = { producto: 6, coleccion: 1, promocion: 1, diseno: 4, plantilla: 1 };

/** Plantilla con la que arranca el video según lo que se promociona. */
const AUTO_STORY: Record<SourceType, StoryboardId> = { producto: 'reelRapido', coleccion: 'coleccion', promocion: 'oferta', diseno: 'coleccion', plantilla: 'lanzamiento' };

type AnySource = SourceProduct | SourceCollection | SourcePromotion | SourceDesign;

/** Vista del post → vista del maniquí 3D. */
const VIEW3D: Record<MockView, View3D> = { front: 'front', back: 'back', side: 'rightSleeve' };
type MockPlan =
  | { kind: 'foto'; zone: SourceZone; baseUrl: string }
  | { kind: '3d'; key: string; model: string; color: string; view3d: View3D; zone: SourceZone | null; zones: SourceZone[]; design: PieceMock['design']; size: number; closeUp: boolean; offset: { x: number; y: number } };

const canvasOf = (h: RefObject<HTMLDivElement | null>) => (h.current?.querySelector('canvas') as HTMLCanvasElement | null) ?? null;
const toSceneProduct = (p: SourceProduct): SceneProduct => ({ id: p.id, name: p.name, image: p.image, price: p.price, listPrice: p.listPrice, discountPercent: p.discountPercent });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Guarda un montaje; al mover un diseño se crean muchos, así que solo quedan los últimos. */
function cacheMock(m: Map<string, HTMLCanvasElement>, key: string, c: HTMLCanvasElement) {
  m.set(key, c);
  while (m.size > 48) m.delete(m.keys().next().value!);
}

export const StudioPage = () => {
  const navigate = useNavigate();
  // Ficha de la marca (Social → Marca): colores, logos, tipografía y voz.
  const { kit, brand } = useBrandKit();
  const models3dReady = useModels3D();

  // 1. Qué se promociona
  const [sourceType, setSourceType] = useState<SourceType>('producto');
  const [q, setQ] = useState('');
  const [options, setOptions] = useState<AnySource[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [selected, setSelected] = useState<AnySource[]>([]);

  // 2. Formato y plantilla
  const [format, setFormat] = useState<Format>('post');
  const [template, setTemplate] = useState<TemplateId>('destacado');
  // Video por escenas: cada una es una prenda 3D, una foto de producto o un texto, con su transición.
  const [stage, setStage] = useState<'claro' | 'oscuro'>('oscuro');
  const [ratio, setRatio] = useState<VideoRatio>('9:16');
  const [showLogo, setShowLogo] = useState(true);
  /** Logo movido a mano en el video (vale para todas las escenas). */
  const [logoAt, setLogoAt] = useState<ElemMove | null>(null);
  const [endCard, setEndCard] = useState(true);
  const [music, setMusic] = useState<StudioMusic | null>(null);
  const [sfxOn, setSfxOn] = useState(true);
  // Narrador: voz IA por escena, mi voz (grabada o subida) o sin voz.
  const [narrator, setNarrator] = useState<NarratorSettings>({ mode: 'ia', voice: 'es-CO-SalomeNeural', rate: 0, volume: 1, duck: true });
  const [voices, setVoices] = useState<{ id: string; name: string }[]>([]);
  const [voiceClips, setVoiceClips] = useState<Record<string, { key: string; buffer: AudioBuffer }>>({});
  const [myVoice, setMyVoice] = useState<{ name: string; buffer: AudioBuffer } | null>(null);
  const [narrBusy, setNarrBusy] = useState<null | 'script' | 'voices' | 'record'>(null);
  const [narrProgress, setNarrProgress] = useState('');
  const [prompter, setPrompter] = useState<{ countdown: number | null; active: boolean }>({ countdown: null, active: false });
  /** Grabando mi voz: la vista previa no suena (para que el micrófono no grabe la música). */
  const voiceRec = useRef(false);
  const [sfxVolume, setSfxVolume] = useState(0.7);
  /** Clips de video y fotos propias subidas al editor. */
  const [media, setMedia] = useState<MediaItem[]>([]);
  // Diseñador de posts e historias (por capas).
  const designHist = useHistory<Design>(() => buildDesign('destacado', '1:1'));
  const { value: design, set: designSet, reset: designReset } = designHist;
  const designEdited = useRef(false);
  const setDesign = useCallback((d: Design, merge?: string) => { designEdited.current = true; designSet(d, merge); }, [designSet]);
  const [photos, setPhotos] = useState<SceneProduct[]>([]);
  /** Ventana "Prenda en 4 vistas con IA". */
  const [garmentOpen, setGarmentOpen] = useState(false);
  /** Recarga las personalizables (después de crear una). */
  const reloadTemplates = useCallback(() => {
    marketingService.sources<SourceProduct>('plantilla').then(setTemplates).catch(() => { /* sin cambios */ });
    if (sourceType === 'plantilla') marketingService.sources<AnySource>('plantilla').then(setOptions).catch(() => { /* sin cambios */ });
  }, [sourceType]);
  const sceneHist = useHistory<Scene[]>(() => []);
  const { value: scenes, set: histSet, reset: histReset } = sceneHist;
  /** El usuario ya tocó las escenas: cambiar la selección no le rehace el video. */
  const edited = useRef(false);
  const setScenes = useCallback((next: Scene[], merge?: string) => { edited.current = true; histSet(next, merge); }, [histSet]);
  const [sceneSel, setSceneSel] = useState<string | null>(null);
  /** Prendas personalizables con modelo 3D (para las escenas 3D de cualquier video). */
  const [templates, setTemplates] = useState<SourceProduct[]>([]);
  /** Qué escena muestra cada uno de los dos maniquíes (se turnan para las transiciones). */
  const [slots, setSlots] = useState<[number, number]>([-1, -1]);
  const slotsRef = useRef(slots);
  useEffect(() => { slotsRef.current = slots; }, [slots]);
  /** Segundo que se ve en pausa. */
  const [pausedAt, setPausedAt] = useState(1.5);

  // 3. Textos
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [cta, setCta] = useState('Compra ya');
  const [showPrice, setShowPrice] = useState(true);
  const [caption, setCaption] = useState('');
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [tone, setTone] = useState<CopyTone>('cercano');
  const [brief, setBrief] = useState('');
  const [writing, setWriting] = useState<null | 'all' | 'scenes'>(null);

  // Lienzo y salida
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const holder3d = useRef<HTMLDivElement>(null);
  const holder3dB = useRef<HTMLDivElement>(null);
  const motionA = useRef({ turn: 0, zoom: 1, lift: 0 });
  const motionB = useRef({ turn: 0, zoom: 1, lift: 0 });
  const playheadRef = useRef<HTMLDivElement | null>(null);
  const timecodeRef = useRef<HTMLSpanElement | null>(null);
  const timeRef = useRef(0);
  const recording = useRef(false);
  const loadedModels = useRef(new Set<string>());
  const layers = useMemo(() => [document.createElement('canvas'), document.createElement('canvas')] as [HTMLCanvasElement, HTMLCanvasElement], []);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [images, setImages] = useState<Record<string, HTMLImageElement | null>>({});
  const [playing, setPlaying] = useState(false);
  const [busy, setBusy] = useState<null | 'download' | 'save' | 'publish'>(null);
  const [progress, setProgress] = useState(0);
  const [publishFor, setPublishFor] = useState<Creative | null>(null);

  // El tono por defecto es el de la ficha de la marca.
  const kitTone = kit?.voice.tone;
  useEffect(() => { if (kitTone) setTone(kitTone); }, [kitTone]);

  // Voces del narrador (una vez).
  useEffect(() => {
    let alive = true;
    marketingService.voices().then((v) => { if (alive) setVoices(v); }).catch(() => { /* sin voces */ });
    return () => { alive = false; };
  }, []);

  // Prendas con modelo 3D (una vez).
  useEffect(() => {
    let alive = true;
    marketingService.sources<SourceProduct>('plantilla').then((r) => { if (alive) setTemplates(r); }).catch(() => { /* sin 3D */ });
    return () => { alive = false; };
  }, []);
  // Los maniquíes generados llegan aparte (useModels3D): al llegar se vuelve a filtrar.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const templates3d = useMemo(() => templates.filter((t) => !!t.model3d && isModel3D(t.model3d)), [templates, models3dReady]);
  /** Plantillas con fotos y zonas: se montan los diseños en 2D (tengan o no modelo 3D). */
  const photoTemplates = useMemo(() => templates.filter(hasPhotoViews), [templates]);

  // Opciones de la fuente elegida.
  useEffect(() => {
    let alive = true;
    setLoadingOptions(true);
    const t = window.setTimeout(() => {
      marketingService.sources<AnySource>(sourceType, q)
        .then((r) => { if (alive) setOptions(r); })
        .catch((e) => { if (alive) toast.error(errorMessage(e, 'No se pudieron cargar las opciones')); })
        .finally(() => { if (alive) setLoadingOptions(false); });
    }, q ? 300 : 0);
    return () => { alive = false; window.clearTimeout(t); };
  }, [sourceType, q]);

  const changeSource = (t: SourceType) => {
    setSourceType(t);
    setSelected([]);
    setQ('');
    setTemplate(SUGGESTED[t]);
  };
  const changeDesignRatio = (ratio: DesignRatio) => {
    if (ratio === design.ratio) return;
    if (designEdited.current) designSet(layoutZones(reflowDesign(design, ratio), subject));
    // Los colores disponibles (si están) se quedan en el formato nuevo.
    else designReset(layoutZones(buildDesign(design.template, ratio, { colors: design.layers.find((l) => l.type === 'colors')?.type === 'colors' ? (design.layers.find((l) => l.type === 'colors') as ColorsLayer).colors : null }), subject), true);
  };

  const toggle = (o: AnySource) => {
    setSelected((prev) => {
      const has = prev.some((p) => p.id === o.id);
      if (has) return prev.filter((p) => p.id !== o.id);
      const max = MAX_ITEMS[sourceType];
      return max === 1 ? [o] : [...prev, o].slice(-max);
    });
  };

  // Productos (o diseños) que van en la pieza.
  const items = useMemo<SourceProduct[]>(() => {
    if (sourceType === 'coleccion') return ((selected[0] as SourceCollection | undefined)?.products ?? []).slice(0, 6);
    if (sourceType === 'promocion') return ((selected[0] as SourcePromotion | undefined)?.products ?? []).slice(0, 6);
    if (sourceType === 'diseno') return (selected as SourceDesign[]).map((d) => ({ id: d.id, name: d.name, image: d.image, price: 0, listPrice: 0, discountPercent: 0 }));
    return selected as SourceProduct[];
  }, [selected, sourceType]);
  const promo = sourceType === 'promocion' ? (selected[0] as SourcePromotion | undefined) ?? null : null;
  const chosenTemplate = sourceType === 'plantilla' ? (selected[0] as SourceProduct | undefined) : undefined;
  /** Prenda 3D por defecto de las escenas nuevas: la elegida (si tiene modelo) o ninguna. */
  const defaultTemplate = useMemo(() => (chosenTemplate ? templates3d.find((t) => t.id === chosenTemplate.id) ?? null : null), [chosenTemplate, templates3d]);
  const templateFor = useCallback((sc: Scene) => templates3d.find((t) => t.id === sc.templateId) ?? defaultTemplate ?? templates3d[0] ?? null, [templates3d, defaultTemplate]);
  /** Productos con foto para las escenas de foto. */
  const sceneProducts = useMemo(() => (sourceType === 'diseno' ? [] : items.filter((i) => i.image).map(toSceneProduct)), [items, sourceType]);
  const photoTemplate = useMemo(() => (chosenTemplate ? photoTemplates.find((t) => t.id === chosenTemplate.id) ?? null : null), [chosenTemplate, photoTemplates]);

  // ─── Prendas personalizables en los posts (vistas con su diseño) ────────────
  /** Personalizables que se pueden mostrar con diseño: con fotos y zonas, o con maniquí 3D. */
  const mockTemplates = useMemo(() => templates.filter((t) => hasPhotoViews(t) || (!!t.model3d && isModel3D(t.model3d))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [templates, models3dReady]);
  /** La de Productos si es personalizable; si no, la primera. */
  const defaultMockTemplate = useMemo(() => (chosenTemplate ? mockTemplates.find((t) => t.id === chosenTemplate.id) : undefined) ?? mockTemplates[0] ?? null, [chosenTemplate, mockTemplates]);

  // ─── Con qué trabaja la pieza: productos (y sus fotos) o la personalizable (vistas y diseños) ──
  /** Fotos elegidas de cada producto (si no, todas). */
  const [photoPicks, setPhotoPicks] = useState<Record<number, string[]>>({});
  /** Por personalizable: qué zonas se muestran y con qué diseño. */
  const [garmentPlans, setGarmentPlans] = useState<Record<number, GarmentPlan>>({});
  /** Color de cada personalizable para el contenido (si no, el primero que tiene). */
  const [garmentColors, setGarmentColors] = useState<Record<number, string>>({});
  /** Colores disponibles que se muestran (opcional; null: no). */
  const [showcase, setShowcase] = useState<string[] | null>(null);
  /** Primer paso del estudio: se puede saltar; pedir el panel de Producto desde él. */
  const [skipOnboarding, setSkipOnboarding] = useState(false);
  const [panelReq, setPanelReq] = useState(0);
  const [aiAccountsOpen, setAiAccountsOpen] = useState(false);
  const garment = useMemo(() => (chosenTemplate ? mockTemplates.find((t) => t.id === chosenTemplate.id) ?? templates.find((t) => t.id === chosenTemplate.id) ?? chosenTemplate : null), [chosenTemplate, mockTemplates, templates]);
  const garmentColor = garment ? garmentColors[garment.id] ?? garment.colors?.[0] ?? null : null;
  const garmentPlan = useMemo(() => (garment ? garmentPlans[garment.id] ?? defaultPlan(garmentZones(garment)) : null), [garment, garmentPlans]);
  const subject = useMemo<Subject | null>(() => {
    if (sourceType === 'diseno') return null;
    if (sourceType === 'plantilla') return garment && garmentPlan && garmentZones(garment).length ? garmentSubject(garment, garmentPlan, garmentColor) : null;
    return items.length ? productSubject(items, photoPicks) : null;
  }, [sourceType, garment, garmentPlan, items, photoPicks, garmentColor]);
  /** La plantilla adaptada a lo elegido (solo para dibujar). */
  const resolvedDesign = useMemo(() => resolveDesign(design, subject), [design, subject]);
  const resolveFn = useCallback((d: Design) => resolveDesign(d, subject), [subject]);
  /**
   * Zonas de la personalizable como capas reales (editables) del post: se rearman al cambiar las zonas
   * elegidas, la plantilla o el formato; entre medio, lo que se mueva o cambie se respeta.
   */
  const zoneKey = subject ? `${subject.kind}:${subject.pieces.map((p) => p.key).join(',')}` : 'ninguna';
  useEffect(() => {
    if (format !== 'post') return;
    const next = layoutZones(design, subject);
    const shape = (d: Design) => JSON.stringify(d.layers.map((l) => [l.id, Math.round(l.x), Math.round(l.y), Math.round(l.w), Math.round(l.h)]));
    if (shape(next) !== shape(design)) designSet(next, 'zonas');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoneKey, design.template, design.ratio, format]);
  const setZoneChoice = (zoneId: number, patch: Partial<ZoneChoice>) => {
    if (!garment || !garmentPlan) return;
    setGarmentPlans((m) => {
      const plan = m[garment.id] ?? garmentPlan;
      const prev = plan[zoneId] ?? { show: false, design: null };
      // Al elegir una zona, va de última en el orden (la primera elegida es la principal).
      const order = patch.show && !prev.show ? Date.now() : patch.order ?? prev.order;
      return { ...m, [garment.id]: { ...plan, [zoneId]: { ...prev, ...patch, order } } };
    });
  };
  const setAllZoneDesigns = (d: SceneDesign | null) => {
    if (!garment || !garmentPlan) return;
    setGarmentPlans((m) => ({ ...m, [garment.id]: Object.fromEntries(Object.entries(m[garment.id] ?? garmentPlan).map(([k, v]) => [k, { ...v, design: d }])) }));
  };
  // Los productos normales van con su foto tal cual (sin recortar): no se pide el recorte con IA.
  const cutouts = useMemo<Record<string, string | null>>(() => ({}), []);
  /**
   * Cómo se arma una prenda con diseño: montaje sobre la foto de la vista (si la plantilla la tiene)
   * o foto del maniquí 3D girado a esa vista.
   */
  const planMock = useCallback((m: PieceMock): MockPlan | null => {
    const tpl = (m.templateId != null ? mockTemplates.find((t) => t.id === m.templateId) : undefined) ?? defaultMockTemplate;
    if (!tpl) return null;
    const view: MockView = m.view ?? 'front';
    const pz = photoZones(tpl);
    const hint = (m.zoneHint ?? '').toLowerCase();
    const inView = pz.filter((z) => canonicalView(z.view) === view);
    const zone = pz.find((z) => z.id === m.zoneId) ?? (hint ? inView.find((z) => z.name.toLowerCase().includes(hint)) : undefined) ?? inView[0] ?? (m.view ? undefined : pz[0]);
    const baseUrl = zone ? viewImageOf(tpl, zone) : null;
    if (zone && baseUrl) return { kind: 'foto', zone, baseUrl };
    if (tpl.model3d && isModel3D(tpl.model3d)) {
      const view3d = VIEW3D[view];
      const zones = tpl.zones ?? [];
      const z3 = zones.find((z) => z.id === m.zoneId) ?? (m.zoneHint ? zones.find((z) => view3DOf(z.view) === view3d && z.name.toLowerCase().includes(m.zoneHint!.toLowerCase())) : undefined) ?? zones.find((z) => view3DOf(z.view) === view3d) ?? null;
      const color = m.color ?? tpl.colors?.[0] ?? '#FFFFFF';
      const closeUp = !!m.closeUp && (!!z3 || !!m.crop);
      const offset = m.offset ?? { x: 0, y: 0 };
      return { kind: '3d', key: `${tpl.model3d}|${color}|${view3d}|${z3?.id ?? ''}|${m.design?.image ?? ''}|${m.size}|${offset.x}|${offset.y}|${closeUp ? 'cerca' : ''}`, model: tpl.model3d, color, view3d, zone: z3, zones, design: m.design, size: m.size, closeUp, offset };
    }
    return null;
  }, [mockTemplates, defaultMockTemplate]);
  const story = useMemo<StoryContext>(() => ({
    template: defaultTemplate ? { id: defaultTemplate.id, name: defaultTemplate.name, colors: defaultTemplate.colors ?? [] } : null,
    photoTemplate: photoTemplate ? {
      id: photoTemplate.id, name: photoTemplate.name, zones: photoZones(photoTemplate).map((z) => z.id),
      zoneInfo: photoZones(photoTemplate).map((z) => ({ id: z.id, name: z.name, view: z.view })),
    } : null,
    // El diseño ya elegido (en una escena del video o en una prenda del post) va en las escenas nuevas.
    design: scenes.find((x) => x.design?.image)?.design ?? (() => {
      for (const l of design.layers) if (l.type === 'image' && l.mock?.design?.image) return l.mock.design;
      return null;
    })(),
    // Las piezas: fotos del producto (una por foto o por producto) o las vistas de la personalizable.
    products: subject ? subject.pieces.map((p) => ({ id: p.productId, name: p.name, image: p.image, price: p.price, listPrice: p.listPrice, discountPercent: p.discountPercent })) : sceneProducts,
    garment: subject?.kind === 'prenda' ? {
      kind: photoTemplate ? 'foto' : '3d', templateId: subject.templateId, name: subject.name, color: subject.color, colors: garment?.colors ?? [],
      pieces: subject.pieces.map((p) => ({ zoneId: p.mock!.zoneId!, view: p.mock!.view ?? null, label: p.label, design: p.mock!.design, size: p.mock!.size, offset: p.mock!.offset })),
    } : null,
    showcase: subject?.kind === 'prenda' && showcase ? showcase.map((hex) => ({ hex, name: garment?.colorNames?.[(garment.colors ?? []).indexOf(hex)] ?? hex })) : null,
    promo: promo ? { label: promo.label, code: promo.code, name: promo.name } : null,
    title, subtitle,
  }), [showcase, defaultTemplate, photoTemplate, sceneProducts, promo, title, subtitle, scenes, design, subject, garment]);
  const storyRef = useRef(story);
  useEffect(() => { storyRef.current = story; }, [story]);

  /** Plantilla de video elegida: al cambiar los productos se rearma la misma, con los nuevos. */
  const storyId = useRef<StoryboardId | null>(null);
  // Cambiaron los productos: la plantilla elegida se queda y se llena con ellos (si no se editaron
  // escenas a mano). Si aún no se eligió plantilla, arranca con la que le va a lo elegido.
  const selKey = `${sourceType}:${selected.map((s) => s.id).join(',')}:${defaultTemplate?.id ?? ''}:${photoTemplate?.id ?? ''}`;
  useEffect(() => {
    if (edited.current && scenes.length) return;
    const ctx = storyRef.current;
    const auto = sourceType === 'plantilla' && !ctx.template && ctx.photoTemplate ? 'personaliza2d' : AUTO_STORY[sourceType];
    const id = storyId.current && canBuild(storyId.current, ctx) ? storyId.current : auto;
    let next = canBuild(id, ctx) ? buildStoryboard(id, ctx) : canBuild('mixto', ctx) ? buildStoryboard('mixto', ctx) : [];
    if (!next.length) next = [newScene({ kind: 'texto', title: ctx.title || brand?.name || 'Tu mensaje', textPos: 'centro', textAnim: 'letras', seconds: 3 })];
    histReset(next);
    setSceneSel(next[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selKey]);

  const applyStoryboard = (id: StoryboardId) => {
    const next = buildStoryboard(id, story);
    if (!next.length) return;
    // Elegir una plantilla no cuenta como editar: si luego cambian los productos, se rearma con ellos.
    storyId.current = id;
    edited.current = false;
    histReset(next, true);
    setSceneSel(next[0].id);
    setPlaying(true);
  };

  // Imágenes de las escenas (diseños sobre el maniquí y fotos de los productos).
  useEffect(() => {
    let alive = true;
    const urls = new Set<string>();
    scenes.forEach((sc) => {
      if (sc.design?.image) urls.add(sc.design.image);
      if (sc.product?.image) urls.add(sc.product.image);
      if (sc.bg?.image) urls.add(sc.bg.image);
      sc.bg?.designs?.forEach((u) => urls.add(u));
      if (sc.kind === 'foto' && sc.photoSource === 'plantilla') {
        const t = photoTemplates.find((x) => x.id === sc.templateId);
        const z = t && (photoZones(t).find((x) => x.id === sc.zoneId) ?? photoZones(t)[0]);
        const v = t && z ? viewImageOf(t, z) : null;
        if (v) urls.add(v);
      }
    });
    items.forEach((it) => { if (it.image) urls.add(it.image); });
    subject?.pieces.forEach((p) => { if (p.image) urls.add(p.image); if (p.mock?.design?.image) urls.add(p.mock.design.image); });
    Object.values(cutouts).forEach((u) => { if (u) urls.add(u); });
    resolvedDesign.layers.forEach((l) => {
      if (l.type === 'pattern') l.designs.forEach((u) => urls.add(u));
      if (l.type !== 'image') return;
      if (l.src) urls.add(l.src);
      if (l.mock) {
        const plan = planMock(l.mock);
        if (plan?.kind === 'foto') urls.add(plan.baseUrl);
        if (l.mock.design?.image) urls.add(l.mock.design.image);
      }
    });
    urls.forEach((url) => {
      if (url in images) return;
      loadImage(url).then((img) => { if (alive) setImages((m) => (url in m ? m : { ...m, [url]: img })); });
    });
    return () => { alive = false; };
  }, [scenes, items, images, resolvedDesign, photoTemplates, planMock, cutouts, subject]);

  // Lo que pinta cada maniquí: su escena 3D con la prenda y el diseño en la zona elegida.
  /**
   * Lo configurado en el post para cada zona de la prenda (diseño, posición y tamaño): las capas del post
   * con su propio diseño y, si no, lo elegido en "Qué se muestra".
   */
  const zoneDefaults = useMemo(() => {
    const out: Record<number, { design: SceneDesign; offset?: { x: number; y: number }; size?: number }> = {};
    for (const l of resolvedDesign.layers) {
      if (l.type !== 'image' || !l.mock?.design) continue;
      const plan = planMock(l.mock);
      const z = plan?.zone?.id;
      if (z != null && !out[z]) out[z] = { design: l.mock.design, offset: l.mock.offset, size: l.mock.size };
    }
    subject?.pieces.forEach((p) => {
      const z = p.mock?.zoneId;
      if (z != null && p.mock?.design && !out[z]) out[z] = { design: p.mock.design, offset: p.mock.offset, size: p.sized ? p.mock.size : undefined };
    });
    return out;
  }, [resolvedDesign, planMock, subject]);
  /** Las escenas como se ven: las de la prenda sin diseño propio usan el de su zona en el post. */
  const effScenes = useMemo(() => scenes.map((sc) => {
    if (sc.design || !(sc.kind === '3d' || (sc.kind === 'foto' && sc.photoSource === 'plantilla'))) return sc;
    let zoneId = sc.zoneId;
    if (zoneId == null && sc.kind === 'foto') { const t = photoTemplates.find((x) => x.id === sc.templateId); zoneId = t ? photoZones(t)[0]?.id ?? null : null; }
    const d = zoneId != null ? zoneDefaults[zoneId] : undefined;
    if (!d) return sc;
    return { ...sc, design: d.design, size: d.size ?? sc.size, offsetX: sc.offsetX || d.offset?.x || 0, offsetY: sc.offsetY || d.offset?.y || 0 };
  }), [scenes, zoneDefaults, photoTemplates]);

  const slotViews = useMemo(() => slots.map((j) => {
    const sc = effScenes[j];
    if (!sc || sc.kind !== '3d') return null;
    const tpl = templateFor(sc);
    if (!tpl?.model3d) return null;
    return { sc, model: tpl.model3d, ...sceneArt(sc, tpl.zones ?? [], sc.design ? images[sc.design.image] : null) };
  }), [effScenes, slots, images, templateFor]);
  // Montajes 2D (foto de la plantilla con el diseño en su zona), uno por escena que los usa.
  const mockCache = useRef(new Map<string, HTMLCanvasElement>());
  const sceneMockups = useMemo(() => {
    const out: Record<string, HTMLCanvasElement> = {};
    for (const sc of effScenes) {
      if (sc.kind !== 'foto' || sc.photoSource !== 'plantilla') continue;
      const t = photoTemplates.find((x) => x.id === sc.templateId);
      const z = t && (photoZones(t).find((x) => x.id === sc.zoneId) ?? photoZones(t)[0]);
      const baseUrl = t && z ? viewImageOf(t, z) : null;
      const base = baseUrl ? images[baseUrl] : null;
      if (!z || !base) continue;
      const design = sc.design ? images[sc.design.image] ?? null : null;
      const key = `${baseUrl}|${z.id}|${sc.design?.image ?? ''}|${design ? 1 : 0}|${sc.size}|${sc.offsetX}|${sc.offsetY}|${sc.color}`;
      let c = mockCache.current.get(key);
      if (!c) { c = composeMockup(base, design, z, sc.size, { x: sc.offsetX, y: sc.offsetY }, sc.color); cacheMock(mockCache.current, key, c); }
      out[sc.id] = c;
    }
    return out;
  }, [effScenes, photoTemplates, images]);
  const tplPrices = useMemo(() => Object.fromEntries(templates.map((t) => [t.id, { name: t.name, price: t.price }])), [templates]);

  const spec = useMemo<PieceSpec | null>(() => {
    if (!brand) return null;
    const list = subject ? subject.pieces : items;
    const pieceItems: PieceItem[] = list.map((it) => ({
      name: it.name,
      price: sourceType === 'diseno' ? undefined : it.price,
      listPrice: it.listPrice,
      discountPercent: it.discountPercent,
      image: it.image ? images[it.image] ?? null : null,
      cutout: it.image && cutouts[it.image] ? images[cutouts[it.image]!] ?? null : null,
    }));
    return {
      format, template, title, subtitle, cta, showPrice, items: pieceItems, brand, stage,
      promo: promo ? { label: promo.label, code: promo.code, name: promo.name } : null,
    };
  }, [brand, items, images, format, template, title, subtitle, cta, showPrice, promo, sourceType, stage, cutouts, subject]);

  // Vistas del maniquí 3D ya fotografiadas (por clave) y las que faltan.
  const [captures, setCaptures] = useState<Record<string, HTMLImageElement>>({});
  const captureFailed = useRef(new Set<string>());
  const captureHandle = useRef<Mannequin3DHandle | null>(null);
  const capturing = useRef<string | null>(null);

  /** Una prenda con su diseño: montaje sobre la foto de la vista o foto del maniquí 3D (si ya está). */
  const mockImage = useCallback((m: PieceMock, zoom = 1): HTMLCanvasElement | HTMLImageElement | null => {
    const z = Math.round(zoom * 100) / 100;
    const plan = planMock(m);
    if (!plan) return null;
    if (plan.kind === '3d') {
      const shot = captures[plan.key];
      if (!shot) return null;
      // Acercamiento: recorte alrededor de la zona (la foto del maniquí se tomó al doble para que no se pixele).
      // En el maniquí la foto incluye la cabeza: el cuello y la tela quedan más abajo que en una foto plana.
      const area = m.crop ? { ...m.crop, y: Math.min(100 - m.crop.h, m.crop.y + 19) } : plan.zone;
      if (plan.closeUp && area) {
        const ck = `${plan.key}|recorte|${JSON.stringify(area)}|${z}`;
        let c = mockCache.current.get(ck);
        if (!c) { c = zoneCrop(shot, area, m.crop ? 0 : 0.9, z); cacheMock(mockCache.current, ck, c); }
        return c;
      }
      return shot;
    }
    const base = images[plan.baseUrl];
    if (!base) return null;
    const dsg = m.design ? images[m.design.image] ?? null : null;
    const key = `${plan.baseUrl}|${plan.zone.id}|${m.design?.image ?? ''}|${dsg ? 1 : 0}|${m.size}|${m.offset?.x ?? 0}|${m.offset?.y ?? 0}|${m.color ?? ''}`;
    let c = mockCache.current.get(key);
    if (!c) { c = composeMockup(base, dsg, plan.zone, m.size, m.offset, m.color); cacheMock(mockCache.current, key, c); }
    if (!m.closeUp) return c;
    const ck = `${key}|recorte|${JSON.stringify(m.crop ?? null)}|${z}`;
    let cc = mockCache.current.get(ck);
    if (!cc) { cc = zoneCrop(c, m.crop ?? plan.zone, m.crop ? 0 : 0.9, z); cacheMock(mockCache.current, ck, cc); }
    return cc;
  }, [images, planMock, captures]);
  // Prendas del post con su diseño (por id de capa).
  const designMockups = useMemo(() => {
    const out: Record<string, HTMLCanvasElement | HTMLImageElement> = {};
    for (const l of resolvedDesign.layers) {
      if (l.type !== 'image' || !l.mock) continue;
      // En los acercamientos, el zoom de la capa es el encuadre de la prenda.
      const c = mockImage(l.mock, l.mock.closeUp ? l.zoom : 1);
      if (c) out[l.id] = c;
    }
    return out;
  }, [resolvedDesign, mockImage]);

  /** Siguiente vista 3D por fotografiar (con su diseño ya cargado). */
  const captureJob = useMemo(() => {
    if (!(format === 'post' || format === 'historia')) return null;
    for (const l of resolvedDesign.layers) {
      if (l.type !== 'image' || !l.mock) continue;
      const plan = planMock(l.mock);
      if (plan?.kind !== '3d' || captures[plan.key] || captureFailed.current.has(plan.key)) continue;
      if (plan.design && !images[plan.design.image]) continue;
      return plan;
    }
    return null;
  }, [format, resolvedDesign, planMock, captures, images]);
  const captureArt = useMemo(() => (captureJob
    ? sceneArt({ design: captureJob.design, zoneId: captureJob.zone?.id ?? null, size: captureJob.size, offsetX: captureJob.offset.x, offsetY: captureJob.offset.y } as Scene, captureJob.zones, captureJob.design ? images[captureJob.design.image] : null)
    : null), [captureJob, images]);
  const onCaptureReady = (job: Extract<MockPlan, { kind: '3d' }>) => {
    if (capturing.current === job.key) return;
    capturing.current = job.key;
    // Dos cuadros para que la prenda termine de montarse; luego la foto de la vista.
    requestAnimationFrame(() => requestAnimationFrame(() => window.setTimeout(() => {
      const url = captureHandle.current?.capture(job.view3d, { size: job.closeUp ? 2048 : 1024 });
      if (!url) { captureFailed.current.add(job.key); capturing.current = null; setCaptures((c) => ({ ...c })); return; }
      const img = new Image();
      img.onload = () => { capturing.current = null; setCaptures((c) => ({ ...c, [job.key]: img })); };
      img.src = url;
    }, 120)));
  };

  /** La prenda en un color (frente, con su diseño): para la capa de colores disponibles. */
  const garmentInColor = useCallback((color: string) => {
    if (subject?.kind !== 'prenda') return null;
    const p = subject.pieces.find((x) => x.mock?.view === 'front') ?? subject.pieces[0];
    return p?.mock ? mockImage({ ...p.mock, color, closeUp: false }) : null;
  }, [subject, mockImage]);

  const designData = useMemo<DesignData | null>(() => (spec ? {
    brand: spec.brand, title, subtitle, cta, items: spec.items, images, mockups: designMockups, mockOf: mockImage, garmentInColor,
    promo: promo ? { label: promo.label, code: promo.code, name: promo.name } : null,
  } : null), [spec, title, subtitle, cta, images, promo, designMockups, mockImage, garmentInColor]);

  const isScenes = format === 'video360';
  /**
   * Mostrar u ocultar los colores disponibles. En el post, la plantilla se reacomoda: cada una tiene su
   * lugar para los colores y el producto cede ese espacio. En el video, un carrusel al final.
   */
  const changeShowcase = (colors: string[] | null) => {
    setShowcase(colors);
    const has = design.layers.some((l) => l.type === 'colors');
    // Solo cambian qué colores: se quedan donde estén.
    if (has && colors?.length) { designSet({ ...design, layers: design.layers.map((l) => (l.type === 'colors' ? { ...l, colors } : l)) }); return; }
    designSet(reflowDesign(design, design.ratio, { colors: colors?.length ? colors : null }));
  };
  /** Agrega ya el carrusel de colores al final del video. */
  const addColorScenes = () => {
    const extra = colorScenes(story);
    if (!extra.length) { toast.error('Elige al menos dos colores'); return; }
    // Si ya estaba, se reemplaza (no se duplica).
    const names = new Set(extra.map((x) => x.badge));
    setScenes([...scenes.filter((x) => !(x.badge && names.has(x.badge) && x.seconds <= 1.8)), ...extra]);
    toast.success('Carrusel de colores agregado al final');
  };
  const isDesign = format === 'post' || format === 'historia';
  const [W, H] = isScenes ? videoSize(ratio) : isDesign ? designSize(design.ratio) : sizeOf(format);
  const isVideo = format === 'reel' || isScenes;
  const timing = useMemo(() => layout(scenes, endCard), [scenes, endCard]);
  const length = isScenes ? timing.total : spec ? reelLength(spec) : 6;

  /** Dibuja el segundo `time`. En vivo (reproduciendo o grabando) los clips corren; en pausa van al cuadro exacto. */
  const drawAt = useCallback((time: number, live = false) => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx || !spec) return;
    if (format === 'reel') drawReel(ctx, spec, time);
    else if (format === 'video360') {
      timeRef.current = time;
      // Clips propios que se ven ahora (la escena y, en una transición, la otra).
      const f = frameAt(scenes, endCard, time);
      const want = new Map<string, number>();
      [f.index, f.transition ? (f.transition.from === f.index ? f.transition.to : f.transition.from) : -1].forEach((j) => {
        const sc = scenes[j];
        if (sc?.kind === 'clip' && sc.clip) want.set(sc.clip.id, sc.clipStart + Math.max(0, time - timing.starts[j]));
      });
      syncClips(want, live);
      // Cada maniquí muestra su escena 3D; el movimiento sale de la línea de tiempo.
      const next = slotsAt(scenes, endCard, time);
      setSlots((cur) => (cur[0] === next[0] && cur[1] === next[1] ? cur : next));
      [motionA, motionB].forEach((m, k) => {
        const j = next[k];
        const sc = scenes[j];
        if (!sc || sc.kind !== '3d') return;
        const mm = motionAt(sc.motion, time - timing.starts[j], sc.seconds, sc.speed);
        mm.turn += transitionTurn(scenes, endCard, time, j);
        m.current = mm;
      });
      drawScenes(ctx, spec, effScenes, { endCard, logo: showLogo, logoAt }, {
        frames: [canvasOf(holder3d), canvasOf(holder3dB)], slots: slotsRef.current, images, mockups: sceneMockups, templates: tplPrices, layers, cutouts,
      }, time);
      const ph = playheadRef.current;
      if (ph) { ph.style.left = `${timing.total ? (time / timing.total) * 100 : 0}%`; ph.style.opacity = '1'; }
      const tc = timecodeRef.current;
      if (tc) tc.textContent = `${Math.floor(time / 60)}:${(time % 60).toFixed(1).padStart(4, '0')}`;
    } else drawStill(ctx, spec);
  }, [spec, format, scenes, effScenes, endCard, timing, showLogo, logoAt, images, tplPrices, layers, sceneMockups, cutouts]);

  // Música de la vista previa (la del video final se mezcla al grabar).
  const musicUrl = music?.url;
  useEffect(() => {
    if (!musicUrl) { audioRef.current = null; return; }
    const a = new Audio(musicUrl);
    a.loop = true;
    audioRef.current = a;
    return () => { a.pause(); };
  }, [musicUrl]);
  const musicRef = useRef(music);
  useEffect(() => { musicRef.current = music; if (audioRef.current && music) audioRef.current.volume = music.volume; }, [music]);
  useEffect(() => { if (!playing || !isVideo) audioRef.current?.pause(); }, [playing, isVideo]);

  // Vista previa: fija o animada (reel y video en bucle). El video por escenas se redibuja siempre,
  // aun en pausa, porque los maniquíes siguen pintándose.
  const cues = useMemo(() => (isScenes && sfxOn ? sfxCues(scenes, endCard) : []), [isScenes, sfxOn, scenes, endCard]);
  const voiceKey = useCallback((sc: Scene) => `${narrator.voice}|${narrator.rate}|${sc.narration.trim()}`, [narrator.voice, narrator.rate]);
  /** Voz del narrador en la línea de tiempo: cada línea al empezar su escena, o mi voz desde el inicio. */
  const voiceCues = useMemo(() => {
    if (!isScenes || narrator.mode === 'ninguno') return [];
    if (narrator.mode === 'mia') return myVoice ? [{ buffer: myVoice.buffer, at: 0 }] : [];
    return scenes.flatMap((sc, i) => {
      const c = voiceClips[sc.id];
      return sc.narration.trim() && c && c.key === voiceKey(sc) ? [{ buffer: c.buffer, at: timing.starts[i] + 0.15 }] : [];
    });
  }, [isScenes, narrator.mode, myVoice, scenes, voiceClips, voiceKey, timing]);
  const sfxRef = useRef({ cues, volume: sfxVolume, voice: voiceCues, voiceVolume: narrator.volume, duck: narrator.duck });
  useEffect(() => { sfxRef.current = { cues, volume: sfxVolume, voice: voiceCues, voiceVolume: narrator.volume, duck: narrator.duck }; }, [cues, sfxVolume, voiceCues, narrator.volume, narrator.duck]);

  useEffect(() => {
    if (!isVideo || (!playing && format !== 'video360')) { drawAt(isVideo ? length * 0.35 : 0); return; }
    let raf = 0;
    let lastT = -1;
    const start = performance.now();
    const loop = () => {
      // Mientras se graba, el lienzo es solo de la grabación.
      if (!recording.current) {
        const t = playing ? ((performance.now() - start) / 1000) % length : Math.min(pausedAt, length - 0.01);
        drawAt(t, playing);
        if (playing && !voiceRec.current) {
          // Sonidos de las transiciones y voz del narrador que se cruzaron desde el cuadro anterior.
          const fx = sfxRef.current;
          const crossed = (at: number) => lastT >= 0 && (lastT <= t ? at > lastT && at <= t : at > lastT || at <= t);
          for (const c of fx.cues) if (crossed(c.at)) void playSound(c.sound, fx.volume);
          for (const c of fx.voice) {
            if (!crossed(c.at)) continue;
            void playBuffer(c.buffer, fx.voiceVolume);
            const a = audioRef.current, m = musicRef.current;
            if (fx.duck && a && m) {
              a.volume = m.volume * 0.3;
              window.setTimeout(() => { if (audioRef.current && musicRef.current) audioRef.current.volume = musicRef.current.volume; }, c.buffer.duration * 1000 + 200);
            }
          }
          lastT = t;
        }
        const a = audioRef.current, m = musicRef.current;
        if (voiceRec.current && a && !a.paused) a.pause();
        if (playing && a && m && !voiceRec.current) {
          const want = (m.offset + t) % Math.max(1, a.duration || m.buffer.duration);
          if (a.paused) { a.currentTime = want; void a.play().catch(() => { /* el navegador pide un clic antes */ }); }
          else if (Math.abs(a.currentTime - want) > 0.3) a.currentTime = want;
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [drawAt, isVideo, playing, length, format, pausedAt]);

  /** Ver una escena: pausa donde mejor se ve (los textos ya entraron). */
  const previewScene = (id: string) => {
    const i = scenes.findIndex((s) => s.id === id);
    if (i < 0) return;
    setPlaying(false);
    const sc = scenes[i];
    const len = layout([sc], false).total;
    const at = sc.kind === '3d' ? (sc.motion === 'giro' ? Math.min(0.6, len * 0.15) : len * 0.5) : Math.min(len - 0.4, 1.5);
    setPausedAt(timing.starts[i] + Math.max(0.4, at));
  };
  const seek = (t: number) => { setPlaying(false); setPausedAt(t); };

  const scenesOk = scenes.length > 0 && scenes.every((s) => (s.kind === '3d' ? !!templateFor(s) : s.kind === 'foto' ? (s.photoSource === 'plantilla' ? s.templateId != null : !!s.product) : s.kind === 'clip' ? !!s.clip : true));
  const ready = !!spec && (isScenes ? scenesOk : isDesign ? true : items.length > 0);

  /** Antes de grabar: cada prenda 3D del video queda cargada y el primer cuadro listo. */
  const warmUp = async () => {
    const models: { model: string; j: number }[] = [];
    scenes.forEach((s, j) => {
      const m = s.kind === '3d' ? templateFor(s)?.model3d : null;
      if (m && !models.some((x) => x.model === m)) models.push({ model: m, j });
    });
    for (const { model, j } of models) {
      if (loadedModels.current.has(model)) continue;
      setSlots(j % 2 === 0 ? [j, -1] : [-1, j]);
      const until = Date.now() + 20000;
      while (!loadedModels.current.has(model) && Date.now() < until) await sleep(120);
    }
    setSlots(slotsAt(scenes, endCard, 0));
    await sleep(models.length ? 700 : 50);
  };

  /** La pieza terminada: PNG (post, historia) o video grabado (reel, video por escenas). */
  const render = async (): Promise<{ blob: Blob; name: string }> => {
    const canvas = canvasRef.current!;
    const base = (title || items[0]?.name || scenes.find((s) => s.title)?.title || 'pieza').toLowerCase().replace(/[^a-z0-9áéíóúñ]+/gi, '-').slice(0, 40);
    if (!isVideo) {
      // El diseño se dibuja aparte, sin las marcas del editor.
      const out = document.createElement('canvas');
      [out.width, out.height] = designSize(design.ratio);
      if (designData) drawDesign(out.getContext('2d')!, resolvedDesign, designData, false);
      const blob = await new Promise<Blob>((res, rej) => out.toBlob((b) => (b ? res(b) : rej(new Error('No se pudo exportar la imagen'))), 'image/png'));
      return { blob, name: `${base}-${design.ratio.replace(':', 'x')}.png` };
    }
    setPlaying(false);
    setProgress(0);
    recording.current = true;
    try {
      if (isScenes) await warmUp();
      const fx = isScenes && sfxOn ? await Promise.all(sfxCues(scenes, endCard).map(async (c) => ({ buffer: await soundBuffer(c.sound), at: c.at }))) : [];
      const blob = await recordCanvas(
        canvas, length, (t) => drawAt(t, true), setProgress,
        music ? { buffer: music.buffer, offset: music.offset, volume: music.volume } : null,
        fx.length ? { cues: fx, volume: sfxVolume } : null,
        voiceCues.length ? { cues: voiceCues, volume: narrator.volume, duck: narrator.duck } : null,
      );
      return { blob, name: `${base}.${extOf(blob.type)}` };
    } finally {
      recording.current = false;
      syncClips(new Map(), false);
    }
  };

  const download = async () => {
    setBusy('download');
    try {
      const { blob, name } = await render();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    } catch (e) {
      toast.error(errorMessage(e, 'No se pudo descargar'));
    } finally {
      setBusy(null);
      setProgress(0);
    }
  };

  const save = async (): Promise<Creative | null> => {
    const { blob, name } = await render();
    return marketingService.saveCreative({
      title: title || items[0]?.name || scenes.find((s) => s.title)?.title || 'Pieza',
      kind: format === 'reel' ? 'reel' : isScenes ? 'video360' : design.ratio === '9:16' ? 'historia' : 'post',
      source: sourceType,
      sourceIds: selected.map((s) => s.id),
      template: isDesign ? design.template : template,
      data: {
        title, subtitle, cta, showPrice,
        ...(isDesign ? { design: { ...design, layers: design.layers.map((l) => (l.type === 'image' && l.src?.startsWith('blob:') ? { ...l, src: null } : l)) } } : {}),
        ...(isScenes ? {
          ratio, stage, endCard, logo: showLogo, logoAt, music: music?.name ?? null, sfx: sfxOn ? sfxVolume : 0,
          narrator: { mode: narrator.mode, voice: narrator.voice, rate: narrator.rate },
          // Lo subido en el momento (diseños, fotos y clips) no se guarda: pesa y vive solo en este navegador.
          scenes: scenes.map((sc) => ({
            ...sc,
            design: sc.design?.image.startsWith('data:') ? { ...sc.design, image: '' } : sc.design,
            // Una foto de fondo subida solo vive en este navegador: no se guarda.
            bg: sc.bg?.image?.startsWith('blob:') ? { ...sc.bg, image: null } : sc.bg,
            product: sc.product?.image?.startsWith('blob:') ? { ...sc.product, image: null } : sc.product,
            clip: sc.clip ? { ...sc.clip, thumb: null } : null,
          })),
        } : {}),
      },
      caption,
      hashtags,
    }, blob, name);
  };

  const onSave = async (thenPublish: boolean) => {
    setBusy(thenPublish ? 'publish' : 'save');
    try {
      const c = await save();
      toast.success('Pieza guardada en la biblioteca');
      if (c && thenPublish) setPublishFor(c);
    } catch (e) {
      toast.error(errorMessage(e, 'No se pudo guardar la pieza'));
    } finally {
      setBusy(null);
      setProgress(0);
    }
  };

  /** Textos con IA: los de la pieza y, en el video por escenas, uno por escena. */
  const writeWithAi = async (scenesOnly = false) => {
    if (!selected.length && !scenes.length) { toast.error('Primero elige qué promocionar'); return; }
    setWriting(scenesOnly ? 'scenes' : 'all');
    try {
      const kind = format === 'reel' ? 'reel' : isScenes ? 'video360' : design.ratio === '9:16' ? 'historia' : 'post';
      const plan = isScenes ? scenes.map((s) => ({
        kind: s.kind,
        about: (s.kind === '3d' ? [templateFor(s)?.name, s.design?.name].filter(Boolean).join(' con ') : s.kind === 'foto' ? s.product?.name ?? '' : s.title).slice(0, 120),
      })) : undefined;
      const r = await marketingService.copy({ kind, source: sourceType, tone, brief: brief || undefined, items: selected, scenes: plan });
      if (!scenesOnly) { setTitle(r.title); setSubtitle(r.subtitle); setCta(r.cta); setCaption(r.caption); setHashtags(r.hashtags); }
      if (r.scenes?.length) {
        setScenes(scenes.map((s, i) => (r.scenes?.[i] ? { ...s, title: r.scenes[i].title, subtitle: r.scenes[i].subtitle } : s)));
      }
      if (!r.ai) toast.info('La IA no respondió: se usaron textos de plantilla');
    } catch (e) {
      toast.error(errorMessage(e, 'No se pudieron escribir los textos'));
    } finally {
      setWriting(null);
    }
  };

  // ─── Narrador ──────────────────────────────────────────────────────────────
  const scenePlan = () => scenes.map((s) => ({
    kind: s.kind,
    about: (s.kind === '3d' ? templateFor(s)?.name ?? '' : s.kind === 'foto' ? (s.photoSource === 'plantilla' ? photoTemplates.find((t) => t.id === s.templateId)?.name ?? '' : s.product?.name ?? '') : s.kind === 'clip' ? s.clip?.name ?? '' : s.title).slice(0, 120),
    title: [s.badge, s.title, s.subtitle].filter(Boolean).join(' · ').slice(0, 120),
    seconds: clampSecondsOf(s.seconds),
  }));
  const writeNarration = async () => {
    setNarrBusy('script');
    try {
      const r = await marketingService.narrationScript({ tone, brief: brief || undefined, scenes: scenePlan() });
      setScenes(scenes.map((s, i) => ({ ...s, narration: r.lines[i] ?? s.narration })));
      if (narrator.mode === 'ninguno') setNarrator({ ...narrator, mode: 'ia' });
      toast.success(r.ai ? 'Guion listo. Revísalo y genera la voz.' : 'La IA no respondió: armé el guion con los textos de las escenas');
    } catch (e) {
      toast.error(errorMessage(e, 'No se pudo escribir el guion'));
    } finally {
      setNarrBusy(null);
    }
  };
  const generateVoices = async () => {
    const todo = scenes.filter((s) => s.narration.trim() && voiceClips[s.id]?.key !== voiceKey(s));
    if (!todo.length) return;
    setNarrBusy('voices');
    const made: Record<string, number> = {};
    try {
      for (let k = 0; k < todo.length; k++) {
        const sc = todo[k];
        setNarrProgress(`Generando la voz ${k + 1} de ${todo.length}…`);
        const blob = await marketingService.speak({ text: sc.narration.trim(), voice: narrator.voice, rate: narrator.rate });
        const buffer = await decodeAudio(blob);
        made[sc.id] = buffer.duration;
        setVoiceClips((m) => ({ ...m, [sc.id]: { key: voiceKey(sc), buffer } }));
      }
      // Si una línea dura más que su escena, la escena se alarga para que la voz no se corte.
      const longer = scenes.filter((s) => made[s.id] != null && made[s.id] + 0.3 > clampSecondsOf(s.seconds));
      if (longer.length) {
        setScenes(scenes.map((s) => (made[s.id] != null && made[s.id] + 0.3 > clampSecondsOf(s.seconds) ? { ...s, seconds: clampSecondsOf(Math.ceil((made[s.id] + 0.6) * 2) / 2) } : s)));
        toast.success(`Voz lista. Alargué ${longer.length === 1 ? 'una escena' : `${longer.length} escenas`} para que quepa (Ctrl+Z para deshacer).`);
      } else toast.success('Voz lista: dale play para escucharla con el video');
    } catch (e) {
      toast.error(errorMessage(e, 'No se pudo generar la voz'));
    } finally {
      setNarrBusy(null);
      setNarrProgress('');
    }
  };
  const recordMine = async () => {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch {
      toast.error('Permite el micrófono para grabar tu voz');
      return;
    }
    setNarrBusy('record');
    setPlaying(false);
    try {
      for (let c = 3; c > 0; c--) { setPrompter({ countdown: c, active: false }); await sleep(1000); }
      setPrompter({ countdown: null, active: true });
      voiceRec.current = true;
      const rec = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      const stopped = new Promise<void>((res) => { rec.onstop = () => res(); });
      rec.start(250);
      setPausedAt(0);
      setPlaying(true);
      await sleep(length * 1000 + 150);
      rec.stop();
      await stopped;
      setPlaying(false);
      const buffer = await decodeAudio(new Blob(chunks, { type: rec.mimeType }));
      setMyVoice({ name: 'Mi voz', buffer });
      setNarrator((n) => ({ ...n, mode: 'mia' }));
      toast.success('Voz grabada. Dale play para escucharla con el video.');
    } catch (e) {
      toast.error(errorMessage(e, 'No se pudo grabar la voz'));
    } finally {
      stream.getTracks().forEach((t) => t.stop());
      voiceRec.current = false;
      setPrompter({ countdown: null, active: false });
      setNarrBusy(null);
    }
  };
  const uploadMine = async (file: File) => {
    if (!file.type.startsWith('audio/')) { toast.error('Elige un archivo de audio'); return; }
    try {
      setMyVoice({ name: file.name.replace(/\.[^.]+$/, ''), buffer: await decodeAudio(file) });
      setNarrator((n) => ({ ...n, mode: 'mia' }));
    } catch {
      toast.error('No se pudo leer ese audio');
    }
  };
  const narration = {
    settings: narrator, onSettings: setNarrator, voices,
    voiceOf: (id: string) => { const sc = scenes.find((x) => x.id === id); const c = voiceClips[id]; return sc && c && c.key === voiceKey(sc) ? c.buffer.duration : null; },
    myVoice: myVoice ? { name: myVoice.name, duration: myVoice.buffer.duration } : null,
    busy: narrBusy, progress: narrProgress,
    onWriteScript: writeNarration, onGenerate: generateVoices,
    onPlayLine: (id: string) => { const c = voiceClips[id]; if (c) void playBuffer(c.buffer, narrator.volume); },
    onRecord: recordMine, onUpload: uploadMine, onClearMine: () => setMyVoice(null),
  };

  /** La IA revisa el video y recomienda transiciones, sonidos y tiempos. */
  const askAdvice = () => marketingService.videoAdvice({
    tone, brief: brief || undefined, ratio, hasMusic: !!music, endCard,
    scenes: scenes.map((s) => ({
      kind: s.kind,
      about: (s.kind === '3d' ? templateFor(s)?.name ?? '' : s.kind === 'foto' ? s.product?.name ?? '' : s.kind === 'clip' ? s.clip?.name ?? '' : s.title).slice(0, 120),
      title: [s.badge, s.title, s.subtitle].filter(Boolean).join(' · ').slice(0, 90),
      seconds: s.seconds, transition: s.transition, sound: isSound(s.sound) ? s.sound : null, motion: s.kind === '3d' ? s.motion : null,
    })),
  });

  const addTag = () => {
    const t = tagInput.trim().replace(/^#/, '').replace(/\s+/g, '');
    if (t && !hashtags.includes(t)) setHashtags([...hashtags, t]);
    setTagInput('');
  };

  const optionImage = (o: AnySource) => ('image' in o ? o.image : (o as SourceCollection).products?.[0]?.image) ?? null;
  const optionLabel = (o: AnySource) => {
    if (sourceType === 'coleccion') return `${(o as SourceCollection).count} productos`;
    if (sourceType === 'promocion') { const p = o as SourcePromotion; return `${p.label}${p.code ? ` · ${p.code}` : ' · automática'}`; }
    if (sourceType === 'diseno') return (o as SourceDesign).category || 'Diseño';
    if (sourceType === 'plantilla') return (o as SourceProduct).model3d && isModel3D((o as SourceProduct).model3d) ? 'Con modelo 3D' : 'Sin modelo 3D';
    const p = o as SourceProduct;
    return p.discountPercent ? `$${Math.round(p.price).toLocaleString('es-CO')} · -${p.discountPercent}%` : `$${Math.round(p.price).toLocaleString('es-CO')}`;
  };
  const previewWidth = format === 'post' || (isScenes && ratio === '1:1') ? 520 : isScenes && ratio === '4:5' ? 440 : 340;
  const stage3d = brand ? { base: stage === 'oscuro' ? brand.primary : brand.paper, accent: brand.accent, dark: stage === 'oscuro' } : undefined;

  // ─── Piezas de la vista (se arman distinto en el editor de video) ───────────
  const sourcePanel = (
    <>
      <div className="flex flex-wrap gap-1.5 mb-3" role="radiogroup" aria-label="Qué promocionas">
        {SOURCES.map((s) => (
          <button
            key={s.value} type="button" role="radio" aria-checked={sourceType === s.value} onClick={() => changeSource(s.value)}
            className={`rounded-full px-3 py-1.5 text-sm border transition-colors ${sourceType === s.value ? 'bg-app-600 border-app-600 text-white' : 'border-gray-200 text-gray-700 hover:border-app-300'}`}
          >
            {s.label}
          </button>
        ))}
      </div>
      {sourceType !== 'promocion' && sourceType !== 'plantilla' && <SearchInput value={q} onChange={setQ} placeholder="Buscar…" />}
      {sourceType === 'plantilla' && (
        <Button className="w-full mb-1" size="sm" variant="outline" icon={<Sparkles className="w-4 h-4" />} onClick={() => setGarmentOpen(true)}>Crear una con IA (4 vistas)</Button>
      )}
      <p className="text-xs text-gray-500 mt-2 mb-2">
        {MAX_ITEMS[sourceType] > 1 ? `Elige hasta ${MAX_ITEMS[sourceType]} (en los videos sale uno por escena).` : 'Elige uno.'}
      </p>
      {subject && (
        <SubjectPanel
          subject={subject} products={sourceType === 'plantilla' ? [] : items} picks={photoPicks} onPicks={(id, urls) => setPhotoPicks((m) => ({ ...m, [id]: urls }))}
          garment={garment} plan={garmentPlan} onZone={setZoneChoice} onAllDesigns={setAllZoneDesigns}
          color={garmentColor} onColor={(c) => {
            if (!garment) return;
            // Las escenas de esta prenda que estaban en el color anterior pasan al nuevo (las que se cambiaron a mano, no).
            const prev = (garmentColor ?? '#FFFFFF').toUpperCase();
            if (scenes.some((x) => x.templateId === garment.id && x.color.toUpperCase() === prev)) {
              setScenes(scenes.map((x) => (x.templateId === garment.id && x.color.toUpperCase() === prev ? { ...x, color: c } : x)));
            }
            setGarmentColors((m) => ({ ...m, [garment.id]: c }));
          }}
          showcase={showcase} onShowcase={changeShowcase} onShowcaseVideo={isScenes ? addColorScenes : undefined}
          is3d={!!garment && !hasPhotoViews(garment) && !!garment.model3d}
        />
      )}
      <p className="text-xs font-medium text-gray-700 mt-4 mb-1">{sourceType === 'plantilla' ? 'Otra personalizable' : 'Elegir'}</p>
      <div className={`${isScenes ? '' : 'max-h-[560px]'} overflow-y-auto -mx-1 px-1 space-y-1.5`}>
        {loadingOptions && <Spinner label="Cargando…" />}
        {!loadingOptions && options.length === 0 && (
          <p className="text-sm text-gray-500 py-6 text-center">{sourceType === 'promocion' ? 'No hay promociones ni cupones activos. Créalos en Cupones del panel.' : 'No hay resultados.'}</p>
        )}
        {!loadingOptions && options.map((o) => {
          const on = selected.some((s) => s.id === o.id);
          const img = optionImage(o);
          return (
            <button
              key={String(o.id)} type="button" onClick={() => toggle(o)} aria-pressed={on}
              className={`w-full flex items-center gap-3 rounded-xl border p-2 text-left transition-colors ${on ? 'border-app-500 bg-app-50' : 'border-gray-200 hover:border-app-300'}`}
            >
              <span className="w-12 h-12 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
                {img && <img src={img} alt="" className="w-full h-full object-cover" loading="lazy" />}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-gray-900 truncate">{o.name}</span>
                <span className="block text-xs text-gray-500 truncate">{optionLabel(o)}</span>
              </span>
            </button>
          );
        })}
      </div>
    </>
  );

  const textsPanel = (
    <div className="space-y-3">
      <div className="rounded-xl border border-app-200 bg-app-50/50 p-3 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Tono" htmlFor="st-tone">
            <SelectInput id="st-tone" value={tone} onChange={(e) => setTone(e.target.value as CopyTone)}>
              {TONES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </SelectInput>
          </Field>
          <div className="flex items-end">
            <Button className="w-full" icon={<Sparkles className="w-4 h-4" />} isLoading={writing === 'all'} disabled={!selected.length || !!writing} onClick={() => writeWithAi(false)}>Escribir con IA</Button>
          </div>
        </div>
        <TextInput aria-label="Indicaciones para la IA" placeholder="Indicaciones (opcional): ej. lanzamiento de fin de semana" value={brief} maxLength={500} onChange={(e) => setBrief(e.target.value)} />
        {isScenes && <p className="text-xs text-gray-500">En el video también escribe el título de cada escena.</p>}
      </div>
      {isDesign && <p className="text-xs text-gray-500 -mb-1">El título, el subtítulo y el botón llenan los textos vinculados del diseño.</p>}
      <Field label={isScenes ? 'Título (cierre del video)' : 'Título en la imagen'} htmlFor="st-title"><TextInput id="st-title" value={title} maxLength={60} placeholder={items[0]?.name ?? 'Título'} onChange={(e) => setTitle(e.target.value)} /></Field>
      <Field label="Subtítulo" htmlFor="st-sub"><TextInput id="st-sub" value={subtitle} maxLength={90} onChange={(e) => setSubtitle(e.target.value)} /></Field>
      <Field label="Botón" htmlFor="st-cta"><TextInput id="st-cta" value={cta} maxLength={24} onChange={(e) => setCta(e.target.value)} /></Field>
      {sourceType !== 'diseno' && format === 'reel' && <Switch checked={showPrice} onChange={setShowPrice} label="Mostrar precio" description="Con la oferta vigente si la tiene." />}
      <Field label="Texto del post" htmlFor="st-caption" hint="Va en Facebook e Instagram junto con la pieza.">
        <div className="flex gap-1 items-start">
          <TextArea id="st-caption" rows={5} maxLength={2200} value={caption} onChange={(e) => setCaption(e.target.value)} />
          <DictateButton label="Dictar el texto del post" onText={(t) => setCaption((c) => appendText(c, t).slice(0, 2200))} />
        </div>
      </Field>
      <div>
        <p className="text-sm font-medium text-gray-700 mb-1.5">Hashtags</p>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {hashtags.map((t) => (
            <Badge key={t} tone="app">
              #{t}
              <button type="button" aria-label={`Quitar #${t}`} className="ml-0.5" onClick={() => setHashtags(hashtags.filter((x) => x !== t))}><X className="w-3 h-3" /></button>
            </Badge>
          ))}
        </div>
        <TextInput aria-label="Agregar hashtag" placeholder="Agregar hashtag y Enter" value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }} />
      </div>
    </div>
  );

  // ─── Video: mover los elementos en la vista previa (en pausa) ───
  // Se agarra lo que esté encima: botón, precio, textos, etiqueta, logo; luego el diseño de la prenda y
  // por último la prenda. La esquina del contorno agranda o achica lo elegido.
  type VTarget = { id: string; key: MoveKey | 'logo' | 'diseno' };
  const vdrag = useRef<null | {
    mode: 'move' | 'scale' | 'design'; t: VTarget; sx: number; sy: number; rw: number; rh: number;
    orig: ElemMove; rect: { x: number; y: number; w: number; h: number };
    span?: [number, number]; design?: SceneDesign; size?: number;
  }>(null);
  const [vsel, setVsel] = useState<VTarget | null>(null);
  const [vhover, setVhover] = useState<VTarget | null>(null);
  const [vlive, setVlive] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [, setVtick] = useState(0);
  const currentScene = () => effScenes[frameAt(scenes, endCard, timeRef.current).index] ?? null;
  const toCanvas = (e: { clientX: number; clientY: number }) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H, r };
  };
  const inRect = (p: { x: number; y: number }, b: { x: number; y: number; w: number; h: number }, pad = 10) => p.x >= b.x - pad && p.x <= b.x + b.w + pad && p.y >= b.y - pad && p.y <= b.y + b.h + pad;
  const rectOf = (t: VTarget) => {
    if (t.key === 'logo') return sceneElements('__video').logo ?? null;
    if (t.key === 'diseno') return photoSceneLayout(t.id)?.designRect ?? null;
    return sceneElements(t.id)[t.key] ?? null;
  };
  const moveOf = (t: VTarget): ElemMove => (t.key === 'logo' ? logoAt : t.key === 'diseno' ? null : scenes.find((x) => x.id === t.id)?.moves?.[t.key]) ?? { x: 0, y: 0, s: 1 };
  /** Qué hay bajo el puntero en la escena que se ve. */
  const hitVideo = (e: { clientX: number; clientY: number }): VTarget | null => {
    if (!isScenes || playing || !canvasRef.current) return null;
    const sc = currentScene();
    const p = toCanvas(e);
    if (sc) {
      const els = sceneElements(sc.id);
      for (const k of ['boton', 'precio', 'subtitulo', 'titulo', 'etiqueta'] as MoveKey[]) {
        const b2 = els[k];
        if (b2 && inRect(p, b2)) return { id: sc.id, key: k };
      }
    }
    if (showLogo) { const lb = sceneElements('__video').logo; if (lb && inRect(p, lb)) return { id: '__video', key: 'logo' }; }
    if (sc && sc.kind === 'foto' && sc.photoSource === 'plantilla' && sc.design) {
      const lay = photoSceneLayout(sc.id);
      if (lay?.designRect && inRect(p, lay.designRect, 18)) return { id: sc.id, key: 'diseno' };
    }
    if (sc) { const g2 = sceneElements(sc.id).prenda; if (g2 && inRect(p, g2, 0)) return { id: sc.id, key: 'prenda' }; }
    return null;
  };
  const startVideoDrag = (e: React.PointerEvent<HTMLElement>, t: VTarget, mode: 'move' | 'scale' | 'design') => {
    const rect = rectOf(t);
    if (!rect) return;
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    const { r } = toCanvas(e);
    const sc = scenes.find((x) => x.id === t.id);
    const eff = effScenes.find((x) => x.id === t.id);
    vdrag.current = {
      mode, t, sx: e.clientX, sy: e.clientY, rw: r.width, rh: r.height, orig: moveOf(t), rect,
      ...(mode === 'design' && eff ? { span: photoSceneLayout(t.id)?.span, design: eff.design ?? undefined, size: eff.size, orig: { x: eff.offsetX, y: eff.offsetY, s: 1 } } : {}),
    };
    if (t.id !== '__video' && sc) setSceneSel(t.id);
    setVsel(t);
    setVlive(rect);
  };
  const onVideoDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const t = hitVideo(e);
    if (!t) { setVsel(null); return; }
    startVideoDrag(e, t, t.key === 'diseno' ? 'design' : 'move');
  };
  const fit = (n: number, lim = 0.5) => { const c = Math.max(-lim, Math.min(lim, n)); return Math.abs(c) < 0.004 ? 0 : Math.round(c * 1000) / 1000; };
  const onVideoMove = (e: React.PointerEvent<HTMLElement>) => {
    const v = vdrag.current;
    if (!v) { setVhover(hitVideo(e)); return; }
    const dx = ((e.clientX - v.sx) / v.rw) * W, dy = ((e.clientY - v.sy) / v.rh) * H;
    if (v.mode === 'design') {
      if (!v.span) return;
      const id = v.t.id;
      setScenes(scenes.map((x) => (x.id === id ? { ...x, design: v.design ?? x.design, size: v.size ?? x.size, offsetX: fit(v.orig.x + dx / v.span![0]), offsetY: fit(v.orig.y + dy / v.span![1]) } : x)), `voff:${id}`);
      setVlive({ ...v.rect, x: v.rect.x + dx, y: v.rect.y + dy });
      return;
    }
    let next: ElemMove;
    if (v.mode === 'move') {
      next = { ...v.orig, x: fit(v.orig.x + dx / W, 1), y: fit(v.orig.y + dy / H, 1) };
      setVlive({ ...v.rect, x: v.rect.x + dx, y: v.rect.y + dy });
    } else {
      // Agrandar o achicar desde el centro, según cuánto se aleja el puntero.
      const cx = v.rect.x + v.rect.w / 2, cy = v.rect.y + v.rect.h / 2;
      const p0 = { x: v.rect.x + v.rect.w, y: v.rect.y + v.rect.h };
      const p1 = { x: p0.x + dx, y: p0.y + dy };
      const k = Math.hypot(p1.x - cx, p1.y - cy) / Math.max(1, Math.hypot(p0.x - cx, p0.y - cy));
      const s2 = Math.max(0.3, Math.min(3, Math.round(v.orig.s * k * 100) / 100));
      next = { ...v.orig, s: s2 };
      const f = s2 / v.orig.s;
      setVlive({ x: cx - (v.rect.w * f) / 2, y: cy - (v.rect.h * f) / 2, w: v.rect.w * f, h: v.rect.h * f });
    }
    if (v.t.key === 'logo') setLogoAt(next);
    else {
      const id = v.t.id, key = v.t.key as MoveKey;
      setScenes(scenes.map((x) => (x.id === id ? { ...x, moves: { ...x.moves, [key]: next } } : x)), `vmove:${id}:${key}`);
    }
  };
  const onVideoUp = () => {
    vdrag.current = null;
    setVlive(null);
    // El contorno toma la posición del cuadro ya dibujado.
    window.setTimeout(() => setVtick((t) => t + 1), 60);
  };
  const VLABEL: Record<VTarget['key'], string> = { prenda: 'Prenda', etiqueta: 'Etiqueta', titulo: 'Título', subtitulo: 'Subtítulo', precio: 'Precio', boton: 'Botón', logo: 'Logo', diseno: 'Diseño' };
  const vbox = vsel && !playing ? vlive ?? rectOf(vsel) : null;
  const vhoverBox = vhover && !playing && (!vsel || vhover.key !== vsel.key || vhover.id !== vsel.id) ? rectOf(vhover) : null;

  const canvasEl = (
    <div className={isScenes ? 'relative w-full h-full' : 'relative'} style={isScenes ? undefined : { maxWidth: previewWidth, width: '100%' }}>
      <canvas
        ref={canvasRef} width={W} height={H}
        className={isScenes ? 'block w-full h-full rounded-sm shadow-[0_12px_40px_rgb(0_0_0/0.18)] bg-white' : 'w-full h-auto rounded-xl ring-1 ring-gray-200 bg-gray-50'}
        aria-label="Vista previa de la pieza"
      />
      {isScenes && (
        <div
          className="absolute inset-0 touch-none" style={{ cursor: vhover ? 'grab' : 'default' }}
          onPointerDown={onVideoDown} onPointerMove={onVideoMove} onPointerUp={onVideoUp} onPointerCancel={onVideoUp} onPointerLeave={() => setVhover(null)}
          aria-label="Vista previa: con el video en pausa, arrastra la prenda, los textos, las etiquetas o el logo"
        >
          {vhoverBox && (
            <div className="absolute border border-dashed border-white/80 ring-1 ring-black/30 rounded-sm pointer-events-none"
              style={{ left: `${(vhoverBox.x / W) * 100}%`, top: `${(vhoverBox.y / H) * 100}%`, width: `${(vhoverBox.w / W) * 100}%`, height: `${(vhoverBox.h / H) * 100}%` }} />
          )}
          {vbox && vsel && (
            <div className="absolute ring-2 ring-app-500 rounded-sm pointer-events-none"
              style={{ left: `${(vbox.x / W) * 100}%`, top: `${(vbox.y / H) * 100}%`, width: `${(vbox.w / W) * 100}%`, height: `${(vbox.h / H) * 100}%` }}>
              <span className="absolute -top-6 left-0 rounded bg-app-600 px-1.5 py-0.5 text-[10px] leading-none text-white whitespace-nowrap">{VLABEL[vsel.key]}</span>
              {vsel.key !== 'diseno' && (
                <span
                  role="button" tabIndex={-1} title="Agrandar o achicar" aria-label="Agrandar o achicar"
                  className="absolute -right-2 -bottom-2 w-4 h-4 rounded-sm bg-white ring-2 ring-app-500 cursor-nwse-resize pointer-events-auto"
                  onPointerDown={(e) => { e.stopPropagation(); startVideoDrag(e, vsel, 'scale'); }}
                  onPointerMove={onVideoMove} onPointerUp={onVideoUp} onPointerCancel={onVideoUp}
                />
              )}
            </div>
          )}
        </div>
      )}
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-white/85 text-sm text-gray-600 text-center px-6">
          {isScenes ? 'Completa las escenas: cada foto necesita su producto, cada clip su video y cada escena 3D una prenda con modelo 3D' : 'Elige qué promocionar para ver la pieza'}
        </div>
      )}
      {busy && isVideo && progress > 0 && (
        <div className="absolute inset-x-0 bottom-0 p-3">
          <div className="h-2 rounded-full bg-black/30 overflow-hidden"><div className="h-full bg-app-500" style={{ width: `${Math.round(progress * 100)}%` }} /></div>
          <p className="text-xs text-white text-center mt-1 drop-shadow">Exportando el video… {Math.round(progress * length)} de {Math.round(length)} s</p>
        </div>
      )}
      {busy && isVideo && progress === 0 && (
        <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/40 text-white"><Spinner label="Preparando las escenas…" /></div>
      )}
    </div>
  );

  const exportButtons = (
    <>
      <Button size={isScenes || isDesign ? 'sm' : 'md'} variant="secondary" icon={<Download className="w-4 h-4" />} disabled={!ready || !!busy} isLoading={busy === 'download'} onClick={download}>{isScenes ? 'Exportar' : 'Descargar'}</Button>
      <Button size={isScenes || isDesign ? 'sm' : 'md'} variant="outline" icon={<Save className="w-4 h-4" />} disabled={!ready || !!busy} isLoading={busy === 'save'} onClick={() => onSave(false)} className={isScenes || isDesign ? 'bg-white' : ''}>Guardar en la biblioteca</Button>
      <Button size={isScenes || isDesign ? 'sm' : 'md'} icon={<Send className="w-4 h-4" />} disabled={!ready || !!busy} isLoading={busy === 'publish'} onClick={() => onSave(true)}>Publicar o programar</Button>
    </>
  );

  /** Dos maniquíes 3D fuera de pantalla (se turnan las escenas 3D); se copian cuadro a cuadro al lienzo. */
  const mannequins = isScenes && [holder3d, holder3dB].map((holder, k) => {
    const view = slotViews[k];
    return (
      <div key={k} ref={holder} aria-hidden="true" style={{ position: 'fixed', left: -10000 - k * 600, top: 0, width: 540, height: 960, pointerEvents: 'none' }}>
        {view && (
          <Suspense fallback={null}>
            <Mannequin3D
              model={view.model} color={view.sc.color} art={view.art} frames={view.frames} focus="front"
              still recordable motionRef={k === 0 ? motionA : motionB} stage={view.sc.bg && stage3d ? { ...stage3d, bare: true } : stage3d}
              onReady={() => { loadedModels.current.add(view.model); }}
            />
          </Suspense>
        )}
      </div>
    );
  });

  // ─── Proyectos: el trabajo se guarda solo y se puede volver a abrir ─────────
  const [params, setParams] = useSearchParams();
  const [project, setProject] = useState<{ id: number; name: string } | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [recent, setRecent] = useState<StudioProjectSummary[]>([]);
  const [nameDraft, setNameDraft] = useState<string | null>(null);
  /** Lo ya subido (data: o blob: → dirección del archivo), para no subirlo otra vez. */
  const assetCache = useRef(new Map<string, string>());
  /** Lo último guardado (para no guardar si nada cambió). */
  const lastSaved = useRef('');
  /** Abriendo un proyecto: lo que el estudio reacomoda en ese momento no cuenta como cambio. */
  const applying = useRef(false);
  const saving = useRef<Promise<void> | null>(null);
  const projectRef = useRef(project);

  const snapshot = () => ({
    v: 1, sourceType, selected, format, template, stage, ratio, showLogo, logoAt, endCard, sfxOn, sfxVolume, narrator,
    music: music ? { name: music.name, url: music.url, offset: music.offset, volume: music.volume } : null,
    design, photos, scenes: scenes.map((sc) => (sc.clip ? { ...sc, clip: { ...sc.clip, thumb: null } } : sc)),
    title, subtitle, cta, showPrice, caption, hashtags, tone, brief,
    photoPicks, garmentPlans, garmentColors, showcase, storyId: storyId.current,
  });
  /** Nombre del proyecto nuevo: lo que se muestra y el tipo de pieza. */
  const autoName = () => {
    const what = (selected[0] as { name?: string } | undefined)?.name || title.trim() || 'Proyecto';
    const more = selected.length > 1 && sourceType === 'producto' ? ` y ${selected.length - 1} más` : '';
    return `${what}${more} · ${format === 'post' || format === 'historia' ? 'Post' : 'Video'}`;
  };
  const meta: { format: ProjectFormat; source: string; template: string } = {
    format: format === 'video360' ? 'video360' : format === 'reel' ? 'reel' : 'post',
    source: sourceType, template: format === 'post' || format === 'historia' ? design.template : template,
  };
  /** ¿Hay algo que valga guardar? (se eligió qué mostrar o se editó algo). */
  const worth = selected.length > 0 || designEdited.current || edited.current || !!title.trim();
  // Lo último de cada render, para guardar desde los temporizadores.
  const live = useRef({ snapshot, autoName, meta, worth });
  useEffect(() => { live.current = { snapshot, autoName, meta, worth }; });

  /** Guarda ya (si hay cambios). El proyecto se crea solo con el primer cambio que vale la pena. */
  const saveNow = useCallback(async () => {
    if (applying.current) return;
    if (saving.current) await saving.current;
    const cur = live.current;
    const snap = cur.snapshot();
    const raw = JSON.stringify(snap);
    if (raw === lastSaved.current || (!projectRef.current && !cur.worth)) return;
    const run = (async () => {
      setSaveState('saving');
      try {
        const data = await persistLocal(snap, assetCache.current, marketingService.projectAsset);
        const thumb = thumbOf(document.querySelector<HTMLCanvasElement>('canvas[aria-label="Vista previa de la pieza"]'));
        const body = { ...cur.meta, data, ...(thumb ? { thumb } : {}) };
        if (projectRef.current) {
          await marketingService.saveProject(projectRef.current.id, body);
        } else {
          const p = await marketingService.createProject({ name: cur.autoName(), ...body });
          projectRef.current = { id: p.id, name: p.name };
          setProject(projectRef.current);
          setParams((sp) => { sp.set('proyecto', String(p.id)); return sp; }, { replace: true });
        }
        lastSaved.current = raw;
        setSavedAt(new Date().toISOString());
        setSaveState('saved');
      } catch {
        setSaveState('error');
      }
    })();
    saving.current = run;
    await run;
    saving.current = null;
  }, [setParams]);

  // Guardado automático: un momento después del último cambio.
  useEffect(() => {
    const t = window.setTimeout(() => { void saveNow(); }, 2500);
    return () => window.clearTimeout(t);
  }, [saveNow, sourceType, selected, format, template, stage, ratio, showLogo, logoAt, endCard, sfxOn, sfxVolume, narrator, music, design, photos, scenes,
    title, subtitle, cta, showPrice, caption, hashtags, tone, brief, photoPicks, garmentPlans, garmentColors, showcase]);
  // Al salir de la pestaña o del estudio, se guarda lo pendiente.
  useEffect(() => {
    const flush = () => { if (document.visibilityState === 'hidden') void saveNow(); };
    document.addEventListener('visibilitychange', flush);
    return () => { document.removeEventListener('visibilitychange', flush); void saveNow(); };
  }, [saveNow]);

  /** Marca lo actual como guardado cuando el estudio terminó de reacomodarse. */
  const settle = (ms: number) => window.setTimeout(() => { lastSaved.current = JSON.stringify(live.current.snapshot()); applying.current = false; }, ms);

  /** Deja el estudio como lo dejó el proyecto. */
  const applyProject = (id: number, name: string, d: Record<string, unknown>) => {
    applying.current = true;
    const g = <T,>(k: string, def: T): T => (d[k] === undefined || d[k] === null ? def : (d[k] as T));
    setSourceType(g<SourceType>('sourceType', 'producto'));
    setQ('');
    setSelected(g<AnySource[]>('selected', []));
    setFormat(g<Format>('format', 'post'));
    setTemplate(g<TemplateId>('template', 'destacado'));
    setStage(g<'claro' | 'oscuro'>('stage', 'oscuro'));
    setRatio(g<VideoRatio>('ratio', '9:16'));
    setShowLogo(g('showLogo', true));
    setLogoAt(g<ElemMove | null>('logoAt', null));
    setEndCard(g('endCard', true));
    setSfxOn(g('sfxOn', true));
    setSfxVolume(g('sfxVolume', 0.7));
    setNarrator(g<NarratorSettings>('narrator', { mode: 'ia', voice: 'es-CO-SalomeNeural', rate: 0, volume: 1, duck: true }));
    designEdited.current = true;
    designReset(g<Design>('design', buildDesign('destacado', '1:1')));
    setPhotos(g<SceneProduct[]>('photos', []));
    // Los clips de video propios no se guardan (pesan y viven en este navegador).
    const sc = g<Scene[]>('scenes', []).map((x) => (x.clip ? { ...x, clip: null } : x));
    edited.current = sc.length > 0;
    histReset(sc);
    setSceneSel(sc[0]?.id ?? null);
    storyId.current = g<StoryboardId | null>('storyId', null);
    setTitle(g('title', '')); setSubtitle(g('subtitle', '')); setCta(g('cta', 'Compra ya')); setShowPrice(g('showPrice', true));
    setCaption(g('caption', '')); setHashtags(g<string[]>('hashtags', [])); setTone(g<CopyTone>('tone', 'cercano')); setBrief(g('brief', ''));
    setPhotoPicks(g<Record<number, string[]>>('photoPicks', {})); setGarmentPlans(g<Record<number, GarmentPlan>>('garmentPlans', {}));
    setGarmentColors(g<Record<number, string>>('garmentColors', {})); setShowcase(g<string[] | null>('showcase', null));
    setSkipOnboarding(true);
    setPlaying(false);
    setMedia([]);
    setMusic(null);
    projectRef.current = { id, name };
    setProject(projectRef.current);
    setSaveState('saved');
    setSavedAt(null);
    setParams((sp) => { sp.set('proyecto', String(id)); return sp; }, { replace: true });
    const m = d.music as { name: string; url: string; offset: number; volume: number } | null | undefined;
    if (m?.url) {
      fetch(m.url).then((r) => r.blob()).then(decodeAudio).then((buffer) => setMusic({ ...m, buffer })).catch(() => toast.error('No se pudo cargar la música del proyecto'));
    }
    settle(2000);
  };

  const openProject = async (id: number) => {
    setProjectsOpen(false);
    await saveNow();
    try {
      const p = await marketingService.project(id);
      applyProject(p.id, p.name, p.data);
      toast.success(`Abriste "${p.name}"`);
    } catch (e) {
      toast.error(errorMessage(e, 'No se pudo abrir el proyecto'));
      setParams((sp) => { sp.delete('proyecto'); return sp; }, { replace: true });
    }
  };

  /** Proyecto nuevo: el estudio vacío (lo anterior ya quedó guardado). */
  const newProject = async () => {
    setProjectsOpen(false);
    await saveNow();
    applying.current = true;
    projectRef.current = null;
    setProject(null);
    setSaveState('idle');
    setSavedAt(null);
    setSourceType('producto'); setQ(''); setSelected([]); setTemplate('destacado');
    setLogoAt(null); setMusic(null); setMedia([]);
    designEdited.current = false;
    designReset(buildDesign('destacado', '1:1'));
    edited.current = false;
    storyId.current = null;
    histReset([]);
    setSceneSel(null);
    setPhotos([]);
    setTitle(''); setSubtitle(''); setCta('Compra ya'); setCaption(''); setHashtags([]); setBrief('');
    setPhotoPicks({}); setGarmentPlans({}); setGarmentColors({}); setShowcase(null);
    setSkipOnboarding(false);
    setParams((sp) => { sp.delete('proyecto'); return sp; }, { replace: true });
    settle(1000);
  };

  const renameProject = async (name: string) => {
    setNameDraft(null);
    const clean = name.trim();
    if (!project || !clean || clean === project.name) return;
    try {
      const r = await marketingService.saveProject(project.id, { name: clean });
      projectRef.current = { id: project.id, name: r.name };
      setProject(projectRef.current);
    } catch (e) {
      toast.error(errorMessage(e, 'No se pudo cambiar el nombre'));
    }
  };

  // Al entrar: el proyecto de la dirección (al recargar se sigue con el mismo).
  const openedFromUrl = useRef(false);
  useEffect(() => {
    const id = Number(params.get('proyecto'));
    if (id > 0 && !openedFromUrl.current) { openedFromUrl.current = true; void openProject(id); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Los recientes, para el inicio del estudio.
  useEffect(() => {
    if (project || selected.length) return;
    let alive = true;
    marketingService.projects().then((r) => { if (alive) setRecent(r.slice(0, 4)); }).catch(() => { /* sin recientes */ });
    return () => { alive = false; };
  }, [project, selected.length]);

  const projectBar = (
    <div className="flex items-center gap-1 min-w-0">
      <button type="button" onClick={() => setProjectsOpen(true)} title="Proyectos" aria-label="Proyectos"
        className="grid place-items-center w-9 h-9 rounded-lg text-gray-600 hover:bg-gray-100 flex-shrink-0"><FolderOpen className="w-4 h-4" /></button>
      {project && nameDraft !== null ? (
        <input autoFocus value={nameDraft} maxLength={120} aria-label="Nombre del proyecto"
          onChange={(e) => setNameDraft(e.target.value)} onBlur={(e) => void renameProject(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setNameDraft(null); }}
          className="h-8 w-52 rounded-md border border-app-300 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-app-200" />
      ) : project ? (
        <button type="button" onClick={() => setNameDraft(project.name)} title="Cambiar el nombre"
          className="max-w-[220px] truncate rounded-md px-2 h-8 text-sm font-medium text-gray-800 hover:bg-gray-100">{project.name}</button>
      ) : (
        <span className="px-2 text-sm text-gray-500 whitespace-nowrap">Proyecto nuevo</span>
      )}
      <span className="hidden lg:flex items-center gap-1 text-xs text-gray-500 whitespace-nowrap" role="status" aria-live="polite">
        {saveState === 'saving' && <><Loader2 className="w-3.5 h-3.5 animate-spin" />Guardando…</>}
        {saveState === 'saved' && <span className="flex items-center gap-1" title={savedAt ? `Guardado ${ago(savedAt)}` : undefined}><Check className="w-3.5 h-3.5 text-green-600" />Guardado</span>}
        {saveState === 'error' && (
          <button type="button" onClick={() => void saveNow()} className="flex items-center gap-1 text-red-600 hover:underline"><CloudOff className="w-3.5 h-3.5" />No se guardó. Reintentar</button>
        )}
      </span>
    </div>
  );

  const studioExtras = (
    <>
      {mannequins}
      {garmentOpen && (
        <GarmentViewsDialog
          onClose={() => setGarmentOpen(false)}
          onUse={isDesign ? (views) => setPhotos((p) => [...views.map((v, i) => ({ id: -Date.now() - i, name: v.label, image: v.url })), ...p]) : undefined}
          onTemplateCreated={reloadTemplates}
        />
      )}
      {captureJob && captureArt && (
        <div aria-hidden="true" style={{ position: 'fixed', left: -12000, top: 0, width: 800, height: 800, pointerEvents: 'none' }}>
          <Suspense fallback={null}>
            <Mannequin3D
              key={captureJob.model} model={captureJob.model} color={captureJob.color} art={captureArt.art} frames={captureArt.frames}
              focus={captureJob.view3d} still locked recordable handleRef={captureHandle} onReady={() => onCaptureReady(captureJob)}
            />
          </Suspense>
        </div>
      )}

      {aiAccountsOpen && (
        <Dialog open onClose={() => setAiAccountsOpen(false)} size="lg" title="Cuentas de IA" description="Las cuentas que crean imágenes, voces y textos, y su cuota de hoy.">
          <AiAccountsCard />
        </Dialog>
      )}
      {projectsOpen && <ProjectsDialog currentId={project?.id ?? null} onOpen={(p) => void openProject(p.id)} onNew={() => void newProject()} onClose={() => setProjectsOpen(false)} />}
      {publishFor && <PublishDialog creative={publishFor} caption={caption} hashtags={hashtags} onClose={() => setPublishFor(null)} onDone={() => { setPublishFor(null); navigate('/messaging/calendar'); }} />}
    </>
  );

  const modeSwitch = (
    <>
      {projectBar}
      <ToolbarSep />
      <StudioModeSwitch
        value={format === 'video360' ? 'video360' : 'post'}
        onChange={(v) => { setFormat(v as Format); setPlaying(v === 'video360'); }}
        options={[{ value: 'post', label: 'Post', icon: ImageIcon }, { value: 'video360', label: 'Video', icon: Film }]}
      />
    </>
  );
  const studioMenu = (
    <ActionMenu
      trigger={<button type="button" title="Más opciones" aria-label="Más opciones" className="grid place-items-center w-9 h-9 rounded-lg text-gray-600 hover:bg-gray-100"><MoreVertical className="w-4 h-4" /></button>}
      items={[
        { label: 'Proyectos', icon: <FolderOpen className="w-4 h-4" />, onClick: () => setProjectsOpen(true) },
        { label: 'Nuevo proyecto', icon: <FilePlus2 className="w-4 h-4" />, onClick: () => void newProject() },
        { label: 'Marca', icon: <Palette className="w-4 h-4" />, onClick: () => navigate('/messaging/brand') },
        { label: 'Calendario y biblioteca', icon: <CalendarClock className="w-4 h-4" />, onClick: () => navigate('/messaging/calendar') },
        { label: 'Cuentas de IA', icon: <Sparkles className="w-4 h-4" />, onClick: () => setAiAccountsOpen(true) },
      ]}
    />
  );
  const hasSubject = selected.length > 0;
  /** Qué se muestra (para recomendar sus plantillas). */
  const content: ContentKind | undefined = !hasSubject ? undefined
    : sourceType === 'plantilla' ? 'personalizable' : sourceType === 'producto' ? (items.length > 1 ? 'varios' : 'producto') : sourceType;
  /** Primer paso: qué se va a mostrar (todo lo demás se arma con eso). */
  const onboarding = !hasSubject && !skipOnboarding ? (
    <div className="w-full max-w-xl rounded-2xl bg-white border border-gray-200 shadow-xl p-6">
      <h2 className="text-lg font-semibold text-gray-900">¿Qué vas a mostrar?</h2>
      <p className="text-sm text-gray-500 mt-1">Elige y el estudio arma {isScenes ? 'el video' : 'la pieza'} con tus productos, sus fotos y tu marca. Todas las plantillas se adaptan.</p>
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
        {START_OPTIONS.map((o) => {
          const Icon = o.icon;
          return (
            <button key={o.value} type="button" onClick={() => { changeSource(o.value); setPanelReq((n) => n + 1); }}
              className="flex items-start gap-3 rounded-xl border border-gray-200 p-3 text-left hover:border-app-300 hover:bg-app-50/40 transition-colors">
              <span className="grid place-items-center w-9 h-9 rounded-lg bg-app-50 text-app-700 flex-shrink-0"><Icon className="w-5 h-5" /></span>
              <span><span className="block text-sm font-medium text-gray-900">{o.label}</span><span className="block text-xs text-gray-500 mt-0.5">{o.hint}</span></span>
            </button>
          );
        })}
      </div>
      <button type="button" onClick={() => setSkipOnboarding(true)} className="mt-4 text-sm text-app-700 hover:underline">Empezar sin producto (solo con plantillas y textos)</button>
      {recent.length > 0 && (
        <div className="mt-5 pt-4 border-t border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-900">O sigue con un proyecto</h3>
            <button type="button" onClick={() => setProjectsOpen(true)} className="text-xs text-app-700 hover:underline">Ver todos</button>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {recent.map((p) => (
              <button key={p.id} type="button" onClick={() => void openProject(p.id)} aria-label={`Abrir ${p.name}`}
                className="rounded-lg border border-gray-200 overflow-hidden text-left hover:border-app-300">
                <span className="block aspect-square bg-gray-100">{p.thumb && <img src={p.thumb} alt="" className="w-full h-full object-contain" />}</span>
                <span className="block px-1.5 py-1">
                  <span className="block text-[11px] font-medium text-gray-800 truncate">{p.name}</span>
                  <span className="block text-[10px] text-gray-500 truncate">{ago(p.updatedAt)}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  ) : null;

  if (isDesign || isScenes) {
    return (
      <>
        {isDesign ? (
          <DesignEditor
            modeSwitch={modeSwitch} menu={studioMenu} onboarding={onboarding} hasSubject={hasSubject} panelReq={panelReq} content={content}
            resolve={resolveFn} onMoveDesign={(zoneId, offset) => setZoneChoice(zoneId, { offset })}
            design={design} onChange={setDesign} onTemplate={(d) => { designEdited.current = false; designReset(layoutZones(d, subject), true); }} data={designData}
            history={{ undo: designHist.undo, redo: designHist.redo, canUndo: designHist.canUndo, canRedo: designHist.canRedo }}
            sourcePanel={sourcePanel} publishPanel={textsPanel} exportActions={exportButtons}
            products={items.map(toSceneProduct)} photos={photos} onPhotos={setPhotos} onRatio={changeDesignRatio}
            mockTemplates={mockTemplates} defaultMockTemplate={defaultMockTemplate} onGarment={() => setGarmentOpen(true)}
          />
        ) : (
          <VideoEditor
            modeSwitch={modeSwitch} menu={studioMenu} onboarding={onboarding} hasSubject={hasSubject} size={[W, H]} panelReq={panelReq} content={content}
            logoMoved={!!logoAt} onResetLogo={() => setLogoAt(null)}
            palette={brand ? [
              { label: 'Principal', hex: brand.primary }, { label: 'Acento', hex: brand.accent }, { label: 'Claro', hex: brand.paper },
              ...(brand.secondary ? [{ label: 'Secundario', hex: brand.secondary }] : []), { label: 'Blanco', hex: '#FFFFFF' }, { label: 'Negro', hex: '#000000' },
            ] : []}
            preview={canvasEl} sourcePanel={sourcePanel} publishPanel={textsPanel} exportActions={exportButtons}
            info={<>{W}×{H} · {(videoMime(!!music) ?? '').includes('mp4') ? 'MP4' : 'WEBM'}{music ? ' · con música' : ''}</>}
            playing={playing} onTogglePlay={() => setPlaying((p) => !p)} timecodeRef={timecodeRef} timeRef={timeRef}
            scenes={scenes} onChange={setScenes} selectedId={sceneSel} onSelect={setSceneSel}
            endCard={endCard} onEndCard={setEndCard} logo={showLogo} onLogo={setShowLogo} ratio={ratio} onRatio={setRatio} stage={stage} onStage={setStage}
            templates={templates3d} defaultTemplate={defaultTemplate} photoTemplates={photoTemplates} products={sceneProducts} story={story} onStoryboard={applyStoryboard}
            playheadRef={playheadRef} onPreview={previewScene} onSeek={seek}
            history={{ undo: sceneHist.undo, redo: sceneHist.redo, canUndo: sceneHist.canUndo, canRedo: sceneHist.canRedo }}
            music={music} onMusic={setMusic} onAiScenes={() => writeWithAi(true)} aiBusy={writing === 'scenes'}
            media={media} onMedia={setMedia}
            sfxOn={sfxOn} onSfxOn={setSfxOn} sfxVolume={sfxVolume} onSfxVolume={setSfxVolume} onAskAdvice={askAdvice}
            narration={narration} prompter={prompter}
          />
        )}
        {studioExtras}
      </>
    );
  }

  return (
    <Page className="max-w-7xl mx-auto">
      <PageHeader
        icon={Wand2}
        title="Estudio de contenido"
        subtitle={isScenes ? 'Videos para reels, historias y posts: plantillas, prendas en 3D, fotos de tus colecciones, tus clips, textos animados, transiciones y música.' : 'Posts e historias: plantillas listas y cada elemento editable, con tu marca y tus productos.'}
        actions={(
          <>
            <Button variant="ghost" icon={<Palette className="w-4 h-4" />} onClick={() => navigate('/messaging/brand')}>Marca</Button>
            <Button variant="secondary" icon={<CalendarClock className="w-4 h-4" />} onClick={() => navigate('/messaging/calendar')}>Calendario y biblioteca</Button>
          </>
        )}
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <RadioGroup
          variant="segmented" value={format}
          onChange={(v) => { setFormat(v); setPlaying(v === 'reel' || v === 'video360'); }}
          options={FORMATS}
        />
        <p className="text-sm text-gray-500">{isScenes ? 'Reel, historia o post de video: elige el formato arriba en el editor.' : 'Post cuadrado, post vertical o historia: elige el formato arriba en el diseñador.'}</p>
      </div>

      {(
        <div className="grid grid-cols-1 xl:grid-cols-[320px_minmax(0,1fr)_360px] gap-5 items-start">
          <Card>
            <CardTitle>1. Qué promocionas</CardTitle>
            {sourcePanel}
          </Card>
          <Card>
            <CardTitle>2. Diseño</CardTitle>
            <div className="flex flex-wrap gap-1.5">
              {TEMPLATES.map((t) => (
                <button
                  key={t.id} type="button" title={t.hint} onClick={() => setTemplate(t.id)} aria-pressed={template === t.id}
                  className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${template === t.id ? 'border-app-600 text-app-700 bg-app-50 font-medium' : 'border-gray-200 text-gray-600 hover:border-app-300'}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="mt-4 flex justify-center">{canvasEl}</div>
            {isVideo && (
              <div className="mt-3 flex flex-wrap items-center justify-center gap-3 text-sm text-gray-600">
                <Button size="sm" variant="secondary" icon={playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />} onClick={() => setPlaying((p) => !p)} disabled={!ready || !!busy}>
                  {playing ? 'Pausar' : 'Reproducir'}
                </Button>
                <span className="inline-flex items-center gap-1"><Film className="w-4 h-4" />{Math.round(length)} s · {W}×{H} · {(videoMime() ?? '').includes('mp4') ? 'MP4' : 'WEBM'}</span>
              </div>
            )}
            <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-gray-100 pt-4">{exportButtons}</div>
          </Card>
          <Card>
            <CardTitle>3. Textos</CardTitle>
            {textsPanel}
          </Card>
        </div>
      )}

      {studioExtras}
    </Page>
  );
};

/** Publicar ya o programar una pieza en Facebook y/o Instagram. */
export function PublishDialog({ creative, caption, hashtags, onClose, onDone }: {
  creative: Creative; caption: string; hashtags: string[]; onClose: () => void; onDone: () => void;
}) {
  const [fb, setFb] = useState(true);
  const [ig, setIg] = useState(true);
  const [when, setWhen] = useState<'now' | 'later'>('now');
  const [at, setAt] = useState(() => {
    const d = new Date(Date.now() + 60 * 60 * 1000);
    d.setMinutes(0, 0, 0);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  });
  const [text, setText] = useState(() => {
    const tags = hashtags.length ? '\n\n' + hashtags.map((t) => '#' + t).join(' ') : '';
    return (caption || creative.caption || '') + tags;
  });
  const [sending, setSending] = useState(false);
  const isVideo = creative.mediaType === 'video';

  const send = async () => {
    const platforms = [fb && 'facebook', ig && 'instagram'].filter(Boolean) as Array<'facebook' | 'instagram'>;
    if (!platforms.length) { toast.error('Elige al menos una red'); return; }
    setSending(true);
    try {
      const posts = await marketingService.publish({
        creativeIds: [creative.id], platforms, caption: text,
        scheduledAt: when === 'later' ? new Date(at).toISOString() : null,
      });
      const failed = posts.filter((p) => p.status === 'failed');
      if (failed.length) toast.error(`No se pudo publicar en ${failed.map((p) => p.platform).join(' y ')}: ${failed[0].error}`);
      else toast.success(when === 'later' ? 'Publicación programada' : 'Publicado');
      onDone();
    } catch (e) {
      toast.error(errorMessage(e, 'No se pudo publicar'));
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog
      open onClose={() => !sending && onClose()} title="Publicar o programar"
      description={`${creative.title} · ${isVideo ? 'video' : creative.kind === 'historia' ? 'historia' : 'imagen'}`}
      size="lg"
      footer={(
        <FormActions>
          <Button variant="secondary" onClick={onClose} disabled={sending}>Cancelar</Button>
          <Button icon={when === 'later' ? <CalendarClock className="w-4 h-4" /> : <Send className="w-4 h-4" />} isLoading={sending} onClick={send}>
            {when === 'later' ? 'Programar' : 'Publicar ahora'}
          </Button>
        </FormActions>
      )}
    >
      <div className="grid grid-cols-1 sm:grid-cols-[180px_minmax(0,1fr)] gap-4">
        <div className="rounded-xl overflow-hidden bg-gray-100 ring-1 ring-gray-200">
          {isVideo ? <video src={creative.media} className="w-full" muted autoPlay loop playsInline /> : <img src={creative.media} alt="" className="w-full" />}
        </div>
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700">Dónde</p>
            <Checkbox checked={fb} onChange={(e) => setFb(e.target.checked)} label="Facebook (página)" description={creative.kind === 'historia' && isVideo ? 'Facebook no permite historias de video por API.' : undefined} />
            <Checkbox checked={ig} onChange={(e) => setIg(e.target.checked)} label="Instagram" description={isVideo ? 'Sale como reel.' : creative.kind === 'historia' ? 'Sale como historia.' : undefined} />
          </div>
          <div className="space-y-2">
            <RadioGroup variant="segmented" value={when} onChange={setWhen} options={[{ value: 'now', label: 'Ahora' }, { value: 'later', label: 'Programar' }]} />
            {when === 'later' && <TextInput type="datetime-local" aria-label="Fecha y hora" value={at} onChange={(e) => setAt(e.target.value)} />}
          </div>
          <Field label="Texto" htmlFor="pd-text"><TextArea id="pd-text" rows={6} maxLength={2200} value={text} onChange={(e) => setText(e.target.value)} /></Field>
        </div>
      </div>
    </Dialog>
  );
}
