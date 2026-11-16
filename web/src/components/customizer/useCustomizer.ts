/**
 * Estado y acciones del estudio de personalización. La página y los componentes solo
 * pintan lo que devuelve este hook; la lógica pura vive en customizerModel.
 */
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { templatesService, type Template } from '../../services/templates.service';
import { templateZonesService } from '../../services/template-zones.service';
import { templateRecipesService } from '../../services/template-recipes.service';
import { customizerService } from '../../services/customizer.service';
import { useCart } from '../../context/CartContext';
import toast from '../../lib/toast';
import type { CustomizedProduct } from '../../types/design';
import {
  blockedZonesOf, buildCustomizedProduct, buildViews, buildZones, canonicalView, fitSize, localQuote, missingRequiredZones,
  printZonesOf, resolveViewImage, restoreDesigns, usedZoneIds, zoneCenter,
  type Quote, type StudioDesign, type StudioView, type StudioZone,
} from './customizerModel';
import { initialStudioState, studioReducer, type DesignPatch } from './studioReducer';
import { DEFAULT_TEXT, measureText, textImage, type TextSpec } from '../../lib/textArt';
import { composeNamed, defaultValues, namedLabel, type NamedDesign } from '../../lib/namedDesign';
import { fitBox, loadImg, newId as layerId, type DLayer, type EditorData } from '../admin/designStudio/model';
import type { StudioResult } from '../admin/designStudio/DesignStudio';
import { prepareGarment, renderMockup, silhouetteGarment, type Garment } from './garment';
import { processDesignFile, type ProcessedDesignImage } from './designImage';
import { assetUrl } from '../../utils/assetUrl';
import type { DesignImage } from '../../services/design-images.service';
import { exportDesignsZip } from './designExport';
import { isModel3D, view3DOf, type Model3D } from '../mannequin/models';
import { useModels3D } from '../mannequin/useModels3D';
import type { Mannequin3DHandle } from '../mannequin/Mannequin3D';

export type AddedImage = Pick<ProcessedDesignImage, 'preview' | 'original' | 'fileName' | 'fileSize' | 'width' | 'height'>;

/** Diseño con nombre listo para la prenda (la imagen con lo escrito en cada texto). */
export const namedFrom = (img: DesignImage, values?: Record<string, string>): NamedDesign => ({
  designId: img.id, name: img.name, base: img.printUrl || img.thumbnailUrl, fields: img.textFields ?? [],
  values: { ...defaultValues(img.textFields ?? []), ...values },
});

