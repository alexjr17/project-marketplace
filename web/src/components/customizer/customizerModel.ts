/**
 * Lógica pura del personalizador (sin React ni red): vistas, imágenes por vista,
 * zonas en %, límites del diseño, resolución de impresión, precio de vista previa
 * y armado de lo que va al carrito y al pedido. Todo lo de aquí es testeable.
 *
 * Coordenadas: todo en % del "escenario" (la imagen de la vista). position = centro
 * del diseño; size = ancho (% del ancho) y alto (% del alto).
 */
import type { Template } from '../../services/templates.service';
import type { TemplateZone } from '../../services/template-zones.service';
import type { CustomizedProduct, Design, OrderCustomization } from '../../types/design';
import type { ProductTypeSlug } from '../../types/product';
import { isModel3D, MODELS_3D } from '../mannequin/models';

// ─── Tipos del estudio ───────────────────────────────────────────────────────

/** Diseño colocado en el estudio: siempre pertenece a una vista y a una zona. */
export type StudioDesign = Design & { viewSlug: string; templateZoneId: number; imageData: string };

/** Zona normalizada a % (0-100) sobre la imagen de la vista. */
export interface StudioZone {
  id: number;
  viewSlug: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  shape: 'rect' | 'circle' | 'polygon';
  points?: Array<{ x: number; y: number }> | null;
  price: number;
  isRequired: boolean;
  isBlocked: boolean;
  sortOrder: number;
}

export interface StudioView {
  slug: string;
  name: string;
  /** Silueta integrada que se usa si la vista no tiene imagen. */
  kind: GarmentKind;
}

export type GarmentKind = 'front' | 'back' | 'sleeve';

export interface QuoteLine { id: number; name: string; zoneTypeSlug: string; price: number }
export interface Quote {
  basePrice: number;
  /** Precio base sin la oferta automática (igual a basePrice si no hay oferta). */
  listPrice?: number;
  zones: QuoteLine[];
  customizationPrice: number;
  total: number;
  /** true = calculado en el navegador (el servidor no respondió). */
  estimated?: boolean;
}

// ─── Vistas e imágenes ───────────────────────────────────────────────────────

/** Alias de las vistas: el admin usa slugs en español, las imágenes viejas en inglés. */
const VIEW_ALIASES: Record<'front' | 'back' | 'side', string[]> = {
  front: ['front', 'frente', 'delantero', 'delantera', 'pecho'],
  back: ['back', 'espalda', 'trasero', 'trasera'],
  side: ['side', 'lado', 'lateral', 'manga', 'manga-izquierda', 'manga-derecha', 'sleeve'],
};

/** Vista canónica (front/back/side) de un slug, o null si no se reconoce. */
export function canonicalView(slug: string | null | undefined): 'front' | 'back' | 'side' | null {
  if (!slug) return null;
  const s = slug.toLowerCase();
  for (const key of Object.keys(VIEW_ALIASES) as Array<keyof typeof VIEW_ALIASES>) {
    if (VIEW_ALIASES[key].some((a) => s === a || s.startsWith(`${a}-`))) return key;
  }
  return null;
}

export function garmentKind(slug: string): GarmentKind {
  const c = canonicalView(slug);
  return c === 'back' ? 'back' : c === 'side' ? 'sleeve' : 'front';
}

/** Imágenes del modelo como objeto {front, back, side}: acepta el objeto, un arreglo (formato del admin) o vacío. */
export function normalizeTemplateImages(images: unknown): { front?: string; back?: string; side?: string } {
  const pick = (v: unknown): string | undefined => {
    if (typeof v === 'string') return v.trim() || undefined;
    if (v && typeof v === 'object' && typeof (v as { url?: unknown }).url === 'string') return ((v as { url: string }).url).trim() || undefined;
    return undefined;
  };
  if (Array.isArray(images)) return { front: pick(images[0]), back: pick(images[1]), side: pick(images[2]) };
  if (images && typeof images === 'object') {
    const o = images as Record<string, unknown>;
    return { front: pick(o.front), back: pick(o.back), side: pick(o.side) };
  }
  return {};
}

/**
 * Imagen de una vista, en un solo lugar: imagen del tipo de zona (donde el admin dibujó
 * las zonas) → la misma con alias → images por vista canónica. Undefined = usar silueta.
 * (No se usa la foto del frente para la espalda: se vería la prenda al revés.)
 */
