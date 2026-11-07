import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

// El listado, los catálogos y los ajustes se simulan: aquí se prueba el puente URL ↔ filtros.
const products = vi.hoisted(() => ({
  filteredProducts: [] as unknown[],
  filters: {},
  sortOption: 'newest',
  isLoading: false,
  pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
  setFilters: vi.fn(),
  setSortOption: vi.fn(),
  setPage: vi.fn(),
}));
vi.mock('../context/ProductsContext', () => ({ useProducts: () => products }));
vi.mock('../context/CatalogsContext', () => ({
  useCatalogs: () => ({
    categories: [
      { id: 1, name: 'Suéteres', slug: 'sueteres', isActive: true },
      { id: 2, name: 'Accesorios', slug: 'accesorios', isActive: true },
    ],
    productTypes: [{ id: 7, name: 'Buzo', slug: 'buzo', categorySlug: 'sueteres', isActive: true }],
  }),
}));
vi.mock('../context/SettingsContext', () => ({ useSettings: () => ({ settings: { catalog: { filters: {} } } }) }));
vi.mock('../hooks/useCurrency', () => ({ useCurrency: () => ({ format: (n: number) => `$${n}` }) }));
vi.mock('../components/seo/Seo', () => ({ Seo: () => null }));

import { CatalogPage } from './CatalogPage';

function Where() {
  const l = useLocation();
  return <output data-testid="url">{l.search}</output>;
}

const renderAt = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/catalog" element={<><CatalogPage /><Where /></>} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  products.setFilters.mockClear();
  products.setSortOption.mockClear();
  products.setPage.mockClear();
});

describe('CatalogPage', () => {
  it('aplica los filtros de la URL al listado y los muestra como chips con nombre', () => {
    renderAt('/catalog?category=sueteres&onSale=1&sort=price-asc&page=2');
    expect(products.setFilters).toHaveBeenCalledWith({ category: 'sueteres', onSale: true });
    expect(products.setSortOption).toHaveBeenCalledWith('price-asc');
    expect(products.setPage).toHaveBeenCalledWith(2);
    const chips = screen.getByLabelText('Filtros activos');
    expect(within(chips).getByText('Suéteres')).toBeInTheDocument();
    expect(within(chips).getByText('En oferta')).toBeInTheDocument();
    // Título = nombre de la categoría, no el slug.
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Suéteres');
  });

  it('quitar un chip lo saca de la URL y vuelve a la página 1', () => {
    renderAt('/catalog?category=sueteres&onSale=1&sort=price-asc&page=2');
    fireEvent.click(screen.getByRole('button', { name: 'Quitar filtro En oferta' }));
    expect(screen.getByTestId('url')).toHaveTextContent('?category=sueteres&sort=price-asc');
  });

  it('"Limpiar todo" deja solo el orden', () => {
    renderAt('/catalog?category=sueteres&inStock=1&sort=rating');
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar todo' }));
    expect(screen.getByTestId('url').textContent).toBe('?sort=rating');
  });

  it('elegir una categoría en el panel escribe la URL', () => {
    renderAt('/catalog');
    const aside = screen.getByRole('complementary', { name: 'Filtros' });
    fireEvent.click(within(aside).getByRole('button', { name: 'Accesorios' }));
    expect(screen.getByTestId('url').textContent).toBe('?category=accesorios');
  });

  it('búsqueda sin resultados: estado vacío con salida', () => {
    renderAt('/catalog?search=zzz');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Resultados para «zzz»');
    expect(screen.getByText('No encontramos productos')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ver todo el catálogo' }));
    expect(screen.getByTestId('url').textContent).toBe('');
  });
});
