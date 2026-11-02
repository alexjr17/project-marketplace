import { describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server, API } from '../test/server';
import { ok, fail, setSession } from '../test/helpers';
import { ordersService } from './orders.service';

const order = (n = 1) => ({ id: n, orderNumber: `ORD-${n}`, status: 'PENDING', total: 1000 * n });
const DEFAULT_PAGINATION = { page: 1, limit: 20, total: 0, totalPages: 0 };

describe('orders.service (caracterización)', () => {
  // getAll escribe en consola; se silencia para no ensuciar la salida.
  const quiet = () => vi.spyOn(console, 'log').mockImplementation(() => {});

  describe('getAll (admin, GET /orders)', () => {
    it('mapea meta del backend a pagination y arma el query', async () => {
      quiet();
      const meta = { page: 2, limit: 10, total: 25, totalPages: 3 };
      let search = '';
      server.use(
        http.get(`${API}/orders`, ({ request }) => {
          search = new URL(request.url).search;
          return ok([order(1), order(2)], undefined, { meta });
        }),
      );
      const res = await ordersService.getAll({ page: 2, limit: 10, status: 'pending' as never, search: '' });
      expect(res).toEqual({ data: [order(1), order(2)], pagination: meta });
      expect(search).toBe('?page=2&limit=10&status=pending');
    });

    it('acepta pagination si el backend la manda en vez de meta', async () => {
      quiet();
      const pagination = { page: 1, limit: 5, total: 1, totalPages: 1 };
      server.use(http.get(`${API}/orders`, () => ok([order()], undefined, { pagination })));
      expect((await ordersService.getAll()).pagination).toEqual(pagination);
    });

    it('meta tiene prioridad sobre pagination si llegan ambas', async () => {
      quiet();
      const meta = { page: 9, limit: 1, total: 9, totalPages: 9 };
      server.use(http.get(`${API}/orders`, () => ok([], undefined, { meta, pagination: DEFAULT_PAGINATION })));
      expect((await ordersService.getAll()).pagination).toEqual(meta);
    });

    it('sin data ni meta: lista vacía y paginación por defecto', async () => {
      quiet();
      server.use(http.get(`${API}/orders`, () => HttpResponse.json({ success: true })));
      expect(await ordersService.getAll()).toEqual({ data: [], pagination: DEFAULT_PAGINATION });
    });

    it('no escribe la respuesta en consola', async () => {
      const log = quiet();
      server.use(http.get(`${API}/orders`, () => ok([], undefined, { meta: DEFAULT_PAGINATION })));
      await ordersService.getAll();
      // CORREGIDO: se quitó el console.log de depuración con datos de pedidos.
      expect(log).not.toHaveBeenCalled();
    });

    it('propaga el error del backend (403)', async () => {
      quiet();
      setSession();
      server.use(http.get(`${API}/orders`, () => fail('No tienes permiso', 403)));
      await expect(ordersService.getAll()).rejects.toThrow('No tienes permiso');
    });
  });

  describe('getMyOrders (GET /orders/my)', () => {
    it('mapea meta a pagination y pasa page/limit', async () => {
      const meta = { page: 1, limit: 5, total: 7, totalPages: 2 };
      let search = '';
      server.use(
        http.get(`${API}/orders/my`, ({ request }) => {
          search = new URL(request.url).search;
          return ok([order()], undefined, { meta });
        }),
      );
      expect(await ordersService.getMyOrders({ page: 1, limit: 5 })).toEqual({ data: [order()], pagination: meta });
      expect(search).toBe('?page=1&limit=5');
    });

    it('sin meta: paginación por defecto', async () => {
      server.use(http.get(`${API}/orders/my`, () => ok([])));
      expect((await ordersService.getMyOrders()).pagination).toEqual(DEFAULT_PAGINATION);
    });

    it('error: lanza (no devuelve lista vacía)', async () => {
      server.use(http.get(`${API}/orders/my`, () => fail('Error', 500)));
      await expect(ordersService.getMyOrders()).rejects.toThrow('Error');
    });
  });

  describe('getMyByNumber (GET /orders/my/number/{n})', () => {
    it('devuelve el pedido', async () => {
      server.use(http.get(`${API}/orders/my/number/ORD-1`, () => ok(order())));
      expect(await ordersService.getMyByNumber('ORD-1')).toEqual(order());
    });

    it('codifica el número en la URL', async () => {
      let path = '';
      server.use(
        http.get(`${API}/orders/my/number/:n`, ({ request }) => {
          path = new URL(request.url).pathname;
          return ok(order());
        }),
      );
      await ordersService.getMyByNumber('A/B #1');
      expect(path).toBe('/api/orders/my/number/A%2FB%20%231');
    });

    it('404 o cualquier error: devuelve null (no lanza)', async () => {
      server.use(http.get(`${API}/orders/my/number/X`, () => fail('Orden no encontrada', 404)));
      expect(await ordersService.getMyByNumber('X')).toBeNull();
    });

    it('un 500 también se ve como "no existe"', async () => {
      server.use(http.get(`${API}/orders/my/number/X`, () => fail('Error interno', 500)));
      // ACTUAL (posible bug): el error del servidor se traga y la pantalla diría "pedido no encontrado".
      expect(await ordersService.getMyByNumber('X')).toBeNull();
    });
  });

  describe('wompiCheckout (POST /orders/my/{id}/wompi-checkout)', () => {
    it('devuelve los datos firmados', async () => {
      const data = { publicKey: 'pub_test', reference: 'ORD-1', amountInCents: 100000, currency: 'COP', signature: 'abc' };
      let method = '';
      server.use(
        http.post(`${API}/orders/my/7/wompi-checkout`, ({ request }) => {
          method = request.method;
          return ok(data);
        }),
      );
      expect(await ordersService.wompiCheckout(7)).toEqual(data);
      expect(method).toBe('POST');
    });

    it('409 del backend: lanza su mensaje', async () => {
      server.use(http.post(`${API}/orders/my/7/wompi-checkout`, () => fail('El pedido no está pendiente de pago', 409)));
      await expect(ordersService.wompiCheckout(7)).rejects.toThrow('El pedido no está pendiente de pago');
    });

    it('200 sin data: lanza "No se pudo preparar el pago"', async () => {
      server.use(http.post(`${API}/orders/my/7/wompi-checkout`, () => HttpResponse.json({ success: true })));
      await expect(ordersService.wompiCheckout(7)).rejects.toThrow('No se pudo preparar el pago');
    });
  });

  describe('confirmWompiPayment (POST /orders/confirm-payment/{n})', () => {
    it('envía transactionId y devuelve {order, message}', async () => {
      let body: unknown;
      server.use(
        http.post(`${API}/orders/confirm-payment/ORD-1`, async ({ request }) => {
          body = await request.json();
          return ok({ ...order(), status: 'PAID' }, 'Pago aprobado');
        }),
      );
      const res = await ordersService.confirmWompiPayment('ORD-1', 'tx-9');
      expect(body).toEqual({ transactionId: 'tx-9' });
      expect(res).toEqual({ order: { ...order(), status: 'PAID' }, message: 'Pago aprobado' });
    });

    it('pago rechazado (400 {success:false, status}): lanza el mensaje; el status se pierde', async () => {
      server.use(
        http.post(`${API}/orders/confirm-payment/ORD-1`, () =>
          HttpResponse.json({ success: false, message: 'Transacción DECLINED', status: 'DECLINED' }, { status: 400 }),
        ),
      );
      await expect(ordersService.confirmWompiPayment('ORD-1', 'tx')).rejects.toThrow('Transacción DECLINED');
    });

    it('sin data: order null y message vacío', async () => {
      server.use(http.post(`${API}/orders/confirm-payment/ORD-1`, () => HttpResponse.json({ success: true })));
      expect(await ordersService.confirmWompiPayment('ORD-1', 'tx')).toEqual({ order: null, message: '' });
    });
  });

  describe('changeStatus (PATCH /orders/{id}/status)', () => {
    it('envía el cuerpo y devuelve el pedido actualizado', async () => {
      let body: unknown;
      let method = '';
      server.use(
        http.patch(`${API}/orders/3/status`, async ({ request }) => {
          method = request.method;
          body = await request.json();
          return ok({ ...order(3), status: 'SHIPPED' });
        }),
      );
      const res = await ordersService.changeStatus(3, { status: 'SHIPPED', trackingNumber: 'T1', note: 'ok' });
      expect(method).toBe('PATCH');
      expect(body).toEqual({ status: 'SHIPPED', trackingNumber: 'T1', note: 'ok' });
      expect(res.status).toBe('SHIPPED');
    });

    it('sin data: lanza "Error cambiando estado"', async () => {
      server.use(http.patch(`${API}/orders/3/status`, () => HttpResponse.json({ success: true })));
      await expect(ordersService.changeStatus(3, { status: 'PAID' })).rejects.toThrow('Error cambiando estado');
    });

    it('422: lanza el mensaje del backend', async () => {
      server.use(http.patch(`${API}/orders/3/status`, () => fail('Transición no permitida', 422)));
      await expect(ordersService.changeStatus(3, { status: 'PAID' })).rejects.toThrow('Transición no permitida');
    });
  });

  describe('cancelMy (POST /orders/my/{id}/cancel)', () => {
    it('hace POST y no devuelve nada', async () => {
      let called = 0;
      server.use(
        http.post(`${API}/orders/my/5/cancel`, () => {
          called++;
          return ok(order(5), 'Pedido cancelado exitosamente');
        }),
      );
      await expect(ordersService.cancelMy(5)).resolves.toBeUndefined();
      expect(called).toBe(1);
    });

    it('error: lanza el mensaje', async () => {
      server.use(http.post(`${API}/orders/my/5/cancel`, () => fail('Solo se pueden cancelar pedidos pendientes', 409)));
      await expect(ordersService.cancelMy(5)).rejects.toThrow('Solo se pueden cancelar pedidos pendientes');
    });
  });

  describe('otros', () => {
    it('getById: null ante error', async () => {
      server.use(http.get(`${API}/orders/1`, () => fail('x', 500)));
      expect(await ordersService.getById(1)).toBeNull();
    });

    it('create: lanza el message si no viene data', async () => {
      server.use(http.post(`${API}/orders`, () => HttpResponse.json({ success: true, message: 'Sin stock' })));
      await expect(ordersService.create({} as never)).rejects.toThrow('Sin stock');
    });

    it('getByEmail usa GET /orders?search= (ruta de admin) y traga errores', async () => {
      server.use(http.get(`${API}/orders`, () => fail('No tienes permiso', 403)));
      // ACTUAL (posible bug): "para usuarios no autenticados" pero /orders exige orders.view; siempre [] para clientes.
      expect(await ordersService.getByEmail('a@b.co')).toEqual([]);
    });
  });
});