export function resolveViewImage(template: Pick<Template, 'images' | 'zoneTypeImages'>, slug: string): string | undefined {
  const zti = template.zoneTypeImages || {};
  const direct = typeof zti[slug] === 'string' ? zti[slug].trim() : '';
  if (direct) return direct;
  const canon = canonicalView(slug);
  if (canon) {
    for (const alias of VIEW_ALIASES[canon]) {
      const v = typeof zti[alias] === 'string' ? zti[alias].trim() : '';
      if (v) return v;
    }
    return normalizeTemplateImages(template.images)[canon];
  }
  return undefined;
}

/**
 * Foto de portada del modelo para las tarjetas (frente o la primera que haya). Si no tiene fotos y
 * usa maniquí 3D, la foto del maniquí (archivo del front, en URL absoluta).
 */
export function templateCover(template: Pick<Template, 'images' | 'zoneTypeImages' | 'model3d'>): string | undefined {
  const imgs = normalizeTemplateImages(template.images);
  if (imgs.front) return imgs.front;
  const zti = Object.values(template.zoneTypeImages || {}).find((v) => typeof v === 'string' && v.trim());
  const photo = zti || imgs.back || imgs.side;
  if (photo) return photo;
  if (isModel3D(template.model3d) && typeof window !== 'undefined') return new URL(MODELS_3D[template.model3d].poster, window.location.origin).href;
  return undefined;
}

// ─── Zonas ───────────────────────────────────────────────────────────────────

/** Referencia para zonas guardadas en píxeles (semillas viejas sobre un lienzo de 500 px). */
export const LEGACY_ZONE_PX = 500;

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Zona de la API → % (0-100). Las zonas nuevas ya vienen en %; si alguna se sale de 100
 * es de las viejas en píxeles y se convierte sobre LEGACY_ZONE_PX.
 */
export function normalizeZone(z: TemplateZone): StudioZone {
  let x = Number(z.positionX) || 0;
  let y = Number(z.positionY) || 0;
  let w = Number(z.maxWidth) || 0;
  let h = Number(z.maxHeight) || 0;
  if (x + w > 100.5 || y + h > 100.5) {
    const k = 100 / LEGACY_ZONE_PX;
    x *= k; y *= k; w *= k; h *= k;
  }
  return {
    id: z.id,
    viewSlug: z.zoneType?.slug || 'frente',
    name: z.name,
    x: r2(x), y: r2(y), width: r2(w), height: r2(h),
    shape: z.shape || 'rect',
    points: z.points ?? null,
    price: Number(z.price) || 0,
    isRequired: !!z.isRequired,
    isBlocked: !!z.isBlocked,
    sortOrder: Number(z.sortOrder) || 0,
  };
}

/** Zonas activas normalizadas y ordenadas. */
export function buildZones(zones: TemplateZone[] | null | undefined): StudioZone[] {
  return (Array.isArray(zones) ? zones : [])
    .filter((z) => z.isActive !== false && z.zoneType?.slug && z.isEditable !== false)
    .map(normalizeZone)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
}

const VIEW_ORDER: Record<string, number> = { front: 0, back: 1, side: 2 };

/** Vistas del modelo: las que tienen al menos una zona de diseño (no bloqueada). */
export function buildViews(rawZones: TemplateZone[] | null | undefined): StudioView[] {
  const seen = new Map<string, { view: StudioView; order: number }>();
  for (const z of Array.isArray(rawZones) ? rawZones : []) {
    if (z.isActive === false || z.isBlocked || z.isEditable === false || !z.zoneType?.slug) continue;
    const slug = z.zoneType.slug;
    if (seen.has(slug)) continue;
    const canon = canonicalView(slug);
    seen.set(slug, {
      view: { slug, name: z.zoneType.name || slug, kind: garmentKind(slug) },
      order: (canon ? VIEW_ORDER[canon] : 3) * 1000 + (Number(z.sortOrder) || 0),
    });
  }
  return [...seen.values()].sort((a, b) => a.order - b.order).map((v) => v.view);
}

export const printZonesOf = (zones: StudioZone[], view: string) => zones.filter((z) => z.viewSlug === view && !z.isBlocked);
export const blockedZonesOf = (zones: StudioZone[], view: string) => zones.filter((z) => z.viewSlug === view && z.isBlocked);

// ─── Geometría del diseño ────────────────────────────────────────────────────

