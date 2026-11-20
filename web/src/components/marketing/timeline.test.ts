import { describe, expect, it } from 'vitest';
import {
  END_SECONDS, frameAt, layout, motionAt, newScene, normalizeScene, slotsAt, TRANSITION_SECONDS, transitionTurn,
} from './timeline';
import { buildStoryboard, canBuild, STORYBOARDS, type StoryContext } from './storyboards';
import { sceneArt, zoneOf } from './sceneArt';
import type { SourceZone } from '../../services/marketing.service';

const three = () => [
  newScene({ seconds: 4, transition: 'fundido' }),
  newScene({ seconds: 3, transition: 'corte' }),
  newScene({ seconds: 5 }),
];

describe('línea de tiempo del video por escenas', () => {
  it('suma las escenas y el cierre; limita la duración de cada escena', () => {
    expect(layout(three(), true)).toEqual({ starts: [0, 4, 7], body: 12, total: 12 + END_SECONDS });
    expect(layout(three(), false).total).toBe(12);
    expect(layout([newScene({ seconds: 40 }), newScene({ seconds: 0.5 })], false).starts).toEqual([0, 30]);
  });

  it('dice qué escena se ve y cuándo hay transición', () => {
    const s = three();
    const half = TRANSITION_SECONDS / 2;
    expect(frameAt(s, true, 1)).toMatchObject({ index: 0, transition: null });
    // Fundido centrado en el corte entre la 1 y la 2.
    const before = frameAt(s, true, 4 - half / 2);
    expect(before.index).toBe(0);
    expect(before.transition).toMatchObject({ from: 0, to: 1, kind: 'fundido' });
    expect(before.transition!.p).toBeCloseTo(0.25, 5);
    const after = frameAt(s, true, 4 + half / 2);
    expect(after).toMatchObject({ index: 1, transition: { from: 0, to: 1 } });
    expect(after.transition!.p).toBeCloseTo(0.75, 5);
    // "Corte": sin transición.
    expect(frameAt(s, true, 7 - 0.05).transition).toBeNull();
    expect(frameAt(s, true, 7 + 0.05)).toMatchObject({ index: 2, transition: null });
    // Cierre (índice = número de escenas).
    const end = frameAt(s, true, 12 + END_SECONDS / 2);
    expect(end.index).toBe(3);
    expect(end.end).toBeCloseTo(0.5, 5);
    expect(frameAt(s, false, 13).index).toBe(2);
  });

  it('cada transición dura lo suyo y la última escena pasa al cierre con la suya', () => {
    const s = [newScene({ seconds: 4, transition: 'zoom', transitionSeconds: 1.2 }), newScene({ seconds: 4, transition: 'cortina', transitionSeconds: 0.4 })];
    expect(frameAt(s, true, 4 - 0.55).transition).toMatchObject({ from: 0, to: 1, kind: 'zoom', seconds: 1.2 });
    expect(frameAt(s, true, 4 - 0.65).transition).toBeNull();
    const toEnd = frameAt(s, true, 8 - 0.1);
    expect(toEnd.transition).toMatchObject({ from: 1, to: 2, kind: 'cortina' });
    expect(toEnd.transition!.p).toBeCloseTo(0.25, 5);
    expect(frameAt(s, true, 8 + 0.1)).toMatchObject({ index: 2, transition: { from: 1, to: 2 } });
    // Sin cierre, la última no tiene transición.
    expect(frameAt(s, false, 8 - 0.1).transition).toBeNull();
  });

  it('los dos maniquíes se turnan entre las escenas 3D y precargan la siguiente', () => {
    const s = three();
    expect(slotsAt(s, true, 1)).toEqual([0, 1]);
    expect(slotsAt(s, true, 5)).toEqual([2, 1]);
    expect(slotsAt(s, true, 4 - 0.1)).toEqual([0, 1]);
    expect(slotsAt([newScene()], true, 1)).toEqual([0, -1]);
    // Fotos y textos no usan maniquí: durante la foto (1) el maniquí 0 ya carga la 3D siguiente (2).
    const mixed = [newScene({ seconds: 4 }), newScene({ kind: 'foto', seconds: 3 }), newScene({ seconds: 4 }), newScene({ kind: 'texto', seconds: 3 }), newScene({ seconds: 4 })];
    expect(slotsAt(mixed, true, 1)).toEqual([0, -1]);
    expect(slotsAt(mixed, true, 5.5)).toEqual([2, -1]);
    expect(slotsAt(mixed, true, 12)).toEqual([4, -1]);
    expect(slotsAt([newScene({ kind: 'texto' })], true, 1)).toEqual([-1, -1]);
  });

  it('cada movimiento gira, acerca y sube o baja la cámara como se espera', () => {
    expect(motionAt('giro', 2, 4).turn).toBeCloseTo(Math.PI, 5);
    expect(motionAt('giro', 2, 4, 2).turn).toBeCloseTo(Math.PI * 2, 5);
    expect(motionAt('revelar', 0, 5).turn).toBeCloseTo(Math.PI, 5);
    expect(motionAt('revelar', 4, 5).turn).toBeCloseTo(0, 5);
    expect(motionAt('espalda', 0, 4).turn).toBeCloseTo(Math.PI, 5);
    expect(motionAt('acercar', 0, 4).zoom).toBe(1);
    expect(motionAt('acercar', 4, 4).zoom).toBeCloseTo(1.65, 5);
    expect(motionAt('heroe', 0, 4).lift).toBeLessThan(-0.5);
    expect(motionAt('detalle', 2, 4).zoom).toBeGreaterThan(2);
    // La prenda sola se anima: flota, se balancea, cae desde arriba y termina en su lugar.
    const floats = [0, 0.5, 1, 1.5, 2].map((t) => motionAt('flotar', t, 4).rise ?? 0);
    expect(Math.max(...floats) - Math.min(...floats)).toBeGreaterThan(0.05);
    expect(Math.abs(motionAt('balanceo', 0.4, 4).tilt ?? 0)).toBeGreaterThan(0.05);
    expect(motionAt('caida', 0, 4).rise).toBeGreaterThan(1);
    expect(Math.abs(motionAt('caida', 3, 4).rise ?? 0)).toBeLessThan(0.1);
    expect(motionAt('pirueta', 2, 4).turn).toBeCloseTo(Math.PI * 2, 5);
    expect(motionAt('rebote', 0.3, 4).rise).toBeGreaterThan(0);
    // Los de cámara no mueven la prenda.
    expect(motionAt('giro', 1, 4).rise ?? 0).toBe(0);
    // El giro rápido termina de frente (vueltas completas).
    expect(Math.cos(motionAt('giroRapido', 4, 4).turn)).toBeCloseTo(1, 5);
  });

  it('el remolino acelera la escena que sale y frena la que entra', () => {
    const s = [newScene({ seconds: 4, transition: 'remolino' }), newScene({ seconds: 4 })];
    expect(transitionTurn(s, false, 2, 0)).toBe(0);
    expect(transitionTurn(s, false, 4 - 0.01, 0)).toBeGreaterThan(1);
    expect(transitionTurn(s, false, 4 + 0.01, 1)).toBeLessThan(-0.5);
  });

  it('normaliza escenas guardadas o de la IA', () => {
    const n = normalizeScene({ kind: 'nave', motion: 'volar', seconds: 99, transition: 'x', transitionSeconds: 9, color: 'rojo', title: 'a'.repeat(200) });
    expect(n).toMatchObject({ kind: '3d', motion: 'giro', seconds: 30, transition: 'fundido', transitionSeconds: 1.5, color: '#FFFFFF' });
    expect(n.title).toHaveLength(60);
    expect(normalizeScene({ kind: 'foto', photoFit: 'completa', showPrice: true })).toMatchObject({ kind: 'foto', photoFit: 'completa', showPrice: true });
  });
});

