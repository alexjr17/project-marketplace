/**
 * Con qué trabaja la pieza: el sistema mira lo que se eligió y arma una lista de "piezas" que llenan los
 * espacios de CUALQUIER plantilla (de post o de video):
 * - un producto: cada foto suya es una pieza (frente, espalda, detalle…);
 * - varios productos: una pieza por producto (su foto principal);
 * - una personalizable (con fotos y zonas, o con modelo 3D): una pieza por cada vista/zona que se elige
 *   mostrar, con el diseño subido para esa zona.
 * Así las plantillas no dependen del tipo de producto: se adaptan solas.
 */
import type { SourceProduct } from '../../services/marketing.service';
import { canonicalView } from '../customizer/customizerModel';
import type { Design, ImageLayer, Layer, MockView, PieceMock } from './design';
import type { SceneDesign } from './timeline';

export interface Piece {
  key: string;
  productId: number;
  name: string;
  price?: number;
  listPrice?: number;
  discountPercent?: number;
  /** Foto del producto (productos normales). */
  image: string | null;
  /** Vista de la personalizable con su diseño (personalizables). */
  mock?: PieceMock | null;
  /** Qué muestra: "Frente", "Espalda", "Foto 2"… */
  label: string;
  /** El tamaño del diseño lo eligió el usuario (manda sobre el de la plantilla). */
  sized?: boolean;
}

/** Una zona de la personalizable: si se muestra y con qué diseño. */
export interface ZoneChoice {
  show: boolean;
  design: SceneDesign | null;
  /** Dónde va el diseño en la zona (corrimiento, fracción de la foto) y su tamaño: igual en todas las plantillas. */
  offset?: { x: number; y: number };
  size?: number;
}
export type GarmentPlan = Record<number, ZoneChoice>;
export interface GarmentZone { id: number; name: string; view: MockView | null; /** Tipo de zona tal cual (manga-derecha…). */ slug: string | null }

export type Subject =
  | { kind: 'productos'; single: boolean; pieces: Piece[] }
  | { kind: 'prenda'; templateId: number; name: string; pieces: Piece[]; zones: GarmentZone[]; color: string | null };

const VIEW_ORDER: Record<MockView, number> = { front: 0, back: 1, side: 2 };
export const VIEW_LABEL: Record<MockView, string> = { front: 'Frente', back: 'Espalda', side: 'Manga / lado' };

/** Zonas de diseño de una personalizable, ordenadas por vista (frente, espalda, lados). */
export function garmentZones(t: SourceProduct): GarmentZone[] {
  return (t.zones ?? [])
    .map((z) => ({ id: z.id, name: z.name, view: canonicalView(z.view) as MockView | null, slug: z.view }))
    .sort((a, b) => (a.view ? VIEW_ORDER[a.view] : 3) - (b.view ? VIEW_ORDER[b.view] : 3));
}

/** Lo que se muestra al empezar: la primera zona de cada vista. */
export function defaultPlan(zones: GarmentZone[]): GarmentPlan {
  const seen = new Set<string>();
  const out: GarmentPlan = {};
  for (const z of zones) {
    const v = z.view ?? `z${z.id}`;
    out[z.id] = { show: !seen.has(v), design: null };
    seen.add(v);
  }
  return out;
}

/** Fotos de un producto que se usan (las elegidas o todas). */
export function photosOf(p: SourceProduct, picks?: string[]): string[] {
  const all = Array.from(new Set([p.image, ...(p.images ?? [])].filter((u): u is string => !!u)));
  const chosen = picks ? all.filter((u) => picks.includes(u)) : all;
  return chosen.length ? chosen : all.slice(0, 1);
}

const photoLabel = (i: number) => (i === 0 ? 'Foto principal' : `Foto ${i + 1}`);

/** Piezas de productos normales. */
export function productSubject(products: SourceProduct[], picks: Record<number, string[]>): Subject {
  const base = (p: SourceProduct) => ({ productId: p.id, name: p.name, price: p.price, listPrice: p.listPrice, discountPercent: p.discountPercent });
  if (products.length === 1) {
    const p = products[0];
    const photos = photosOf(p, picks[p.id]);
    const pieces = photos.length
      ? photos.map((image, i) => ({ ...base(p), key: `${p.id}:${i}`, image, label: photoLabel(i) }))
      : [{ ...base(p), key: `${p.id}:0`, image: null, label: photoLabel(0) }];
    return { kind: 'productos', single: true, pieces };
  }
  return {
    kind: 'productos', single: false,
    pieces: products.map((p) => ({ ...base(p), key: `${p.id}`, image: photosOf(p, picks[p.id])[0] ?? null, label: p.name })),
  };
}

