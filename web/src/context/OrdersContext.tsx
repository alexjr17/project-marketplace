import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type {
  Order,
  OrderStatus,
  StatusHistoryEntry,
  PaymentEvidence,
  PaymentMethod,
} from '../types/order';
import { ordersService } from '../services/orders.service';
import type { ApiOrder, CreateOrderInput, ChangeStatusInput } from '../services/orders.service';
import { useAuth } from './AuthContext';

interface ChangeStatusParams {
  orderId: string;
  newStatus: OrderStatus;
  note?: string;
  evidences?: Omit<PaymentEvidence, 'id' | 'uploadedAt'>[];
  trackingNumber?: string;
  trackingUrl?: string;
  cancellationReason?: string;
}

interface CreateOrderData {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: string;
  shippingCity: string;
  shippingPostalCode?: string;
  shippingNotes?: string;
  paymentMethod: PaymentMethod;
  items: {
    productId: string | number;
    productName: string;
    productImage: string;
    size: string;
    color: string;
    quantity: number;
    unitPrice: number;
    customization?: {
      designFront?: string;
      designBack?: string;
      originalFront?: string;
      originalBack?: string;
    };
  }[];
  subtotal: number;
  shippingCost: number;
  discount: number;
  total: number;
  couponCode?: string;
}

interface OrdersContextType {
  orders: Order[];
  isLoading: boolean;
  error: string | null;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  getOrderById: (id: string) => Promise<Order | undefined>;
  getOrderByNumber: (orderNumber: string) => Promise<Order | undefined>;
  changeOrderStatus: (params: ChangeStatusParams) => Promise<void>;
  updateOrderStatus: (orderId: string, status: OrderStatus) => Promise<void>;
  updateTrackingInfo: (orderId: string, trackingNumber: string, trackingUrl?: string) => Promise<void>;
  addEvidenceToStatus: (
    orderId: string,
    historyEntryId: string,
    evidence: Omit<PaymentEvidence, 'id' | 'uploadedAt'>
  ) => void;
  getOrdersByStatus: (status: OrderStatus) => Order[];
  getOrdersReadyToShip: () => Order[];
  createOrder: (data: CreateOrderData) => Promise<Order>;
  getOrdersByUserEmail: (email: string) => Promise<Order[]>;
  getMyOrders: () => Promise<Order[]>;
  refreshOrders: () => Promise<void>;
  setPage: (page: number) => void;
  setFilters: (filters: { status?: OrderStatus; search?: string }) => void;
}

const OrdersContext = createContext<OrdersContextType | undefined>(undefined);

// Convertir status de backend (MAYÚSCULAS) a frontend (minúsculas)
const normalizeStatus = (status: string | undefined | null): OrderStatus => {
  if (!status) return 'pending';
  return status.toLowerCase() as OrderStatus;
};

// Mapear API Order a tipo local Order
const mapApiOrderToOrder = (apiOrder: ApiOrder): Order => {
  // El backend devuelve statusHistory con { status, timestamp, note }
  // El frontend espera { toStatus, changedAt, note, fromStatus, ... }
  const mappedStatusHistory = (apiOrder.statusHistory || []).map((entry: any, index: number, arr: any[]) => {
    // El backend usa 'status' y 'timestamp', el frontend usa 'toStatus' y 'changedAt'
    const toStatus = entry.toStatus || entry.status;
    const changedAt = entry.changedAt || entry.timestamp;
    const fromStatus = entry.fromStatus || (index > 0 ? arr[index - 1]?.status || arr[index - 1]?.toStatus : null);

    return {
      id: entry.id || `history-${index}`,
      fromStatus: fromStatus ? normalizeStatus(fromStatus) : null,
      toStatus: normalizeStatus(toStatus),
      changedBy: entry.changedBy || 'Sistema',
      changedAt: new Date(changedAt),
      note: entry.note,
      trackingNumber: entry.trackingNumber,
      trackingUrl: entry.trackingUrl,
      cancellationReason: entry.cancellationReason,
      evidences: entry.evidences?.map((ev: any) => ({
        ...ev,
        type: ev.type as 'receipt' | 'transfer' | 'voucher' | 'other',
        uploadedAt: new Date(ev.uploadedAt),
        uploadedBy: ev.uploadedBy || 'Sistema',
      })),
    };
  });

  return {
    id: apiOrder.id,
    orderNumber: apiOrder.orderNumber,
    userId: apiOrder.userId,
    userName: apiOrder.userName || apiOrder.user?.name || apiOrder.shipping?.name || '',
    userEmail: apiOrder.userEmail || apiOrder.user?.email || apiOrder.shipping?.email || '',
    items: apiOrder.items.map((item) => ({
      ...item,
      customization: item.customization,
    })),
    subtotal: apiOrder.subtotal,
    shippingCost: apiOrder.shippingCost,
    discount: apiOrder.discount,
    total: apiOrder.total,
    status: normalizeStatus(apiOrder.status),
    paymentMethod: apiOrder.paymentMethod as PaymentMethod,
    paymentReference: apiOrder.paymentRef,
    shipping: apiOrder.shipping,
    trackingNumber: apiOrder.trackingNumber,
    trackingUrl: apiOrder.trackingUrl,
    notes: apiOrder.notes,
    statusHistory: mappedStatusHistory,
    createdAt: new Date(apiOrder.createdAt),
    updatedAt: new Date(apiOrder.updatedAt),
    paidAt: apiOrder.paidAt ? new Date(apiOrder.paidAt) : undefined,
    shippedAt: apiOrder.shippedAt ? new Date(apiOrder.shippedAt) : undefined,
    deliveredAt: apiOrder.deliveredAt ? new Date(apiOrder.deliveredAt) : undefined,
  };
};

