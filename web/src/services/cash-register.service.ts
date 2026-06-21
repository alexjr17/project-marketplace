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
  const response = await axios.get(`${API_URL}/cash-registers${params}`, {
    headers: {
      Authorization: `Bearer ${getAuthToken()}`,
    },
  });
  return response.data.data;
}

/**
 * Get cash register by ID
 */
export async function getCashRegister(id: number): Promise<CashRegister> {
  const response = await axios.get(`${API_URL}/cash-registers/${id}`, {
    headers: {
      Authorization: `Bearer ${getAuthToken()}`,
    },
  });
  return response.data.data;
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
  const response = await axios.post(`${API_URL}/cash-registers`, data, {
    headers: {
      Authorization: `Bearer ${getAuthToken()}`,
    },
  });
  return response.data.data;
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
  const response = await axios.patch(`${API_URL}/cash-registers/${id}`, data, {
    headers: {
      Authorization: `Bearer ${getAuthToken()}`,
    },
  });
  return response.data.data;
}

/**
 * Delete cash register
 */
export async function deleteCashRegister(id: number): Promise<void> {
  await axios.delete(`${API_URL}/cash-registers/${id}`, {
    headers: {
      Authorization: `Bearer ${getAuthToken()}`,
    },
  });
}

/**
 * Open cash session
 */
export async function openSession(
  cashRegisterId: number,
  data: OpenSessionRequest
): Promise<CashSession> {
  const response = await axios.post(`${API_URL}/cash-registers/${cashRegisterId}/open-session`, data, {
    headers: {
      Authorization: `Bearer ${getAuthToken()}`,
    },
  });
  return response.data.data;
}

/**
 * Close cash session
 */
export async function closeSession(sessionId: number, data: CloseSessionRequest): Promise<CashSession> {
  const response = await axios.post(`${API_URL}/cash-registers/sessions/${sessionId}/close`, data, {
    headers: {
      Authorization: `Bearer ${getAuthToken()}`,
    },
  });
  return response.data.data;
}

/**
 * Get current session for authenticated user
 */
export async function getMySession(): Promise<CashSession | null> {
  try {
    const response = await axios.get(`${API_URL}/cash-registers/my-session`, {
      headers: {
        Authorization: `Bearer ${getAuthToken()}`,
      },
    });
    return response.data.data;
  } catch (error: any) {
    if (error.response?.status === 404) {
      return null;
    }
    throw error;
  }
}

/**
 * Get session report
 */
export async function getSessionReport(sessionId: number): Promise<SessionReport> {
  const response = await axios.get(`${API_URL}/cash-registers/sessions/${sessionId}/report`, {
    headers: {
      Authorization: `Bearer ${getAuthToken()}`,
    },
  });
  return response.data.data;
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

  const response = await axios.get(`${API_URL}/cash-registers/sessions?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${getAuthToken()}`,
    },
  });
  return response.data.data;
}
