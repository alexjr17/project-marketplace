import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// Helper para obtener token desde marketplace_auth
const getAuthToken = (): string | null => {
  const authData = localStorage.getItem('marketplace_auth');
  if (authData) {
    try {
      const parsed = JSON.parse(authData);
      return parsed.token || null;
    } catch {
      return null;
    }
  }
  return null;
};

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
  paymentMethod: 'cash' | 'card' | 'transfer' | 'mixed';
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
  price: number;
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
  const response = await axios.post(
    `${API_URL}/pos/scan`,
    { barcode },
    {
      headers: {
        Authorization: `Bearer ${getAuthToken()}`,
      },
    }
  );
  return response.data.data;
}

/**
 * Search products and templates by barcode or name
 */
export async function searchProductsAndTemplates(query: string): Promise<SearchResponse> {
  const response = await axios.post(
    `${API_URL}/pos/search`,
    { query },
    {
      headers: {
        Authorization: `Bearer ${getAuthToken()}`,
      },
    }
  );
  return response.data.data;
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
  search: string = ''
): Promise<BrowseProductsResponse> {
  const response = await axios.get(`${API_URL}/pos/products`, {
    params: { page, perPage, search: search || undefined },
    headers: {
      Authorization: `Bearer ${getAuthToken()}`,
    },
  });
  return response.data.data;
}

/**
 * Calculate sale totals
 */
export async function calculateSale(
  items: SaleItem[],
  discount: number = 0
): Promise<CalculateSaleResponse> {
  const response = await axios.post(
    `${API_URL}/pos/calculate`,
    { items, discount },
    {
      headers: {
        Authorization: `Bearer ${getAuthToken()}`,
      },
    }
  );
  return response.data.data;
}

/**
 * Create a POS sale
 */
export async function createSale(data: CreateSaleRequest): Promise<Sale> {
  const response = await axios.post(`${API_URL}/pos/sale`, data, {
    headers: {
      Authorization: `Bearer ${getAuthToken()}`,
    },
  });
  return response.data.data;
}

/**
 * Cancel a POS sale
 */
export async function cancelSale(saleId: number, reason: string): Promise<Sale> {
  const response = await axios.post(
    `${API_URL}/pos/sale/${saleId}/cancel`,
    { reason },
    {
      headers: {
        Authorization: `Bearer ${getAuthToken()}`,
      },
    }
  );
  return response.data.data;
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

  const response = await axios.get(`${API_URL}/pos/sales?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${getAuthToken()}`,
    },
  });
  return response.data.data;
}

/**
 * Get sale detail
 */
export async function getSaleDetail(saleId: number): Promise<Sale> {
  const response = await axios.get(`${API_URL}/pos/sale/${saleId}`, {
    headers: {
      Authorization: `Bearer ${getAuthToken()}`,
    },
  });
  return response.data.data;
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
  const response = await axios.get(`${API_URL}/pos/customer/search`, {
    params: { cedula },
    headers: {
      Authorization: `Bearer ${getAuthToken()}`,
    },
  });
  return response.data.data;
}

/**
 * Send invoice by email
 */
export async function sendInvoiceEmail(saleId: number, email: string): Promise<{ message: string }> {
  const response = await axios.post(
    `${API_URL}/pos/sale/${saleId}/send-invoice`,
    { email },
    {
      headers: {
        Authorization: `Bearer ${getAuthToken()}`,
      },
    }
  );
  return { message: response.data.message };
}

/**
 * Get invoice PDF URL for printing
 */
export function getInvoicePDFUrl(saleId: number): string {
  return `${API_URL}/pos/sale/${saleId}/invoice-pdf`;
}

/**
 * Get invoice PDF as Blob (for preview modal)
 */
export async function getInvoicePDFBlob(saleId: number): Promise<Blob> {
  const token = getAuthToken();
  const url = `${API_URL}/pos/sale/${saleId}/invoice-pdf`;

  const response = await axios.get(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    responseType: 'blob',
  });

  return new Blob([response.data], { type: 'application/pdf' });
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
  const response = await axios.post(
    `${API_URL}/pos/sale/${saleId}/payment-evidence`,
    { evidence },
    {
      headers: {
        Authorization: `Bearer ${getAuthToken()}`,
      },
    }
  );
  return response.data.data;
}

/**
 * Get payment evidence for a sale
 */
export async function getPaymentEvidence(saleId: number): Promise<string | null> {
  const response = await axios.get(`${API_URL}/pos/sale/${saleId}/payment-evidence`, {
    headers: {
      Authorization: `Bearer ${getAuthToken()}`,
    },
  });
  return response.data.data?.evidence || null;
}
