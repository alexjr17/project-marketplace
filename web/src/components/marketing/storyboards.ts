/**
 * Plantillas de video (guiones listos): arman las escenas (tipo, movimientos, textos y transiciones)
 * con lo que se eligió promocionar. Después todo se puede editar escena por escena. Sirven para
 * reels, historias y posts de video (el formato se elige aparte).
 */
import { newScene, type Scene, type SceneDesign, type SceneProduct } from './timeline';

export type StoryboardId =
  | 'reelRapido' | 'personaliza2d' | 'frenteEspalda2d' | 'premium2d' | 'disenoPrenda2d' | 'lanzamiento' | 'colores' | 'coleccion' | 'oferta' | 'mixto' | 'ritmo' | 'top3' | 'encuesta' | 'regresiva' | 'resena' | 'beneficios';

export interface StoryContext {
  /** Prenda 3D para las escenas 3D (la elegida o la primera con modelo). */
  template: { id: number; name: string; colors: string[] } | null;
  /** Plantilla personalizable con fotos y zonas (montaje 2D) y sus zonas usables. */
  photoTemplate?: { id: number; name: string; zones: number[]; zoneInfo?: { id: number; name: string; view: string | null }[] } | null;
  /** Diseño para estampar en las escenas de prenda (el que ya se eligió en el video o en el post). */
  design?: SceneDesign | null;
  /**
   * La personalizable elegida, con las vistas/zonas que se muestran y su diseño (ver pieces.ts):
   * con fotos por vista ('foto') o con maniquí 3D ('3d'). Si está, TODAS las plantillas la usan.
   */
  /** Colores disponibles que se muestran al final (opcional). */
  showcase?: { hex: string; name: string }[] | null;
  garment?: { kind: 'foto' | '3d'; templateId: number; name: string; color?: string | null; colors?: string[]; pieces: { zoneId: number; view: 'front' | 'back' | 'side' | null; label: string; design: SceneDesign | null; size?: number; offset?: { x: number; y: number } }[] } | null;
  /** Productos con foto (los elegidos, los de la colección o los de la promoción). */
  products: SceneProduct[];
  promo: { label: string; code?: string | null; name: string } | null;
  title: string;
  subtitle: string;
}

/** Plantillas de video pensadas para cada tipo de contenido (ver ContentKind en design.ts). */
export const STORIES_FOR: Record<'producto' | 'varios' | 'coleccion' | 'promocion' | 'personalizable' | 'diseno', StoryboardId[]> = {
  producto: ['reelRapido', 'lanzamiento', 'ritmo', 'regresiva', 'resena'],
  varios: ['coleccion', 'reelRapido', 'ritmo', 'top3', 'encuesta', 'mixto'],
  coleccion: ['coleccion', 'reelRapido', 'ritmo', 'top3', 'mixto'],
  promocion: ['oferta', 'regresiva', 'reelRapido', 'coleccion'],
  personalizable: ['premium2d', 'frenteEspalda2d', 'personaliza2d', 'disenoPrenda2d', 'colores', 'lanzamiento'],
  diseno: ['personaliza2d', 'disenoPrenda2d', 'ritmo'],
};

export type StoryGroup = 'Personalizable' | 'Productos' | 'Prenda 3D' | 'Venta' | 'Interacción' | 'Marca';
export const STORY_GROUPS: StoryGroup[] = ['Personalizable', 'Productos', 'Venta', 'Prenda 3D', 'Interacción', 'Marca'];