export const MIN_DESIGN_SIZE = 4; // % mínimo de ancho/alto

/** Alto en % que conserva la proporción de la imagen en un escenario de proporción `stageAspect` (ancho/alto). */
export function heightForWidth(widthPct: number, imageAspect: number, stageAspect = 1): number {
  return imageAspect > 0 ? (widthPct * stageAspect) / imageAspect : widthPct;
}

/** Tamaño más grande (con la proporción de la imagen) que cabe en la zona, escalado por `fill`. */
export function fitSize(zone: Pick<StudioZone, 'width' | 'height'>, imageAspect: number, stageAspect = 1, fill = 1) {
  let width = zone.width * fill;
  let height = heightForWidth(width, imageAspect, stageAspect);
  if (height > zone.height * fill) {
    height = zone.height * fill;
    width = (height * imageAspect) / stageAspect;
  }
  return { width: r2(width), height: r2(height) };
}

export const zoneCenter = (zone: Pick<StudioZone, 'x' | 'y' | 'width' | 'height'>) => ({ x: r2(zone.x + zone.width / 2), y: r2(zone.y + zone.height / 2) });

/**
 * Mantiene el diseño dentro del área imprimible: no más grande que la zona (escala
 * proporcional) y con su caja dentro de ella. La rotación se recorta visualmente.
 */
export function clampToZone<T extends Pick<Design, 'position' | 'size'>>(design: T, zone: Pick<StudioZone, 'x' | 'y' | 'width' | 'height'>): T {
  let { width, height } = design.size;
  const k = Math.min(1, zone.width / Math.max(width, 0.01), zone.height / Math.max(height, 0.01));
  width *= k; height *= k;
  const kMin = Math.max(1, MIN_DESIGN_SIZE / Math.max(Math.min(width, height), 0.01));
  if (kMin > 1 && width * kMin <= zone.width && height * kMin <= zone.height) { width *= kMin; height *= kMin; }
  const clamp = (v: number, lo: number, hi: number) => (lo > hi ? (lo + hi) / 2 : Math.min(hi, Math.max(lo, v)));
  const x = clamp(design.position.x, zone.x + width / 2, zone.x + zone.width - width / 2);
  const y = clamp(design.position.y, zone.y + height / 2, zone.y + zone.height - height / 2);
  return { ...design, position: { x: r2(x), y: r2(y) }, size: { width: r2(width), height: r2(height) } };
}

/** Ángulo normalizado a (-180, 180]. */
export function normalizeAngle(deg: number): number {
  let a = Math.round(deg) % 360;
  if (a > 180) a -= 360;
  if (a <= -180) a += 360;
  return a;
}

// ─── Resolución de impresión ─────────────────────────────────────────────────

/** Ancho real aproximado que representa el escenario (prenda de frente, en cm). */
export const STAGE_WIDTH_CM = 60;
export const DPI_GOOD = 150;
export const DPI_MIN = 100;

/** DPI aproximados con los que se imprimiría el diseño a su tamaño actual. null = no se sabe. */
export function estimateDpi(design: Pick<Design, 'size' | 'pixelWidth'>): number | null {
  if (!design.pixelWidth || design.size.width <= 0) return null;
  const cm = (design.size.width / 100) * STAGE_WIDTH_CM;
  return Math.round(design.pixelWidth / (cm / 2.54));
}

export function dpiLevel(dpi: number | null): 'good' | 'fair' | 'low' | 'unknown' {
  if (dpi == null) return 'unknown';
  return dpi >= DPI_GOOD ? 'good' : dpi >= DPI_MIN ? 'fair' : 'low';
}

/** Tamaño impreso aproximado en cm. */
export function printSizeCm(design: Pick<Design, 'size'>, stageAspect = 1) {
  const w = (design.size.width / 100) * STAGE_WIDTH_CM;
  const h = (design.size.height / 100) * (STAGE_WIDTH_CM / stageAspect);
  return { width: Math.round(w), height: Math.round(h) };
}

// ─── Precio ──────────────────────────────────────────────────────────────────

/** Zonas usadas (una vez cada una aunque tengan varios diseños). */
export function usedZoneIds(designs: Array<Pick<Design, 'templateZoneId'>>): number[] {
  return [...new Set(designs.map((d) => d.templateZoneId).filter((id): id is number => typeof id === 'number' && id > 0))].sort((a, b) => a - b);
}

