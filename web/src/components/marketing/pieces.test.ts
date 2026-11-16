import { describe, expect, it } from 'vitest';
import type { SourceProduct } from '../../services/marketing.service';
import { buildDesign, type ImageLayer } from './design';
import { defaultPlan, garmentSubject, garmentZones, productSubject, resolveDesign } from './pieces';
import { buildStoryboard, canBuild, STORYBOARDS, type StoryContext } from './storyboards';

const prod = (id: number, images: string[]): SourceProduct => ({ id, name: `P${id}`, price: 50000, listPrice: 50000, discountPercent: 0, image: images[0] ?? null, images });
const shirt: SourceProduct = {
  ...prod(60, ['/front.png']), name: 'Oversize',
  viewImages: { front: '/front.png', back: '/back.png', side: '/side.png' },
  zones: [
    { id: 3, name: 'Espalda', view: 'back', x: 30, y: 20, w: 40, h: 50, circle: false },
    { id: 1, name: 'Frente', view: 'front', x: 30, y: 20, w: 40, h: 50, circle: false },
    { id: 2, name: 'Pecho izquierdo', view: 'front', x: 55, y: 25, w: 10, h: 10, circle: false },
    { id: 4, name: 'Manga derecha', view: 'manga-derecha', x: 20, y: 25, w: 9, h: 13, circle: false },
  ],
};
const laurel = { id: 9, name: 'Laurel', image: '/laurel.png' };
const images = (d: { layers: unknown[] }) => d.layers.filter((l): l is ImageLayer => (l as ImageLayer).type === 'image');

