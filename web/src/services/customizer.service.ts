import { http } from '../lib/http';

export interface CustomizationQuote {
  basePrice: number;
  zones: Array<{ id: number; name: string; zoneTypeSlug: string; price: number }>;
  customizationPrice: number;
  total: number;
}

/** Precio de la personalización (lo calcula el servidor: base + precio de cada zona usada). */
async function quote(templateId: number, templateZoneIds: number[]): Promise<CustomizationQuote> {
  return http.post<CustomizationQuote>('/customizer/quote', { templateId, templateZoneIds });
}

/** Sube una imagen del diseño (data URL) y devuelve su URL. Requiere sesión. */
async function uploadDesignImage(dataUrl: string): Promise<string> {
  const res = await http.post<{ url?: string }>('/uploads/base64', { image: dataUrl, folder: 'designs' });
  if (!res?.url) throw new Error('La imagen no se pudo subir');
  return res.url;
}

export const customizerService = { quote, uploadDesignImage };
