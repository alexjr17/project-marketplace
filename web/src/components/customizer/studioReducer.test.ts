import { describe, expect, it } from 'vitest';
import { initialStudioState, studioReducer, type StudioState } from './studioReducer';
import type { StudioDesign, StudioZone } from './customizerModel';

const zone: StudioZone = { id: 1, viewSlug: 'frente', name: 'Frente', x: 20, y: 20, width: 60, height: 60, shape: 'rect', price: 8000, isRequired: true, isBlocked: false, sortOrder: 1 };
const back: StudioZone = { ...zone, id: 2, viewSlug: 'espalda', name: 'Espalda' };
const design = (id = 'a', over: Partial<StudioDesign> = {}): StudioDesign => ({
  id, viewSlug: 'frente', viewType: 'frente', zoneId: 'view-frente', templateZoneId: 1, zoneName: 'Frente', imageData: 'data:x',
  position: { x: 50, y: 50 }, size: { width: 20, height: 20 }, rotation: 0, opacity: 1, ...over,
});

const run = (...actions: Parameters<typeof studioReducer>[1][]) => actions.reduce<StudioState>(studioReducer, initialStudioState);

describe('studioReducer', () => {
  it('agrega, selecciona y limita el diseño a su zona', () => {
    const s = run({ type: 'add', design: design('a', { position: { x: 5, y: 5 } }), zone });
    expect(s.selectedId).toBe('a');
    expect(s.designs[0].position).toEqual({ x: 30, y: 30 });
  });

  it('deshace y rehace', () => {
    let s = run({ type: 'add', design: design(), zone }, { type: 'update', id: 'a', patch: { position: { x: 60, y: 60 } }, zone });
    expect(s.designs[0].position).toEqual({ x: 60, y: 60 });
    s = studioReducer(s, { type: 'undo' });
    expect(s.designs[0].position).toEqual({ x: 50, y: 50 });
    s = studioReducer(s, { type: 'undo' });
    expect(s.designs).toHaveLength(0);
    s = studioReducer(s, { type: 'redo' });
    s = studioReducer(s, { type: 'redo' });
    expect(s.designs[0].position).toEqual({ x: 60, y: 60 });
    expect(studioReducer(s, { type: 'redo' })).toBe(s);
  });

  it('un arrastre (begin + updates sin registro) se deshace de una vez', () => {
    let s = run({ type: 'add', design: design(), zone }, { type: 'begin' });
    for (let i = 1; i <= 5; i++) s = studioReducer(s, { type: 'update', id: 'a', patch: { position: { x: 50 + i, y: 50 } }, zone, record: false });
    expect(s.past).toHaveLength(2);
    s = studioReducer(s, { type: 'undo' });
    expect(s.designs[0].position.x).toBe(50);
  });

  it('un cambio nuevo borra lo que se podía rehacer', () => {
    let s = run({ type: 'add', design: design(), zone }, { type: 'update', id: 'a', patch: { rotation: 30 } }, { type: 'undo' });
    expect(s.future).toHaveLength(1);
    s = studioReducer(s, { type: 'update', id: 'a', patch: { rotation: 10 } });
    expect(s.future).toHaveLength(0);
  });

  it('normaliza la rotación y la opacidad', () => {
    const s = run({ type: 'add', design: design(), zone }, { type: 'update', id: 'a', patch: { rotation: 270, opacity: 3 } });
    expect(s.designs[0].rotation).toBe(-90);
    expect(s.designs[0].opacity).toBe(1);
  });

  it('no deja crecer el diseño más que la zona', () => {
    const s = run({ type: 'add', design: design(), zone }, { type: 'update', id: 'a', patch: { size: { width: 120, height: 60 } }, zone });
    expect(s.designs[0].size).toEqual({ width: 60, height: 30 });
  });

  it('duplica en otra vista, trae al frente y quita', () => {
    let s = run({ type: 'add', design: design('a'), zone }, { type: 'add', design: design('b'), zone });
    s = studioReducer(s, { type: 'toFront', id: 'a' });
    expect(s.designs.map((d) => d.id)).toEqual(['b', 'a']);
    s = studioReducer(s, { type: 'duplicate', id: 'a', zone: back, newId: 'c' });
    expect(s.designs.find((d) => d.id === 'c')).toMatchObject({ viewSlug: 'espalda', templateZoneId: 2, zoneName: 'Espalda' });
    expect(s.selectedId).toBe('c');
    s = studioReducer(s, { type: 'remove', id: 'c' });
    expect(s.selectedId).toBeNull();
    expect(s.designs).toHaveLength(2);
  });

  it('cargar (editar desde el carrito) reinicia el historial', () => {
    const s = run({ type: 'add', design: design(), zone }, { type: 'load', designs: [design('z')] });
    expect(s).toMatchObject({ selectedId: 'z', past: [], future: [] });
  });
});
