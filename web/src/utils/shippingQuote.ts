import type { ShippingSettings } from '../types/settings';
import { COLOMBIA_GEO } from '../data/colombiaGeo';

export interface ShippingQuote {
  cost: number;
  zoneName: string;
  carrierName: string;
  estimatedDays: { min: number; max: number };
  free: boolean;
  /** Monto a partir del cual el envío es gratis en esta zona (si aplica). */
  freeShippingThreshold?: number;
}

/** Normaliza un nombre para comparar (sin acentos, espacios ni mayúsculas). */
const norm = (s: string): string =>
  (s || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

/** Departamento de Colombia al que pertenece una ciudad (o null). */
function departmentOfCity(cityN: string): string | null {
  for (const d of COLOMBIA_GEO) {
    if (d.cities.some((c) => norm(c) === cityN)) return d.department;
  }
  return null;
}

/**
 * Calcula el costo de envío a una ciudad según la configuración de zonas y
 * transportadoras. Primero ubica la zona por el DEPARTAMENTO de la ciudad
 * (la zona es un departamento); si no, intenta por la lista de ciudades.
 * Devuelve null si no se puede cotizar.
 */
export function quoteShipping(
  shipping: ShippingSettings,
  city: string,
  totalWeightKg: number,
  subtotal: number,
): ShippingQuote | null {
  if (!city || !city.trim()) return null;
  const cityN = norm(city);

  const activeZones = (shipping.zones || []).filter((z) => z.isActive);

  // 1. Zona cuyo departamento contiene la ciudad.
  const dept = departmentOfCity(cityN);
  let zone = dept
    ? activeZones.find((z) => z.department && norm(z.department) === norm(dept))
    : undefined;

  // 2. Respaldo: zona que lista la ciudad explícitamente.
  if (!zone) {
    zone = activeZones.find((z) => (z.cities || []).some((c) => norm(c) === cityN));
  }
  if (!zone) return null;

  // Transportadora: la predeterminada activa, o la primera activa.
  const carriers = (shipping.carriers || []).filter((c) => c.isActive);
  const carrier = carriers.find((c) => c.id === shipping.defaultCarrierId) ?? carriers[0];
  if (!carrier) return null;

  const rate = (carrier.zoneRates || []).find((r) => r.zoneId === zone!.id);
  if (!rate) return null;

  const weight = Math.max(totalWeightKg, 0.1);
  const cost = Math.round(rate.baseCost + weight * rate.costPerKg);
  const free = rate.freeShippingThreshold != null && subtotal >= rate.freeShippingThreshold;

  return {
    cost: free ? 0 : cost,
    zoneName: zone.name,
    carrierName: carrier.name,
    estimatedDays: rate.estimatedDays,
    free,
    freeShippingThreshold: rate.freeShippingThreshold,
  };
}
