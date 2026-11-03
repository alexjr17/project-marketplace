import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { http } from 'msw';
import { server, API } from '../../test/server';
import { ok } from '../../test/helpers';
import type { CustomizedProduct } from '../../types/design';

// El carrito, el formato de moneda y lo que necesita canvas (no existe en jsdom) se simulan.
const cart = vi.hoisted(() => ({
  addCustomizedProduct: vi.fn<(p: CustomizedProduct, q?: number) => Promise<void>>(async () => {}),
  updateCustomizedProduct: vi.fn(async () => {}),
  getCartItemById: vi.fn(() => undefined),
}));
vi.mock('../../context/CartContext', () => ({ useCart: () => cart }));
vi.mock('../../hooks/useCurrency', () => ({ useCurrency: () => ({ format: (n: number) => `$${n.toLocaleString('es-CO')}` }) }));
vi.mock('./designImage', async (orig) => ({
  ...(await orig<typeof import('./designImage')>()),
  processDesignFile: vi.fn(async (f: File) => ({ preview: 'data:image/png;base64,PREV', original: 'data:image/png;base64,ORIG', fileName: f.name, fileSize: 10, width: 2000, height: 2000 })),
}));
vi.mock('./garment', async (orig) => ({
  ...(await orig<typeof import('./garment')>()),
  renderMockup: vi.fn(async () => 'data:image/png;base64,MOCKUP'),
}));

import { CustomizerPage } from '../../pages/CustomizerPage';

const template = {
  id: 4, sku: 'TPL-1', slug: 'sueter-basico', name: 'Suéter Básico Personalizable', description: '', barcode: null,
  categoryId: 1, categorySlug: 'sueteres', categoryName: 'Suéteres', typeId: 1, typeSlug: 'sueter-basico', typeName: 'Suéter Básico',
  basePrice: 70000, images: { front: '', back: '', side: '' }, zoneTypeImages: null, designZones: null, exclusionZones: null,
  colors: [{ id: 1, name: 'Blanco', slug: 'blanco', hexCode: '#FFFFFF' }, { id: 2, name: 'Negro', slug: 'negro', hexCode: '#1A1A1A' }],
  sizes: [{ id: 3, name: 'Small', abbreviation: 'S' }, { id: 4, name: 'Medium', abbreviation: 'M' }],
  tags: [], isActive: true, createdAt: '', updatedAt: '',
};
const zones = [
  { id: 1, templateId: 4, zoneTypeId: 1, zoneId: 'f', name: 'Frente', shape: 'rect', positionX: 22, positionY: 18, maxWidth: 56, maxHeight: 60, price: 8000, isEditable: true, isRequired: true, isBlocked: false, sortOrder: 1, isActive: true, zoneType: { id: 1, name: 'Frente', slug: 'frente' } },
  { id: 2, templateId: 4, zoneTypeId: 2, zoneId: 'e', name: 'Espalda', shape: 'rect', positionX: 22, positionY: 18, maxWidth: 56, maxHeight: 60, price: 8000, isEditable: true, isRequired: false, isBlocked: false, sortOrder: 2, isActive: true, zoneType: { id: 2, name: 'Espalda', slug: 'espalda' } },
];

let stockQuery: URLSearchParams | null = null;
let quoteBody: { templateId: number; templateZoneIds: number[] } | null = null;

beforeEach(() => {
  stockQuery = null;
  quoteBody = null;
  cart.addCustomizedProduct.mockClear();
  server.use(
    http.get(`${API}/templates/public`, () => ok([template])),
    http.get(`${API}/template-zones/template/4`, () => ok(zones)),
    http.get(`${API}/template-recipes/variant-stock/4`, ({ request }) => { stockQuery = new URL(request.url).searchParams; return ok({ availableStock: 2 }); }),
    http.post(`${API}/customizer/quote`, async ({ request }) => {
      quoteBody = (await request.json()) as typeof quoteBody;
      const used = zones.filter((z) => quoteBody!.templateZoneIds.includes(z.id));
      const extra = used.reduce((s, z) => s + z.price, 0);
      return ok({ basePrice: 70000, zones: used.map((z) => ({ id: z.id, name: z.name, zoneTypeSlug: z.zoneType.slug, price: z.price })), customizationPrice: extra, total: 70000 + extra });
    }),
    http.get(`${API}/design-images`, () => ok([])),
  );
});