export const STORYBOARDS: { id: StoryboardId; label: string; hint: string; group: StoryGroup; needs: '3d' | 'plantilla2d' | 'fotos' | 'dosFotos' | 'alguno' | 'nada' }[] = [
  { id: 'reelRapido', label: 'Reel rápido', hint: 'Una foto por producto a pantalla completa con su precio, y el cierre', group: 'Productos', needs: 'fotos' },
  { id: 'coleccion', label: 'Colección', hint: 'Portada y una escena por producto con su precio', group: 'Productos', needs: 'fotos' },
  { id: 'ritmo', label: 'Ritmo rápido', hint: 'Escenas cortas con cortes y efectos, para tendencias', group: 'Productos', needs: 'alguno' },
  { id: 'oferta', label: 'Oferta', hint: 'El descuento en grande, el producto y el código', group: 'Venta', needs: 'alguno' },
  { id: 'regresiva', label: 'Cuenta regresiva', hint: '3, 2, 1… y aparece el producto: para lanzamientos y drops', group: 'Venta', needs: 'alguno' },
  { id: 'premium2d', label: 'Colección premium', hint: 'La prenda personalizable con tu diseño: espalda en grande, frente, manga y el precio', group: 'Personalizable', needs: 'plantilla2d' },
  { id: 'frenteEspalda2d', label: 'Frente y espalda', hint: 'La prenda por delante y por detrás con su diseño, y el precio', group: 'Personalizable', needs: 'plantilla2d' },
  { id: 'personaliza2d', label: 'Personalízala', hint: 'La prenda con el diseño en cada zona (frente, espalda…) y el llamado a crear la tuya', group: 'Personalizable', needs: 'plantilla2d' },
  { id: 'disenoPrenda2d', label: 'Tu diseño en la prenda', hint: 'Ritmo rápido: el diseño saltando por cada zona de la prenda', group: 'Personalizable', needs: 'plantilla2d' },
  { id: 'lanzamiento', label: 'Lanzamiento 3D', hint: 'Anuncio, la prenda se revela, detalle del diseño y giro final', group: 'Prenda 3D', needs: '3d' },
  { id: 'colores', label: 'Todos los colores', hint: 'La prenda girando en cada color, una escena por color', group: 'Prenda 3D', needs: '3d' },
  { id: 'mixto', label: '3D + productos', hint: 'La prenda en 3D entre las fotos de los productos', group: 'Prenda 3D', needs: 'alguno' },
  { id: 'top3', label: 'Top 3', hint: 'Los tres favoritos, del tercero al primero', group: 'Interacción', needs: 'dosFotos' },
  { id: 'encuesta', label: '¿Cuál prefieres?', hint: 'Opción A, opción B y la pregunta para que comenten', group: 'Interacción', needs: 'dosFotos' },
  { id: 'resena', label: 'Reseña', hint: 'La opinión de un cliente con estrellas y el producto', group: 'Interacción', needs: 'nada' },
  { id: 'beneficios', label: 'Beneficios', hint: 'Envío, cambios y pagos, uno por escena', group: 'Marca', needs: 'nada' },
];

/**
 * ¿Se puede armar? Todas las plantillas sirven para cualquier tipo de producto (con fotos, varios o una
 * personalizable con fotos o 3D); solo piden tener algo elegido, y las de dos opciones, dos piezas.
 */
export function canBuild(id: StoryboardId, ctx: StoryContext): boolean {
  const need = STORYBOARDS.find((s) => s.id === id)?.needs;
  if (need === 'nada') return true;
  const pieces = ctx.garment?.pieces.length ?? ctx.products.length;
  if (need === 'dosFotos') return pieces > 1;
  return !!ctx.template || !!ctx.garment || !!ctx.photoTemplate?.zones.length || ctx.products.length > 0;
}

const priceBadge = (p: SceneProduct) => (p.discountPercent ? `-${p.discountPercent}%` : '');

/**
 * Carrusel de los colores disponibles de la prenda: la vista principal en cada color, rápido, con el
 * nombre del color y "Disponible en N colores" al empezar.
 */
export function colorScenes(ctx: StoryContext): Scene[] {
  const list = ctx.showcase ?? [];
  if (list.length < 2) return [];
  const g = ctx.garment;
  const t = ctx.template;
  const pc = g?.pieces[0];
  return list.slice(0, 10).map((c, i) => {
    const text = { title: i === 0 ? `Disponible en ${list.length} colores` : '', badge: c.name.toUpperCase(), seconds: i === 0 ? 1.8 : 1.2, transition: 'deslizar' as const, transitionSeconds: 0.35, textAnim: 'pop' as const };
    if (g?.kind === 'foto' && pc) {
      return newScene({ kind: 'foto', photoSource: 'plantilla', templateId: g.templateId, zoneId: pc.zoneId, design: pc.design, color: c.hex, photoFit: 'tarjeta', photoMove: 'quieta', ...text });
    }
    return newScene({ kind: '3d', templateId: g?.templateId ?? t?.id ?? null, color: c.hex, zoneId: pc?.zoneId ?? null, design: pc?.design ?? null, motion: 'giro', ...text });
  });
}

export function buildStoryboard(id: StoryboardId, ctx: StoryContext): Scene[] {
  const scenes = buildBase(id, ctx);
  // Con "mostrar los colores disponibles", todas las plantillas terminan con el carrusel de colores.
  return id === 'colores' ? scenes : [...scenes, ...colorScenes(ctx)];
}