/** Cotización local (vista previa): base + precio de cada zona usada. El servidor cobra con la misma regla. */
export function localQuote(basePrice: number, zones: StudioZone[], designs: Array<Pick<Design, 'templateZoneId'>>): Quote {
  const ids = usedZoneIds(designs);
  const lines = ids
    .map((id) => zones.find((z) => z.id === id))
    .filter((z): z is StudioZone => !!z)
    .map((z) => ({ id: z.id, name: z.name, zoneTypeSlug: z.viewSlug, price: z.price }));
  const customizationPrice = lines.reduce((s, l) => s + l.price, 0);
  return { basePrice, zones: lines, customizationPrice, total: basePrice + customizationPrice, estimated: true };
}

/** Zonas obligatorias que aún no tienen diseño. */
export function missingRequiredZones(zones: StudioZone[], designs: Array<Pick<Design, 'templateZoneId'>>): StudioZone[] {
  const used = new Set(usedZoneIds(designs));
  return zones.filter((z) => z.isRequired && !z.isBlocked && !used.has(z.id));
}

// ─── Guía de tallas ──────────────────────────────────────────────────────────

/** Tabla de tallas para el tipo del modelo (los slugs del admin son libres: "sueter-basico"). */
export function sizeChartType(typeSlug?: string | null, typeName?: string | null): ProductTypeSlug {
  const s = `${typeSlug || ''} ${typeName || ''}`.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (/hoodie|capota|capucha/.test(s)) return 'hoodie';
  if (/sueter|buso|buzo|sudadera|sweat|crewneck/.test(s)) return 'sweatshirt';
  if (/gorra|cap\b/.test(s)) return 'cap';
  if (/taza|mug/.test(s)) return 'mug';
  return 'tshirt';
}

// ─── Carrito y pedido ────────────────────────────────────────────────────────

export interface BuildProductInput {
  template: Pick<Template, 'id' | 'name' | 'slug' | 'basePrice' | 'typeSlug' | 'images' | 'zoneTypeImages'>;
  color: { id?: number; hexCode: string; name: string };
  size: { id?: number; abbreviation: string };
  designs: StudioDesign[];
  /** Mockup por vista (dataURL o URL subida). */
  previews: Record<string, string>;
  quote: Quote;
  views: StudioView[];
  id?: string;
}

/** Diseño del estudio → Design guardado (con los campos viejos para compatibilidad). */
function toStoredDesign(d: StudioDesign): Design {
  return {
    id: d.id,
    viewSlug: d.viewSlug,
    viewType: d.viewSlug,
    zoneId: `view-${d.viewSlug}`,
    templateZoneId: d.templateZoneId,
    zoneName: d.zoneName,
    imageData: d.imageData,
    originalImageData: d.originalImageData,
    originalFileName: d.originalFileName,
    originalFileSize: d.originalFileSize,
    pixelWidth: d.pixelWidth,
    pixelHeight: d.pixelHeight,
    position: d.position,
    size: d.size,
    rotation: d.rotation || 0,
    opacity: d.opacity ?? 1,
  };
}

/** Vista (slug) que corresponde al frente / la espalda entre las del modelo. */
function viewFor(views: Array<Pick<StudioView, 'slug'>>, canon: 'front' | 'back'): string | undefined {
  return views.find((v) => canonicalView(v.slug) === canon)?.slug;
}

/** Producto personalizado (formato del carrito, versión 2). */
export function buildCustomizedProduct(input: BuildProductInput): CustomizedProduct {
  const { template, color, size, designs, previews, quote, views } = input;
  const frontSlug = viewFor(views, 'front');
  const backSlug = viewFor(views, 'back');
  const firstOf = (slug?: string) => (slug ? designs.find((d) => d.viewSlug === slug) : undefined);
  const viewsWithDesign = views.filter((v) => designs.some((d) => d.viewSlug === v.slug)).map((v) => v.slug);
  const firstPreview = previews[frontSlug || ''] || viewsWithDesign.map((s) => previews[s]).find(Boolean) || Object.values(previews)[0] || '';

  return {
    id: input.id || `custom-${Date.now()}`,
    version: 2,
    productId: String(template.id),
    productType: (template.typeSlug || 'tshirt') as ProductTypeSlug,
    productName: template.name,
    basePrice: quote.basePrice,
    listPrice: quote.listPrice,
    selectedColor: color.hexCode,
    selectedColorName: color.name,
    colorId: color.id,
    selectedSize: size.abbreviation,
    sizeId: size.id,
    designs: designs.map(toStoredDesign),
    previews,
    previewImages: { front: firstPreview, back: backSlug ? previews[backSlug] : undefined },
    productionImages: {
      front: firstOf(frontSlug)?.originalImageData || firstOf(frontSlug)?.imageData,
      back: firstOf(backSlug)?.originalImageData || firstOf(backSlug)?.imageData,
    },
    zonePrices: quote.zones,
    customizationPrice: quote.customizationPrice,
    totalPrice: quote.total,
    createdAt: new Date(),
    templateId: template.id,
    templateSlug: template.slug,
  };
}

