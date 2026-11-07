import { describe, expect, it } from 'vitest';
import { quoteShipping } from './shippingQuote';
import type { ShippingSettings, ShippingZone, ShippingCarrier } from '../types/settings';

const zone = (z: Partial<ShippingZone> & { id: string }): ShippingZone => ({ name: z.id, cities: [], isActive: true, ...z });
const carrier = (c: Partial<ShippingCarrier> & { id: string }): ShippingCarrier => ({
  name: c.id, code: c.id, isActive: true, volumetricFactor: 5000, zoneRates: [], ...c,
});
const days = { min: 1, max: 3 };

const settings = (over: Partial<ShippingSettings> = {}): ShippingSettings => ({
  origin: {} as ShippingSettings['origin'],
  handlingTime: 1,
  packageDefaults: {} as ShippingSettings['packageDefaults'],
  zones: [
    zone({ id: 'ant', name: 'Antioquia', department: 'Antioquia' }),
    zone({ id: 'bog', name: 'Bogotá', department: 'Bogotá D.C.' }),
    zone({ id: 'costa', name: 'Costa', cities: ['Ciudad Inventada'] }),
  ],
  carriers: [
    carrier({
      id: 'c1', name: 'Servi',
      zoneRates: [
        { zoneId: 'ant', baseCost: 10000, costPerKg: 2000, estimatedDays: days, freeShippingThreshold: 200000 },
        { zoneId: 'bog', baseCost: 8000, costPerKg: 1000, estimatedDays: days },
        { zoneId: 'costa', baseCost: 15000, costPerKg: 3000, estimatedDays: { min: 3, max: 6 } },
      ],
    }),
  ],
  ...over,
});