export const OrdersProvider = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated, isAdmin, isLoading: authLoading } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  // Empezar en true para mostrar loading mientras auth carga
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [filters, setFiltersState] = useState<{ status?: OrderStatus; search?: string }>({});

  // Cargar pedidos desde la API (solo para admins)
  const loadOrders = useCallback(async () => {
    // Solo cargar si está autenticado y es admin
    if (!isAuthenticated || !isAdmin) {
      setOrders([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log('[OrdersContext] Cargando pedidos...');
      const response = await ordersService.getAll({
        page: pagination.page,
        limit: pagination.limit,
        status: filters.status,
        search: filters.search,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      console.log('[OrdersContext] Respuesta recibida:', response);
      const mappedOrders = response.data.map(mapApiOrderToOrder);
      console.log('[OrdersContext] Pedidos mapeados:', mappedOrders);

      setOrders(mappedOrders);
      setPagination(response.pagination);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error cargando pedidos';
      setError(message);
      console.error('[OrdersContext] Error loading orders:', err);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, isAdmin, pagination.page, pagination.limit, filters.status, filters.search]);

  // Cargar al montar (solo si es admin y auth ha terminado de cargar)
  useEffect(() => {
    // Esperar a que auth termine de cargar
    if (authLoading) {
      return;
    }

    console.log('[OrdersContext] Auth cargado. isAdmin:', isAdmin, 'isAuthenticated:', isAuthenticated);

    if (isAuthenticated && isAdmin) {
      loadOrders();
    } else {
      // Si no es admin, marcar como cargado sin pedidos
      setIsLoading(false);
      setOrders([]);
    }
  }, [authLoading, isAuthenticated, isAdmin, loadOrders]);

  const getOrderById = async (id: string): Promise<Order | undefined> => {
    const numericId = Number(id);
    // Primero buscar en cache local
    const cached = orders.find((order) => order.id === numericId);
    if (cached) return cached;

    // Si no está en cache, buscar en API
    try {
      const apiOrder = await ordersService.getById(numericId);
      if (apiOrder) {
        return mapApiOrderToOrder(apiOrder);
      }
      return undefined;
    } catch {
      return undefined;
    }
  };

  const getOrderByNumber = async (orderNumber: string): Promise<Order | undefined> => {
    // Primero buscar en cache local
    const cached = orders.find((order) => order.orderNumber === orderNumber);
    if (cached) return cached;

    // Si no está en cache, buscar en API
    try {
      const apiOrder = await ordersService.getByNumber(orderNumber);
      if (apiOrder) {
        return mapApiOrderToOrder(apiOrder);
      }
      return undefined;
    } catch {
      return undefined;
    }
  };

  const changeOrderStatus = async ({
    orderId,
    newStatus,
    note,
    evidences,
    trackingNumber,
    trackingUrl,
    cancellationReason,
  }: ChangeStatusParams): Promise<void> => {
    // Convertir status a mayúsculas para el backend
    const backendStatus = newStatus.toUpperCase() as OrderStatus;

    const input: ChangeStatusInput = {
      status: backendStatus,
      note,
      trackingNumber,
      trackingUrl,
      cancellationReason,
      evidences: evidences?.map((ev) => ({
        type: ev.type as 'receipt' | 'transfer' | 'screenshot' | 'other',
        url: ev.url,
        description: ev.description,
      })),
    };

    const updated = await ordersService.changeStatus(Number(orderId), input);
    const mappedOrder = mapApiOrderToOrder(updated);

    setOrders((prev) => prev.map((order) => (order.id === Number(orderId) ? mappedOrder : order)));
  };

  const addEvidenceToStatus = (
    orderId: string,
    historyEntryId: string,
    evidence: Omit<PaymentEvidence, 'id' | 'uploadedAt'>
  ) => {
    // Por ahora actualizamos localmente, en el futuro podemos agregar un endpoint
    setOrders((prev) =>
      prev.map((order) => {
        if (order.id === orderId) {
          const now = new Date();
          const newEvidence: PaymentEvidence = {
            ...evidence,
            id: `ev-${orderId}-${Date.now()}`,
            uploadedAt: now,
          };

          const updatedHistory = order.statusHistory.map((entry) => {
            if (entry.id === historyEntryId) {
              return {
                ...entry,
                evidences: [...(entry.evidences || []), newEvidence],
              };
            }
            return entry;
          });

          return {
            ...order,
            statusHistory: updatedHistory,
            updatedAt: now,
          };
        }
        return order;
      })
    );
  };

  const getOrdersByStatus = (status: OrderStatus): Order[] => {
    return orders.filter((order) => order.status === status);
  };

  const getOrdersReadyToShip = (): Order[] => {
    return orders.filter((order) => order.status === 'processing' || order.status === 'paid');
  };

  const updateOrderStatus = async (orderId: string, status: OrderStatus): Promise<void> => {
    await changeOrderStatus({ orderId, newStatus: status });
  };

  const updateTrackingInfo = async (
    orderId: string,
    trackingNumber: string,
    trackingUrl?: string
  ): Promise<void> => {
    try {
      const updated = await ordersService.updateTracking(orderId, trackingNumber, trackingUrl);
      const mappedOrder = mapApiOrderToOrder(updated);
      setOrders((prev) => prev.map((order) => (order.id === orderId ? mappedOrder : order)));
    } catch (err) {
      // Si falla el endpoint específico, intentar con cambio de estado
      setOrders((prev) =>
        prev.map((order) => {
          if (order.id === orderId) {
            return {
              ...order,
              trackingNumber,
              trackingUrl,
              updatedAt: new Date(),
            };
          }
          return order;
        })
      );
    }
  };

  const createOrder = async (data: CreateOrderData): Promise<Order> => {
    const input: CreateOrderInput = {
      items: data.items.map((item) => ({
        productId: typeof item.productId === 'string' ? parseInt(item.productId, 10) : item.productId,
        size: item.size,
        color: item.color,
        quantity: item.quantity,
        customization: item.customization
          ? {
              text: item.customization.designFront || item.customization.designBack,
              notes: item.customization.designFront
                ? `Front: ${item.customization.designFront}`
                : undefined,
            }
          : undefined,
      })),
      shipping: {
        name: data.customerName,
        email: data.customerEmail,
        phone: data.customerPhone,
        address: data.shippingAddress,
        city: data.shippingCity,
        postalCode: data.shippingPostalCode,
        country: 'Colombia',
        notes: data.shippingNotes,
      },
      paymentMethod: data.paymentMethod,
      couponCode: data.couponCode || undefined,
    };

    const apiOrder = await ordersService.create(input);
    const newOrder = mapApiOrderToOrder(apiOrder);

    setOrders((prev) => [newOrder, ...prev]);
    return newOrder;
  };

  const getOrdersByUserEmail = async (email: string): Promise<Order[]> => {
    try {
      const apiOrders = await ordersService.getByEmail(email);
      return apiOrders.map(mapApiOrderToOrder);
    } catch {
      return [];
    }
  };

  const getMyOrders = async (): Promise<Order[]> => {
    try {
      const response = await ordersService.getMyOrders();
      return response.data.map(mapApiOrderToOrder);
    } catch {
      return [];
    }
  };

  const refreshOrders = async (): Promise<void> => {
    await loadOrders();
  };

  const setPage = (page: number) => {
    setPagination((prev) => ({ ...prev, page }));
  };

  const setFilters = (newFilters: { status?: OrderStatus; search?: string }) => {
    setFiltersState(newFilters);
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  return (
    <OrdersContext.Provider
      value={{
        orders,
        isLoading,
        error,
        pagination,
        getOrderById,
        getOrderByNumber,
        changeOrderStatus,
        updateOrderStatus,
        updateTrackingInfo,
        addEvidenceToStatus,
        getOrdersByStatus,
        getOrdersReadyToShip,
        createOrder,
        getOrdersByUserEmail,
        getMyOrders,
        refreshOrders,
        setPage,
        setFilters,
      }}
    >
      {children}
    </OrdersContext.Provider>
  );
};

export const useOrders = () => {
  const context = useContext(OrdersContext);
  if (!context) {
    throw new Error('useOrders must be used within an OrdersProvider');
  }
  return context;
};