const newId = () => `d-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export function useCustomizer() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { addCustomizedProduct, updateCustomizedProduct, getCartItemById } = useCart();

  // Maniquíes generados en el admin: hasta que llegan, la plantilla no sabe si es 3D.
  const models3dReady = useModels3D();
  const templateParam = Number(params.get('template')) || null;
  const editId = params.get('edit');

  // ── Modelos ──
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [template, setTemplate] = useState<Template | null>(null);
  const [rawZonesReady, setRawZonesReady] = useState(false);
  const [zones, setZones] = useState<StudioZone[]>([]);
  const [views, setViews] = useState<StudioView[]>([]);

  // ── Opciones ──
  const [colorId, setColorId] = useState<number | null>(null);
  const [sizeId, setSizeId] = useState<number | null>(null);
  const [view, setView] = useState<string | null>(null);
  const [activeZoneByView, setActiveZoneByView] = useState<Record<string, number>>({});
  const [quantity, setQuantity] = useState(1);

  // ── Diseños ──
  const [studio, dispatch] = useReducer(studioReducer, initialStudioState);

  // ── Derivados del servidor ──
  const [stock, setStock] = useState<number | null>(null);
  const [loadingStock, setLoadingStock] = useState(false);
  const [serverQuote, setServerQuote] = useState<Quote | null>(null);
  const [garments, setGarments] = useState<Record<string, Garment>>({});
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const editLoadedRef = useRef<string | null>(null);
  // Maniquí 3D (si la plantilla tiene uno): el lienzo es su escenario cuadrado y las vistas previas
  // del carrito son fotos del 3D.
  const mannequinRef = useRef<Mannequin3DHandle | null>(null);

  const editItem = useMemo(() => {
    if (!editId) return null;
    const item = getCartItemById(editId);
    return item && item.type === 'customized' ? item : null;
  }, [editId, getCartItemById]);
  const isEditMode = !!editItem;

  // Cargar los modelos públicos.
  useEffect(() => {
    let alive = true;
    templatesService.getPublicTemplates()
      .then((list) => alive && setTemplates(Array.isArray(list) ? list : []))
      .catch(() => alive && setTemplates([]))
      .finally(() => alive && setLoadingTemplates(false));
    return () => { alive = false; };
  }, []);

  // Modelo elegido: por ?template= o por el ítem del carrito que se edita.
  const wantedTemplateId = editItem?.customizedProduct.templateId ?? templateParam;
  useEffect(() => {
    if (!wantedTemplateId) { setTemplate(null); return; }
    if (template?.id === wantedTemplateId) return;
    const fromList = templates.find((t) => t.id === wantedTemplateId);
    if (fromList) { setTemplate(fromList); return; }
    if (loadingTemplates) return;
    let alive = true;
    templatesService.getTemplateById(wantedTemplateId)
      .then((t) => alive && setTemplate(t))
      .catch(() => { if (alive) { toast.error('Ese modelo ya no está disponible'); setParams({}, { replace: true }); } });
    return () => { alive = false; };
  }, [wantedTemplateId, templates, loadingTemplates, template?.id, setParams]);

  // Zonas del modelo (una sola petición).
  useEffect(() => {
    setRawZonesReady(false);
    setZones([]);
    setViews([]);
    setGarments({});
    if (!template) return;
    let alive = true;
    templateZonesService.getByTemplateId(template.id)
      .then((raw) => {
        if (!alive) return;
        setZones(buildZones(raw));
        setViews(buildViews(raw));
      })
      .catch(() => alive && toast.error('No se pudieron cargar las zonas del modelo'))
      .finally(() => alive && setRawZonesReady(true));
    return () => { alive = false; };
  }, [template]);

  // Color y talla por defecto, o los del ítem que se edita; restaura diseños y cantidad.
  useEffect(() => {
    if (!template || !rawZonesReady) return;
    const cp = editItem?.customizedProduct;
    if (cp && editLoadedRef.current !== editItem!.id) {
      editLoadedRef.current = editItem!.id;
      const c = template.colors?.find((x) => x.id === cp.colorId) || template.colors?.find((x) => x.hexCode?.toLowerCase() === cp.selectedColor?.toLowerCase());
      const s = template.sizes?.find((x) => x.id === cp.sizeId) || template.sizes?.find((x) => x.abbreviation === cp.selectedSize || x.name === cp.selectedSize);
      setColorId(c?.id ?? template.colors?.[0]?.id ?? null);
      setSizeId(s?.id ?? null);
      setQuantity(editItem!.quantity || 1);
      const restored = restoreDesigns(cp.designs, zones, views);
      dispatch({ type: 'load', designs: restored });
      setView(restored[0]?.viewSlug ?? views[0]?.slug ?? null);
      return;
    }
    if (!cp) {
      setColorId((prev) => (template.colors?.some((c) => c.id === prev) ? prev : template.colors?.[0]?.id ?? null));
      setSizeId((prev) => (template.sizes?.some((s) => s.id === prev) ? prev : null));
      setView((prev) => (prev && views.some((v) => v.slug === prev) ? prev : views[0]?.slug ?? null));
    }
  }, [template, rawZonesReady, editItem, zones, views]);

  const color = template?.colors?.find((c) => c.id === colorId) ?? null;
  const size = template?.sizes?.find((s) => s.id === sizeId) ?? null;
  const colorHex = color?.hexCode || '#FFFFFF';
  const model3d: Model3D | null = isModel3D(template?.model3d) ? template.model3d : null;

  // Prenda de cada vista (pintada del color). La vista actual primero.
  useEffect(() => {
    if (!template || !views.length || model3d) return;
    let alive = true;
    const ordered = [...views].sort((a, b) => (a.slug === view ? -1 : b.slug === view ? 1 : 0));
    (async () => {
      for (const v of ordered) {
        const g = await prepareGarment(resolveViewImage(template, v.slug), colorHex, v.kind).catch(() => silhouetteGarment(v.kind, colorHex));
        if (!alive) return;
        setGarments((prev) => ({ ...prev, [v.slug]: g }));
      }
    })();
    return () => { alive = false; };
    // La vista no se incluye: cambiarla no debe volver a pintar todo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template, views, colorHex, model3d]);

  // Stock de la combinación color/talla.
  useEffect(() => {
    if (!template) { setStock(null); return; }
    let alive = true;
    setLoadingStock(true);
    templateRecipesService.getVariantStock(template.id, colorId, sizeId)
      .then((info) => alive && setStock(typeof info?.availableStock === 'number' ? info.availableStock : null))
      .catch(() => alive && setStock(null))
      .finally(() => alive && setLoadingStock(false));
    return () => { alive = false; };
  }, [template, colorId, sizeId]);

  // Precio: lo calcula el servidor (con espera corta); si no responde, cálculo local "estimado".
  const zoneIdsKey = usedZoneIds(studio.designs).join(',');
  const fallbackQuote = useMemo(
    () => localQuote(template?.basePrice || 0, zones, studio.designs),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [template?.basePrice, zones, zoneIdsKey],
  );
  useEffect(() => {
    setServerQuote(null);
    if (!template) return;
    let alive = true;
    const ids = zoneIdsKey ? zoneIdsKey.split(',').map(Number) : [];
    const t = window.setTimeout(() => {
      customizerService.quote(template.id, ids)
        .then((q) => {
          if (!alive || !q || typeof q.total !== 'number') return;
          setServerQuote({ basePrice: q.basePrice, listPrice: q.listPrice, zones: q.zones || [], customizationPrice: q.customizationPrice, total: q.total });
        })
        .catch(() => { /* se queda el cálculo local */ });
    }, 300);
    return () => { alive = false; window.clearTimeout(t); };
  }, [template, zoneIdsKey]);
  const quote = serverQuote ?? fallbackQuote;

  // ── Zona activa de la vista ──
  const viewPrintZones = useMemo(() => (view ? printZonesOf(zones, view) : []), [zones, view]);
  const viewBlockedZones = useMemo(() => (view ? blockedZonesOf(zones, view) : []), [zones, view]);
  const selected = studio.designs.find((d) => d.id === studio.selectedId) ?? null;
  const activeZone =
    viewPrintZones.find((z) => z.id === (selected?.viewSlug === view ? selected?.templateZoneId : undefined)) ||
    viewPrintZones.find((z) => z.id === activeZoneByView[view || '']) ||
    viewPrintZones[0] ||
    null;
  const setActiveZone = useCallback((id: number) => {
    if (!view) return;
    setActiveZoneByView((p) => ({ ...p, [view]: id }));
  }, [view]);

  const garment = model3d ? undefined : view ? garments[view] : undefined;
  const stageAspect = model3d ? 1 : garment?.aspect || 1;

  // ── Acciones ──
  const selectTemplate = useCallback((t: Template | null) => {
    editLoadedRef.current = null;
    dispatch({ type: 'load', designs: [] });
    setQuantity(1);
    setSizeId(null);
    setView(null);
    setParams(t ? { template: String(t.id) } : {});
  }, [setParams]);

  const changeView = useCallback((slug: string) => {
    setView(slug);
    const first = studio.designs.find((d) => d.viewSlug === slug);
    dispatch({ type: 'select', id: first?.id ?? null });
  }, [studio.designs]);

  const addImage = useCallback((img: AddedImage, extra?: Partial<StudioDesign>) => {
    if (!view || !activeZone) { toast.warning('Este modelo no tiene zonas de diseño en esta vista'); return; }
    const aspect = img.width && img.height ? img.width / img.height : 1;
    const size = fitSize(activeZone, aspect, stageAspect, 0.8);
    const design: StudioDesign = {
      id: newId(),
      viewSlug: view,
      viewType: view,
      zoneId: `view-${view}`,
      templateZoneId: activeZone.id,
      zoneName: activeZone.name,
      imageData: img.preview,
      originalImageData: img.original,
      originalFileName: img.fileName,
      originalFileSize: img.fileSize,
      pixelWidth: img.width || undefined,
      pixelHeight: img.height || undefined,
      position: zoneCenter(activeZone),
      size,
      rotation: 0,
      opacity: 1,
      ...extra,
    };
    dispatch({ type: 'add', design, zone: activeZone });
  }, [view, activeZone, stageAspect]);

  const [processing, setProcessing] = useState(false);

  /** Archivo(s) del cliente → diseño(s) en la zona activa. */
  const addFiles = useCallback(async (files: File[]) => {
    if (!files.length) return;
    if (!activeZone) { toast.warning('Este modelo no tiene zonas de diseño en esta vista'); return; }
    setProcessing(true);
    try {
      for (const f of files.slice(0, 4)) {
        try {
          addImage(await processDesignFile(f));
        } catch (e) {
          toast.error(e instanceof Error ? e.message : 'No se pudo usar esa imagen');
        }
      }
    } finally {
      setProcessing(false);
    }
  }, [activeZone, addImage]);

  /** Diseño de la galería: se muestra la miniatura y producción recibe la imagen completa. */
  const addPreset = useCallback(async (img: DesignImage) => {
    // Con nombre editable: se compone con el nombre de ejemplo y el cliente lo cambia.
    if (img.textFields?.length) {
      const named = namedFrom(img);
      try {
        const out = await composeNamed(named, 900);
        addImage({ preview: out.url, original: '', fileName: img.name, fileSize: 0, width: out.width, height: out.height }, { named, originalImageData: undefined });
      } catch {
        toast.error('No se pudo cargar ese diseño');
      }
      return;
    }
    const preview = img.thumbnailUrl || img.fullUrl;
    const original = img.fullUrl || img.thumbnailUrl;
    let width = 0, height = 0;
    try {
      const el = new Image();
      await new Promise<void>((res, rej) => { el.onload = () => res(); el.onerror = () => rej(new Error('x')); el.src = assetUrl(original); });
      width = el.naturalWidth; height = el.naturalHeight;
    } catch { /* sin medidas: se coloca cuadrada */ }
    addImage({ preview, original, fileName: img.name, fileSize: 0, width, height });
  }, [addImage]);

  const zoneOf = useCallback((d: StudioDesign) => zones.find((z) => z.id === d.templateZoneId), [zones]);

  const update = useCallback((id: string, patch: DesignPatch, record = true) => {
    const d = studio.designs.find((x) => x.id === id);
    if (!d) return;
    dispatch({ type: 'update', id, patch, zone: zoneOf(d), record });
  }, [studio.designs, zoneOf]);

  // ── Texto ──
  /** Lado mayor de la imagen del texto: para ver y para producción (alta resolución). */
  const TEXT_PREVIEW = 900, TEXT_PRINT = 3000;
  const textRun = useRef(new Map<string, number>());
  /** Ancho (en unidades de letra) del texto que tiene hoy cada diseño: con él se conserva el tamaño de la letra. */
  const textUnits = useRef(new Map<string, number>());
  const designsRef = useRef(studio.designs);
  useEffect(() => { designsRef.current = studio.designs; }, [studio.designs]);

  /** Agrega un texto en la zona activa (con lo último usado o el estilo por defecto). */
  const addText = useCallback(async (spec?: Partial<TextSpec>) => {
    if (!view || !activeZone) { toast.warning('Este modelo no tiene zonas de diseño en esta vista'); return; }
    const last = [...designsRef.current].reverse().find((d) => d.text)?.text;
    const full: TextSpec = { ...DEFAULT_TEXT, ...(last ? { ...last, text: DEFAULT_TEXT.text } : {}), ...spec };
    const img = await textImage(full, TEXT_PREVIEW);
    const aspect = img.width / img.height;
    const design: StudioDesign = {
      id: newId(), viewSlug: view, viewType: view, zoneId: `view-${view}`, templateZoneId: activeZone.id, zoneName: activeZone.name,
      imageData: img.url, originalFileName: 'Texto', pixelWidth: Math.round(img.width * (TEXT_PRINT / TEXT_PREVIEW)), pixelHeight: Math.round(img.height * (TEXT_PRINT / TEXT_PREVIEW)),
      position: zoneCenter(activeZone), size: fitSize(activeZone, aspect, stageAspect, 0.7), rotation: 0, opacity: 1, text: full,
    };
    textUnits.current.set(design.id, img.units);
    dispatch({ type: 'add', design, zone: activeZone });
  }, [view, activeZone, stageAspect]);

  /**
   * Cambia el texto (lo que dice, la fuente, la forma…): se vuelve a dibujar y conserva su alto y su
   * centro (un nombre más largo crece a lo ancho, sin salirse de la zona).
   */
  const setText = useCallback(async (id: string, patch: Partial<TextSpec>, record = true) => {
    const d = designsRef.current.find((x) => x.id === id);
    if (!d?.text) return;
    const spec: TextSpec = { ...d.text, ...patch };
    const run = (textRun.current.get(id) ?? 0) + 1;
    textRun.current.set(id, run);
    // Lo escrito se ve al instante en el panel; la imagen llega enseguida.
    dispatch({ type: 'update', id, patch: { text: spec }, record });
    // El texto al que corresponde el tamaño actual (al volver del carrito se mide de nuevo).
    const prevUnits = textUnits.current.get(id) ?? measureText(d.text).width;
    const img = await textImage(spec, TEXT_PREVIEW);
    if (textRun.current.get(id) !== run) return;
    const cur = designsRef.current.find((x) => x.id === id);
    if (!cur) return;
    const aspect = img.width / img.height;
    // La letra conserva su tamaño: el ancho crece o se achica con el texto (sin salirse de la zona).
    const width = cur.size.width * (img.units / Math.max(1, prevUnits));
    textUnits.current.set(id, img.units);
    const height = (width * stageAspect) / aspect;
    dispatch({
      type: 'update', id, record: false, zone: zoneOf(cur),
      patch: {
        imageData: img.url, originalImageData: undefined,
        pixelWidth: Math.round(img.width * (TEXT_PRINT / TEXT_PREVIEW)), pixelHeight: Math.round(img.height * (TEXT_PRINT / TEXT_PREVIEW)),
        size: { width, height },
      },
    });
  }, [zoneOf, stageAspect]);

  /** Cambia lo escrito en un diseño con nombre: se vuelve a componer (el tamaño no cambia). */
  const setNamedValues = useCallback(async (id: string, values: Record<string, string>, record = true) => {
    const d = designsRef.current.find((x) => x.id === id);
    if (!d?.named) return;
    const named: NamedDesign = { ...d.named, values: { ...d.named.values, ...values } };
    const run = (textRun.current.get(id) ?? 0) + 1;
    textRun.current.set(id, run);
    dispatch({ type: 'update', id, patch: { named, originalImageData: undefined }, record });
    try {
      const img = await composeNamed(named, TEXT_PREVIEW);
      if (textRun.current.get(id) !== run) return;
      dispatch({ type: 'update', id, record: false, patch: { imageData: img.url } });
    } catch { /* queda la imagen anterior */ }
  }, []);

  /** Antes de comprar o descargar: cada texto en alta resolución para producción. */
  const withPrintText = useCallback(async (list: StudioDesign[]): Promise<StudioDesign[]> => {
    const out: StudioDesign[] = [];
    for (const d of list) {
      if (d.named && !d.originalImageData) {
        // Diseño con nombre: el diseño en su tamaño real con el nombre, para producción.
        const img = await composeNamed(d.named, TEXT_PRINT);
        out.push({ ...d, originalImageData: img.url, pixelWidth: img.width, pixelHeight: img.height, originalFileName: `${d.named.name}-${namedLabel(d.named) || 'nombre'}.png`.replace(/[^\w.\-áéíóúñÁÉÍÓÚÑ]+/g, '-') });
        continue;
      }
      if (!d.text || d.originalImageData) { out.push(d); continue; }
      const img = await textImage(d.text, TEXT_PRINT);
      out.push({ ...d, originalImageData: img.url, pixelWidth: img.width, pixelHeight: img.height, originalFileName: `texto-${d.text.text.replace(/\W+/g, '-').slice(0, 30) || 'diseno'}.png` });
    }
    return out;
  }, []);

  const fitToZone = useCallback((id: string) => {
    const d = studio.designs.find((x) => x.id === id);
    const z = d && zoneOf(d);
    if (!d || !z) return;
    const aspect = d.pixelWidth && d.pixelHeight ? d.pixelWidth / d.pixelHeight : (d.size.width * stageAspect) / (d.size.height || 1);
    dispatch({ type: 'update', id, patch: { size: fitSize(z, aspect, stageAspect, 1), position: zoneCenter(z) }, zone: z });
  }, [studio.designs, zoneOf, stageAspect]);

  const center = useCallback((id: string) => {
    const d = studio.designs.find((x) => x.id === id);
    const z = d && zoneOf(d);
    if (d && z) dispatch({ type: 'update', id, patch: { position: zoneCenter(z) }, zone: z });
  }, [studio.designs, zoneOf]);

  const duplicateTo = useCallback((id: string, targetView: string) => {
    const z = printZonesOf(zones, targetView)[0];
    if (!z) return;
    dispatch({ type: 'duplicate', id, zone: z, newId: newId() });
    setView(targetView);
  }, [zones]);

  const moveToZone = useCallback((id: string, zoneId: number) => {
    const z = zones.find((x) => x.id === zoneId);
    if (z) dispatch({ type: 'moveToZone', id, zone: z });
    setActiveZone(zoneId);
  }, [zones, setActiveZone]);

  const missing = useMemo(() => missingRequiredZones(zones, studio.designs), [zones, studio.designs]);
  const hasDesign = studio.designs.length > 0;
  const outOfStock = stock !== null && stock < quantity;
  const canSubmit = !!template && !!color && !!size && hasDesign && missing.length === 0 && !outOfStock && !saving;
  const blockers = useMemo(() => {
    const out: string[] = [];
    if (!template) return out;
    if (!size) out.push('Elige tu talla');
    if (!hasDesign) out.push('Agrega al menos un diseño');
    missing.forEach((z) => out.push(`Falta el diseño de ${z.name.toLowerCase()}`));
    if (stock === 0) out.push('Sin stock en esta combinación');
    else if (outOfStock) out.push(`Solo hay ${stock} disponibles`);
    return out;
  }, [template, size, hasDesign, missing, stock, outOfStock]);

  /** Mockups de cada vista con diseño. */
  const buildPreviews = useCallback(async (): Promise<Record<string, string>> => {
    const out: Record<string, string> = {};
    for (const v of views) {
      const ds = studio.designs.filter((d) => d.viewSlug === v.slug);
      if (!ds.length) continue;
      // Maniquí 3D: foto de esa vista con los diseños puestos.
      if (model3d && mannequinRef.current) {
        try {
          const shot = mannequinRef.current.capture(view3DOf(v.slug), { type: 'image/webp', quality: 0.9, size: 900 });
          if (shot) { out[v.slug] = shot; continue; }
        } catch { /* imagen sin CORS: queda el mockup plano */ }
      }
      const g = garments[v.slug] || silhouetteGarment(v.kind, colorHex);
      try {
        out[v.slug] = await renderMockup({ garment: g, kind: v.kind, color: colorHex, designs: ds, zones, blocked: blockedZonesOf(zones, v.slug) });
      } catch {
        out[v.slug] = await renderMockup({ garment: silhouetteGarment(v.kind, colorHex), kind: v.kind, color: colorHex, designs: ds, zones, blocked: blockedZonesOf(zones, v.slug) }).catch(() => '');
      }
    }
    return out;
  }, [views, studio.designs, garments, colorHex, zones, model3d]);

  const submit = useCallback(async () => {
    if (!template || !color || !size) return;
    if (!canSubmit) { if (blockers[0]) toast.warning(blockers[0]); return; }
    setSaving(true);
    try {
      const previews = await buildPreviews();
      // Precio confirmado por el servidor para estas zonas (si no responde, el último conocido).
      const finalQuote: Quote = await customizerService.quote(template.id, usedZoneIds(studio.designs))
        .then((q) => ({ basePrice: q.basePrice, listPrice: q.listPrice, zones: q.zones || [], customizationPrice: q.customizationPrice, total: q.total }))
        .catch(() => quote);
      const product: CustomizedProduct = buildCustomizedProduct({
        template, color: { id: color.id, hexCode: color.hexCode, name: color.name }, size: { id: size.id, abbreviation: size.abbreviation },
        designs: await withPrintText(studio.designs), previews, quote: finalQuote, views, id: editItem?.customizedProduct.id,
      });
      if (editItem) {
        await updateCustomizedProduct(editItem.id, product, quantity);
        toast.success('Diseño actualizado');
      } else {
        await addCustomizedProduct(product, quantity);
        toast.success(quantity > 1 ? `${quantity} unidades agregadas al carrito` : 'Agregado al carrito');
      }
      navigate('/cart');
    } catch {
      toast.error('No se pudo agregar al carrito. Inténtalo de nuevo.');
    } finally {
      setSaving(false);
    }
  }, [template, color, size, canSubmit, blockers, buildPreviews, withPrintText, studio.designs, quote, views, editItem, updateCustomizedProduct, addCustomizedProduct, quantity, navigate]);

  // ── Editor de diseños (el cliente ubica y agrega textos) ──
  /** Capas para abrir un diseño de la prenda en el editor (o un lienzo vacío con la forma de la zona). */
  const studioFor = useCallback(async (d: StudioDesign | null): Promise<EditorData> => {
    const board = (aspect: number) => {
      const w = Math.round(3000 * Math.min(1, aspect)), h = Math.round(3000 * Math.min(1, 1 / aspect));
      return { key: 'zona', label: 'Tu diseño', w, h };
    };
    const base = { rot: 0, flipX: false, flipY: false };
    if (!d) {
      const z = activeZone;
      return { v: 1, artboard: board(z ? (z.width * stageAspect) / Math.max(1, z.height) : 1), layers: [] };
    }
    if (d.studio) return d.studio;
    const aspect = d.pixelWidth && d.pixelHeight ? d.pixelWidth / d.pixelHeight : (d.size.width * stageAspect) / Math.max(0.01, d.size.height);
    const A = board(aspect);
    if (d.text) return { v: 1, artboard: A, layers: [{ id: layerId(), name: 'Texto', kind: 'text', spec: d.text, editable: null, ...fitBox(A, aspect, 0.98), ...base }] };
    if (d.named) {
      // El diseño de la galería y cada nombre como texto que el cliente puede mover y cambiar.
      let a = 1;
      try { const im = await loadImg(d.named.base); a = im.naturalWidth / Math.max(1, im.naturalHeight); } catch { /* cuadrada */ }
      const A2 = board(a);
      const box = fitBox(A2, a, 1);
      const layers: DLayer[] = [{ id: layerId(), name: d.named.name, kind: 'image', src: d.named.base, ...box, ...base }];
      for (const f of d.named.fields) {
        layers.push({
          id: layerId(), name: f.label, kind: 'text', editable: null, ...base,
          x: box.x + (f.box.x / 100) * box.w, y: box.y + (f.box.y / 100) * box.h, w: (f.box.w / 100) * box.w, h: (f.box.h / 100) * box.h,
          spec: { ...DEFAULT_TEXT, ...f.style, text: d.named.values[f.key] ?? f.default },
        });
      }
      return { v: 1, artboard: A2, layers };
    }
    // Una imagen: la original si se puede abrir aquí (subida o de la tienda); si no, la de la vista.
    const orig = d.originalImageData;
    const src = orig && (orig.startsWith('data:') || orig.includes('/uploads/')) ? orig : d.imageData;
    return { v: 1, artboard: A, layers: [{ id: layerId(), name: d.originalFileName || 'Imagen', kind: 'image', src, ...fitBox(A, aspect, 1), ...base }] };
  }, [activeZone, stageAspect]);

  /** Lo hecho en el editor va a la prenda: reemplaza el diseño (mismo lugar y ancho) o se agrega. */
  const applyStudio = useCallback((id: string | null, r: StudioResult) => {
    const aspect = r.width / Math.max(1, r.height);
    const d = id ? designsRef.current.find((x) => x.id === id) : null;
    if (!d) {
      addImage({ preview: r.preview, original: r.original, fileName: 'Mi diseño', fileSize: 0, width: r.width, height: r.height }, { studio: r.data });
      return;
    }
    const width = d.size.width;
    dispatch({
      type: 'update', id: d.id, zone: zoneOf(d),
      patch: {
        imageData: r.preview, originalImageData: r.original, pixelWidth: r.width, pixelHeight: r.height, originalFileName: 'Mi diseño',
        studio: r.data, text: undefined, named: undefined, size: { width, height: (width * stageAspect) / aspect },
      },
    });
  }, [addImage, zoneOf, stageAspect]);

  // ── Pack familiar ──
  /** Vista y zona donde va el diseño de cada integrante (el frente; si no, la primera con zona). */
  const packPlace = useMemo(() => {
    const ordered = [...views].sort((a, b) => (canonicalView(a.slug) === 'front' ? -1 : canonicalView(b.slug) === 'front' ? 1 : 0));
    for (const v of ordered) {
      const z = printZonesOf(zones, v.slug)[0];
      if (z) return { view: v, zone: z };
    }
    return null;
  }, [views, zones]);

  /**
   * Varias prendas de una vez (una por integrante): el diseño de cada uno con su nombre, en el frente,
   * del color elegido y con su talla. Revisa el stock de cada talla antes de agregar.
   */
  const addFamilyPack = useCallback(async (members: { design: DesignImage; values: Record<string, string>; sizeId: number }[]): Promise<boolean> => {
    if (!template || !color || !packPlace || !members.length) return false;
    const { view: v, zone } = packPlace;
    // Stock de cada talla para las prendas que la piden.
    const need = new Map<number, number>();
    members.forEach((m) => need.set(m.sizeId, (need.get(m.sizeId) ?? 0) + 1));
    for (const [sid, n] of need) {
      const info = await templateRecipesService.getVariantStock(template.id, color.id, sid).catch(() => null);
      const have = typeof info?.availableStock === 'number' ? info.availableStock : null;
      if (have !== null && have < n) {
        const sz = template.sizes?.find((s) => s.id === sid);
        toast.warning(have === 0 ? `No hay stock en talla ${sz?.abbreviation ?? ''} de este color` : `En talla ${sz?.abbreviation ?? ''} solo hay ${have}`);
        return false;
      }
    }
    setSaving(true);
    try {
      const q: Quote = await customizerService.quote(template.id, [zone.id])
        .then((r) => ({ basePrice: r.basePrice, listPrice: r.listPrice, zones: r.zones || [], customizationPrice: r.customizationPrice, total: r.total }))
        .catch(() => localQuote(template.basePrice || 0, zones, [{ templateZoneId: zone.id }]));
      const g = garments[v.slug] || silhouetteGarment(v.kind, colorHex);
      const aspect3d = model3d ? 1 : g.aspect || 1;
      for (const m of members) {
        const named = namedFrom(m.design, m.values);
        const [prev, hd] = await Promise.all([composeNamed(named, TEXT_PREVIEW), composeNamed(named, TEXT_PRINT)]);
        const d: StudioDesign = {
          id: newId(), viewSlug: v.slug, viewType: v.slug, zoneId: `view-${v.slug}`, templateZoneId: zone.id, zoneName: zone.name,
          imageData: prev.url, originalImageData: hd.url, originalFileName: `${m.design.name}-${namedLabel(named) || 'nombre'}.png`,
          pixelWidth: hd.width, pixelHeight: hd.height, named,
          position: zoneCenter(zone), size: fitSize(zone, prev.width / prev.height, aspect3d, 0.85), rotation: 0, opacity: 1,
        };
        const mock = await renderMockup({ garment: g, kind: v.kind, color: colorHex, designs: [d], zones, blocked: blockedZonesOf(zones, v.slug) }).catch(() => '');
        const sz = template.sizes?.find((s) => s.id === m.sizeId);
        const product = buildCustomizedProduct({
          template, color: { id: color.id, hexCode: color.hexCode, name: color.name }, size: { id: m.sizeId, abbreviation: sz?.abbreviation ?? '' },
          designs: [d], previews: mock ? { [v.slug]: mock } : {}, quote: q, views,
        });
        await addCustomizedProduct(product, 1);
      }
      toast.success(`${members.length} prendas de la familia agregadas al carrito`);
      navigate('/cart');
      return true;
    } catch {
      toast.error('No se pudo agregar el pack. Inténtalo de nuevo.');
      return false;
    } finally {
      setSaving(false);
    }
  }, [template, color, colorHex, packPlace, zones, views, garments, model3d, addCustomizedProduct, navigate]);

  const exportZip = useCallback(async () => {
    if (!template || !hasDesign) return;
    setExporting(true);
    try {
      const previews = await buildPreviews();
      await exportDesignsZip({ templateName: template.name, color: color?.name || colorHex, size: size?.abbreviation || '', designs: await withPrintText(studio.designs), previews, views });
    } catch {
      toast.error('No se pudieron descargar los diseños');
    } finally {
      setExporting(false);
    }
  }, [template, hasDesign, buildPreviews, withPrintText, color, colorHex, size, studio.designs, views]);

  return {
    // datos
    templates, loadingTemplates: loadingTemplates || !models3dReady, template, pendingTemplate: !!wantedTemplateId && !template, zones, views, zonesReady: rawZonesReady,
    color, size, colorId, sizeId, view, quantity, stock, loadingStock, quote,
    garment, garments, stageAspect, model3d, mannequinRef, viewPrintZones, viewBlockedZones, activeZone,
    studio, selected, isEditMode, editItem, saving, exporting, canSubmit, blockers, missing,
    // acciones
    selectTemplate, setColorId, setSizeId, changeView, setQuantity, setActiveZone,
    addImage, addFiles, addPreset, addText, setText, setNamedValues, addFamilyPack, packPlace, studioFor, applyStudio, processing, update, fitToZone, center, duplicateTo, moveToZone, dispatch, submit, exportZip,
    cancelEdit: () => navigate('/cart'),
  };
}

export type CustomizerApi = ReturnType<typeof useCustomizer>;
