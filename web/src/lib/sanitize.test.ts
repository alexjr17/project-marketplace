import { describe, expect, it } from 'vitest';
import { sanitizeHtml } from './sanitize';

describe('sanitizeHtml (caracterización)', () => {
  it('quita <script>', () => {
    expect(sanitizeHtml('<p>Hola</p><script>alert(1)</script>')).toBe('<p>Hola</p>');
  });

  it('quita manejadores on* (onerror, onclick)', () => {
    const out = sanitizeHtml('<img src="x.png" onerror="alert(1)"><a href="/a" onclick="x()">a</a>');
    expect(out).not.toMatch(/onerror|onclick/i);
    expect(out).toContain('src="x.png"');
    expect(out).toContain('href="/a"');
  });

  it('quita URLs javascript:', () => {
    const out = sanitizeHtml('<a href="javascript:alert(1)">x</a><a href="JaVaScRiPt:alert(1)">y</a>');
    expect(out).not.toMatch(/javascript:/i);
    expect(out).toContain('>x</a>');
  });

  it('quita iframe, style, form, input y button', () => {
    const out = sanitizeHtml('<iframe src="https://x"></iframe><style>p{}</style><form><input><button>b</button></form><p>ok</p>');
    // FORBID_TAGS quita la etiqueta pero deja su texto (el "b" del botón).
    expect(out).toBe('b<p>ok</p>');
  });

  it('quita el atributo style', () => {
    expect(sanitizeHtml('<p style="color:red">t</p>')).toBe('<p>t</p>');
  });

  it('conserva formato del editor (negrita, listas, enlaces, títulos)', () => {
    const html = '<h2>T</h2><p><strong>b</strong> <em>i</em> <u>u</u></p><ul><li>1</li></ul><a href="https://vexa.co">l</a>';
    expect(sanitizeHtml(html)).toBe(html);
  });

  it('quita target="_blank" de los enlaces', () => {
    // ACTUAL (posible bug): DOMPurify borra target por defecto; los enlaces del editor
    // (Tiptap Link agrega target="_blank") se abren en la misma pestaña.
    expect(sanitizeHtml('<a href="https://vexa.co" target="_blank" rel="noopener">l</a>')).toBe('<a href="https://vexa.co" rel="noopener">l</a>');
  });

  it('quita svg/math (perfil solo html)', () => {
    expect(sanitizeHtml('<svg><circle r="1"></circle></svg><p>x</p>')).toBe('<p>x</p>');
  });

  it('null/undefined → cadena vacía', () => {
    expect(sanitizeHtml(null)).toBe('');
    expect(sanitizeHtml(undefined)).toBe('');
  });
});
