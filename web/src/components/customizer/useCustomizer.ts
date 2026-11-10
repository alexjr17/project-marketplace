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
  blockedZonesOf, buildCustomizedProduct, buildViews, buildZones, fitSize, localQuote, missingRequiredZones,
  printZonesOf, resolveViewImage, restoreDesigns, usedZoneIds, zoneCenter,
  type Quote, type StudioDesign, type StudioView, type StudioZone,
} from './customizerModel';
import { initialStudioState, studioReducer } from './studioReducer';
import { prepareGarment, renderMockup, silhouetteGarment, type Garment } from './garment';
import { processDesignFile, type ProcessedDesignImage } from './designImage';
import { assetUrl } from '../../utils/assetUrl';
import type { DesignImage } from '../../services/design-images.service';
import { exportDesignsZip } from './designExport';
import { isModel3D, view3DOf, type Model3D } from '../mannequin/models';
import { useModels3D } from '../mannequin/useModels3D';
import type { Mannequin3DHandle } from '../mannequin/Mannequin3D';

export type AddedImage = Pick<ProcessedDesignImage, 'preview' | 'original' | 'fileName' | 'fileSize' | 'width' | 'height'>;

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

  const addImage = useCallback((img: AddedImage) => {
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

  const update = useCallback((id: string, patch: Partial<Pick<StudioDesign, 'position' | 'size' | 'rotation' | 'opacity'>>, record = true) => {
    const d = studio.designs.find((x) => x.id === id);
    if (!d) return;
    dispatch({ type: 'update', id, patch, zone: zoneOf(d), record });
  }, [studio.designs, zoneOf]);

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
        designs: studio.designs, previews, quote: finalQuote, views, id: editItem?.customizedProduct.id,
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
  }, [template, color, size, canSubmit, blockers, buildPreviews, studio.designs, quote, views, editItem, updateCustomizedProduct, addCustomizedProduct, quantity, navigate]);

  const exportZip = useCallback(async () => {
    if (!template || !hasDesign) return;
    setExporting(true);
    try {
      const previews = await buildPreviews();
      await exportDesignsZip({ templateName: template.name, color: color?.name || colorHex, size: size?.abbreviation || '', designs: studio.designs, previews, views });
    } catch {
      toast.error('No se pudieron descargar los diseños');
    } finally {
      setExporting(false);
    }
  }, [template, hasDesign, buildPreviews, color, colorHex, size, studio.designs, views]);

  return {
    // datos
    templates, loadingTemplates: loadingTemplates || !models3dReady, template, pendingTemplate: !!wantedTemplateId && !template, zones, views, zonesReady: rawZonesReady,
    color, size, colorId, sizeId, view, quantity, stock, loadingStock, quote,
    garment, garments, stageAspect, model3d, mannequinRef, viewPrintZones, viewBlockedZones, activeZone,
    studio, selected, isEditMode, editItem, saving, exporting, canSubmit, blockers, missing,
    // acciones
    selectTemplate, setColorId, setSizeId, changeView, setQuantity, setActiveZone,
    addImage, addFiles, addPreset, processing, update, fitToZone, center, duplicateTo, moveToZone, dispatch, submit, exportZip,
    cancelEdit: () => navigate('/cart'),
  };
}

export type CustomizerApi = ReturnType<typeof useCustomizer>;