function buildBase(id: StoryboardId, ctx: StoryContext): Scene[] {
  const t = ctx.template;
  const color0 = ctx.garment?.color ?? t?.colors[0] ?? '#FFFFFF';
  const g = ctx.garment ?? null;
  // Solo la plantilla con fotos (sin el detalle de vistas): sus zonas, con el diseño elegido.
  const pt = ctx.photoTemplate;
  const gx = g ?? (pt?.zones.length ? {
    kind: 'foto' as const, templateId: pt.id, name: pt.name,
    pieces: (pt.zoneInfo ?? pt.zones.map((id) => ({ id, name: '', view: null }))).map((z) => {
      const v = `${z.view ?? ''} ${z.name}`.toLowerCase();
      const view = /front|frente/.test(v) ? 'front' as const : /back|espalda/.test(v) ? 'back' as const : /manga|sleeve|side|lateral/.test(v) ? 'side' as const : null;
      return { zoneId: z.id, view, label: z.name, design: ctx.design ?? null };
    }),
  } : null);
  /** Escena de la vista i de la personalizable (foto con su diseño, o maniquí 3D con el diseño en su zona). */
  const gScene = (i: number, base?: Partial<Scene>): Scene => {
    const pc = gx!.pieces[i % gx!.pieces.length];
    if (gx!.kind === 'foto') {
      return newScene({
        kind: 'foto', photoSource: 'plantilla', templateId: gx!.templateId, zoneId: pc.zoneId, design: pc.design, color: color0, photoFit: 'tarjeta',
        size: 'size' in pc && pc.size ? pc.size : 0.85, offsetX: 'offset' in pc ? pc.offset?.x ?? 0 : 0, offsetY: 'offset' in pc ? pc.offset?.y ?? 0 : 0,
        photoMove: i % 2 ? 'alejar' : 'acercar', seconds: 3, transition: i % 2 ? 'deslizar' : 'empujar', textAnim: 'deslizar', ...base,
      });
    }
    return newScene({ kind: '3d', templateId: gx!.templateId, color: color0, zoneId: pc.zoneId, design: pc.design, motion: i % 2 ? 'detalle' : 'giro', seconds: 3.4, transition: i % 2 ? 'barrido' : 'empujar', ...base });
  };
  let fallbackIdx = 0;
  /** Escena 3D; sin prenda 3D, la siguiente pieza (vista de la personalizable o foto del producto). */
  const d3 = (base: Partial<Scene>): Scene => {
    if (t) {
      const pc = g?.kind === '3d' ? g.pieces[0] : null;
      return newScene({ kind: '3d', templateId: t.id, color: color0, ...(pc ? { zoneId: pc.zoneId, design: pc.design } : {}), ...base });
    }
    const i = fallbackIdx++;
    if (g) return gScene(i, { title: base.title, subtitle: base.subtitle, showPrice: base.showPrice, badge: base.badge, seconds: base.seconds, transition: base.transition, textAnim: base.textAnim });
    const p = ctx.products[i % Math.max(1, ctx.products.length)];
    return p ? photoOf(p, i, { title: base.title ?? p.name, subtitle: base.subtitle, showPrice: base.showPrice ?? p.price != null, badge: base.badge, seconds: base.seconds, transition: base.transition })
      : text(base.title || ctx.title || 'Nuevo', { subtitle: base.subtitle });
  };
  /** Pieza i: con una personalizable, su vista i; si no, la foto del producto. */
  const photo = (p: SceneProduct, i: number, base?: Partial<Scene>) => (g ? gScene(i, { title: p.name, showPrice: p.price != null, ...base }) : photoOf(p, i, base));
  const photoOf = (p: SceneProduct, i: number, base?: Partial<Scene>) => newScene({
    kind: 'foto', product: p, photoMove: i % 2 ? 'alejar' : 'acercar', photoFit: 'tarjeta', title: p.name, showPrice: p.price != null,
    badge: priceBadge(p), seconds: 3, transition: i % 2 ? 'deslizar' : 'empujar', textAnim: 'deslizar', ...base,
  });
  const text = (title: string, base?: Partial<Scene>) => newScene({ kind: 'texto', title, textPos: 'centro', textAnim: 'letras', seconds: 2.5, transition: 'zoom', ...base });
  const products = ctx.products.slice(0, 6);
  const title = ctx.title || t?.name || products[0]?.name || 'Nuevo';

  switch (id) {
    case 'lanzamiento':
      return [
        text(ctx.title || 'Nuevo lanzamiento', { subtitle: ctx.subtitle || t?.name || '', badge: 'NUEVO', textAnim: 'pop', transition: 'circulo', textBg: 'malla' }),
        d3({ motion: 'revelar', seconds: 4, transition: 'remolino', title: t?.name ?? '', textAnim: 'subir' }),
        d3({ motion: 'detalle', seconds: 3.5, transition: 'barrido', subtitle: 'Personalízala con tu diseño', textAnim: 'deslizar' }),
        d3({ motion: 'orbita', seconds: 5, transition: 'fundido', showPrice: true, title: 'Diseña la tuya', textAnim: 'escribir' }),
      ];
    case 'colores': {
      // Con fotos de la personalizable: la prenda en cada uno de sus colores.
      if (!t && g?.kind === 'foto' && g.colors?.length) {
        return g.colors.slice(0, 6).map((c, i, all) => gScene(0, {
          color: c, title: i === 0 ? title : '', subtitle: i === all.length - 1 ? 'Elige tu color' : '', showPrice: i === all.length - 1,
          seconds: i === 0 ? 3.4 : 2.6, transition: 'empujar', photoMove: i % 2 ? 'alejar' : 'acercar',
        }));
      }
      if (!t) return (g ? g.pieces : products).map((_, i) => d3({ title: i === 0 ? title : '', showPrice: i === 0, seconds: 3, transition: 'empujar' }));
      const colors = (t?.colors.length ? t.colors : ['#FFFFFF', '#1F1D1E']).slice(0, 6);
      return colors.map((c, i) => d3({
        color: c, motion: i === 0 ? 'revelar' : i % 2 ? 'vaiven' : 'giro', seconds: i === 0 ? 4 : 3, transition: 'empujar',
        title: i === 0 ? title : '', subtitle: i === colors.length - 1 ? 'Elige tu color' : '', showPrice: i === colors.length - 1,
      }));
    }
    case 'coleccion':
      return [
        text(ctx.title || 'La colección', { subtitle: ctx.subtitle || `${products.length} favoritos para ti`, textBg: 'malla', transition: 'persiana' }),
        ...products.map((p, i) => photo(p, i)),
      ];
    case 'oferta': {
      const big = ctx.promo?.label || priceBadge(products[0] ?? { id: 0, name: '', image: null }) || 'OFERTA';
      const middle = t ? d3({ motion: 'giro', seconds: 4, transition: 'destello', showPrice: true, title: t.name }) : products[0] ? photo(products[0], 0, { transition: 'destello' }) : null;
      return [
        text(big, { subtitle: ctx.promo?.name || ctx.subtitle || 'Por tiempo limitado', textBg: 'rayas', textAnim: 'pop', seconds: 2.5, transition: 'glitch' }),
        ...(middle ? [middle] : []),
        ...products.slice(t ? 0 : 1, 3).map((p, i) => photo(p, i, { seconds: 2.5, transition: 'barrido' })),
        text(ctx.promo?.code ? ctx.promo.code : 'Compra ya', { subtitle: ctx.promo?.code ? 'Usa este código al pagar' : 'Antes de que se acabe', textAnim: 'escribir', transition: 'cortina' }),
      ];
    }
    case 'mixto': {
      const out: Scene[] = [];
      if (t) out.push(d3({ motion: 'heroe', seconds: 4, transition: 'zoom', title, textAnim: 'pop' }));
      products.slice(0, 4).forEach((p, i) => out.push(photo(p, i)));
      if (t) out.push(d3({ motion: 'giroRapido', seconds: 3.5, transition: 'fundido', title: 'Hazla tuya', showPrice: true, textAnim: 'letras' }));
      return out;
    }
    case 'personaliza2d':
    case 'frenteEspalda2d':
    case 'premium2d':
    case 'disenoPrenda2d': {
      // Vistas: de la personalizable (su zona en esa vista) o, con productos, la foto que corresponde.
      const g = gx;
      const n = g ? g.pieces.length : products.length;
      const idxOf = (v: 'front' | 'back' | 'side' | 'pecho'): number | null => {
        if (g) {
          const k = v === 'pecho' ? g.pieces.findIndex((x) => /pecho|chest/i.test(x.label)) : g.pieces.findIndex((x) => x.view === v);
          return k >= 0 ? k : null;
        }
        const k = v === 'front' ? 0 : v === 'back' ? 1 : v === 'side' ? 2 : -1;
        return k >= 0 && k < n ? k : null;
      };
      const at = (k: number | null, i: number, base?: Partial<Scene>): Scene[] => {
        if (k == null) return [];
        if (g) return [gScene(k, { title: '', ...base })];
        const p = products[k];
        return p ? [photoOf(p, i, { title: '', showPrice: false, badge: '', ...base })] : [];
      };
      const name = ctx.title || g?.name || products[0]?.name || 'Hazla tuya';
      const front = idxOf('front') ?? 0;
      if (id === 'frenteEspalda2d') {
        return [
          ...at(front, 0, { title: name, subtitle: ctx.subtitle || 'Frente', textAnim: 'pop', seconds: 3.2, transition: 'zoom' }),
          ...at(idxOf('back') ?? (n > 1 ? 1 : null), 1, { subtitle: 'Espalda', seconds: 3.2, transition: 'barrido' }),
          ...at(front, 2, { title: 'Hazla tuya', showPrice: true, photoMove: 'quieta', seconds: 3, transition: 'circulo', textAnim: 'letras' }),
        ];
      }
      if (id === 'premium2d') {
        const back = idxOf('back');
        return [
          text(name, { subtitle: ctx.subtitle || 'Colección', textBg: 'mosaicoDisenos', textAnim: 'letras', seconds: 2.6, transition: 'cortina' }),
          ...at(back ?? front, 0, { badge: back != null ? 'ESPALDA' : '', photoMove: 'alejar', seconds: 3.4, transition: 'fundido' }),
          ...(back != null ? at(front, 1, { badge: 'FRENTE', seconds: 3, transition: 'empujar' }) : []),
          ...at(idxOf('side'), 2, { badge: 'MANGA', photoMove: 'acercar', seconds: 2.6, transition: 'deslizar' }),
          ...at(idxOf('pecho'), 3, { badge: 'DETALLE', photoMove: 'acercar', seconds: 2.4, transition: 'zoom' }),
          ...at(front, 4, { title: 'Hecha para durar', subtitle: 'Diseñada para ti', showPrice: true, photoMove: 'quieta', seconds: 3.2, transition: 'destello', textAnim: 'escribir' }),
        ];
      }
      if (id === 'disenoPrenda2d') {
        const fx: Scene['transition'][] = ['glitch', 'zoom', 'mosaico', 'barrido', 'remolino'];
        return [
          text('Tu diseño', { subtitle: 'en cada rincón de la prenda', textBg: 'mosaicoDisenos', textAnim: 'pop', seconds: 1.8, transition: 'glitch' }),
          ...Array.from({ length: Math.min(5, n) }, (_, k) => at(k, k, {
            badge: g ? g.pieces[k].label.split(' · ').pop()!.toUpperCase() : '', seconds: 1.7, transition: fx[k % fx.length], transitionSeconds: 0.45, photoMove: 'acercar',
          })).flat(),
          text('Crea la tuya', { subtitle: 'Sube tu diseño y míralo al instante', textBg: 'acento', textAnim: 'escribir', seconds: 2.4, transition: 'fundido' }),
        ];
      }
      return [
        text(ctx.title || 'Diseña la tuya', { subtitle: g?.name ?? products[0]?.name ?? '', textAnim: 'pop', seconds: 2.4, transition: 'circulo' }),
        ...Array.from({ length: Math.min(4, n) }, (_, k) => at(k, k, { title: k === 0 ? name : '', subtitle: k === 0 ? 'Tu diseño, donde quieras' : '', showPrice: k === 0 })).flat(),
        text('Crea la tuya hoy', { subtitle: 'Sube tu diseño y míralo al instante', textBg: 'mosaicoDisenos', textAnim: 'escribir', seconds: 2.6, transition: 'fundido' }),
      ];
    }
    case 'reelRapido':
      return products.map((p, i) => photo(p, i, {
        photoFit: 'completa', photoMove: i % 2 ? 'alejar' : 'acercar', seconds: 2.6, transition: 'fundido', transitionSeconds: 0.5,
        title: i === 0 && ctx.title ? ctx.title : p.name, subtitle: i === 0 ? ctx.subtitle : '', textAnim: 'subir',
      }));
    case 'top3': {
      const top = products.slice(0, 3);
      return [
        text(ctx.title || `Top ${top.length} de la semana`, { textBg: 'claro', textAnim: 'pop', seconds: 2.2, transition: 'barrido' }),
        ...top.map((p, i) => photo(p, i, { badge: `#${top.length - i}`, seconds: 2.6, transition: 'empujar', textAnim: 'pop' })).reverse()
          .map((s, i, arr) => ({ ...s, badge: `#${arr.length - i}` })),
      ];
    }
    case 'encuesta': {
      const [a, b = a] = products;
      return [
        text('¿Cuál prefieres?', { textAnim: 'pop', seconds: 2, transition: 'barrido', textBg: 'malla' }),
        photo(a, 0, { badge: 'A', seconds: 2.6, transition: 'glitch', photoFit: 'tarjeta' }),
        photo(b, 1, { badge: 'B', seconds: 2.6, transition: 'zoom', photoFit: 'tarjeta' }),
        text('Comenta A o B', { subtitle: 'Te leemos 👇', textBg: 'acento', textAnim: 'escribir', seconds: 2.6, transition: 'fundido' }),
      ];
    }
    case 'regresiva': {
      const reveal = t ? d3({ motion: 'revelar', seconds: 4, transition: 'fundido', title: t.name, showPrice: true }) : photo(products[0], 0, { photoFit: 'completa', seconds: 3.5, transition: 'fundido' });
      return [
        text('3', { textAnim: 'pop', seconds: 1.5, transition: 'corte', textBg: 'marca' }),
        text('2', { textAnim: 'pop', seconds: 1.5, transition: 'corte', textBg: 'acento' }),
        text('1', { textAnim: 'pop', seconds: 1.5, transition: 'destello', textBg: 'marca' }),
        { ...reveal, badge: 'YA DISPONIBLE' },
        ...(t && products[0] ? [photo(products[0], 1, { seconds: 2.8 })] : []),
      ];
    }
    case 'resena': {
      const p = products[0];
      return [
        text('★★★★★', { subtitle: 'Lo que dicen nuestros clientes', textBg: 'claro', textAnim: 'letras', seconds: 2.4, transition: 'deslizar' }),
        text('“Me encantó la calidad y el diseño quedó perfecto”', { subtitle: 'Laura M. · Cliente verificada', textAnim: 'escribir', textBg: 'malla', seconds: 4, transition: p || t ? 'circulo' : 'fundido' }),
        ...(p ? [photo(p, 0, { seconds: 3, title: p.name })] : t ? [d3({ motion: 'giro', seconds: 4, title: t.name })] : []),
      ];
    }
    case 'beneficios':
      return [
        text(ctx.title || '¿Por qué comprar con nosotros?', { textAnim: 'pop', seconds: 2.6, transition: 'empujar', textBg: 'mosaicoMarca' }),
        text('Envío a todo el país', { badge: '✓', textBg: 'claro', textAnim: 'deslizar', seconds: 2, transition: 'empujar' }),
        text('Cambios fáciles', { badge: '✓', textBg: 'acento', textAnim: 'deslizar', seconds: 2, transition: 'empujar' }),
        text('Paga como quieras', { badge: '✓', textBg: 'claro', textAnim: 'deslizar', seconds: 2, transition: 'empujar' }),
        ...(products[0] ? [photo(products[0], 0, { seconds: 3, transition: 'fundido' })] : t ? [d3({ motion: 'giro', seconds: 4, transition: 'fundido' })] : []),
      ];
    case 'ritmo': {
      const out: Scene[] = [text(title, { seconds: 1.8, textAnim: 'pop', transition: 'glitch', textBg: 'acento' })];
      const fx: Scene['transition'][] = ['zoom', 'mosaico', 'remolino', 'glitch', 'barrido'];
      if (t) out.push(d3({ motion: 'giroRapido', seconds: 2.5, transition: fx[out.length % fx.length], speed: 1.5 }));
      products.slice(0, 4).forEach((p, i) => out.push(photo(p, i, { seconds: 1.8, photoFit: 'completa', title: '', badge: priceBadge(p), transition: fx[(out.length + i) % fx.length], transitionSeconds: 0.45 })));
      if (t) out.push(d3({ motion: 'detalle', seconds: 2.2, transition: 'remolino', title: 'Personalízala' }));
      return out.map((s) => ({ ...s, transitionSeconds: Math.min(s.transitionSeconds, 0.5) }));
    }
  }
}
