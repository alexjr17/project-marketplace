import { describe, expect, it } from 'vitest';
import { activeChips, compactFilters, readCatalogParams, removeChip, writeCatalogParams } from './catalogParams';
import { pickRelated, excludeIds } from './recommendations';
import { freeShippingProgress } from '../cart/freeShipping';
import type { Product } from '../../types/product';

const money = (n: number) => `$${n}`;

describe('catálogo ↔ URL', () => {
  it('lee filtros, orden y página de la URL', () => {
    const s = readCatalogParams(new URLSearchParams('search=buso&category=ropa&type=hoodie&minPrice=20000&maxPrice=90000&inStock=1&featured=true&onSale=1&sort=price-desc&page=3'));
    expect(s.filters).toEqual({ search: 'buso', category: 'ropa', type: 'hoodie', minPrice: 20000, maxPrice: 90000, inStock: true, featured: true, onSale: true });
    expect(s.sort).toBe('price-desc');
    expect(s.page).toBe(3);
  });

  it('lee y escribe la temática (?tag=) y la muestra como chip', () => {
    const s = readCatalogParams(new URLSearchParams('tag=dragon%20ball&category=camisetas'));
    expect(s.filters).toEqual({ tag: 'dragon ball', category: 'camisetas' });
    expect(writeCatalogParams(s).get('tag')).toBe('dragon ball');
    expect(activeChips(s.filters, {}, money)).toContainEqual({ key: 'tag', label: 'Dragon Ball' });
    expect(removeChip(s.filters, 'tag')).toEqual({ category: 'camisetas' });
  });

  it('sin parámetros: sin filtros, más recientes, página 1', () => {
    expect(readCatalogParams(new URLSearchParams(''))).toEqual({ filters: {}, sort: 'newest', page: 1 });
  });

  it('ignora valores inválidos y traduce enlaces viejos', () => {
    const s = readCatalogParams(new URLSearchParams('minPrice=abc&maxPrice=-5&page=0&sort=raro'));
    expect(s.filters).toEqual({});
    expect(s.sort).toBe('newest');
    expect(s.page).toBe(1);
    expect(readCatalogParams(new URLSearchParams('sort=price')).sort).toBe('price-asc');
    expect(readCatalogParams(new URLSearchParams('bestsellers=true')).sort).toBe('popular');
  });

  it('escribe URLs cortas (sin valores por defecto) y es reversible', () => {
    const state = { filters: { category: 'ropa' as never, onSale: true, minPrice: 1000 }, sort: 'newest' as const, page: 1 };
    const p = writeCatalogParams(state);
    expect(p.toString()).toBe('category=ropa&minPrice=1000&onSale=1');
    expect(readCatalogParams(p)).toEqual(state);
    expect(writeCatalogParams({ filters: {}, sort: 'rating', page: 2 }).toString()).toBe('sort=rating&page=2');
  });

  it('compactFilters quita claves vacías', () => {
    expect(compactFilters({ search: '', inStock: false, featured: undefined, category: 'ropa' as never })).toEqual({ category: 'ropa' });
  });
});

describe('chips de filtros activos', () => {
  it('muestra nombres (no slugs) y el rango de precio en un solo chip', () => {
    const chips = activeChips(
      { search: 'buso', category: 'ropa' as never, type: 'hoodie' as never, minPrice: 1000, maxPrice: 5000, onSale: true },
      { category: (s) => (s === 'ropa' ? 'Ropa' : undefined), type: () => 'Buzos' },
      money,
    );
    expect(chips.map((c) => c.label)).toEqual(['«buso»', 'Ropa', 'Buzos', '$1000 – $5000', 'En oferta']);
  });

  it('precio con un solo extremo', () => {
    expect(activeChips({ minPrice: 10 }, {}, money)[0].label).toBe('Desde $10');
    expect(activeChips({ maxPrice: 20 }, {}, money)[0].label).toBe('Hasta $20');
  });

  it('quitar un chip quita solo su filtro (el de precio, ambos extremos)', () => {
    const f = { category: 'ropa' as never, minPrice: 1, maxPrice: 2, inStock: true };
    expect(removeChip(f, 'price')).toEqual({ category: 'ropa', inStock: true });
    expect(removeChip(f, 'category')).toEqual({ minPrice: 1, maxPrice: 2, inStock: true });
  });
});

describe('envío gratis', () => {
  it('calcula lo que falta y el porcentaje', () => {
    expect(freeShippingProgress(100000, 150000)).toEqual({ remaining: 50000, reached: false, pct: 67 });
    expect(freeShippingProgress(200000, 150000)).toEqual({ remaining: 0, reached: true, pct: 100 });
  });
  it('sin umbral no hay barra', () => {
    expect(freeShippingProgress(1000, 0)).toBeNull();
    expect(freeShippingProgress(1000, undefined)).toBeNull();
  });
});

describe('recomendaciones', () => {
  const p = (id: number, tags: string[] = [], extra: Partial<Product> = {}) => ({ id, tags, ...extra }) as Product;

  it('relacionados: sin el actual ni plantillas, primero los que comparten etiquetas', () => {
    const list = [p(1, ['a']), p(2), p(3, ['a', 'b']), p(4, ['b'], { isTemplate: true }), p(5, ['b'])];
    expect(pickRelated(list, { id: 1, tags: ['a', 'b'] }).map((x) => x.id)).toEqual([3, 5, 2]);
  });

  it('respeta el límite y el orden del API a igual puntaje', () => {
    expect(pickRelated([p(2), p(3), p(4)], { id: 1, tags: [] }, 2).map((x) => x.id)).toEqual([2, 3]);
  });

  it('carrito: quita lo que ya está agregado', () => {
    expect(excludeIds([p(1), p(2), p(3)], [2]).map((x) => x.id)).toEqual([1, 3]);
  });
});