/** Piezas de una personalizable: las zonas que se muestran, cada una con su diseño. */
export function garmentSubject(t: SourceProduct, plan: GarmentPlan, color?: string | null): Subject {
  const zones = garmentZones(t);
  let shown = zones.filter((z) => plan[z.id]?.show);
  if (!shown.length) shown = zones.slice(0, 1);
  const pieces: Piece[] = shown.map((z) => ({
    key: `${t.id}:${z.id}`, productId: t.id, name: t.name, price: t.price, listPrice: t.listPrice, discountPercent: t.discountPercent,
    image: null, label: z.view ? `${VIEW_LABEL[z.view]} · ${z.name}` : z.name,
    sized: plan[z.id]?.size != null,
    mock: {
      templateId: t.id, zoneId: z.id, view: z.view ?? 'front', design: plan[z.id]?.design ?? null, size: plan[z.id]?.size ?? 0.85,
      ...(plan[z.id]?.offset ? { offset: plan[z.id]!.offset } : {}), ...(color ? { color } : {}),
    },
  }));
  return { kind: 'prenda', templateId: t.id, name: t.name, pieces, zones, color: color ?? null };
}

/** Diseño para una vista de la prenda: el de su zona, o el de otra zona mostrada en esa vista. */
function pieceForView(s: Extract<Subject, { kind: 'prenda' }>, m: PieceMock): Piece | undefined {
  const view = m.view ?? 'front';
  const inView = s.pieces.filter((p) => p.mock?.view === view);
  const hint = m.zoneHint?.toLowerCase();
  return s.pieces.find((p) => p.mock?.zoneId === m.zoneId)
    ?? (hint ? inView.find((p) => p.label.toLowerCase().includes(hint) && p.mock?.design) : undefined)
    ?? inView.find((p) => p.mock?.design) ?? inView[0];
}

/**
 * La plantilla adaptada a lo que se eligió (solo para dibujar; lo editado no cambia):
 * - con una personalizable, los espacios de foto muestran sus vistas con diseño, y las vistas de la
 *   plantilla toman el diseño de su zona;
 * - con productos, las vistas de prenda de la plantilla usan las fotos del producto (frente, espalda…)
 *   o, con varios productos, uno por espacio.
 */
export function resolveDesign(d: Design, s: Subject | null): Design {
  if (!s) return d;
  const layers = d.layers.map((l): Layer => {
    if (l.type !== 'image' || l.src) return l;
    if (s.kind === 'prenda') {
      if (l.mock) {
        const p = pieceForView(s, l.mock);
        return {
          ...l,
          mock: {
            ...l.mock,
            templateId: l.mock.templateId ?? s.templateId,
            zoneId: l.mock.zoneId ?? (l.mock.crop ? null : p?.mock?.zoneId ?? null),
            design: l.mock.design ?? p?.mock?.design ?? null,
            color: l.mock.color ?? s.color ?? undefined,
            // Con el diseño de la zona, también su posición y (si se eligió) su tamaño.
            ...(!l.mock.design && p?.mock ? { offset: p.mock.offset ?? l.mock.offset, size: p.sized ? p.mock.size : l.mock.size } : {}),
          },
        };
      }
      const p = s.pieces[l.item];
      return p?.mock ? { ...l, mock: { ...p.mock } } : l;
    }
    if (!l.mock) return l;
    // Producto normal en una plantilla de vistas: la foto que corresponde a esa vista (o ese producto).
    const idx = l.mock.closeUp ? (l.mock.view === 'side' ? 2 : l.mock.view === 'back' ? 1 : 0) : VIEW_ORDER[l.mock.view ?? 'front'];
    // Sin foto para esa vista: el espacio queda libre (en el editor invita a elegir otra).
    const item = idx < s.pieces.length ? idx : 999;
    const close: Partial<ImageLayer> = l.mock.closeUp ? { fit: 'cover', zoom: Math.max(l.zoom, 1.8), cutout: false } : { cutout: true };
    return { ...l, mock: null, item, ...close };
  });
  return { ...d, layers };
}
