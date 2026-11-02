import { httpKeepUrls as client, isApiError } from '../lib/http';
// ==================== TYPES ====================

export interface CashRegister {
  id: number;
  name: string;
  location: string;
  code: string;
  /** Categorías que la caja puede vender. Vacío/null = todas. */
  categoryIds?: number[] | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  cashSessions?: CashSession[];
}

export interface CashSession {
  id: number;
  cashRegisterId: number;
  cashRegister?: CashRegister;
  sellerId: number;
  seller?: {
    id: number;
    name: string;
    email: string;
  };
  openedAt: string;
  closedAt: string | null;
  initialCash: number;
  finalCash: number | null;
  expectedCash: number | null;
  difference: number | null;
  salesCount: number;
  totalSales: number;
  notes: string | null;
  status: 'OPEN' | 'CLOSED';
  createdAt: string;
  updatedAt: string;
}

export interface OpenSessionRequest {
  initialCash: number;
  notes?: string;
}

export interface CloseSessionRequest {
  finalCash: number;
  notes?: string;
}

export interface SessionReport {
  session: CashSession;
  sales: any[];
  summary: {
    totalSales: number;
    totalAmount: number;
    paymentMethods: {
      [key: string]: {
        count: number;
        total: number;
      };
    };
    duration: number | null;
  };
}

export interface SessionsFilter {
  cashRegisterId?: number;
  sellerId?: number;
  status?: 'OPEN' | 'CLOSED';
  dateFrom?: string;
  dateTo?: string;
}

// ==================== API FUNCTIONS ====================

/**
 * Get all cash registers
 */
export async function getCashRegisters(activeOnly: boolean = false): Promise<CashRegister[]> {
  const params = activeOnly ? '?activeOnly=true' : '';
  return client.get<CashRegister[]>(`/cash-registers${params}`);
}

/**
 * Get cash register by ID
 */
export async function getCashRegister(id: number): Promise<CashRegister> {
  return client.get<CashRegister>(`/cash-registers/${id}`);
}

/**
 * Create cash register
 */
export async function createCashRegister(data: {
  name: string;
  location: string;
  code: string;
  categoryIds?: number[];
}): Promise<CashRegister> {
  return client.post<CashRegister>(`/cash-registers`, data);
}

/**
 * Update cash register
 */
export async function updateCashRegister(
  id: number,
  data: {
    name?: string;
    location?: string;
    code?: string;
    isActive?: boolean;
    categoryIds?: number[];
  }
): Promise<CashRegister> {
  return client.patch<CashRegister>(`/cash-registers/${id}`, data);
}

/**
 * Delete cash register
 */
export async function deleteCashRegister(id: number): Promise<void> {
  await client.delete(`/cash-registers/${id}`);
}

/**
 * Open cash session
 */
export async function openSession(
  cashRegisterId: number,
  data: OpenSessionRequest
): Promise<CashSession> {
  return client.post<CashSession>(`/cash-registers/${cashRegisterId}/open-session`, data);
}

/**
 * Close cash session
 */
export async function closeSession(sessionId: number, data: CloseSessionRequest): Promise<CashSession> {
  return client.post<CashSession>(`/cash-registers/sessions/${sessionId}/close`, data);
}

/**
 * Get current session for authenticated user
 */
export async function getMySession(): Promise<CashSession | null> {
  try {
    return await client.get<CashSession | null>(`/cash-registers/my-session`);
  } catch (error) {
    if (isApiError(error) && error.status === 404) {
      return null;
    }
    throw error;
  }
}

/**
 * Get session report
 */
export async function getSessionReport(sessionId: number): Promise<SessionReport> {
  return client.get<SessionReport>(`/cash-registers/sessions/${sessionId}/report`);
}

/**
 * Get sessions with filters
 */
export async function getSessions(filter?: SessionsFilter): Promise<CashSession[]> {
  const params = new URLSearchParams();
  if (filter?.cashRegisterId) params.append('cashRegisterId', filter.cashRegisterId.toString());
  if (filter?.sellerId) params.append('sellerId', filter.sellerId.toString());
  if (filter?.status) params.append('status', filter.status);
  if (filter?.dateFrom) params.append('dateFrom', filter.dateFrom);
  if (filter?.dateTo) params.append('dateTo', filter.dateTo);

  return client.get<CashSession[]>(`/cash-registers/sessions?${params.toString()}`);
}
