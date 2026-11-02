import { httpKeepUrls as client } from '../lib/http';
// ==================== TIPOS ====================

export interface BarcodeLabelData {
  variantId: number;
  barcode: string;
  productName: string;
  sku: string;
  color: string;
  size: string;
  price: number;
  image: string; // Base64 encoded image
}

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
 * Generar imagen de código de barras genérico
 */
export async function generateBarcodeImage(
  barcode: string,
  options: BarcodeImageOptions = {}
): Promise<string> {
  const blob = await client.blob('/barcodes/image', { method: 'POST', body: { barcode, ...options } });

  return URL.createObjectURL(blob);
}

/**
 * Obtener datos completos de etiqueta para una variante
 */
export async function getVariantBarcodeLabel(variantId: number): Promise<BarcodeLabelData> {
  return client.get<BarcodeLabelData>(`/barcodes/label/${variantId}`);
}

/**
 * Generar etiquetas para múltiples variantes
 */
export async function generateBatchLabels(variantIds: number[]): Promise<BarcodeLabelData[]> {
  return client.post<BarcodeLabelData[]>(`/barcodes/labels/batch`, { variantIds });
}

/**
 * Generar etiquetas para todas las variantes de un producto
 */
export async function generateProductLabels(productId: number): Promise<BarcodeLabelData[]> {
  return client.get<BarcodeLabelData[]>(`/barcodes/labels/product/${productId}`);
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
 * Asignar códigos de barras a todas las variantes sin código
 */
export async function assignAllBarcodes(): Promise<{
  success: number;
  failed: number;
  errors: { variantId: number; error: string }[];
}> {
  return client.post<{
  success: number;
  failed: number;
  errors: { variantId: number; error: string }[];
}>(`/barcodes/assign-all`, {});
}

/**
 * Validar formato de código de barras
 */
export async function validateBarcode(
  barcode: string,
  type: 'ean13' | 'code128' = 'ean13'
): Promise<{ barcode: string; type: string; isValid: boolean }> {
  return client.post<{ barcode: string; type: string; isValid: boolean }>(`/barcodes/validate`, { barcode, type });
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