describe('quoteShipping (caracterización)', () => {
  it('ubica la zona por el departamento de la ciudad (sin acentos ni mayúsculas)', () => {
    const q = quoteShipping(settings(), '  MEDELLIN ', 2, 50000)!;
    expect(q).toEqual({
      cost: 14000, zoneName: 'Antioquia', carrierName: 'Servi', estimatedDays: days, free: false, freeShippingThreshold: 200000,
    });
  });

  it('cost = round(baseCost + peso * costPerKg)', () => {
    expect(quoteShipping(settings(), 'Bogotá', 1.25, 0)!.cost).toBe(9250);
    expect(quoteShipping(settings(), 'Bogotá', 0.3333, 0)!.cost).toBe(8333);
  });

  it('peso mínimo 0.1 kg (0 o negativo cuentan como 0.1)', () => {
    expect(quoteShipping(settings(), 'Bogotá', 0, 0)!.cost).toBe(8100);
    expect(quoteShipping(settings(), 'Bogotá', -5, 0)!.cost).toBe(8100);
    expect(quoteShipping(settings(), 'Bogotá', 0.05, 0)!.cost).toBe(8100);
  });

  it('envío gratis cuando subtotal >= umbral (inclusive)', () => {
    const q = quoteShipping(settings(), 'Medellín', 2, 200000)!;
    expect(q.free).toBe(true);
    expect(q.cost).toBe(0);
    expect(quoteShipping(settings(), 'Medellín', 2, 199999)!.free).toBe(false);
  });

  it('sin umbral nunca es gratis', () => {
    const q = quoteShipping(settings(), 'Bogotá', 1, 10_000_000)!;
    expect(q.free).toBe(false);
    expect(q.freeShippingThreshold).toBeUndefined();
  });

  it('umbral 0: siempre gratis', () => {
    const s = settings();
    s.carriers[0].zoneRates[1].freeShippingThreshold = 0;
    expect(quoteShipping(s, 'Bogotá', 1, 0)!.free).toBe(true);
  });

  it('respaldo: si el departamento no tiene zona, busca la ciudad en la lista de la zona', () => {
    const q = quoteShipping(settings(), 'ciudad inventada', 1, 0)!;
    expect(q.zoneName).toBe('Costa');
    expect(q.cost).toBe(18000);
  });

  it('respaldo por ciudad también aplica a ciudades conocidas de un departamento sin zona', () => {
    const s = settings({ zones: [zone({ id: 'costa', name: 'Costa', cities: ['Cali'] })] });
    expect(quoteShipping(s, 'Cali', 1, 0)!.zoneName).toBe('Costa');
  });

  it('la zona por departamento gana sobre la lista de ciudades de otra zona', () => {
    const s = settings();
    s.zones[2].cities.push('Medellín');
    expect(quoteShipping(s, 'Medellín', 1, 0)!.zoneName).toBe('Antioquia');
  });

  it('ignora zonas inactivas', () => {
    const s = settings();
    s.zones[0].isActive = false;
    expect(quoteShipping(s, 'Medellín', 1, 0)).toBeNull();
  });

  it('null si la ciudad está vacía o no tiene zona', () => {
    expect(quoteShipping(settings(), '', 1, 0)).toBeNull();
    expect(quoteShipping(settings(), '   ', 1, 0)).toBeNull();
    expect(quoteShipping(settings(), 'Pasto', 1, 0)).toBeNull();
  });

  it('transportadora: la predeterminada activa; si no, la primera activa', () => {
    const s = settings();
    s.carriers.push(carrier({ id: 'c2', name: 'Inter', zoneRates: [{ zoneId: 'bog', baseCost: 1, costPerKg: 0, estimatedDays: days }] }));
    expect(quoteShipping(s, 'Bogotá', 1, 0)!.carrierName).toBe('Servi');
    s.defaultCarrierId = 'c2';
    expect(quoteShipping(s, 'Bogotá', 1, 0)!.carrierName).toBe('Inter');
    s.carriers[1].isActive = false;
    expect(quoteShipping(s, 'Bogotá', 1, 0)!.carrierName).toBe('Servi');
  });

  it('null si no hay transportadora activa o no tiene tarifa para la zona', () => {
    const s = settings();
    s.carriers[0].isActive = false;
    expect(quoteShipping(s, 'Bogotá', 1, 0)).toBeNull();
    const s2 = settings();
    s2.carriers[0].zoneRates = s2.carriers[0].zoneRates.filter((r) => r.zoneId !== 'bog');
    expect(quoteShipping(s2, 'Bogotá', 1, 0)).toBeNull();
  });

  it('la predeterminada sin tarifa para la zona cae a otra transportadora activa que sí la tenga', () => {
    const s = settings();
    s.carriers.push(carrier({ id: 'c2', name: 'Inter', zoneRates: [] }));
    s.defaultCarrierId = 'c2';
    // Corregido (antes daba null aunque Servi cubre Bogotá). Igual en ShippingQuoteService del API.
    expect(quoteShipping(s, 'Bogotá', 1, 0)!.carrierName).toBe('Servi');
  });

  it('maxWeight de la tarifa se respeta: si ninguna transportadora lo admite, no se cotiza', () => {
    const s = settings();
    s.carriers[0].zoneRates[1].maxWeight = 5;
    // Corregido (antes 50 kg se cotizaba aunque la tarifa permite 5 kg máximo).
    expect(quoteShipping(s, 'Bogotá', 50, 0)).toBeNull();
    expect(quoteShipping(s, 'Bogotá', 5, 0)).not.toBeNull();
    // Otra transportadora que sí admite el peso toma el envío.
    s.carriers.push(carrier({ id: 'c2', name: 'Inter', zoneRates: [{ zoneId: 'bog', baseCost: 1000, costPerKg: 0, estimatedDays: days }] }));
    expect(quoteShipping(s, 'Bogotá', 50, 0)!.carrierName).toBe('Inter');
  });

  it('ciudad con nombre repetido en dos departamentos: se toma el primero de COLOMBIA_GEO', () => {
    const s = settings({
      zones: [zone({ id: 'cho', name: 'Chocó', department: 'Chocó' })],
      carriers: [carrier({ id: 'c1', zoneRates: [{ zoneId: 'cho', baseCost: 1, costPerKg: 0, estimatedDays: days }] })],
    });
    // ACTUAL (posible bug): "Riosucio" está en Caldas y en Chocó; se asume Caldas, no hay zona Caldas
    // y como la zona Chocó no lista ciudades, no se cotiza.
    expect(quoteShipping(s, 'Riosucio', 1, 0)).toBeNull();
  });

  it('settings sin zones/carriers no revienta', () => {
    expect(quoteShipping({} as ShippingSettings, 'Bogotá', 1, 0)).toBeNull();
  });
});