describe('guiones listos', () => {
  const ctx: StoryContext = {
    template: { id: 9, name: 'Camiseta', colors: ['#FFFFFF', '#000000', '#FF0000'] },
    photoTemplate: { id: 9, name: 'Camiseta', zones: [5, 7] },
    products: [
      { id: 1, name: 'Suéter', image: '/a.png', price: 50000, listPrice: 60000, discountPercent: 17 },
      { id: 2, name: 'Gorra', image: '/b.png', price: 30000 },
    ],
    promo: { label: '-20%', code: 'VEXA20', name: 'Fin de semana' },
    title: '',
    subtitle: '',
  };

  it('cada guion arma escenas válidas con lo elegido', () => {
    for (const b of STORYBOARDS) {
      expect(canBuild(b.id, ctx), b.id).toBe(true);
      const scenes = buildStoryboard(b.id, ctx);
      expect(scenes.length, b.id).toBeGreaterThan(0);
      scenes.forEach((sc) => {
        if (sc.kind === '3d') expect(sc.templateId).toBe(9);
        if (sc.kind === 'foto') expect(sc.photoSource === 'plantilla' ? sc.templateId : sc.product).not.toBeNull();
      });
    }
    expect(buildStoryboard('colores', ctx).map((s) => s.color)).toEqual(['#FFFFFF', '#000000', '#FF0000']);
    // Personalízala: la foto de la plantilla con el diseño en cada zona.
    const p2d = buildStoryboard('personaliza2d', ctx).filter((s) => s.kind === 'foto');
    expect(p2d.map((s) => [s.photoSource, s.templateId, s.zoneId])).toEqual([['plantilla', 9, 5], ['plantilla', 9, 7]]);
    const oferta = buildStoryboard('oferta', ctx);
    expect(oferta[0]).toMatchObject({ kind: 'texto', title: '-20%' });
    expect(oferta[oferta.length - 1].title).toBe('VEXA20');
    const col = buildStoryboard('coleccion', ctx);
    expect(col.filter((s) => s.kind === 'foto').map((s) => s.badge)).toEqual(['-17%', '']);
  });

  it('sin prenda 3D los guiones 3D salen con las fotos; sin nada elegido, solo los que no lo necesitan', () => {
    const noTpl = { ...ctx, template: null, photoTemplate: null };
    expect(canBuild('lanzamiento', noTpl)).toBe(true);
    expect(buildStoryboard('lanzamiento', noTpl).every((s) => s.kind !== '3d')).toBe(true);
    expect(canBuild('coleccion', noTpl)).toBe(true);
    expect(buildStoryboard('mixto', noTpl).every((s) => s.kind === 'foto')).toBe(true);
    // Sin nada elegido solo quedan las que no necesitan productos (reseña y beneficios).
    const nothing = { ...noTpl, products: [] };
    expect(STORYBOARDS.filter((b) => canBuild(b.id, nothing)).map((b) => b.id)).toEqual(['resena', 'beneficios']);
  });
});

