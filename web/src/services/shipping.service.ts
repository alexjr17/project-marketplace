import api from './api.service';
import type {
  CarrierApiConfig,
  CarrierZoneRate,
  ShippingOrigin,
  PackageDefaults,
} from '../types/settings';

/** Datos que se envían para sincronizar las tarifas de una transportadora. */
export interface SyncRatesPayload {
  zones: { id: string; name: string; cities: string[] }[];
  apiConfig?: CarrierApiConfig;            // si se omite, se usan tarifas aproximadas
  origin?: Partial<ShippingOrigin>;
  packageDefaults?: PackageDefaults;       // tamaño y peso para cotizar
  carrierCode?: string;                    // código de la transportadora en la API
  declaredValue?: number;
}

/** Propuesta de tarifas devuelta por el backend (para vista previa). */
export interface SyncRatesResult {
  source: 'api' | 'simulated' | 'mixed';
  rates: CarrierZoneRate[];
  errors: string[];
  syncedAt: string;
}

export const shippingService = {
  /**
   * Consulta las tarifas de envío por zona. Si la transportadora tiene
   * conexión API se consulta en vivo; si no, devuelve tarifas aproximadas.
   * El resultado es una propuesta — no aplica nada todavía.
   */
  async syncRates(payload: SyncRatesPayload): Promise<SyncRatesResult> {
    const res = await api.post<SyncRatesResult>('/shipping/sync-rates', payload);
    if (!res.data) throw new Error(res.message || 'Error al sincronizar tarifas');
    return res.data;
  },
};

export default shippingService;
