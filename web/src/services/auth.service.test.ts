import { describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server, API } from '../test/server';
import { ok, fail, setSession } from '../test/helpers';
import { authService } from './auth.service';
import type { AuthUser } from '../types/user';

const user: AuthUser = { id: 1, email: 'a@b.co', name: 'Ana', roleId: 3, role: 'Vendedor', permissions: ['orders.view'], status: 'ACTIVE' };
const stored = () => JSON.parse(localStorage.getItem('marketplace_auth') ?? 'null');

describe('auth.service (caracterización)', () => {
  describe('login (POST /auth/login)', () => {
    it('envía credenciales, guarda {user, token} en marketplace_auth y lo devuelve', async () => {
      let body: unknown;
      server.use(
        http.post(`${API}/auth/login`, async ({ request }) => {
          body = await request.json();
          return ok({ user, token: 'tok' }, 'Inicio de sesión exitoso');
        }),
      );
      const res = await authService.login({ email: 'a@b.co', password: 'x' });
      expect(body).toEqual({ email: 'a@b.co', password: 'x' });
      expect(res).toEqual({ user, token: 'tok' });
      expect(stored()).toEqual({ user, token: 'tok' });
    });

    it('credenciales inválidas (401 sin token): lanza el mensaje del backend y no guarda nada', async () => {
      server.use(http.post(`${API}/auth/login`, () => fail('Credenciales inválidas', 401)));
      await expect(authService.login({ email: 'a@b.co', password: 'x' })).rejects.toThrow('Credenciales inválidas');
      expect(localStorage.getItem('marketplace_auth')).toBeNull();
    });

    it('cuenta desactivada: lanza el mensaje del backend', async () => {
      server.use(http.post(`${API}/auth/login`, () => fail('Tu cuenta está desactivada. Contacta al administrador.', 401)));
      await expect(authService.login({ email: 'a@b.co', password: 'x' })).rejects.toThrow('Tu cuenta está desactivada');
    });

    it('login con una sesión vieja guardada y 401: muestra el motivo real, no "sesión expirada"', async () => {
      setSession('viejo');
      const listener = vi.fn();
      window.addEventListener('auth:token-expired', listener);
      server.use(http.post(`${API}/auth/login`, () => fail('Credenciales inválidas', 401)));
      // CORREGIDO: un 401 del propio login nunca se trata como sesión expirada.
      await expect(authService.login({ email: 'a@b.co', password: 'x' })).rejects.toThrow('Credenciales inválidas');
      expect(listener).not.toHaveBeenCalled();
      window.removeEventListener('auth:token-expired', listener);
    });

    it('200 sin data: lanza "Error en el login"', async () => {
      server.use(http.post(`${API}/auth/login`, () => HttpResponse.json({ success: true })));
      await expect(authService.login({ email: 'a', password: 'b' })).rejects.toThrow('Error en el login');
    });
  });

  describe('logout', () => {
    it('con sesión: llama POST /auth/logout con el token y borra la sesión local de inmediato', async () => {
      setSession('tok-logout');
      let auth: string | null = null;
      const done = new Promise<void>((resolve) => {
        server.use(
          http.post(`${API}/auth/logout`, ({ request }) => {
            auth = request.headers.get('authorization');
            resolve();
            return ok(undefined, 'Sesión cerrada exitosamente');
          }),
        );
      });
      authService.logout();
      expect(localStorage.getItem('marketplace_auth')).toBeNull();
      await done;
      expect(auth).toBe('Bearer tok-logout');
    });

    it('sin sesión: no llama a la API', async () => {
      let called = false;
      server.use(
        http.post(`${API}/auth/logout`, () => {
          called = true;
          return ok();
        }),
      );
      authService.logout();
      await new Promise((r) => setTimeout(r, 20));
      expect(called).toBe(false);
    });

    it('si /auth/logout falla no lanza', async () => {
      setSession();
      server.use(http.post(`${API}/auth/logout`, () => HttpResponse.error()));
      expect(() => authService.logout()).not.toThrow();
      await new Promise((r) => setTimeout(r, 20));
      expect(localStorage.getItem('marketplace_auth')).toBeNull();
    });
  });

  describe('getProfile (GET /auth/me)', () => {
    it('devuelve data.user', async () => {
      setSession();
      server.use(http.get(`${API}/auth/me`, () => ok({ user })));
      expect(await authService.getProfile()).toEqual(user);
    });

    it('sin data.user: lanza "No autenticado"', async () => {
      server.use(http.get(`${API}/auth/me`, () => ok(user)));
      await expect(authService.getProfile()).rejects.toThrow('No autenticado');
    });
  });

  describe('updateStoredUser', () => {
    it('reemplaza el usuario guardado sin tocar el token', () => {
      setSession('keep', { id: 1, name: 'Viejo', permissions: [] });
      authService.updateStoredUser(user);
      expect(stored()).toEqual({ token: 'keep', user });
    });

    it('sin sesión guardada no crea una', () => {
      authService.updateStoredUser(user);
      expect(localStorage.getItem('marketplace_auth')).toBeNull();
    });

    it('con almacenamiento corrupto no lanza ni lo cambia', () => {
      localStorage.setItem('marketplace_auth', '{roto');
      expect(() => authService.updateStoredUser(user)).not.toThrow();
      expect(localStorage.getItem('marketplace_auth')).toBe('{roto');
    });
  });

  describe('updateProfile (PUT /auth/me)', () => {
    it('mezcla la respuesta en el usuario guardado', async () => {
      setSession('t', { ...user });
      server.use(http.put(`${API}/auth/me`, () => ok({ ...user, name: 'Ana María' })));
      await authService.updateProfile({ name: 'Ana María' });
      expect(stored().user.name).toBe('Ana María');
      expect(stored().token).toBe('t');
    });
  });

  describe('lectura local', () => {
    it('getStoredAuth / isAuthenticated / isAdmin / hasPermission', () => {
      expect(authService.getStoredAuth()).toBeNull();
      expect(authService.isAuthenticated()).toBe(false);
      setSession('t', { ...user, roleId: 1 });
      expect(authService.isAuthenticated()).toBe(true);
      expect(authService.isAdmin()).toBe(true);
      expect(authService.hasPermission('orders.view')).toBe(true);
      expect(authService.hasPermission('users.view')).toBe(false);
    });

    it('isAuthenticated solo mira que exista algo guardado (no valida el token)', () => {
      localStorage.setItem('marketplace_auth', JSON.stringify({}));
      // ACTUAL: un objeto vacío cuenta como autenticado.
      expect(authService.isAuthenticated()).toBe(true);
    });

    it('validateResetToken solo revisa la longitud (64)', async () => {
      expect(await authService.validateResetToken('a'.repeat(64), 'x')).toBe(true);
      expect(await authService.validateResetToken('z'.repeat(64), 'x')).toBe(true); // no es hex y pasa
      expect(await authService.validateResetToken('abc', 'x')).toBe(false);
    });
  });
});
