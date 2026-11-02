import { describe, expect, it } from 'vitest';
import { DEFAULT_APP_COLORS, DEFAULT_STORE_COLOR, paletteVars, resolveAppColor } from './appTheme';

describe('paletteVars (caracterización)', () => {
  it('genera --app-50 … --app-900 como "r g b"; el 600 es el color dado', () => {
    const v = paletteVars('#4f46e5');
    expect(Object.keys(v)).toEqual(['--app-50', '--app-100', '--app-200', '--app-300', '--app-400', '--app-500', '--app-600', '--app-700', '--app-800', '--app-900']);
    expect(v['--app-600']).toBe('79 70 229');
  });

  it('los claros mezclan con blanco y los oscuros con negro', () => {
    const v = paletteVars('#000000');
    expect(v['--app-50']).toBe('242 242 242'); // 0 + 255*0.95 = 242.25
    expect(v['--app-500']).toBe('38 38 38');
    expect(v['--app-900']).toBe('0 0 0');
    const w = paletteVars('#ffffff');
    expect(w['--app-700']).toBe('217 217 217'); // 255 * 0.85 = 216.75
    expect(w['--app-900']).toBe('140 140 140'); // 255 * 0.55 = 140.25
  });

  it('acepta #rgb, sin # y espacios', () => {
    expect(paletteVars('#f00')['--app-600']).toBe('255 0 0');
    expect(paletteVars('00ff00')['--app-600']).toBe('0 255 0');
    expect(paletteVars('  #0000FF ')['--app-600']).toBe('0 0 255');
  });

  it('color inválido: usa el fallback (por defecto el de la Tienda)', () => {
    expect(paletteVars('rojo')['--app-600']).toBe(paletteVars(DEFAULT_STORE_COLOR)['--app-600']);
    expect(paletteVars('', '#059669')['--app-600']).toBe('5 150 105');
  });

  it('color y fallback inválidos: revienta', () => {
    // ACTUAL (posible bug): el `!` asume que el fallback siempre es válido.
    expect(() => paletteVars('x', 'y')).toThrow(TypeError);
  });
});

describe('resolveAppColor (caracterización)', () => {
  it('Tienda: brandColors.primary o el color de marca por defecto', () => {
    expect(resolveAppColor('store')).toBe(DEFAULT_STORE_COLOR);
    expect(resolveAppColor('store', { brandColors: { primary: '#111111' } })).toBe('#111111');
    expect(resolveAppColor('store', { appColors: { admin: '#222222' } })).toBe(DEFAULT_STORE_COLOR);
  });

  it('otras apps: appColors[app] o su color por defecto', () => {
    expect(resolveAppColor('admin')).toBe(DEFAULT_APP_COLORS.admin);
    expect(resolveAppColor('pos', { appColors: { pos: '#333333' } })).toBe('#333333');
    expect(resolveAppColor('manufacturing', { appColors: { pos: '#333333' } })).toBe(DEFAULT_APP_COLORS.manufacturing);
    expect(resolveAppColor('messaging', { appColors: { messaging: '' } })).toBe(DEFAULT_APP_COLORS.messaging);
  });

  it('no valida el formato: devuelve el texto guardado tal cual', () => {
    expect(resolveAppColor('admin', { appColors: { admin: 'no-es-color' } })).toBe('no-es-color');
  });
});
