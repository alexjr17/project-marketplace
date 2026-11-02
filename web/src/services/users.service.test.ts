import { describe, expect, it } from 'vitest';
import { http } from 'msw';
import { server, API } from '../test/server';
import { ok, fail } from '../test/helpers';
import { usersService } from './users.service';

describe('users.service (caracterización)', () => {
  describe('changeStatus', () => {
    it('usa PUT /users/{id} con {status} (no existe PATCH /users/{id}/status)', async () => {
      let method = '';
      let body: unknown;
      server.use(
        http.put(`${API}/users/9`, async ({ request }) => {
          method = request.method;
          body = await request.json();
          return ok({ id: 9, status: 'SUSPENDED' });
        }),
      );
      const res = await usersService.changeStatus(9, 'SUSPENDED');
      expect(method).toBe('PUT');
      expect(body).toEqual({ status: 'SUSPENDED' });
      expect(res).toEqual({ id: 9, status: 'SUSPENDED' });
    });

    it('sin data: lanza "Error cambiando estado"', async () => {
      server.use(http.put(`${API}/users/9`, () => ok()));
      await expect(usersService.changeStatus(9, 'ACTIVE')).rejects.toThrow('Error cambiando estado');
    });

    it('404 del backend: lanza su mensaje', async () => {
      server.use(http.put(`${API}/users/9`, () => fail('Usuario no encontrado', 404)));
      await expect(usersService.changeStatus(9, 'ACTIVE')).rejects.toThrow('Usuario no encontrado');
    });
  });
});
