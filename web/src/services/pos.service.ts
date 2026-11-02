import { apiUrl, httpKeepUrls as client } from '../lib/http';
// ==================== TYPES ====================

export interface ScanProductResponse {
  variantId: number;
  product: {
    id: number;
    name: string;
    image: string;
  };
  color: string;
  size: string;
  sku: string;
  barcode: string | null;
  price: number;
  basePrice?: number;
  hasDiscount?: boolean;
  stock: number;
  available: boolean;
}

export interface SaleItem {
  variantId: number;
  quantity: number;
  price: number;
}

export interface CalculateSaleRequest {
  items: SaleItem[];
  discount?: number;
}

export interface CalculateSaleResponse {
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
}

export interface CreateSaleRequest {
  cashRegisterId: number;
  items: SaleItem[];
  customerId?: number;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  customerCedula?: string; // NIT/Cédula del cliente para registro
  paymentMethod: 'cash' | 'card' | 'transfer' | 'mixed' | 'debe';
  cashAmount?: number;
  cardAmount?: number;
  discount?: number;
  notes?: string;
  // Datos de pago con tarjeta/transferencia
  cardReference?: string;
  cardType?: string;
  cardLastFour?: string;
}

export interface POSCustomer {
  id: number;
  cedula: string;
  name: string;
  email: string | null;
  phone: string | null;
  totalPurchases: number;
  totalSpent: number;
}