const renderPage = (url = '/customize') =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/customize" element={<CustomizerPage />} />
        <Route path="/cart" element={<p>Página del carrito</p>} />
      </Routes>
    </MemoryRouter>,
  );

describe('Personalizador', () => {
  it('elige el modelo, sube un diseño y lo agrega al carrito con el precio de la zona', async () => {
    renderPage();

    // Paso 0: tarjetas de modelos
    fireEvent.click(await screen.findByRole('button', { name: /Suéter Básico/ }));

    // Estudio: vistas desde las zonas
    const frontTab = await screen.findByRole('tab', { name: /Frente/ });
    await waitFor(() => expect(frontTab).toHaveAttribute('aria-selected', 'true'));
    expect(screen.getByRole('tab', { name: /Espalda/ })).toBeInTheDocument();

    // Sin talla ni diseño no se puede comprar
    const [desktopBtn] = screen.getAllByRole('button', { name: /Agregar al carrito/ });
    expect(desktopBtn).toBeDisabled();

    // Talla M → stock con ids reales (antes se buscaba por nombre y salía 0)
    fireEvent.click(screen.getByRole('radio', { name: 'M' }));
    await waitFor(() => expect(stockQuery?.get('sizeId')).toBe('4'));
    expect(stockQuery?.get('colorId')).toBe('1');
    expect((await screen.findAllByText('¡Últimas 2!')).length).toBeGreaterThan(0);

    // Color negro
    fireEvent.click(screen.getByRole('radio', { name: 'Negro' }));
    await waitFor(() => expect(stockQuery?.get('colorId')).toBe('2'));

    // Subir el diseño (el input oculto del lienzo)
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(['x'], 'logo.png', { type: 'image/png' })] } });
    expect((await screen.findAllByText('logo.png')).length).toBeGreaterThan(0);

    // El servidor cotiza la zona del frente
    await waitFor(() => expect(quoteBody?.templateZoneIds).toEqual([1]));
    expect(await screen.findByText('Estampado frente')).toBeInTheDocument();
    expect(screen.getAllByText('$78.000').length).toBeGreaterThan(0);

    // Agregar
    await waitFor(() => expect(screen.getAllByRole('button', { name: /Agregar al carrito/ })[0]).toBeEnabled());
    fireEvent.click(screen.getAllByRole('button', { name: /Agregar al carrito/ })[0]);
    expect(await screen.findByText('Página del carrito')).toBeInTheDocument();

    expect(cart.addCustomizedProduct).toHaveBeenCalledTimes(1);
    const [product, qty] = cart.addCustomizedProduct.mock.calls[0];
    expect(qty).toBe(1);
    expect(product).toMatchObject({
      version: 2, templateId: 4, colorId: 2, sizeId: 4, selectedSize: 'M', selectedColorName: 'Negro',
      customizationPrice: 8000, totalPrice: 78000, previews: { frente: 'data:image/png;base64,MOCKUP' },
    });
    expect(product.designs).toHaveLength(1);
    expect(product.designs[0]).toMatchObject({ viewSlug: 'frente', templateZoneId: 1, originalImageData: 'data:image/png;base64,ORIG' });
  });

  it('entra directo con ?template= y avisa la zona obligatoria', async () => {
    renderPage('/customize?template=4');
    fireEvent.click(await screen.findByRole('tab', { name: /Espalda/ }));
    fireEvent.click(screen.getByRole('radio', { name: 'S' }));
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(['x'], 'espalda.png', { type: 'image/png' })] } });
    expect((await screen.findAllByText('espalda.png')).length).toBeGreaterThan(0);
    const summary = screen.getByRole('heading', { name: /Resumen/ }).closest('section')!;
    expect(within(summary).getByText('Falta el diseño de frente')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Agregar al carrito/ })[0]).toBeDisabled();
  });
});
