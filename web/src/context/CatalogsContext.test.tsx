import { describe, expect, it } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { http, HttpResponse } from 'msw';
import { server, API } from '../test/server';
import { ok } from '../test/helpers';
import { CatalogsProvider, useCatalogs } from './CatalogsContext';

const color = (id: number, name: string) => ({ id, name, slug: name.toLowerCase(), hexCode: '#000000', isActive: true });

function setup() {
  server.use(
    http.get(`${API}/catalogs/sizes`, () => ok([])),
    http.get(`${API}/catalogs/colors`, () => ok([color(1, 'Negro'), color(2, 'Blanco')])),
    http.get(`${API}/catalogs/product-types`, () => ok([])),
    http.get(`${API}/catalogs/categories`, () => ok([])),
    http.put(`${API}/catalogs/colors/:id`, async ({ params, request }) =>
      ok({ ...color(Number(params.id), 'x'), ...((await request.json()) as object) })),
    http.delete(`${API}/catalogs/colors/:id`, () => new HttpResponse(null, { status: 204 })),
  );
  const wrapper = ({ children }: { children: ReactNode }) => <CatalogsProvider>{children}</CatalogsProvider>;
  return renderHook(() => useCatalogs(), { wrapper });
}

describe('CatalogsContext (ids numéricos del API)', () => {
  it('updateColor reemplaza el color editado en la lista (antes comparaba number === string y no cambiaba)', async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.colors).toHaveLength(2));
    await act(() => result.current.updateColor(2, { name: 'Hueso' }));
    expect(result.current.colors.map((c) => c.name)).toEqual(['Negro', 'Hueso']);
  });

  it('deleteColor quita el color de la lista', async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.colors).toHaveLength(2));
    await act(() => result.current.deleteColor(1));
    expect(result.current.colors.map((c) => c.id)).toEqual([2]);
  });
});
