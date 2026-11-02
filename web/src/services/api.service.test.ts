import { describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server, API, API_ORIGIN } from '../test/server';
import { ok, fail, setSession } from '../test/helpers';
import api from './api.service';

/** Registra un handler que guarda la última petición recibida. */
function capture(method: 'get' | 'post' | 'put' | 'patch' | 'delete', path: string, response: () => Response = () => ok({ ok: 1 })) {
  const seen: { req?: Request; body?: unknown } = {};
  server.use(
    http[method](`${API}${path}`, async ({ request }) => {
      seen.req = request.clone();
      const text = await request.text();
      seen.body = text ? JSON.parse(text) : undefined;
      return response();
    }),
  );
  return seen;
}

describe('api.service (caracterización)', () => {
  describe('respuesta', () => {
    it('devuelve el sobre completo {success, message, data} (no solo data)', async () => {
      server.use(http.get(`${API}/things`, () => ok({ id: 1 }, 'Listo')));
      const res = await api.get('/things');
      expect(res).toEqual({ success: true, message: 'Listo', data: { id: 1 } });
    });

    it('conserva pagination y meta en la raíz del sobre', async () => {
      server.use(
        http.get(`${API}/list`, () =>
          ok([1, 2], undefined, { pagination: { page: 2, limit: 2, total: 9, totalPages: 5 }, meta: { x: 1 } }),
        ),
      );
      const res = (await api.get('/list')) as any;
      expect(res.data).toEqual([1, 2]);
      expect(res.pagination).toEqual({ page: 2, limit: 2, total: 9, totalPages: 5 });
      expect(res.meta).toEqual({ x: 1 });
    });

    it('arma el query string omitiendo undefined, null y cadena vacía', async () => {
      const seen = capture('get', '/q');
      await api.get('/q', { page: 1, search: '', status: undefined, userId: null, active: false, tag: 'a b' });
      const url = new URL(seen.req!.url);
      expect(url.search).toBe('?page=1&active=false&tag=a+b');
    });

    it('sin params no agrega "?"', async () => {
      const seen = capture('get', '/q');
      await api.get('/q');
      expect(seen.req!.url).toBe(`${API}/q`);
    });

    it('con params todos vacíos deja un "?" colgando', async () => {
      const seen = capture('get', '/q');
      await api.get('/q', { search: '' });
      // ACTUAL: la URL termina en "?" (inofensivo).
      expect(seen.req!.url).toBe(`${API}/q?`);
    });
  });

  describe('verbos y cuerpo', () => {
    it.each(['post', 'put', 'patch'] as const)('%s envía el cuerpo como JSON', async (verb) => {
      const seen = capture(verb, '/x');
      await api[verb]('/x', { a: 1 });
      expect(seen.req!.method).toBe(verb.toUpperCase());
      expect(seen.req!.headers.get('content-type')).toBe('application/json');
      expect(seen.body).toEqual({ a: 1 });
    });

    it('post sin cuerpo no envía body', async () => {
      const seen = capture('post', '/x');
      await api.post('/x');
      expect(seen.body).toBeUndefined();
    });

    it('delete usa DELETE', async () => {
      const seen = capture('delete', '/x/1');
      await api.delete('/x/1');
      expect(seen.req!.method).toBe('DELETE');
    });
  });

  describe('token', () => {
    it('agrega Authorization: Bearer con el token de marketplace_auth', async () => {
      setSession('abc');
      const seen = capture('get', '/me');
      await api.get('/me');
      expect(seen.req!.headers.get('authorization')).toBe('Bearer abc');
    });

    it('sin sesión no envía Authorization', async () => {
      const seen = capture('get', '/me');
      await api.get('/me');
      expect(seen.req!.headers.get('authorization')).toBeNull();
    });

    it('con marketplace_auth corrupto no envía Authorization ni falla', async () => {
      localStorage.setItem('marketplace_auth', '{no-json');
      const seen = capture('get', '/me');
      await api.get('/me');
      expect(seen.req!.headers.get('authorization')).toBeNull();
    });

    it('lee el token en cada petición (no lo cachea)', async () => {
      const seen = capture('get', '/me');
      setSession('uno');
      await api.get('/me');
      expect(seen.req!.headers.get('authorization')).toBe('Bearer uno');
      setSession('dos');
      await api.get('/me');
      expect(seen.req!.headers.get('authorization')).toBe('Bearer dos');
    });
  });

  describe('errores', () => {
    it('401 CON token: borra la sesión, dispara auth:token-expired y lanza "Sesión expirada"', async () => {
      setSession('viejo');
      const listener = vi.fn();
      window.addEventListener('auth:token-expired', listener);
      server.use(http.get(`${API}/me`, () => fail('Unauthenticated.', 401)));

      await expect(api.get('/me')).rejects.toThrow('Sesión expirada. Por favor, inicia sesión nuevamente.');
      expect(localStorage.getItem('marketplace_auth')).toBeNull();
      expect(listener).toHaveBeenCalledTimes(1);
      window.removeEventListener('auth:token-expired', listener);
    });

    it('401 SIN token: no dispara el evento y lanza el mensaje del backend', async () => {
      const listener = vi.fn();
      window.addEventListener('auth:token-expired', listener);
      server.use(http.post(`${API}/auth/login`, () => fail('Credenciales inválidas', 401)));

      await expect(api.post('/auth/login', {})).rejects.toThrow('Credenciales inválidas');
      expect(listener).not.toHaveBeenCalled();
      window.removeEventListener('auth:token-expired', listener);
    });

    it('401 SIN token y sin mensaje: "Correo o contraseña incorrectos"', async () => {
      server.use(http.post(`${API}/auth/login`, () => HttpResponse.json({}, { status: 401 })));
      await expect(api.post('/auth/login', {})).rejects.toThrow('Correo o contraseña incorrectos');
    });

    it('403/422/500 con token: lanza el message del backend sin tocar la sesión', async () => {
      setSession('t');
      server.use(http.get(`${API}/x`, () => fail('No tienes permiso', 403)));
      await expect(api.get('/x')).rejects.toThrow('No tienes permiso');
      expect(localStorage.getItem('marketplace_auth')).not.toBeNull();
    });

    it('error sin message: "Error en la solicitud"', async () => {
      server.use(http.get(`${API}/x`, () => HttpResponse.json({ success: false }, { status: 500 })));
      await expect(api.get('/x')).rejects.toThrow('Error en la solicitud');
    });

    it('422: el Error solo lleva message; los errors de validación se pierden', async () => {
      server.use(http.post(`${API}/x`, () => fail('Datos inválidos', 422, { errors: { email: ['requerido'] } })));
      const err = await api.post('/x', {}).catch((e) => e);
      expect(err).toBeInstanceOf(Error);
      expect(err.message).toBe('Datos inválidos');
      // ACTUAL (posible bug): el detalle por campo (errors) no llega a quien llama.
      expect((err as any).errors).toBeUndefined();
    });

    it('respuesta 2xx con success:false NO lanza: se devuelve tal cual', async () => {
      server.use(http.get(`${API}/x`, () => HttpResponse.json({ success: false, message: 'raro' })));
      // ACTUAL: solo se mira response.ok, no el campo success.
      await expect(api.get('/x')).resolves.toEqual({ success: false, message: 'raro' });
    });

    it('respuesta no JSON (p. ej. HTML de un 502): lanza el error de parseo crudo', async () => {
      server.use(http.get(`${API}/x`, () => new HttpResponse('<html>Bad Gateway</html>', { status: 502 })));
      const err = await api.get('/x').catch((e) => e);
      // ACTUAL (posible bug): el usuario ve un SyntaxError de JSON en vez de un mensaje amigable.
      expect(err).toBeInstanceOf(SyntaxError);
    });

    it('204 sin cuerpo: también falla al parsear', async () => {
      server.use(http.delete(`${API}/x`, () => new HttpResponse(null, { status: 204 })));
      // ACTUAL (posible bug): un 204 se trata como error.
      await expect(api.delete('/x')).rejects.toBeInstanceOf(SyntaxError);
    });

    it('fallo de red: se relanza el TypeError de fetch, nunca "Error de conexión con el servidor"', async () => {
      server.use(http.get(`${API}/x`, () => HttpResponse.error()));
      const err = await api.get('/x').catch((e) => e);
      // ACTUAL (posible bug): el mensaje "Error de conexión con el servidor" es inalcanzable,
      // porque fetch lanza TypeError (que es instanceof Error) y se relanza tal cual.
      expect(err).toBeInstanceOf(TypeError);
      expect(err.message).not.toBe('Error de conexión con el servidor');
    });
  });

  describe('rutas /uploads', () => {
    it('convierte /uploads relativos a absolutos hacia el backend, en profundidad', async () => {
      server.use(
        http.get(`${API}/p`, () =>
          ok({ image: '/uploads/a.png', nested: { list: ['/uploads/b.png', { url: '/uploads/c.png' }] }, other: 'texto' }),
        ),
      );
      const res = await api.get<any>('/p');
      expect(res.data.image).toBe(`${API_ORIGIN}/uploads/a.png`);
      expect(res.data.nested.list[0]).toBe(`${API_ORIGIN}/uploads/b.png`);
      expect(res.data.nested.list[1].url).toBe(`${API_ORIGIN}/uploads/c.png`);
      expect(res.data.other).toBe('texto');
    });

    it('es idempotente con rutas que ya traen el origen', async () => {
      server.use(http.get(`${API}/p`, () => ok({ image: `${API_ORIGIN}/uploads/a.png` })));
      const res = await api.get<any>('/p');
      expect(res.data.image).toBe(`${API_ORIGIN}/uploads/a.png`);
    });

    it('reemplaza todas las apariciones dentro de un texto (p. ej. HTML)', async () => {
      server.use(http.get(`${API}/p`, () => ok({ html: '<img src="/uploads/a.png"><img src="/uploads/b.png">' })));
      const res = await api.get<any>('/p');
      expect(res.data.html).toBe(`<img src="${API_ORIGIN}/uploads/a.png"><img src="${API_ORIGIN}/uploads/b.png">`);
    });

    it('URL de OTRO dominio con /uploads/ queda corrupta', async () => {
      server.use(http.get(`${API}/p`, () => ok({ image: 'https://cdn.example.com/uploads/a.png' })));
      const res = await api.get<any>('/p');
      // ACTUAL (posible bug): se antepone el origen en medio de la URL externa.
      expect(res.data.image).toBe(`https://cdn.example.com${API_ORIGIN}/uploads/a.png`);
    });

    it('también reescribe /uploads/ dentro del message de un error', async () => {
      server.use(http.get(`${API}/p`, () => fail('ver /uploads/x.png', 400)));
      await expect(api.get('/p')).rejects.toThrow(`ver ${API_ORIGIN}/uploads/x.png`);
    });
  });

  describe('getBlob', () => {
    it('devuelve el Blob con el token y el query string', async () => {
      setSession('blob-tok');
      let auth: string | null = null;
      let url = '';
      server.use(
        http.get(`${API}/pdf`, ({ request }) => {
          auth = request.headers.get('authorization');
          url = request.url;
          return new HttpResponse('PDFDATA', { headers: { 'Content-Type': 'application/pdf' } });
        }),
      );
      const blob = await api.getBlob('/pdf', { id: 3, empty: '' });
      expect(auth).toBe('Bearer blob-tok');
      expect(url).toBe(`${API}/pdf?id=3`);
      expect(await blob.text()).toBe('PDFDATA');
    });

    it('error JSON: lanza el message; 401 con token dispara auth:token-expired', async () => {
      setSession('t');
      const listener = vi.fn();
      window.addEventListener('auth:token-expired', listener);
      server.use(http.get(`${API}/pdf`, () => fail('Expirado', 401)));
      await expect(api.getBlob('/pdf')).rejects.toThrow('Expirado');
      expect(listener).toHaveBeenCalledTimes(1);
      expect(localStorage.getItem('marketplace_auth')).toBeNull();
      window.removeEventListener('auth:token-expired', listener);
    });

    it('error no JSON: "Error en la solicitud"', async () => {
      server.use(http.get(`${API}/pdf`, () => new HttpResponse('oops', { status: 500 })));
      await expect(api.getBlob('/pdf')).rejects.toThrow('Error en la solicitud');
    });
  });
});
