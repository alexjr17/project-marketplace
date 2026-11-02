import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server, API, API_ORIGIN } from '../test/server';
import { ok } from '../test/helpers';
import { settingsService } from './settings.service';

// Forma de SettingController::getPublic.
const publicSettings = {
  store: { name: 'Vexa', email: 'hola@vexa.co', logo: '/uploads/logo.png' },
  general: { siteName: 'Vexa' },
  appearance: { brandColors: { primary: '#7c3aed' } },
  home: {},
  catalog: {},
  shipping: { zones: [], carriers: [] },
  payment: { wompi: { enabled: true, publicKey: 'pub_test' } },
  legal: { terms: '<p>Términos</p>' },
};

describe('settings.service (caracterización)', () => {
  it('getPublicSettings (GET /settings/public, sin token) devuelve data con payment y legal', async () => {
    let auth: string | null = 'x';
    server.use(
      http.get(`${API}/settings/public`, ({ request }) => {
        auth = request.headers.get('authorization');
        return ok(publicSettings);
      }),
    );
    const res = await settingsService.getPublicSettings();
    expect(auth).toBeNull();
    expect(res.payment).toEqual(publicSettings.payment);
    expect(res.legal).toEqual(publicSettings.legal);
    expect(res.store.name).toBe('Vexa');
    // El logo relativo sale absoluto (api.service).
    expect(res.store.logo).toBe(`${API_ORIGIN}/uploads/logo.png`);
  });

  it('el tipo PublicSettings declara tax y paymentMethods que el backend no envía', async () => {
    server.use(http.get(`${API}/settings/public`, () => ok(publicSettings)));
    const res = await settingsService.getPublicSettings();
    // ACTUAL (posible bug): campos obligatorios en el tipo que llegan undefined.
    expect(res.tax).toBeUndefined();
    expect(res.paymentMethods).toBeUndefined();
  });

  it('sin data: lanza "Error obteniendo configuración"', async () => {
    server.use(http.get(`${API}/settings/public`, () => HttpResponse.json({ success: true })));
    await expect(settingsService.getPublicSettings()).rejects.toThrow('Error obteniendo configuración');
  });
});