describe('diseño de la escena sobre el maniquí', () => {
  const zones: SourceZone[] = [
    { id: 7, name: 'Espalda', view: 'espalda', x: 20, y: 20, w: 60, h: 60, circle: false },
    { id: 5, name: 'Frente', view: 'frente', x: 30, y: 24, w: 40, h: 40, circle: true },
  ];
  const img = { naturalWidth: 10, naturalHeight: 10 } as HTMLImageElement;

  it('va en la zona elegida (o la del frente), centrado y al tamaño pedido', () => {
    expect(zoneOf({ zoneId: null }, zones).id).toBe(5);
    expect(zoneOf({ zoneId: 7 }, zones).id).toBe(7);
    expect(zoneOf({ zoneId: null }, []).name).toBe('Pecho');
    const sc = newScene({ design: { id: 1, name: 'Logo', image: '/d.png' }, zoneId: 7, size: 0.5 });
    const { art, frames } = sceneArt(sc, zones, img);
    expect(art.back?.layers[0]).toMatchObject({ cx: 50, cy: 50, w: 30, h: 30, clip: { x: 20, y: 20, w: 60, h: 60 } });
    expect(frames.back).toEqual({ x: 20, y: 20, w: 60, h: 60 });
    expect(art.front).toBeUndefined();
  });

  it('el diseño se corre y se agranda en el 3D; si sale de su zona, la textura lo alcanza', () => {
    const base = sceneArt(newScene({ design: { id: 1, name: 'x', image: '/x.png' }, zoneId: 5, size: 1 }), zones, img);
    const moved = sceneArt(newScene({ design: { id: 1, name: 'x', image: '/x.png' }, zoneId: 5, size: 1, offsetY: 0.2 }), zones, img);
    const l0 = Object.values(base.art)[0]!.layers[0], l1 = Object.values(moved.art)[0]!.layers[0];
    expect(l1.cy - l0.cy).toBeCloseTo(20);
    const f0 = Object.values(base.frames)[0]!, f1 = Object.values(moved.frames)[0]!;
    expect(f1.y + f1.h).toBeGreaterThan(f0.y + f0.h);
    // Dentro de su zona conserva la forma de la zona (redonda).
    expect((l0.clip as { circle?: boolean }).circle).toBe(true);
  });

  it('sin diseño o sin imagen cargada la prenda va lisa', () => {
    expect(sceneArt(newScene(), zones, img).art).toEqual({});
    expect(sceneArt(newScene({ design: { id: 1, name: 'x', image: '/x.png' } }), zones, null).art).toEqual({});
  });
});

