import { describe, expect, it } from 'vitest';
import { http as mswHttp, HttpResponse } from 'msw';
import { server, API, API_ORIGIN } from '../test/server';
import { ok, setSession } from '../test/helpers';
import { http, httpKeepUrls, apiUrl } from './http';

describe('lib/http', () => {
  it('get devuelve solo data', async () => {
    server.use(mswHttp.get(`${API}/x`, () => ok({ id: 1 }, 'Listo')));
    expect(await http.get('/x')).toEqual({ id: 1 });
  });

  describe('getPaged normaliza la paginación', () => {
    it('desde `pagination`', async () => {
      server.use(mswHttp.get(`${API}/l`, () => ok([1, 2], undefined, { pagination: { page: 2, limit: 2, total: 9, totalPages: 5 } })));
      expect(await http.getPaged('/l')).toEqual({ items: [1, 2], page: 2, limit: 2, total: 9, totalPages: 5 });
    });

    it('desde `meta`', async () => {
      server.use(mswHttp.get(`${API}/l`, () => ok([1], undefined, { meta: { page: 1, limit: 20, total: 1, totalPages: 1, unreadCount: 3 } })));
      expect(await http.getPaged('/l')).toEqual({ items: [1], page: 1, limit: 20, total: 1, totalPages: 1 });
    });

    it('anidada en data: { data, meta }', async () => {
      server.use(mswHttp.get(`${API}/l`, () => ok({ data: ['a'], meta: { page: 3, limit: 10, total: 21, totalPages: 3 } })));
      expect(await http.getPaged('/l')).toEqual({ items: ['a'], page: 3, limit: 10, total: 21, totalPages: 3 });
    });

    it('sin datos: lista vacía', async () => {
      server.use(mswHttp.get(`${API}/l`, () => HttpResponse.json({ success: true })));
      expect(await http.getPaged('/l')).toEqual({ items: [], page: 1, limit: 0, total: 0, totalPages: 1 });
    });
  });

  it('upload envía FormData sin forzar Content-Type JSON', async () => {
    let type = '';
    server.use(mswHttp.post(`${API}/uploads/image`, ({ request }) => { type = request.headers.get('content-type') || ''; return ok({ url: '/uploads/a.png' }); }));
    const fd = new FormData();
    fd.append('folder', 'general');
    expect(await http.upload('/uploads/image', fd)).toEqual({ url: `${API_ORIGIN}/uploads/a.png` });
    expect(type).toMatch(/multipart\/form-data/);
  });

  it('httpKeepUrls deja las rutas /uploads relativas', async () => {
    server.use(mswHttp.get(`${API}/img`, () => ok({ url: '/uploads/a.png' })));
    expect(await httpKeepUrls.get('/img')).toEqual({ url: '/uploads/a.png' });
  });

  it('401 en /auth/login con un token viejo no cierra la sesión', async () => {
    setSession('viejo');
    server.use(mswHttp.post(`${API}/auth/login`, () => HttpResponse.json({ success: false, message: 'Credenciales inválidas' }, { status: 401 })));
    await expect(http.post('/auth/login', {})).rejects.toThrow('Credenciales inválidas');
    expect(localStorage.getItem('marketplace_auth')).not.toBeNull();
  });

  it('apiUrl arma la URL absoluta con query', () => {
    expect(apiUrl('/pos/sale/1/invoice-pdf')).toBe(`${API}/pos/sale/1/invoice-pdf`);
    expect(apiUrl('/q', { a: 1, b: '' })).toBe(`${API}/q?a=1`);
  });
});
