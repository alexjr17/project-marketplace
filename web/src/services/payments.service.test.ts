import { describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server, API } from '../test/server';
import { ok, fail } from '../test/helpers';
import paymentsService from './payments.service';

const payment = { id: 4, orderId: 1, status: 'PENDING', amount: 5000 };

describe('payments.service (caracterización)', () => {
  describe('unwrap', () => {
    it('devuelve data del sobre', async () => {
      server.use(http.get(`${API}/payments/order/1`, () => ok([payment])));
      expect(await paymentsService.getMyOrderPayments(1)).toEqual([payment]);
    });

    it('data null o ausente: lanza el message o "Respuesta vacía del servidor"', async () => {
      server.use(http.get(`${API}/payments/4/admin`, () => HttpResponse.json({ success: true, message: 'Nada' })));
      await expect(paymentsService.getPaymentById(4)).rejects.toThrow('Nada');
      server.use(http.get(`${API}/payments/4/admin`, () => HttpResponse.json({ success: true, data: null })));
      await expect(paymentsService.getPaymentById(4)).rejects.toThrow('Respuesta vacía del servidor');
    });

    it('acepta valores falsy que no son null/undefined (0, [], "")', async () => {
      server.use(http.get(`${API}/payments/order/1`, () => ok([])));
      expect(await paymentsService.getMyOrderPayments(1)).toEqual([]);
    });

    it('error HTTP: lanza el mensaje del backend', async () => {
      server.use(http.post(`${API}/payments/4/refund`, () => fail('Monto mayor al pagado', 422)));
      await expect(paymentsService.refundPayment(4, { reason: 'x', amount: 9e9 })).rejects.toThrow('Monto mayor al pagado');
    });
  });

  describe('rutas', () => {
    it.each([
      ['createPayment', 'POST', '/api/payments', () => paymentsService.createPayment({ orderId: 1, paymentMethod: 'wompi', amount: 1 })],
      ['createMercadoPagoPreference', 'POST', '/api/payments/mercadopago/preference', () => paymentsService.createMercadoPagoPreference(1)],
      ['updateMyPayment', 'PATCH', '/api/payments/4', () => paymentsService.updateMyPayment(4, { notes: 'n' })],
      ['getOrderPayments', 'GET', '/api/payments/order/1/all', () => paymentsService.getOrderPayments(1)],
      ['getPaymentByTransactionId', 'GET', '/api/payments/transaction/tx', () => paymentsService.getPaymentByTransactionId('tx')],
      ['updatePayment', 'PATCH', '/api/payments/4/admin', () => paymentsService.updatePayment(4, { notes: 'n' })],
      ['verifyPayment', 'POST', '/api/payments/4/verify', () => paymentsService.verifyPayment(4, { approved: true })],
      ['cancelPayment', 'POST', '/api/payments/4/cancel', () => paymentsService.cancelPayment(4, 'r')],
      ['getPaymentStats', 'GET', '/api/payments/stats', () => paymentsService.getPaymentStats()],
    ])('%s → %s %s', async (_name, method, path, call) => {
      const seen: string[] = [];
      server.use(
        http.all(`${API}/payments/*`, ({ request }) => {
          seen.push(`${request.method} ${new URL(request.url).pathname}`);
          return ok(payment);
        }),
        http.post(`${API}/payments`, ({ request }) => {
          seen.push(`${request.method} ${new URL(request.url).pathname}`);
          return ok(payment);
        }),
      );
      await call();
      expect(seen).toEqual([`${method} ${path}`]);
    });
  });

  describe('listPayments (GET /payments/all)', () => {
    it('devuelve {data, meta} leyendo meta o pagination', async () => {
      vi.spyOn(console, 'log').mockImplementation(() => {});
      const meta = { page: 1, limit: 20, total: 1, totalPages: 1 };
      server.use(http.get(`${API}/payments/all`, () => ok([payment], undefined, { meta })));
      expect(await paymentsService.listPayments({ status: 'PENDING' })).toEqual({ data: [payment], meta });

      server.use(http.get(`${API}/payments/all`, () => ok([payment], undefined, { pagination: meta })));
      expect((await paymentsService.listPayments()).meta).toEqual(meta);
    });

    it('sin datos: lista vacía y meta por defecto; escribe en consola', async () => {
      const log = vi.spyOn(console, 'log').mockImplementation(() => {});
      server.use(http.get(`${API}/payments/all`, () => HttpResponse.json({ success: true })));
      expect(await paymentsService.listPayments()).toEqual({ data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } });
      // ACTUAL (posible bug): console.log de depuración en producción.
      expect(log).toHaveBeenCalled();
    });
  });

  describe('confirmMercadoPago (GET /webhooks/mercadopago/confirm/{n})', () => {
    it('lee success/message/status de la raíz y manda payment_id', async () => {
      let url = '';
      server.use(
        http.get(`${API}/webhooks/mercadopago/confirm/:n`, ({ request }) => {
          url = request.url;
          return HttpResponse.json({ success: true, message: 'Aprobado', status: 'approved' });
        }),
      );
      expect(await paymentsService.confirmMercadoPago('ORD 1', 'p9')).toEqual({ success: true, message: 'Aprobado', status: 'approved' });
      expect(url).toBe(`${API}/webhooks/mercadopago/confirm/ORD%201?payment_id=p9`);
    });

    it('pago no aprobado con status HTTP de error: lanza (no devuelve success:false)', async () => {
      server.use(http.get(`${API}/webhooks/mercadopago/confirm/:n`, () => fail('Pago rechazado', 400)));
      await expect(paymentsService.confirmMercadoPago('ORD-1', 'p')).rejects.toThrow('Pago rechazado');
    });
  });
});