describe('con qué trabaja la pieza', () => {
  it('un producto: cada foto es una pieza; varios: una por producto con su foto principal', () => {
    const one = productSubject([prod(1, ['/a.png', '/b.png', '/c.png'])], {});
    expect(one.kind === 'productos' && one.single).toBe(true);
    expect(one.pieces.map((p) => p.image)).toEqual(['/a.png', '/b.png', '/c.png']);
    // Solo las fotos elegidas.
    expect(productSubject([prod(1, ['/a.png', '/b.png', '/c.png'])], { 1: ['/c.png'] }).pieces.map((p) => p.image)).toEqual(['/c.png']);
    const many = productSubject([prod(1, ['/a.png', '/b.png']), prod(2, ['/x.png'])], { 1: ['/b.png'] });
    expect(many.pieces.map((p) => [p.productId, p.image])).toEqual([[1, '/b.png'], [2, '/x.png']]);
  });

  it('personalizable: zonas por vista, al empezar una por vista, cada una con su diseño', () => {
    const zones = garmentZones(shirt);
    expect(zones.map((z) => z.id)).toEqual([1, 2, 3, 4]);
    const plan = defaultPlan(zones);
    expect(Object.entries(plan).filter(([, v]) => v.show).map(([k]) => Number(k))).toEqual([1, 3, 4]);
    const s = garmentSubject(shirt, { ...plan, 3: { show: true, design: laurel } });
    expect(s.pieces.map((p) => [p.mock?.zoneId, p.mock?.view, p.mock?.design?.id ?? null])).toEqual([[1, 'front', null], [3, 'back', 9], [4, 'side', null]]);
  });

  it('cualquier plantilla de producto muestra la personalizable con sus vistas', () => {
    const s = garmentSubject(shirt, { 1: { show: true, design: laurel }, 3: { show: true, design: null } });
    const d = resolveDesign(buildDesign('coleccion', '1:1'), s);
    const slots = images(d).filter((l) => /^Foto \d$/.test(l.name));
    expect(slots[0].mock?.zoneId).toBe(1);
    expect(slots[0].mock?.design?.id).toBe(9);
    expect(slots[1].mock?.zoneId).toBe(3);
    expect(slots[2].mock).toBeUndefined(); // no hay tercera vista elegida: queda libre
  });

  it('las plantillas de vistas toman el diseño de su zona; con un producto usan sus fotos', () => {
    const s = garmentSubject(shirt, { 1: { show: true, design: laurel }, 3: { show: true, design: { ...laurel, id: 10 } } });
    const views = images(resolveDesign(buildDesign('dosVistas', '1:1'), s)).filter((l) => l.mock);
    expect(views.map((l) => [l.mock?.view, l.mock?.design?.id])).toEqual([['front', 9], ['back', 10]]);
    // Producto normal con frente y espalda: la vista de espalda usa su segunda foto, sin montaje.
    const p = productSubject([prod(1, ['/a.png', '/b.png'])], {});
    const pv = images(resolveDesign(buildDesign('dosVistas', '1:1'), p)).filter((l) => l.name.startsWith('Vista'));
    expect(pv.map((l) => [l.mock ?? null, l.item])).toEqual([[null, 0], [null, 1]]);
  });

  it('todas las plantillas de video sirven para productos y para personalizables', () => {
    const base: StoryContext = { template: null, products: [], promo: null, title: 'X', subtitle: '' };
    const productCtx: StoryContext = { ...base, products: [{ id: 1, name: 'P1', image: '/a.png', price: 1 }, { id: 1, name: 'P1', image: '/b.png', price: 1 }] };
    const garmentCtx: StoryContext = {
      ...base, products: [{ id: 60, name: 'O', image: null }, { id: 60, name: 'O', image: null }],
      garment: { kind: 'foto', templateId: 60, name: 'O', pieces: [{ zoneId: 1, view: 'front', label: 'Frente', design: laurel }, { zoneId: 3, view: 'back', label: 'Espalda', design: null }] },
    };
    for (const sb of STORYBOARDS) {
      for (const ctx of [productCtx, garmentCtx]) {
        expect(canBuild(sb.id, ctx), sb.id).toBe(true);
        const scenes = buildStoryboard(sb.id, ctx);
        expect(scenes.length, sb.id).toBeGreaterThan(0);
        if (ctx === garmentCtx) {
          // Ninguna escena de foto de producto: todo sale de la personalizable.
          expect(scenes.every((sc) => sc.kind !== 'foto' || sc.photoSource === 'plantilla'), sb.id).toBe(true);
        }
      }
    }
    const fb = buildStoryboard('frenteEspalda2d', garmentCtx).filter((s) => s.kind === 'foto');
    expect(fb.map((s) => [s.zoneId, s.design?.id ?? null])).toEqual([[1, 9], [3, null], [1, 9]]);
    const fbp = buildStoryboard('frenteEspalda2d', productCtx).filter((s) => s.kind === 'foto');
    expect(fbp.map((s) => s.product?.image)).toEqual(['/a.png', '/b.png', '/a.png']);
  });

  it('el color elegido de la prenda va en todas sus vistas, en los posts y en los videos', () => {
    const s = garmentSubject(shirt, { 1: { show: true, design: laurel }, 3: { show: true, design: null } }, '#1E3A5F');
    expect(s.pieces.every((p) => p.mock?.color === '#1E3A5F')).toBe(true);
    const views = images(resolveDesign(buildDesign('dosVistas', '1:1'), s)).filter((l) => l.mock);
    expect(views.every((l) => l.mock?.color === '#1E3A5F')).toBe(true);
    const ctx: StoryContext = {
      template: null, products: [{ id: 60, name: 'O', image: null }], promo: null, title: 'X', subtitle: '',
      garment: { kind: 'foto', templateId: 60, name: 'O', color: '#1E3A5F', colors: ['#FFFFFF', '#1E3A5F', '#DC2626'], pieces: [{ zoneId: 1, view: 'front', label: 'Frente', design: laurel }] },
    };
    expect(buildStoryboard('frenteEspalda2d', ctx).filter((x) => x.kind === 'foto').every((x) => x.color === '#1E3A5F')).toBe(true);
    // "Todos los colores" con fotos: una escena por color de la prenda.
    expect(buildStoryboard('colores', ctx).map((x) => x.color)).toEqual(['#FFFFFF', '#1E3A5F', '#DC2626']);
  });

  it('colores disponibles: todas las plantillas de video terminan con el carrusel de colores', () => {
    const ctx: StoryContext = {
      template: null, products: [{ id: 60, name: 'O', image: null }], promo: null, title: 'X', subtitle: '',
      garment: { kind: 'foto', templateId: 60, name: 'O', pieces: [{ zoneId: 1, view: 'front', label: 'Frente', design: laurel }] },
      showcase: [{ hex: '#FFFFFF', name: 'Blanco' }, { hex: '#1E3A5F', name: 'Azul Marino' }, { hex: '#DC2626', name: 'Rojo' }],
    };
    for (const sb of STORYBOARDS.filter((x) => x.id !== 'colores' && canBuild(x.id, ctx))) {
      const tail = buildStoryboard(sb.id, ctx).slice(-3);
      expect(tail.map((x) => [x.color, x.badge]), sb.id).toEqual([['#FFFFFF', 'BLANCO'], ['#1E3A5F', 'AZUL MARINO'], ['#DC2626', 'ROJO']]);
      expect(tail[0].title).toBe('Disponible en 3 colores');
    }
    // Sin la opción, nada extra.
    expect(buildStoryboard('frenteEspalda2d', { ...ctx, showcase: null }).some((x) => x.badge === 'ROJO')).toBe(false);
  });
});
