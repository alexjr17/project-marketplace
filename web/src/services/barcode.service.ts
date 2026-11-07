import { httpKeepUrls as client } from '../lib/http';
// ==================== TIPOS ====================

export interface BarcodeImageOptions {
  format?: 'png' | 'svg';
  width?: number;
  height?: number;
  includeText?: boolean;
}

// ==================== API ====================

/**
 * Obtener imagen del código de barras de una variante
 * Devuelve una URL blob para mostrar la imagen
 */
export async function getVariantBarcodeImage(
  variantId: number,
  options: BarcodeImageOptions = {}
): Promise<string> {
  const params = new URLSearchParams();

  if (options.format) params.append('format', options.format);
  if (options.width) params.append('width', options.width.toString());
  if (options.height) params.append('height', options.height.toString());
  if (options.includeText !== undefined)
    params.append('includeText', options.includeText.toString());

  const blob = await client.blob(`/barcodes/image/${variantId}?${params.toString()}`);

  // Crear URL blob para la imagen
  return URL.createObjectURL(blob);
}

/**
 * Asignar código de barras a una variante
 */
export async function assignBarcode(
  variantId: number,
  barcode?: string
): Promise<{ variantId: number; barcode: string }> {
  return client.post<{ variantId: number; barcode: string }>(`/barcodes/assign/${variantId}`, { barcode });
}

/**
 * Generar PDF con etiquetas de códigos de barras
 * @param items Array de {variantId, quantity}
 * @param templateId ID de la plantilla personalizada (opcional)
 * @returns Blob con el PDF generado
 */
export async function generateBarcodeLabels(
  items: { variantId: number; quantity: number }[],
  templateId?: number
): Promise<Blob> {
  return client.blob('/barcodes/print', { method: 'POST', body: { items, templateId } });
}