describe('plantillas de video para personalizables', () => {
  const ctx: StoryContext = {
    template: null, products: [], promo: null, title: 'Julius Caesar', subtitle: '',
    photoTemplate: {
      id: 60, name: 'Camiseta Oversize', zones: [1, 2, 3, 4],
      zoneInfo: [{ id: 1, name: 'Frente', view: 'frente' }, { id: 2, name: 'Pecho izquierdo', view: 'frente' }, { id: 3, name: 'Espalda', view: 'espalda' }, { id: 4, name: 'Manga derecha', view: 'manga-derecha' }],
    },
    design: { id: 7, name: 'Laurel', image: '/uploads/laurel.png' },
  };
  it('tienen su propio grupo y se arman con la prenda y el diseño elegido', () => {
    const ids = STORYBOARDS.filter((s) => s.group === 'Personalizable').map((s) => s.id);
    expect(ids).toEqual(['premium2d', 'frenteEspalda2d', 'personaliza2d', 'disenoPrenda2d']);
    for (const id of ids) {
      expect(canBuild(id, ctx)).toBe(true);
      expect(canBuild(id, { ...ctx, photoTemplate: null })).toBe(false);
      const mocks = buildStoryboard(id, ctx).filter((s) => s.kind === 'foto');
      expect(mocks.length, id).toBeGreaterThan(1);
      expect(mocks.every((s) => s.photoSource === 'plantilla' && s.templateId === 60 && s.design?.id === 7), id).toBe(true);
    }
  });
  it('frente y espalda usan las zonas de cada vista; la premium incluye la manga', () => {
    expect(buildStoryboard('frenteEspalda2d', ctx).map((s) => s.zoneId)).toEqual([1, 3, 1]);
    expect(buildStoryboard('premium2d', ctx).filter((s) => s.kind === 'foto').map((s) => s.zoneId)).toEqual([3, 1, 4, 2, 1]);
  });
});

describe('fondo propio de la escena', () => {
  it('se valida al cargar y por defecto la escena usa el de la plantilla', () => {
    expect(newScene().bg).toBeNull();
    const ok = normalizeScene({ kind: 'texto', bg: { style: 'mosaicoDisenos', base: '#000000', ink: '#ABD04C', density: 0.3, size: 999, angle: 10, grain: false } });
    expect(ok?.bg).toMatchObject({ style: 'mosaicoDisenos', base: '#000000', size: 400, angle: 10, grain: false, move: true, image: null });
    expect(normalizeScene({ kind: 'texto', bg: { style: 'video' } })?.bg).toBeNull();
    // Nada de imágenes incrustadas en el borrador.
    expect(normalizeScene({ kind: 'foto', bg: { style: 'foto', image: 'data:image/png;base64,AAAA' } })?.bg?.image).toBeNull();
    expect(normalizeScene({ kind: 'foto', bg: { style: 'foto', image: '/uploads/marketing/ia/fondo.webp', dim: 0.4 } })?.bg).toMatchObject({ image: '/uploads/marketing/ia/fondo.webp', dim: 0.4 });
    // Mosaico de diseños: los elegidos (sin incrustados) y si suma los de las prendas.
    const mos = normalizeScene({ kind: 'texto', bg: { style: 'mosaicoDisenos', designs: ['/uploads/a.png', 'data:image/png;base64,AA', 7], useSceneDesigns: false } })?.bg;
    expect(mos).toMatchObject({ designs: ['/uploads/a.png'], useSceneDesigns: false });
    expect(normalizeScene({ kind: 'texto', bg: { style: 'mosaicoDisenos' } })?.bg).toMatchObject({ designs: [], useSceneDesigns: true });
  });
});

describe('elementos movidos en el video', () => {
  it('se guardan acotados y solo los que existen', () => {
    expect(newScene().moves).toEqual({});
    const sc = normalizeScene({ kind: 'foto', moves: { prenda: { x: 0.2, y: -3, s: 9 }, titulo: { x: 'a' }, raro: { x: 1 } } });
    expect(sc?.moves).toEqual({ prenda: { x: 0.2, y: -1, s: 3 }, titulo: { x: 0, y: 0, s: 1 } });
  });
});
