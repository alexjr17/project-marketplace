import { describe, expect, it } from 'vitest';
import { BASE, DEFAULT_TEXT, layoutText, weightFor, type TextSpec } from './textArt';

/** Todas las letras miden lo mismo (60) para que las cuentas sean fáciles. */
const measure = () => 60;
const spec = (p: Partial<TextSpec>): TextSpec => ({ ...DEFAULT_TEXT, spacing: 0, ...p });

describe('layoutText', () => {
  it('recto: una letra al lado de la otra, varias líneas y alineación', () => {
    const l = layoutText(spec({ text: 'AB\nC', shape: 'recto', align: 'left', lineHeight: 1.2 }), measure);
    expect(l.glyphs.map((g) => [g.ch, g.x, g.y])).toEqual([['A', 30, 0], ['B', 90, 0], ['C', 30, BASE * 1.2]]);
    const c = layoutText(spec({ text: 'AB\nC', shape: 'recto', align: 'center' }), measure);
    expect(c.glyphs[2].x).toBe(60); // centrada bajo las dos de arriba
    expect(c.box.w).toBe(120);
  });

  it('el espacio entre letras separa sin cambiar el ancho de cada letra', () => {
    const l = layoutText(spec({ text: 'AB', spacing: 20 }), measure);
    expect(l.glyphs[1].x - l.glyphs[0].x).toBe(60 + 20);
  });

  it('mayúsculas', () => {
    expect(layoutText(spec({ text: 'sofía', upper: true }), measure).glyphs.map((g) => g.ch).join('')).toBe('SOFÍA');
  });

  it('arco: simétrico, por arriba y las letras giran hacia afuera', () => {
    const l = layoutText(spec({ text: 'ABCDE', shape: 'arco', curve: 60 }), measure);
    const [a, , mid, , e] = l.glyphs;
    expect(mid.x).toBeCloseTo(0);
    expect(a.x).toBeCloseTo(-e.x);
    expect(a.y).toBeCloseTo(e.y);
    expect(a.y).toBeGreaterThan(mid.y); // los extremos quedan más abajo: forma de arco
    expect(a.rot).toBeLessThan(0);
    expect(e.rot).toBeGreaterThan(0);
  });

  it('puente: los extremos quedan más arriba (sonrisa)', () => {
    const l = layoutText(spec({ text: 'ABCDE', shape: 'puente', curve: 60 }), measure);
    const [a, , mid, , e] = l.glyphs;
    expect(a.y).toBeLessThan(mid.y);
    expect(a.rot).toBeGreaterThan(0);
    expect(e.rot).toBeLessThan(0);
  });

  it('círculo: las letras dan casi la vuelta completa', () => {
    const l = layoutText(spec({ text: 'NAVIDAD FELIZ', shape: 'circulo' }), measure);
    const first = l.glyphs[0], last = l.glyphs[l.glyphs.length - 1];
    expect(last.rot - first.rot).toBeGreaterThan(Math.PI * 1.6);
    expect(Math.abs(l.box.w - l.box.h)).toBeLessThan(l.box.w * 0.2); // queda redondo
  });

  it('onda: sube y baja', () => {
    const l = layoutText(spec({ text: 'ABCDEFGHIJ', shape: 'onda', curve: 80 }), measure);
    const ys = l.glyphs.map((g) => g.y);
    expect(Math.max(...ys)).toBeGreaterThan(10);
    expect(Math.min(...ys)).toBeLessThan(-10);
  });

  it('las formas curvas van en una línea', () => {
    const l = layoutText(spec({ text: 'FELIZ\nNAVIDAD', shape: 'arco' }), measure);
    expect(l.glyphs.map((g) => g.ch).join('')).toBe('FELIZ NAVIDAD');
  });

  it('texto vacío: una caja mínima (no rompe el dibujo)', () => {
    expect(layoutText(spec({ text: '' }), measure).box.w).toBeGreaterThan(0);
  });
});

describe('weightFor', () => {
  it('usa el peso más cercano que tiene la fuente', () => {
    expect(weightFor('Anton', 800)).toBe(400);
    expect(weightFor('Montserrat', 700)).toBe(800);
  });
});
