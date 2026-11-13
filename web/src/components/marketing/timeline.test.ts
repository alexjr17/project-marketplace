import { describe, expect, it } from 'vitest';
import { END_SECONDS, frameAt, layout, motionAt, newScene, slotsAt, TRANSITION_SECONDS } from './timeline';
import { sceneArt, zoneOf } from './sceneArt';
import type { SourceZone } from '../../services/marketing.service';

const three = () => [
  newScene({ seconds: 4, transition: 'fundido' }),
  newScene({ seconds: 3, transition: 'corte' }),
  newScene({ seconds: 5 }),
];

describe('línea de tiempo del video 3D', () => {
  it('suma las escenas y el cierre; limita la duración de cada escena', () => {
    expect(layout(three(), true)).toEqual({ starts: [0, 4, 7], body: 12, total: 12 + END_SECONDS });
    expect(layout(three(), false).total).toBe(12);
    expect(layout([newScene({ seconds: 40 }), newScene({ seconds: 0.5 })], false).starts).toEqual([0, 10]);
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
    // Cierre.
    const end = frameAt(s, true, 12 + END_SECONDS / 2);
    expect(end.index).toBe(-1);
    expect(end.end).toBeCloseTo(0.5, 5);
    expect(frameAt(s, false, 13).index).toBe(2);
  });

  it('los dos maniquíes se turnan y precargan la escena siguiente', () => {
    const s = three();
    expect(slotsAt(s, true, 1)).toEqual([0, 1]);
    expect(slotsAt(s, true, 5)).toEqual([2, 1]);
    // En la transición se ven las dos escenas.
    expect(slotsAt(s, true, 4 - 0.1)).toEqual([0, 1]);
    expect(slotsAt([newScene()], true, 1)).toEqual([0, -1]);
  });

  it('cada movimiento gira y acerca la cámara como se espera', () => {
    expect(motionAt('giro', 2, 4).turn).toBeCloseTo(Math.PI, 5);
    expect(motionAt('revelar', 0, 5).turn).toBeCloseTo(Math.PI, 5);
    expect(motionAt('revelar', 4, 5).turn).toBeCloseTo(0, 5);
    expect(motionAt('espalda', 0, 4).turn).toBeCloseTo(Math.PI, 5);
    expect(motionAt('acercar', 0, 4).zoom).toBe(1);
    expect(motionAt('acercar', 4, 4).zoom).toBeCloseTo(1.65, 5);
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

  it('sin diseño o sin imagen cargada la prenda va lisa', () => {
    expect(sceneArt(newScene(), zones, img).art).toEqual({});
    expect(sceneArt(newScene({ design: { id: 1, name: 'x', image: '/x.png' } }), zones, null).art).toEqual({});
  });
});
