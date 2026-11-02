import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import paymentsService, {
  type Payment,
  type CreatePaymentInput,
  type UpdatePaymentInput,
  type VerifyPaymentInput,
  type RefundPaymentInput,
  type PaymentStats,
  type ListPaymentsQuery,
} from '../services/payments.service';
import { useToast } from './ToastContext';

interface PaymentsContextType {
  payments: Payment[];
  isLoading: boolean;
  error: string | null;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };

  // Métodos de usuario
  createPayment: (data: CreatePaymentInput) => Promise<Payment>;
  getMyOrderPayments: (orderId: number) => Promise<Payment[]>;
  updateMyPayment: (id: number, data: UpdatePaymentInput) => Promise<Payment>;

  // Métodos de admin
  listPayments: (query?: ListPaymentsQuery) => Promise<void>;
  getOrderPayments: (orderId: number) => Promise<Payment[]>;
  getPaymentById: (id: number) => Promise<Payment | undefined>;
  getPaymentByTransactionId: (transactionId: string) => Promise<Payment | undefined>;
  verifyPayment: (id: number, data: VerifyPaymentInput) => Promise<Payment>;
  refundPayment: (id: number, data: RefundPaymentInput) => Promise<Payment>;
  cancelPayment: (id: number, reason?: string) => Promise<Payment>;
  getPaymentStats: () => Promise<PaymentStats>;

  // Utilidades
  refreshPayments: () => Promise<void>;
  setPage: (page: number) => void;
  setFilters: (filters: Partial<ListPaymentsQuery>) => void;
}

const PaymentsContext = createContext<PaymentsContextType | undefined>(undefined);

interface PaymentsProviderProps {
  children: ReactNode;
}

