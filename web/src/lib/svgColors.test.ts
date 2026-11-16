import { describe, expect, it } from 'vitest';
import { recolorSvg, sanitizeSvg, svgColors, svgSize, toHex } from './svgColors';

const SVG = `<svg viewBox="0 0 100 50"><rect fill="#f00" width="10" height="10"/><circle style="fill: rgb(0, 128, 0); stroke:#FFFFFF" r="4"/><path fill="red" d="M0 0"/><g fill="none"/></svg>`;

describe('SVG editable', () => {
  it('lee los colores sólidos (sin repetir y en el orden en que aparecen)', () => {
    expect(svgColors(SVG)).toEqual(['#FF0000', '#008000', '#FFFFFF']);
    expect(svgColors('<svg><path d="M0 0"/></svg>')).toEqual(['#000000']);
    expect(toHex('#abc')).toBe('#AABBCC');
    expect(toHex('none')).toBeNull();
  });

  it('cambia cada color (en atributos y estilos) sin tocar los demás', () => {
    const out = recolorSvg(SVG, { '#FF0000': '#C62828', '#008000': '#1B5E3A' });
    expect(svgColors(out)).toEqual(['#C62828', '#1B5E3A', '#FFFFFF']);
    expect(out).toContain('fill="none"');
    // Un SVG sin colores (negro por defecto) toma el color nuevo completo.
    expect(recolorSvg('<svg><path d="M0 0"/></svg>', { '#000000': '#FF0000' })).toContain('<svg fill="#FF0000"');
  });

  it('quita scripts, eventos y enlaces javascript:', () => {
    const bad = '<svg onload="x()"><script>alert(1)</script><a xlink:href="javascript:y()"><rect onclick="z()" fill="red"/></a><foreignObject><div>hola</div></foreignObject></svg>';
    const clean = sanitizeSvg(bad);
    expect(clean).not.toMatch(/script|onload|onclick|javascript:|foreignObject/i);
    expect(clean).toContain('<rect fill="red"/>');
  });

  it('tamaño por width/height o viewBox', () => {
    expect(svgSize(SVG)).toEqual({ w: 100, h: 50 });
    expect(svgSize('<svg width="30" height="20"></svg>')).toEqual({ w: 30, h: 20 });
  });
});
