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
import { designSize, imageLayer, shapeLayer, textLayer, type Design, type ImageLayer, type Layer, type MockView, type PieceMock } from './design';
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
  /** Orden en que sale (la primera es la principal); se marca al elegirla. */
  order?: number;
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
    out[z.id] = { show: !seen.has(v), design: null, order: Object.keys(out).length };
    seen.add(v);
  }
  return out;
}

/** Todas las fotos de un producto. */
export function allPhotosOf(p: SourceProduct): string[] {
  return Array.from(new Set([p.image, ...(p.images ?? [])].filter((u): u is string => !!u)));
}

/** Fotos de un producto que se usan: su foto principal, o las que se marquen. */
export function photosOf(p: SourceProduct, picks?: string[]): string[] {
  const all = allPhotosOf(p);
  const chosen = picks ? all.filter((u) => picks.includes(u)) : all.slice(0, 1);
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
  // En el orden en que se eligieron: la primera es la principal.
  let shown = zones.filter((z) => plan[z.id]?.show)
    .sort((a, b) => (plan[a.id]?.order ?? zones.indexOf(a)) - (plan[b.id]?.order ?? zones.indexOf(b)));
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

/** La familia elegida en el estudio: de qué familia de diseños y lo que dice cada integrante. */
export interface FamilyPlan {
  familyId: number;
  members: { key: string; designId: number; role: string; values: Record<string, string> }[];
}

/** Un integrante de la familia: su rol, su nombre y su diseño ya con el nombre puesto. */
export interface FamilyMember { key: string; role: string; name: string; design: SceneDesign | null }

/**
 * La familia en la prenda personalizable: una pieza por integrante, todas en el frente de la prenda
 * (la primera zona del frente), cada una con su diseño con el nombre. El nombre de la pieza es el del
 * integrante (lo usan los textos de la plantilla) y su etiqueta, "Rol · Nombre".
 */
export function familySubject(t: SourceProduct, members: FamilyMember[], color?: string | null): Subject | null {
  const zones = garmentZones(t);
  const front = zones.find((z) => z.view === 'front') ?? zones[0];
  if (!front || !members.length) return null;
  const pieces: Piece[] = members.slice(0, 6).map((m) => ({
    key: `${t.id}:familia:${m.key}`, productId: t.id, name: m.name || m.role, price: t.price, listPrice: t.listPrice, discountPercent: t.discountPercent,
    image: null, label: m.role ? `${m.role} · ${m.name || m.role}` : m.name,
    mock: { templateId: t.id, zoneId: front.id, view: front.view ?? 'front', design: m.design, size: 0.85, ...(color ? { color } : {}) },
  }));
  return { kind: 'prenda', templateId: t.id, name: t.name, pieces, zones, color: color ?? null };
}

/** ¿Es un niño? (se dibuja un poco más chico en la fila de la familia). */
const isKid = (label: string) => /hij|beb[eé]|niñ|niet|peque|junior/i.test(label);

/**
 * Plantilla "Navidad en familia": las prendas de la familia en fila dentro del espacio del producto,
 * los adultos más grandes y los niños un poco más chicos, un poco encimadas, y el nombre de cada uno
 * debajo. Sirve también con varios productos (uno por lugar, con su nombre).
 */
function layoutFamily(layers: Layer[], heroAt: number, pieces: Piece[]): Layer[] {
  const hero = layers[heroAt] as ImageLayer;
  const home = { x: hero.x, y: hero.y, w: hero.w, h: hero.h };
  const list = pieces.slice(0, 6);
  const n = list.length;
  // En formatos altos (historia) y con 3 o más, en dos filas: así cada prenda se ve más grande.
  const rows = hero.h > hero.w * 0.9 && n >= 3 ? 2 : 1;
  const perRow = Math.ceil(n / rows);
  const pillH = 52, pillGap = 10, over = 0.1, rowGap = 24;
  const rowH = (hero.h - (rows - 1) * rowGap) / rows;
  const added: Layer[] = [];
  let main: ImageLayer = hero;
  for (let r = 0; r < rows; r++) {
    const idx = Array.from({ length: Math.min(perRow, n - r * perRow) }, (_, k) => r * perRow + k);
    const scale = idx.map((i) => (isKid(list[i].label) ? 0.74 : 1));
    const sum = scale.reduce((a, b) => a + b, 0);
    const unit = hero.w / Math.max(1, sum - over * (idx.length - 1));
    const top = hero.y + r * (rowH + rowGap);
    const floor = top + rowH - pillH - pillGap;
    // Cada fila centrada.
    const used = idx.reduce((a, _, k) => a + unit * scale[k], 0) - unit * over * (idx.length - 1);
    let x = hero.x + (hero.w - used) / 2;
    idx.forEach((i, k) => {
      const w = unit * scale[k];
      const h = Math.min((floor - top) * scale[k], w * 1.35);
      const box = { x, y: floor - h, w, h };
      if (i === 0) main = { ...hero, ...box, item: 0, anchor: 'bottom', home };
      else added.push(imageLayer({ id: `${hero.id}~f${i}`, auto: 'zonas', name: `Integrante ${i + 1}`, item: i, ...box, fit: 'contain', cutout: true, shadow: hero.shadow, anchor: 'bottom' }));
      const pw = Math.min(w - 8, 260);
      added.push(textLayer({
        id: `${hero.id}~fn${i}`, auto: 'zonas', name: `Nombre ${i + 1}`, bind: 'name', item: i, x: x + (w - pw) / 2, y: floor + pillGap, w: pw, h: pillH,
        font: 'body', size: 26, weight: 800, color: 'white', bg: '#B3121C', radius: 999, maxLines: 1, upper: false, align: 'center',
      }));
      x += w - unit * over;
    });
  }
  // Los integrantes van detrás de los nombres: primero las prendas, después las etiquetas.
  const figures = added.filter((l) => l.type === 'image');
  const pills = added.filter((l) => l.type !== 'image');
  return [...layers.slice(0, heroAt), main, ...figures, ...pills, ...layers.slice(heroAt + 1)];
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
  const VIEW_TAG: Record<string, number> = { FRENTE: 0, ESPALDA: 1, MANGA: 2 };
  const layers = d.layers.map((l): Layer => {
    // Con productos, las etiquetas de vista (Frente, Espalda, Manga) no aplican: con varios productos
    // muestran el precio de cada uno; con uno solo (sus fotos) no se ponen.
    if (s.kind === 'productos' && l.type === 'text' && !l.bind && l.name.startsWith('Etiqueta ') && l.text in VIEW_TAG) {
      const i = VIEW_TAG[l.text];
      return s.single || i >= s.pieces.length ? { ...l, hidden: true } : { ...l, bind: 'price', item: i, letterSpacing: 0 };
    }
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
    // Producto normal: su foto va tal cual (sin recortar), como foto con esquinas y sombra.
    const asPhoto: Partial<ImageLayer> = { cutout: false, fit: 'cover', radius: Math.max(l.radius, 28), shadow: true, feather: 0 };
    if (!l.mock) return l.cutout ? { ...l, ...asPhoto, ...(l.name === 'Foto del producto' ? photoFrame(l, d.layers, designSize(d.ratio)) : {}) } : l;
    // Producto normal en una plantilla de vistas: la foto que corresponde a esa vista (o ese producto).
    const idx = l.mock.closeUp ? (l.mock.view === 'side' ? 2 : l.mock.view === 'back' ? 1 : 0) : VIEW_ORDER[l.mock.view ?? 'front'];
    // Sin foto para esa vista: el espacio queda libre (en el editor invita a elegir otra).
    const item = idx < s.pieces.length ? idx : 999;
    const close: Partial<ImageLayer> = l.mock.closeUp ? { fit: 'cover', zoom: Math.max(l.zoom, 1.8), cutout: false } : asPhoto;
    return { ...l, mock: null, item, ...close };
  });
  return { ...d, layers };
}

type Box = { x: number; y: number; w: number; h: number };
/**
 * Varios productos en una plantilla de un solo producto: dentro del espacio libre (sin tapar logo,
 * textos, precio ni botón), 2 productos van a la par y 3 o 4, el primero en grande y los demás al lado
 * o abajo; todos como foto (sin recortar), con su nombre y su precio.
 */
function layoutProducts(layers: Layer[], heroAt: number, pieces: Piece[], canvas: [number, number]): Layer[] {
  const hero = layers[heroAt] as ImageLayer;
  const home = { x: hero.x, y: hero.y, w: hero.w, h: hero.h };
  const area = freeSpace(hero, layers, canvas);
  const list = pieces.slice(0, 4);
  const g = 18, k = list.length - 1;
  const photo: Partial<ImageLayer> = { cutout: false, fit: 'cover', radius: 26, shadow: true, feather: 0 };
  const tag = (id: string, i: number, x: number, y: number, w: number) => textLayer({
    id, auto: 'zonas', name: `Precio ${i + 1}`, bind: 'price', item: i, x: x + 10, y: y + 10, w: Math.min(w - 20, 220), h: 44, font: 'body', size: 24, weight: 800, color: 'white', bg: 'primary', radius: 999, maxLines: 1, upper: false, align: 'center',
  });
  const added: Layer[] = [];
  let main: ImageLayer;
  if (k === 1) {
    // Dos productos a la par, del mismo tamaño.
    const side = Math.min((area.w - g) / 2, area.h);
    const sideV = Math.min(area.w, (area.h - g) / 2);
    const row = side >= sideV;
    const t = row ? side : sideV;
    const x0 = row ? area.x + (area.w - (2 * t + g)) / 2 : area.x + (area.w - t) / 2;
    const y0 = row ? area.y + (area.h - t) / 2 : area.y + (area.h - (2 * t + g)) / 2;
    const b = row ? { x: x0 + t + g, y: y0 } : { x: x0, y: y0 + t + g };
    main = { ...hero, ...photo, x: x0, y: y0, w: t, h: t, home };
    added.push(
      imageLayer({ id: `${hero.id}~z0`, auto: 'zonas', name: 'Producto 2', item: 1, ...b, w: t, h: t, ...photo }),
      tag(`${hero.id}~zp1`, 1, b.x, b.y, t),
    );
  } else {
    // El primero en grande y los demás en una columna al lado o en una fila abajo: lo que deje
    // más foto a la vista (sin miniaturas diminutas).
    const fit = (wide: boolean) => {
      const t = wide ? Math.min(area.w * 0.34, (area.h - (k - 1) * g) / k) : Math.min(area.h * 0.34, (area.w - (k - 1) * g) / k);
      const ms = wide ? Math.min(area.w - t - g, area.h) : Math.min(area.w, area.h - t - g);
      return { t, score: ms * ms + k * t * t * (t < ms * 0.22 ? 0.2 : 1) };
    };
    const wide = fit(true).score >= fit(false).score;
    const t = fit(wide).t;
    const mainBox = wide ? { x: area.x, y: area.y, w: area.w - t - g, h: area.h } : { x: area.x, y: area.y, w: area.w, h: area.h - t - g };
    const ms = Math.min(mainBox.w, mainBox.h);
    main = { ...hero, ...photo, x: mainBox.x + (mainBox.w - ms) / 2, y: mainBox.y + (mainBox.h - ms) / 2, w: ms, h: ms, home };
    list.slice(1).forEach((_, i) => {
      const x = wide ? area.x + area.w - t : area.x + (area.w - (k * t + (k - 1) * g)) / 2 + i * (t + g);
      const y = wide ? area.y + (area.h - (k * t + (k - 1) * g)) / 2 + i * (t + g) : area.y + area.h - t;
      added.push(
        imageLayer({ id: `${hero.id}~z${i}`, auto: 'zonas', name: `Producto ${i + 2}`, item: i + 1, x, y, w: t, h: t, ...photo, radius: 20 }),
        tag(`${hero.id}~zp${i + 1}`, i + 1, x - 4, y + t - 58, t),
      );
    });
  }
  return [...layers.slice(0, heroAt), main, ...added, ...layers.slice(heroAt + 1)];
}

/**
 * Dónde va la foto de un producto normal en una plantilla pensada para la prenda recortada (que se
 * desborda sobre textos a propósito): el mayor cuadrado del espacio del producto que no tapa el logo,
 * los títulos, el precio ni el botón, centrado ahí.
 */
function photoFrame(hero: ImageLayer, layers: Layer[], canvas: [number, number]): Box {
  const r = freeSpace(hero, layers, canvas);
  const side = Math.min(r.w, r.h);
  return { x: r.x + (r.w - side) / 2, y: r.y + (r.h - side) / 2, w: side, h: side };
}

/** El mayor espacio dentro del lugar del producto que no tapa logo, títulos, precio ni botón. */
function freeSpace(hero: ImageLayer, layers: Layer[], [W, H]: [number, number]): Box {
  const gap = 24, m = 40;
  const heroAt = layers.findIndex((l) => l.id === hero.id);
  const obstacles = layers.filter((l, i) => !l.hidden && !l.locked && l.id !== hero.id
    && (l.type === 'text' || l.type === 'logo' || l.type === 'colors' || (l.type === 'shape' && i > heroAt && !/^(Fondo|Luz|Sombra|Velo|Marco)/.test(l.name))));
  const hit = (a: Box, b: Box) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  // Nunca fuera del lienzo: la foto de un producto normal no se desborda como la prenda recortada.
  const x0 = Math.max(m, hero.x), y0 = Math.max(m, hero.y);
  let r: Box = { x: x0, y: y0, w: Math.min(W - m, hero.x + hero.w) - x0, h: Math.min(H - m, hero.y + hero.h) - y0 };
  // Se recorta el espacio por el lado que menos achica la foto, hasta que no tape nada.
  for (let guard = 0; guard < 12; guard++) {
    const ob = obstacles.find((o) => hit(r, o));
    if (!ob) break;
    const cuts: Box[] = [
      { ...r, y: ob.y + ob.h + gap, h: r.y + r.h - (ob.y + ob.h + gap) }, // por arriba
      { ...r, h: ob.y - gap - r.y }, // por abajo
      { ...r, x: ob.x + ob.w + gap, w: r.x + r.w - (ob.x + ob.w + gap) }, // por la izquierda
      { ...r, w: ob.x - gap - r.x }, // por la derecha
    ].filter((c) => c.w > 80 && c.h > 80);
    if (!cuts.length) break;
    r = cuts.reduce((a, b) => (Math.min(b.w, b.h) > Math.min(a.w, a.h) ? b : a));
  }
  return r;
}

/**
 * Arma (como capas reales y editables) las zonas elegidas de la personalizable en una plantilla de un
 * solo producto (Destacado, Oferta, Nuevo, Minimal…):
 * - 1 zona: la plantilla tal cual;
 * - 2 zonas: las dos a la par, lado a lado (una sobre otra si el espacio es alto), cada una con su nombre;
 * - 3 o 4: la principal en grande y las demás como detalles al lado o abajo, donde no tapen textos.
 * Las plantillas de varios espacios (Colección, Top 3, Frente y espalda…) no cambian: ya reparten una
 * zona por espacio. Se puede llamar las veces que sea: primero deshace el armado anterior.
 */
export function layoutZones(d: Design, s: Subject | null): Design {
  // 1) Quitar lo armado antes y devolver el producto a su lugar de la plantilla.
  let layers: Layer[] = d.layers.filter((l) => l.auto !== 'zonas').map((l) => (l.home ? { ...l, ...l.home, home: undefined } : l));
  const heroAt = layers.findIndex((l) => l.type === 'image' && !l.src && !l.mock && l.name === 'Foto del producto');
  const others = layers.filter((l, i) => i !== heroAt && l.type === 'image' && !l.src && !/^Fondo|^IA:/.test(l.name));
  if (heroAt < 0 || others.length || !s) return { ...d, layers };
  // La familia: todos en fila con su nombre (también con varios productos).
  if (d.template === 'familia') return { ...d, layers: s.pieces.length ? layoutFamily(layers, heroAt, s.pieces) : layers };
  // Varios productos (colección, promoción o elegidos): fotos en el espacio libre de la plantilla.
  if (s.kind === 'productos') return { ...d, layers: s.single || s.pieces.length < 2 ? layers : layoutProducts(layers, heroAt, s.pieces, designSize(d.ratio)) };
  if (s.pieces.length < 2) return { ...d, layers };
  const hero = layers[heroAt] as ImageLayer;
  const home = { x: hero.x, y: hero.y, w: hero.w, h: hero.h };
  const extra = s.pieces.slice(1, 4);
  const k = extra.length, g = 18;
  const nameOf = (p: Piece) => p.label.split(' · ').pop() ?? p.label;
  const pill = (id: string, text: string, x: number, y: number, w: number) => textLayer({
    id, auto: 'zonas', name: `Etiqueta ${text}`, text: text.toUpperCase(), x, y, w, h: 36, font: 'body', size: 20, weight: 800, color: 'white', bg: 'primary', radius: 999, maxLines: 1, letterSpacing: 1,
  });
  const above = layers.slice(heroAt + 1).filter((l) => !l.hidden && !l.locked && (l.type === 'text' || l.type === 'logo' || l.type === 'shape' || l.type === 'colors'));
  const overlap = (ax: number, ay: number, aw: number, ah: number) => above.reduce((c, b) =>
    c + Math.max(0, Math.min(ax + aw, b.x + b.w) - Math.max(ax, b.x)) * Math.max(0, Math.min(ay + ah, b.y + b.h) - Math.max(ay, b.y)), 0);
  const wide = hero.w >= hero.h * 0.85;
  const added: Layer[] = [];
  let main: ImageLayer;

  if (k === 1) {
    // Dos zonas a la par.
    const p = extra[0];
    // Lado a lado o una sobre otra: lo que deje las prendas más grandes. Se enciman un poco (como un par).
    const f = 0.58;
    const sideBySide = Math.min(hero.w * f, hero.h) >= Math.min(hero.w, hero.h * f);
    const a = sideBySide ? { x: hero.x, y: hero.y, w: hero.w * f, h: hero.h } : { x: hero.x, y: hero.y, w: hero.w, h: hero.h * f };
    const b = sideBySide ? { x: hero.x + hero.w * (1 - f), y: hero.y, w: hero.w * f, h: hero.h } : { x: hero.x, y: hero.y + hero.h * (1 - f), w: hero.w, h: hero.h * f };
    main = { ...hero, ...a, anchor: 'bottom', home };
    added.push(
      imageLayer({ id: `${hero.id}~z0`, auto: 'zonas', name: `Zona ${nameOf(p)}`, ...b, fit: 'contain', cutout: true, shadow: hero.shadow, anchor: 'bottom', mock: { templateId: null, zoneId: p.mock!.zoneId, view: p.mock!.view, design: null, size: 0.85 } }),
      // El nombre de cada zona, abajo, apoyado en el borde de la prenda.
      pill(`${hero.id}~zt-main`, nameOf(s.pieces[0]), a.x + a.w / 2 - 110, a.y + a.h - 44, 220),
      pill(`${hero.id}~zt0`, nameOf(p), b.x + b.w / 2 - 110, b.y + b.h - 44, 220),
    );
  } else {
    // La principal en grande y los detalles donde menos tapen.
    type Plan = { main: { x: number; y: number; w: number; h: number }; t: number; tiles: { x: number; y: number }[] };
    const col = (right: boolean): Plan => {
      const t = Math.min(hero.w * 0.28, (hero.h - (k - 1) * g) / k);
      const y0 = hero.y + (hero.h - (k * t + (k - 1) * g)) / 2;
      return { main: { x: right ? hero.x : hero.x + t + g, y: hero.y, w: hero.w - t - g, h: hero.h }, t, tiles: Array.from({ length: k }, (_, i) => ({ x: right ? hero.x + hero.w - t : hero.x, y: y0 + i * (t + g) })) };
    };
    const row = (): Plan => {
      const t = Math.min(hero.h * 0.24, (hero.w - (k - 1) * g) / k);
      const x0 = hero.x + (hero.w - (k * t + (k - 1) * g)) / 2;
      return { main: { x: hero.x, y: hero.y, w: hero.w, h: hero.h - t - g }, t, tiles: Array.from({ length: k }, (_, i) => ({ x: x0 + i * (t + g), y: hero.y + hero.h - t })) };
    };
    const plans = wide ? [col(true), col(false), row()] : [row(), col(true), col(false)];
    const cost = (pl: Plan) => pl.tiles.reduce((c, tl) => c + overlap(tl.x, tl.y, pl.t, pl.t), 0);
    const best = plans.reduce((x, y) => (cost(y) < cost(x) * 0.7 ? y : x));
    main = { ...hero, ...best.main, home };
    const t = best.t;
    extra.forEach((p, i) => {
      const { x, y } = best.tiles[i];
      const name = nameOf(p);
      added.push(
        shapeLayer({ id: `${hero.id}~zb${i}`, auto: 'zonas', name: `Marco ${name}`, x, y, w: t, h: t, fill: 'white', fillAlpha: 0.94, radius: 22, stroke: '#00000014' }),
        imageLayer({ id: `${hero.id}~z${i}`, auto: 'zonas', name: `Zona ${name}`, x: x + 6, y: y + 6, w: t - 12, h: t - 12, radius: 18, fit: 'cover', mock: { templateId: null, zoneId: p.mock!.zoneId, view: p.mock!.view, design: null, size: 0.85, closeUp: true } }),
        textLayer({ id: `${hero.id}~zt${i}`, auto: 'zonas', name: `Etiqueta ${name}`, text: name.toUpperCase(), x: x + 10, y: y + t - 44, w: t - 20, h: 34, font: 'body', size: Math.max(14, Math.min(20, t * 0.09)), weight: 800, color: 'white', bg: 'primary', radius: 999, maxLines: 1, letterSpacing: 1 }),
      );
    });
  }
  layers = [...layers.slice(0, heroAt), main, ...added, ...layers.slice(heroAt + 1)];
  return { ...d, layers };
}