export function PaymentsProvider({ children }: PaymentsProviderProps) {
  const { showToast } = useToast();

  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [filters, setFiltersState] = useState<Partial<ListPaymentsQuery>>({});

  // Debug: Log payments state changes
  useEffect(() => {
    console.log('[PaymentsContext] payments state updated:', payments);
  }, [payments]);

  useEffect(() => {
    console.log('[PaymentsContext] pagination state updated:', pagination);
  }, [pagination]);

  // ==================== MÉTODOS DE USUARIO ====================

  const createPayment = useCallback(
    async (data: CreatePaymentInput): Promise<Payment> => {
      try {
        setIsLoading(true);
        setError(null);
        const payment = await paymentsService.createPayment(data);
        showToast('Pago iniciado correctamente', 'success');
        return payment;
      } catch (err: any) {
        const errorMessage = err?.message || 'Error al crear el pago';
        setError(errorMessage);
        showToast(errorMessage, 'error');
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [showToast]
  );

  const getMyOrderPayments = useCallback(
    async (orderId: number): Promise<Payment[]> => {
      try {
        setIsLoading(true);
        setError(null);
        const payments = await paymentsService.getMyOrderPayments(orderId);
        return payments;
      } catch (err: any) {
        const errorMessage = err?.message || 'Error al obtener pagos';
        setError(errorMessage);
        showToast(errorMessage, 'error');
        return [];
      } finally {
        setIsLoading(false);
      }
    },
    [showToast]
  );

  const updateMyPayment = useCallback(
    async (id: number, data: UpdatePaymentInput): Promise<Payment> => {
      try {
        setIsLoading(true);
        setError(null);
        const payment = await paymentsService.updateMyPayment(id, data);
        showToast('Pago actualizado correctamente', 'success');
        return payment;
      } catch (err: any) {
        const errorMessage = err?.message || 'Error al actualizar el pago';
        setError(errorMessage);
        showToast(errorMessage, 'error');
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [showToast]
  );

  // ==================== MÉTODOS DE ADMIN ====================

  const listPayments = useCallback(
    async (query?: ListPaymentsQuery): Promise<void> => {
      try {
        console.log('[PaymentsContext] listPayments called with query:', query);
        setIsLoading(true);
        setError(null);

        // Leer valores actuales del estado usando función updater
        let currentPage = 1;
        let currentLimit = 20;
        setPagination((prev) => {
          currentPage = prev.page;
          currentLimit = prev.limit;
          return prev;
        });

        console.log('[PaymentsContext] Calling API with filters:', filters, 'page:', currentPage, 'limit:', currentLimit);
        const result = await paymentsService.listPayments({
          ...filters,
          ...query,
          page: query?.page ?? currentPage,
          limit: query?.limit ?? currentLimit,
        });
        console.log('[PaymentsContext] API returned:', result);
        console.log('[PaymentsContext] Setting payments data:', result.data);
        console.log('[PaymentsContext] Setting pagination meta:', result.meta);
        setPayments(result.data);
        setPagination(result.meta);
      } catch (err: any) {
        const errorMessage = err?.message || 'Error al listar pagos';
        setError(errorMessage);
        showToast(errorMessage, 'error');
        console.error('[PaymentsContext] Error listing payments:', err);
      } finally {
        setIsLoading(false);
      }
    },
    [filters, showToast]
  );

  const getOrderPayments = useCallback(
    async (orderId: number): Promise<Payment[]> => {
      try {
        setIsLoading(true);
        setError(null);
        const payments = await paymentsService.getOrderPayments(orderId);
        return payments;
      } catch (err: any) {
        const errorMessage = err?.message || 'Error al obtener pagos del pedido';
        setError(errorMessage);
        showToast(errorMessage, 'error');
        return [];
      } finally {
        setIsLoading(false);
      }
    },
    [showToast]
  );

  const getPaymentById = useCallback(
    async (id: number): Promise<Payment | undefined> => {
      try {
        setIsLoading(true);
        setError(null);
        const payment = await paymentsService.getPaymentById(id);
        return payment;
      } catch (err: any) {
        const errorMessage = err?.message || 'Error al obtener el pago';
        setError(errorMessage);
        showToast(errorMessage, 'error');
        return undefined;
      } finally {
        setIsLoading(false);
      }
    },
    [showToast]
  );

  const getPaymentByTransactionId = useCallback(
    async (transactionId: string): Promise<Payment | undefined> => {
      try {
        setIsLoading(true);
        setError(null);
        const payment = await paymentsService.getPaymentByTransactionId(transactionId);
        return payment;
      } catch (err: any) {
        const errorMessage = err?.message || 'Error al obtener el pago';
        setError(errorMessage);
        showToast(errorMessage, 'error');
        return undefined;
      } finally {
        setIsLoading(false);
      }
    },
    [showToast]
  );

  const verifyPayment = useCallback(
    async (id: number, data: VerifyPaymentInput): Promise<Payment> => {
      try {
        setIsLoading(true);
        setError(null);
        const payment = await paymentsService.verifyPayment(id, data);
        showToast(
          `Pago ${data.approved ? 'aprobado' : 'rechazado'} correctamente`,
          'success'
        );
        // Refrescar lista
        await listPayments();
        return payment;
      } catch (err: any) {
        const errorMessage = err?.message || 'Error al verificar el pago';
        setError(errorMessage);
        showToast(errorMessage, 'error');
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [showToast, listPayments]
  );

  const refundPayment = useCallback(
    async (id: number, data: RefundPaymentInput): Promise<Payment> => {
      try {
        setIsLoading(true);
        setError(null);
        const payment = await paymentsService.refundPayment(id, data);
        showToast('Reembolso procesado correctamente', 'success');
        // Refrescar lista
        await listPayments();
        return payment;
      } catch (err: any) {
        const errorMessage = err?.message || 'Error al procesar reembolso';
        setError(errorMessage);
        showToast(errorMessage, 'error');
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [showToast, listPayments]
  );

  const cancelPayment = useCallback(
    async (id: number, reason?: string): Promise<Payment> => {
      try {
        setIsLoading(true);
        setError(null);
        const payment = await paymentsService.cancelPayment(id, reason);
        showToast('Pago cancelado correctamente', 'success');
        // Refrescar lista
        await listPayments();
        return payment;
      } catch (err: any) {
        const errorMessage = err?.message || 'Error al cancelar el pago';
        setError(errorMessage);
        showToast(errorMessage, 'error');
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [showToast, listPayments]
  );

  const getPaymentStats = useCallback(async (): Promise<PaymentStats> => {
    try {
      setIsLoading(true);
      setError(null);
      const stats = await paymentsService.getPaymentStats();
      return stats;
    } catch (err: any) {
      const errorMessage = err?.message || 'Error al obtener estadísticas';
      setError(errorMessage);
      showToast(errorMessage, 'error');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  // ==================== UTILIDADES ====================

  const refreshPayments = useCallback(async () => {
    await listPayments();
  }, [listPayments]);

  const setPage = useCallback((page: number) => {
    setPagination((prev) => ({ ...prev, page }));
  }, []);

  const setFilters = useCallback((newFilters: Partial<ListPaymentsQuery>) => {
    setFiltersState((prev) => ({ ...prev, ...newFilters }));
    setPagination((prev) => ({ ...prev, page: 1 })); // Reset a página 1 al filtrar
  }, []);

  const value: PaymentsContextType = {
    payments,
    isLoading,
    error,
    pagination,
    createPayment,
    getMyOrderPayments,
    updateMyPayment,
    listPayments,
    getOrderPayments,
    getPaymentById,
    getPaymentByTransactionId,
    verifyPayment,
    refundPayment,
    cancelPayment,
    getPaymentStats,
    refreshPayments,
    setPage,
    setFilters,
  };

  return <PaymentsContext.Provider value={value}>{children}</PaymentsContext.Provider>;
}

export function usePayments() {
  const context = useContext(PaymentsContext);
  if (context === undefined) {
    throw new Error('usePayments must be used within a PaymentsProvider');
  }
  return context;
}