export interface Sale {
  id: number;
  orderNumber: string;
  cashRegisterId: number;
  sellerId: number;
  posCustomerId: number | null;
  posCustomer: POSCustomer | null;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  items: any[];
  subtotal: number;
  shippingCost: number;
  discount: number;
  tax: number;
  total: number;
  paymentMethod: string;
  cardType?: string | null;
  cardLastFour?: string | null;
  cardReference?: string | null;
  cashAmount?: number | null;
  cardAmount?: number | null;
  paymentEvidence?: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SalesHistoryFilter {
  cashRegisterId?: number;
  dateFrom?: string;
  dateTo?: string;
  status?: string;
}

export interface ProductSearchResult {
  type: 'product';
  variantId: number;
  productId: number;
  name: string;
  image: string | null;
  color: string;
  size: string;
  sku: string;
  barcode: string | null;
  price: number;        // precio con la oferta automática ya aplicada
  basePrice?: number;   // precio original (para mostrar tachado)
  hasDiscount?: boolean;
  stock: number;
  available: boolean;
  hasOptions?: boolean; // tiene colores/tallas: hay que elegir variante
}

export interface PosVariant {
  variantId: number;
  productId: number;
  name: string;
  colorName: string | null;
  colorHex: string | null;
  size: string | null;
  sizeName: string | null;
  sku: string | null;
  barcode: string | null;
  image: string | null;
  price: number;
  basePrice: number;
  hasDiscount: boolean;
  stock: number;
  available: boolean;
}

export interface TemplateZoneInfo {
  id: number;
  name: string;
  price: number;
  zoneType: string;
  zoneTypeSlug: string;
  isRequired: boolean;
  isBlocked: boolean;
  positionX: number;
  positionY: number;
  maxWidth: number;
  maxHeight: number;
  shape: 'rect' | 'circle' | 'polygon';
}

export interface TemplateSearchResult {
  type: 'template';
  productId: number;
  templateId: number;
  name: string;
  image: string | null;
  sku: string;
  basePrice: number;
  zoneTypeImages: Record<string, string> | null;
  scannedVariant?: {
    variantId: number;
    colorId: number | null;
    colorName: string | null;
    colorHex: string | null;
    sizeId: number | null;
    sizeName: string | null;
    sizeAbbr: string | null;
  };
  colors: Array<{
    id: number;
    name: string;
    slug: string;
    hexCode: string;
  }>;
  sizes: Array<{
    id: number;
    name: string;
    abbreviation: string;
  }>;
  zones: TemplateZoneInfo[];
}

export type SearchResult = ProductSearchResult | TemplateSearchResult;

export interface SearchResponse {
  type: 'single' | 'list';
  result?: ProductSearchResult; // For single barcode scan
  results?: SearchResult[]; // For name-based search
}

// ==================== API FUNCTIONS ====================

/**
 * Scan product by barcode
 */
export async function scanProduct(barcode: string): Promise<ScanProductResponse> {
  return client.post<ScanProductResponse>(`/pos/scan`, { barcode });
}

/**
 * Search products and templates by barcode or name
 */
export async function searchProductsAndTemplates(query: string): Promise<SearchResponse> {
  return client.post<SearchResponse>(`/pos/search`, { query });
}

export interface BrowseProductsResponse {
  results: SearchResult[];
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

/**
 * Lista paginada de productos y templates para el catálogo del POS.
 */
export async function browseProducts(
  page: number = 1,
  perPage: number = 12,
  search: string = '',
  categoryId: number | null = null,
  type: 'product' | 'template' | null = null
): Promise<BrowseProductsResponse> {
  return client.get<BrowseProductsResponse>(`/pos/products`, { page, perPage, search: search || undefined, categoryId: categoryId || undefined, type: type || undefined });
}

/** Variantes (color/talla) de un producto, para elegir en el POS. */
export async function getProductVariants(productId: number): Promise<PosVariant[]> {
  return (await client.get<PosVariant[]>(`/pos/product/${productId}/variants`)) || [];
}

/**
 * Calculate sale totals
 */
export async function calculateSale(
  items: SaleItem[],
  discount: number = 0
): Promise<CalculateSaleResponse> {
  return client.post<CalculateSaleResponse>(`/pos/calculate`, { items, discount });
}

/**
 * Create a POS sale
 */
export async function createSale(data: CreateSaleRequest): Promise<Sale> {
  return client.post<Sale>(`/pos/sale`, data);
}

/**
 * Cancel a POS sale
 */
export async function cancelSale(saleId: number, reason: string): Promise<Sale> {
  return client.post<Sale>(`/pos/sale/${saleId}/cancel`, { reason });
}

export interface PosStats {
  range: string;
  from: string;
  totals: { salesCount: number; totalSold: number; avgTicket: number; itemsSold: number };
  byMethod: { method: string; count: number; total: number }[];
  byHour: { hour: number; total: number; count: number }[];
  topProducts: { name: string; qty: number; total: number }[];
}

/** Estadísticas/reportes del POS (today | 7d | 30d). */
export async function getPosStats(range: 'today' | '7d' | '30d' = 'today'): Promise<PosStats> {
  return client.get<PosStats>(`/pos/stats`, { range });
}

export interface ReturnSalePayload {
  items: { variantId: number; quantity: number }[];
  reason?: string;
  refundMethod?: 'cash' | 'transfer';
}

/** Devolución parcial de una venta (reintegra stock y reembolsa). */
export async function returnSale(saleId: number, payload: ReturnSalePayload): Promise<Sale> {
  return client.post<Sale>(`/pos/sale/${saleId}/return`, payload);
}

/**
 * Get sales history
 */
export async function getSalesHistory(filter?: SalesHistoryFilter): Promise<Sale[]> {
  const params = new URLSearchParams();
  if (filter?.cashRegisterId) params.append('cashRegisterId', filter.cashRegisterId.toString());
  if (filter?.dateFrom) params.append('dateFrom', filter.dateFrom);
  if (filter?.dateTo) params.append('dateTo', filter.dateTo);
  if (filter?.status) params.append('status', filter.status);

  return client.get<Sale[]>(`/pos/sales?${params.toString()}`);
}

/**
 * Get sale detail
 */
export async function getSaleDetail(saleId: number): Promise<Sale> {
  return client.get<Sale>(`/pos/sale/${saleId}`);
}

// ==================== CUSTOMER & INVOICE ====================

export interface CustomerSearchResult {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  cedula: string;
  totalPurchases: number;
  totalSpent: number;
}

/**
 * Search customer by cédula
 */
export async function searchCustomerByCedula(cedula: string): Promise<CustomerSearchResult | null> {
  return client.get<CustomerSearchResult | null>(`/pos/customer/search`, { cedula });
}

/**
 * Search customers by name / cédula / phone (autocomplete). Returns a list.
 */
export async function searchCustomers(q: string): Promise<CustomerSearchResult[]> {
  return (await client.get<CustomerSearchResult[]>(`/pos/customer/search`, { q })) ?? [];
}

export interface PendingDebt {
  id: number;
  orderNumber: string;
  posCustomerId: number | null;
  customerName: string;
  customerPhone: string | null;
  total: number;
  paid: number;
  remaining: number;
  createdAt: string;
}

export interface POSCustomerListItem {
  id: number;
  name: string;
  cedula: string | null;
  phone: string | null;
  email: string | null;
  totalPurchases: number;
  totalSpent: number;
  debt: number;
}

export interface POSCustomerOrder {
  id: number;
  orderNumber: string;
  total: number;
  status: string;
  paymentMethod: string;
  paid: number;
  remaining: number;
  itemsCount: number;
  createdAt: string;
}

export interface POSCustomerDetail extends POSCustomerListItem {
  orders: POSCustomerOrder[];
}

/** Lista de clientes POS (con deuda). */
export async function listCustomers(q?: string): Promise<POSCustomerListItem[]> {
  return (await client.get<POSCustomerListItem[]>(`/pos/customers`, q ? { q } : {})) ?? [];
}

/** Detalle de un cliente POS con su historial de compras. */
export async function getCustomerDetail(id: number): Promise<POSCustomerDetail> {
  return client.get<POSCustomerDetail>(`/pos/customers/${id}`);
}

export interface UpdateSalePayload {
  items?: { variantId: number; quantity: number; price: number }[];
  customerId?: number;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  customerCedula?: string;
  paymentMethod?: 'cash' | 'card' | 'transfer' | 'mixed' | 'debe';
  discount?: number;
  notes?: string;
  // Datos de pago/transacción (al editar conservar/actualizar).
  cashAmount?: number;
  cardAmount?: number;
  cardReference?: string;
  cardType?: string;
  cardLastFour?: string;
}

/** Edita una venta POS (ítems, cliente, método de pago, notas). */
export async function updateSale(saleId: number, data: UpdateSalePayload): Promise<Sale> {
  return client.put<Sale>(`/pos/sale/${saleId}`, data);
}

/**
 * List pending POS debts (fiados).
 */
export async function getDebts(): Promise<PendingDebt[]> {
  return (await client.get<PendingDebt[]>(`/pos/debts`)) ?? [];
}

/**
 * Collect a debt (fiado): mark it paid with the given collection method.
 */
export async function collectDebt(
  saleId: number,
  paymentMethod: 'cash' | 'card' | 'transfer',
  amount?: number
): Promise<Sale> {
  return client.post<Sale>(`/pos/sale/${saleId}/collect`, { paymentMethod, amount });
}

/**
 * Send invoice by email
 */
export async function sendInvoiceEmail(saleId: number, email: string): Promise<{ message: string }> {
  const response = await client.envelope('POST', `/pos/sale/${saleId}/send-invoice`, { body: { email } });
  return { message: response.message ?? '' };
}

/**
 * Get invoice PDF URL for printing
 */
export function getInvoicePDFUrl(saleId: number): string {
  return apiUrl(`/pos/sale/${saleId}/invoice-pdf`);
}

/**
 * Get invoice PDF as Blob (for preview modal)
 */
export async function getInvoicePDFBlob(saleId: number): Promise<Blob> {
  const blob = await client.blob(`/pos/sale/${saleId}/invoice-pdf`);
  return new Blob([blob], { type: 'application/pdf' });
}

/**
 * Print invoice PDF - opens print dialog directly
 */
export async function printInvoicePDF(saleId: number): Promise<void> {
  // Get PDF as blob
  const blob = await getInvoicePDFBlob(saleId);
  const pdfUrl = URL.createObjectURL(blob);

  // Create hidden iframe for printing
  const printFrame = document.createElement('iframe');
  printFrame.id = 'print-invoice-frame';
  printFrame.style.position = 'fixed';
  printFrame.style.right = '0';
  printFrame.style.bottom = '0';
  printFrame.style.width = '0';
  printFrame.style.height = '0';
  printFrame.style.border = 'none';
  printFrame.src = pdfUrl;

  document.body.appendChild(printFrame);

  // Wait for PDF to load then trigger print dialog
  printFrame.onload = () => {
    setTimeout(() => {
      printFrame.contentWindow?.focus();
      printFrame.contentWindow?.print();
    }, 300);
  };

  // Cleanup after printing (when user closes print dialog)
  const cleanup = () => {
    const frame = document.getElementById('print-invoice-frame');
    if (frame) {
      document.body.removeChild(frame);
    }
    URL.revokeObjectURL(pdfUrl);
    window.removeEventListener('focus', cleanup);
  };

  // Remove iframe when window regains focus (print dialog closed)
  setTimeout(() => {
    window.addEventListener('focus', cleanup);
  }, 1000);
}

// ==================== PAYMENT EVIDENCE ====================

/**
 * Upload payment evidence for a transfer sale
 */
export async function uploadPaymentEvidence(saleId: number, evidence: string): Promise<Sale> {
  return client.post<Sale>(`/pos/sale/${saleId}/payment-evidence`, { evidence });
}

/**
 * Get payment evidence for a sale
 */
export async function getPaymentEvidence(saleId: number): Promise<string | null> {
  const data = await client.get<{ evidence?: string | null } | null>(`/pos/sale/${saleId}/payment-evidence`);
  return data?.evidence || null;
}
