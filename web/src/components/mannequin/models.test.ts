import { describe, expect, it } from 'vitest';
import { view3DOf } from './models';

describe('view3DOf', () => {
  it('suéteres: frente, espalda y mangas', () => {
    expect(view3DOf('frente')).toBe('front');
    expect(view3DOf('bolsillo')).toBe('front');
    expect(view3DOf('espalda')).toBe('back');
    expect(view3DOf('manga-izquierda')).toBe('leftSleeve');
    expect(view3DOf('manga-derecha')).toBe('rightSleeve');
  });

  it('gorras y objetos: atrás y lados', () => {
    expect(view3DOf('atras')).toBe('back');
    expect(view3DOf('lado-izquierdo')).toBe('leftSleeve');
    expect(view3DOf('lado-derecho')).toBe('rightSleeve');
    expect(view3DOf(null)).toBe('front');
  });
});