/**
 * Lo que va en `items[].customization` del pedido (contrato v2). Incluye las claves viejas
 * (designFront/Back, originalFront/Back) que lee el detalle del pedido en el admin.
 * Un ítem viejo del carrito (sin versión) manda solo las claves viejas, como antes.
 */
export function buildOrderCustomization(cp: CustomizedProduct): OrderCustomization {
  const legacy = {
    designFront: cp.previewImages?.front || undefined,
    designBack: cp.previewImages?.back || undefined,
    originalFront: cp.productionImages?.front || undefined,
    originalBack: cp.productionImages?.back || undefined,
  };
  if (cp.version !== 2) return legacy;
  const previews = cp.previews || {};
  const slugs = Object.keys(previews);
  const front = slugs.find((s) => canonicalView(s) === 'front');
  const back = slugs.find((s) => canonicalView(s) === 'back');
  return {
    version: 2,
    templateId: cp.templateId ?? Number(cp.productId),
    colorId: cp.colorId ?? null,
    sizeId: cp.sizeId ?? null,
    designs: (cp.designs || []).map((d) => ({
      id: d.id,
      viewSlug: d.viewSlug || d.viewType,
      templateZoneId: d.templateZoneId ?? null,
      zoneName: d.zoneName,
      imageData: d.imageData || '',
      originalImageData: d.originalImageData,
      originalFileName: d.originalFileName,
      position: d.position,
      size: d.size,
      rotation: d.rotation || 0,
      opacity: d.opacity ?? 1,
    })),
    previews,
    designFront: (front && previews[front]) || legacy.designFront,
    designBack: (back && previews[back]) || legacy.designBack,
    originalFront: legacy.originalFront,
    originalBack: legacy.originalBack,
    customizationPrice: cp.customizationPrice,
    totalPrice: cp.totalPrice,
  };
}

/**
 * Diseños guardados (carrito) → diseños del estudio, para editar. Los ítems viejos
 * (vista "front"/"back" y sin zona) se asignan a la primera zona de la vista equivalente;
 * los que no encuentran zona se descartan.
 */
export function restoreDesigns(saved: Design[] | undefined, zones: StudioZone[], views: StudioView[]): StudioDesign[] {
  const out: StudioDesign[] = [];
  for (const d of saved || []) {
    if (!d.imageData) continue;
    const rawView = d.viewSlug || d.viewType || String(d.zoneId || '').replace(/^view-/, '');
    let zone = zones.find((z) => z.id === d.templateZoneId && !z.isBlocked);
    if (!zone) {
      const view = views.find((v) => v.slug === rawView) || views.find((v) => canonicalView(v.slug) === canonicalView(rawView));
      zone = view ? printZonesOf(zones, view.slug)[0] : undefined;
    }
    if (!zone) continue;
    out.push({
      ...d,
      viewSlug: zone.viewSlug,
      viewType: zone.viewSlug,
      zoneId: `view-${zone.viewSlug}`,
      templateZoneId: zone.id,
      zoneName: zone.name,
      imageData: d.imageData,
      rotation: d.rotation || 0,
      opacity: d.opacity ?? 1,
    });
  }
  return out;
}

/** Miniaturas de un ítem del carrito: una por vista con diseño (o la vista previa vieja). */
export function cartThumbnails(cp: CustomizedProduct): Array<{ key: string; src: string }> {
  const previews = cp.previews && Object.keys(cp.previews).length ? cp.previews : null;
  if (previews) return Object.entries(previews).filter(([, v]) => !!v).map(([key, src]) => ({ key, src }));
  return [
    { key: 'front', src: cp.previewImages?.front || '' },
    { key: 'back', src: cp.previewImages?.back || '' },
  ].filter((t) => t.src);
}
