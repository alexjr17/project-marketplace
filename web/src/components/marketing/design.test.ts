import { describe, expect, it } from 'vitest';
import { buildDesign, DESIGN_RATIOS, DESIGN_TEMPLATES, designSize, reflowDesign, resizeDesign, textLayer } from './design';
import { textOf, type DesignData } from './designRender';

const data: DesignData = {
  brand: { name: 'Toclex', slogan: 'Hecho con intención', primary: '#1F1D1E', accent: '#ABD04C', paper: '#F2F1EC', logo: null, logoOnDark: null },
  title: '',
  subtitle: 'Nuevo drop',
  cta: 'Compra ya',
  items: [
    { name: 'Gorra', price: 39000, listPrice: 50000, discountPercent: 22, image: null },
    { name: 'Hoodie', price: 95000, image: null },
  ],
  promo: null,
  images: {},
};

describe('diseñador de piezas', () => {
  it('cada plantilla arma capas dentro del lienzo en los tres formatos', () => {
    for (const t of DESIGN_TEMPLATES) {
      for (const { value: ratio } of DESIGN_RATIOS) {
        const d = buildDesign(t.id, ratio);
        const [W, H] = designSize(ratio);
        expect(d.layers.length, `${t.id} ${ratio}`).toBeGreaterThan(2);
        expect(new Set(d.layers.map((l) => l.id)).size).toBe(d.layers.length);
        for (const l of d.layers) {
          // Puede salirse un poco (sombras, luces), pero no quedar fuera del lienzo.
          expect(l.x + l.w, `${t.id} ${ratio} ${l.name}`).toBeGreaterThan(0);
          expect(l.x, `${t.id} ${ratio} ${l.name}`).toBeLessThan(W);
          expect(l.y + l.h, `${t.id} ${ratio} ${l.name}`).toBeGreaterThan(0);
          expect(l.y, `${t.id} ${ratio} ${l.name}`).toBeLessThan(H);
        }
      }
    }
  });

  it('las plantillas de vistas traen una prenda por vista, cada una con su diseño', () => {
    const views = (id: 'dosVistas' | 'tresVistas', r: '1:1' | '9:16') => buildDesign(id, r).layers.flatMap((l) => (l.type === 'image' && l.mock ? [l.mock.view] : []));
    expect(views('dosVistas', '1:1')).toEqual(['front', 'back']);
    expect(views('dosVistas', '9:16')).toEqual(['front', 'back']);
    expect(views('tresVistas', '1:1')).toEqual(['front', 'back', 'side']);
    // Sin plantilla propia: usan la personalizable elegida en Productos.
    expect(buildDesign('tresVistas', '4:5').layers.every((l) => l.type !== 'image' || l.mock?.templateId === null)).toBe(true);
  });

  it('las plantillas traen fondos con estilo y el fondo elegido se conserva al cambiar de formato', () => {
    const bg = (id: Parameters<typeof buildDesign>[0]) => buildDesign(id, '1:1').layers[0];
    expect(bg('anuncio')).toMatchObject({ type: 'pattern', style: 'mosaicoMarca', locked: true });
    expect(bg('oferta')).toMatchObject({ type: 'pattern', style: 'malla' });
    expect(bg('drop')).toMatchObject({ type: 'pattern', style: 'rayas' });
    expect(bg('personaliza')).toMatchObject({ type: 'pattern', style: 'mosaicoDisenos', useMockDesigns: true });
    const d = buildDesign('anuncio', '1:1');
    const edited = { ...d, layers: d.layers.map((l, i) => (i === 0 && l.type === 'pattern' ? { ...l, style: 'mosaicoDisenos' as const, designs: ['/d.png'], grain: false } : l)) };
    const r = reflowDesign(edited, '9:16');
    expect(r.layers[0]).toMatchObject({ type: 'pattern', style: 'mosaicoDisenos', designs: ['/d.png'], grain: false, h: 1920 });
  });

  it('los fondos y velos decorativos quedan bloqueados', () => {
    const d = buildDesign('destacado', '1:1');
    expect(d.layers.filter((l) => /^Sombra/.test(l.name)).every((l) => l.locked)).toBe(true);
    expect(d.layers.find((l) => l.name === 'Título')?.locked).toBeFalsy();
  });

  it('los textos vinculados salen de los datos de la pieza', () => {
    expect(textOf(textLayer({ bind: 'title' }), data)).toBe('Gorra');
    expect(textOf(textLayer({ bind: 'title' }), { ...data, title: 'Llegó' })).toBe('Llegó');
    expect(textOf(textLayer({ bind: 'price', item: 1 }), data)).toBe('$95.000');
    expect(textOf(textLayer({ bind: 'listPrice' }), data)).toBe('$50.000');
    expect(textOf(textLayer({ bind: 'listPrice', item: 1 }), data)).toBe('');
    expect(textOf(textLayer({ bind: 'discount' }), data)).toBe('-22%');
    expect(textOf(textLayer({ bind: 'code' }), { ...data, promo: { label: '-20%', code: 'VEXA20', name: 'Fin de semana' } })).toBe('VEXA20');
    expect(textOf(textLayer({ text: 'Fijo', bind: null }), data)).toBe('Fijo');
  });

  it('al cambiar de formato un diseño editado se rearma con la distribución nueva y conserva los cambios', () => {
    const d = buildDesign('tresVistas', '1:1');
    const edited = {
      ...d,
      layers: [
        ...d.layers
          .filter((l) => l.name !== 'Precio')
          .map((l) => (l.type === 'image' && l.mock ? { ...l, mock: { ...l.mock, design: { id: 1, name: 'Logo', image: '/d.png' } } } : l.name === 'Título' && l.type === 'text' ? { ...l, text: 'Mi título', bind: null, color: 'accent' as const } : l)),
        textLayer({ name: 'Mi texto', y: 540 }),
      ],
    };
    const r = reflowDesign(edited, '9:16');
    expect(r.ratio).toBe('9:16');
    const t = r.layers.find((l) => l.name === 'Título');
    expect(t).toMatchObject({ text: 'Mi título', bind: null, color: 'accent' });
    // La distribución es la de 9:16 (la vista del frente arriba, a todo el ancho).
    expect(r.layers.find((l) => l.name === 'Vista FRENTE')).toMatchObject(buildDesign('tresVistas', '9:16').layers.find((l) => l.name === 'Vista FRENTE')!.type === 'image' ? { w: buildDesign('tresVistas', '9:16').layers.find((l) => l.name === 'Vista FRENTE')!.w } : {});
    expect(r.layers.filter((l) => l.type === 'image' && l.mock?.design?.id === 1)).toHaveLength(3);
    // Lo quitado no vuelve; lo agregado se conserva.
    expect(r.layers.some((l) => l.name === 'Precio')).toBe(false);
    expect(r.layers.find((l) => l.name === 'Mi texto')?.y).toBe(Math.round(540 * (1920 / 1080)));
  });

  it('al cambiar de formato las capas se reacomodan al nuevo alto', () => {
    const d = buildDesign('destacado', '1:1');
    const r = resizeDesign(d, '9:16');
    expect(r.ratio).toBe('9:16');
    // El fondo a sangre cubre el lienzo nuevo completo; el producto se escala con el alto.
    expect(r.layers.find((l) => l.name === 'Fondo')?.h).toBe(1920);
    const hero = d.layers.find((l) => l.name === 'Foto del producto')!;
    expect(r.layers.find((l) => l.name === 'Foto del producto')!.h).toBe(Math.round(hero.h * (1920 / 1080)));
    const title = d.layers.find((l) => l.name === 'Título')!;
    expect(r.layers.find((l) => l.name === 'Título')!.y).toBe(Math.round(title.y * (1920 / 1080)));
  });

  it('el producto sale recortado y grande en las plantillas de producto', () => {
    for (const id of ['destacado', 'oferta', 'nuevo', 'editorial', 'sticker', 'drop'] as const) {
      for (const ratio of ['1:1', '4:5', '9:16'] as const) {
        const d = buildDesign(id, ratio);
        const [W, H] = ratio === '1:1' ? [1080, 1080] : ratio === '4:5' ? [1080, 1350] : [1080, 1920];
        const hero = d.layers.find((l) => l.name === 'Foto del producto');
        expect(hero?.type === 'image' && hero.cutout, `${id} ${ratio}`).toBe(true);
        // Al menos la mitad del lienzo para el producto, y sin salirse de abajo.
        expect(hero!.w * hero!.h, `${id} ${ratio}`).toBeGreaterThan(W * H * 0.5);
        expect(hero!.y + hero!.h, `${id} ${ratio}`).toBeLessThanOrEqual(H);
      }
    }
  });

  it('con colores disponibles, cada plantilla les reserva su lugar sin tapar los textos', () => {
    const colors = ['#FFFFFF', '#1E3A5F', '#DC2626'];
    const overlap = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) =>
      Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
    for (const t of DESIGN_TEMPLATES) {
      for (const ratio of ['1:1', '4:5', '9:16'] as const) {
        const d = buildDesign(t.id, ratio, { colors });
        const [W, H] = designSize(ratio);
        const strip = d.layers.find((l) => l.type === 'colors');
        expect(strip, `${t.id} ${ratio}`).toBeTruthy();
        expect(strip!.x >= 0 && strip!.y >= 0 && strip!.x + strip!.w <= W && strip!.y + strip!.h <= H, `${t.id} ${ratio} dentro`).toBe(true);
        const hits = d.layers.filter((l) => l.type === 'text' && !l.locked && !l.hidden && overlap(strip!, l) > 0.15 * Math.min(strip!.w * strip!.h, l.w * l.h)).map((l) => l.name);
        expect(hits, `${t.id} ${ratio}`).toEqual([]);
        // Sin colores, no hay franja.
        expect(buildDesign(t.id, ratio).layers.some((l) => l.type === 'colors')).toBe(false);
      }
    }
  });
});
