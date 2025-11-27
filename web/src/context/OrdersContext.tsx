import { createContext, useContext, useState, type ReactNode } from 'react';
import type { Order, OrderStatus, StatusHistoryEntry, PaymentEvidence, PaymentMethod } from '../types/order';

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
    productId: string;
    productName: string;
    productImage: string;
    size: string;
    color: string;
    quantity: number;
    unitPrice: number;
    customization?: {
      designFront?: string;
      designBack?: string;
    };
  }[];
  subtotal: number;
  shippingCost: number;
  discount: number;
  total: number;
}

interface OrdersContextType {
  orders: Order[];
  getOrderById: (id: string) => Order | undefined;
  getOrderByNumber: (orderNumber: string) => Order | undefined;
  changeOrderStatus: (params: ChangeStatusParams) => void;
  updateOrderStatus: (orderId: string, status: OrderStatus) => void;
  updateTrackingInfo: (orderId: string, trackingNumber: string, trackingUrl?: string) => void;
  addEvidenceToStatus: (orderId: string, historyEntryId: string, evidence: Omit<PaymentEvidence, 'id' | 'uploadedAt'>) => void;
  getOrdersByStatus: (status: OrderStatus) => Order[];
  getOrdersReadyToShip: () => Order[];
  createOrder: (data: CreateOrderData) => Order;
  getOrdersByUserEmail: (email: string) => Order[];
}

const OrdersContext = createContext<OrdersContextType | undefined>(undefined);

// Datos mock para demostración
const mockOrders: Order[] = [
  {
    id: '1',
    orderNumber: 'ORD-2024-001',
    userId: '1',
    userName: 'María García',
    userEmail: 'maria@example.com',
    items: [
      {
        id: '1',
        productId: 'prod-1',
        productName: 'Camiseta Básica Blanca',
        productImage: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=100',
        size: 'M',
        color: 'Blanco',
        quantity: 2,
        unitPrice: 35000,
        customization: {
          designFront: 'Logo empresa',
        },
      },
      {
        id: '2',
        productId: 'prod-2',
        productName: 'Camiseta Polo Negra',
        productImage: 'https://images.unsplash.com/photo-1618354691373-d851c5c3a990?w=100',
        size: 'L',
        color: 'Negro',
        quantity: 1,
        unitPrice: 55000,
      },
    ],
    subtotal: 125000,
    shippingCost: 12000,
    discount: 0,
    total: 137000,
    status: 'processing',
    paymentMethod: 'credit_card',
    paymentReference: 'PAY-123456',
    shipping: {
      recipientName: 'María García',
      phone: '+57 300 123 4567',
      address: 'Calle 123 #45-67, Apto 301',
      city: 'Bogotá',
      postalCode: '110111',
      country: 'Colombia',
      notes: 'Edificio Torre Norte, portería 24h',
    },
    statusHistory: [
      {
        id: 'sh-1-1',
        fromStatus: null,
        toStatus: 'pending',
        changedBy: 'Sistema',
        changedAt: new Date('2024-11-25T10:30:00'),
        note: 'Pedido creado',
      },
      {
        id: 'sh-1-2',
        fromStatus: 'pending',
        toStatus: 'paid',
        changedBy: 'Sistema',
        changedAt: new Date('2024-11-25T10:35:00'),
        note: 'Pago confirmado automáticamente',
        evidences: [
          {
            id: 'ev-1-1',
            type: 'receipt',
            url: 'https://example.com/receipts/pay-123456.pdf',
            description: 'Recibo de pago TC',
            uploadedAt: new Date('2024-11-25T10:35:00'),
            uploadedBy: 'Sistema',
          },
        ],
      },
      {
        id: 'sh-1-3',
        fromStatus: 'paid',
        toStatus: 'processing',
        changedBy: 'Admin',
        changedAt: new Date('2024-11-25T14:00:00'),
        note: 'Iniciando preparación del pedido',
      },
    ],
    createdAt: new Date('2024-11-25T10:30:00'),
    updatedAt: new Date('2024-11-25T14:00:00'),
    paidAt: new Date('2024-11-25T10:35:00'),
  },
  {
    id: '2',
    orderNumber: 'ORD-2024-002',
    userId: '2',
    userName: 'Carlos López',
    userEmail: 'carlos@example.com',
    items: [
      {
        id: '3',
        productId: 'prod-3',
        productName: 'Hoodie Gris',
        productImage: 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=100',
        size: 'XL',
        color: 'Gris',
        quantity: 1,
        unitPrice: 89000,
        customization: {
          designFront: 'Diseño personalizado',
          designBack: 'Texto custom',
        },
      },
    ],
    subtotal: 89000,
    shippingCost: 15000,
    discount: 10000,
    total: 94000,
    status: 'paid',
    paymentMethod: 'pse',
    paymentReference: 'PSE-789012',
    shipping: {
      recipientName: 'Carlos López',
      phone: '+57 310 987 6543',
      address: 'Carrera 50 #30-20',
      city: 'Medellín',
      postalCode: '050001',
      country: 'Colombia',
    },
    statusHistory: [
      {
        id: 'sh-2-1',
        fromStatus: null,
        toStatus: 'pending',
        changedBy: 'Sistema',
        changedAt: new Date('2024-11-24T16:45:00'),
        note: 'Pedido creado',
      },
      {
        id: 'sh-2-2',
        fromStatus: 'pending',
        toStatus: 'paid',
        changedBy: 'Sistema',
        changedAt: new Date('2024-11-24T16:50:00'),
        note: 'Pago PSE confirmado',
        evidences: [
          {
            id: 'ev-2-1',
            type: 'transfer',
            url: 'https://example.com/pse/pse-789012.pdf',
            description: 'Comprobante PSE',
            uploadedAt: new Date('2024-11-24T16:50:00'),
            uploadedBy: 'Sistema',
          },
        ],
      },
    ],
    createdAt: new Date('2024-11-24T16:45:00'),
    updatedAt: new Date('2024-11-24T16:50:00'),
    paidAt: new Date('2024-11-24T16:50:00'),
  },
  {
    id: '3',
    orderNumber: 'ORD-2024-003',
    userId: '3',
    userName: 'Ana Martínez',
    userEmail: 'ana@example.com',
    items: [
      {
        id: '4',
        productId: 'prod-1',
        productName: 'Camiseta Básica Blanca',
        productImage: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=100',
        size: 'S',
        color: 'Blanco',
        quantity: 5,
        unitPrice: 35000,
      },
    ],
    subtotal: 175000,
    shippingCost: 0,
    discount: 17500,
    total: 157500,
    status: 'shipped',
    paymentMethod: 'credit_card',
    paymentReference: 'PAY-345678',
    shipping: {
      recipientName: 'Ana Martínez',
      phone: '+57 320 555 1234',
      address: 'Av. Principal #100-50',
      city: 'Cali',
      postalCode: '760001',
      country: 'Colombia',
    },
    trackingNumber: 'COL123456789',
    trackingUrl: 'https://tracking.example.com/COL123456789',
    statusHistory: [
      {
        id: 'sh-3-1',
        fromStatus: null,
        toStatus: 'pending',
        changedBy: 'Sistema',
        changedAt: new Date('2024-11-20T09:00:00'),
        note: 'Pedido creado',
      },
      {
        id: 'sh-3-2',
        fromStatus: 'pending',
        toStatus: 'paid',
        changedBy: 'Sistema',
        changedAt: new Date('2024-11-20T09:05:00'),
        note: 'Pago confirmado',
      },
      {
        id: 'sh-3-3',
        fromStatus: 'paid',
        toStatus: 'processing',
        changedBy: 'Admin',
        changedAt: new Date('2024-11-21T10:00:00'),
        note: 'En preparación',
      },
      {
        id: 'sh-3-4',
        fromStatus: 'processing',
        toStatus: 'shipped',
        changedBy: 'Admin',
        changedAt: new Date('2024-11-22T11:30:00'),
        note: 'Enviado con Servientrega',
        trackingNumber: 'COL123456789',
        trackingUrl: 'https://tracking.example.com/COL123456789',
      },
    ],
    createdAt: new Date('2024-11-20T09:00:00'),
    updatedAt: new Date('2024-11-22T11:30:00'),
    paidAt: new Date('2024-11-20T09:05:00'),
    shippedAt: new Date('2024-11-22T11:30:00'),
  },
  {
    id: '4',
    orderNumber: 'ORD-2024-004',
    userId: '4',
    userName: 'Pedro Sánchez',
    userEmail: 'pedro@example.com',
    items: [
      {
        id: '5',
        productId: 'prod-2',
        productName: 'Camiseta Polo Negra',
        productImage: 'https://images.unsplash.com/photo-1618354691373-d851c5c3a990?w=100',
        size: 'M',
        color: 'Negro',
        quantity: 3,
        unitPrice: 55000,
      },
    ],
    subtotal: 165000,
    shippingCost: 12000,
    discount: 0,
    total: 177000,
    status: 'delivered',
    paymentMethod: 'transfer',
    paymentReference: 'TRF-901234',
    shipping: {
      recipientName: 'Pedro Sánchez',
      phone: '+57 315 444 7890',
      address: 'Calle 80 #20-30',
      city: 'Barranquilla',
      postalCode: '080001',
      country: 'Colombia',
    },
    trackingNumber: 'COL987654321',
    trackingUrl: 'https://tracking.example.com/COL987654321',
    statusHistory: [
      {
        id: 'sh-4-1',
        fromStatus: null,
        toStatus: 'pending',
        changedBy: 'Sistema',
        changedAt: new Date('2024-11-15T14:20:00'),
        note: 'Pedido creado',
      },
      {
        id: 'sh-4-2',
        fromStatus: 'pending',
        toStatus: 'paid',
        changedBy: 'Admin',
        changedAt: new Date('2024-11-15T15:00:00'),
        note: 'Pago por transferencia verificado',
        evidences: [
          {
            id: 'ev-4-1',
            type: 'transfer',
            url: 'https://example.com/transfers/trf-901234.jpg',
            description: 'Comprobante de transferencia bancaria',
            uploadedAt: new Date('2024-11-15T15:00:00'),
            uploadedBy: 'Admin',
          },
        ],
      },
      {
        id: 'sh-4-3',
        fromStatus: 'paid',
        toStatus: 'processing',
        changedBy: 'Admin',
        changedAt: new Date('2024-11-15T16:00:00'),
        note: 'Iniciando preparación',
      },
      {
        id: 'sh-4-4',
        fromStatus: 'processing',
        toStatus: 'shipped',
        changedBy: 'Admin',
        changedAt: new Date('2024-11-16T10:00:00'),
        note: 'Enviado con Coordinadora',
        trackingNumber: 'COL987654321',
        trackingUrl: 'https://tracking.example.com/COL987654321',
      },
      {
        id: 'sh-4-5',
        fromStatus: 'shipped',
        toStatus: 'delivered',
        changedBy: 'Admin',
        changedAt: new Date('2024-11-18T16:00:00'),
        note: 'Entregado - Confirmado por cliente',
      },
    ],
    createdAt: new Date('2024-11-15T14:20:00'),
    updatedAt: new Date('2024-11-18T16:00:00'),
    paidAt: new Date('2024-11-15T15:00:00'),
    shippedAt: new Date('2024-11-16T10:00:00'),
    deliveredAt: new Date('2024-11-18T16:00:00'),
  },
  {
    id: '5',
    orderNumber: 'ORD-2024-005',
    userId: '5',
    userName: 'Laura Rodríguez',
    userEmail: 'laura@example.com',
    items: [
      {
        id: '6',
        productId: 'prod-4',
        productName: 'Tank Top Rosa',
        productImage: 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=100',
        size: 'S',
        color: 'Rosa',
        quantity: 2,
        unitPrice: 28000,
      },
    ],
    subtotal: 56000,
    shippingCost: 12000,
    discount: 0,
    total: 68000,
    status: 'pending',
    paymentMethod: 'pse',
    shipping: {
      recipientName: 'Laura Rodríguez',
      phone: '+57 318 222 3333',
      address: 'Carrera 15 #90-50',
      city: 'Bogotá',
      postalCode: '110221',
      country: 'Colombia',
    },
    statusHistory: [
      {
        id: 'sh-5-1',
        fromStatus: null,
        toStatus: 'pending',
        changedBy: 'Sistema',
        changedAt: new Date('2024-11-26T08:00:00'),
        note: 'Pedido creado - Esperando pago',
      },
    ],
    createdAt: new Date('2024-11-26T08:00:00'),
    updatedAt: new Date('2024-11-26T08:00:00'),
  },
  {
    id: '6',
    orderNumber: 'ORD-2024-006',
    userId: '1',
    userName: 'María García',
    userEmail: 'maria@example.com',
    items: [
      {
        id: '7',
        productId: 'prod-5',
        productName: 'Sudadera Oversize',
        productImage: 'https://images.unsplash.com/photo-1578587018452-892bacefd3f2?w=100',
        size: 'L',
        color: 'Beige',
        quantity: 1,
        unitPrice: 75000,
      },
    ],
    subtotal: 75000,
    shippingCost: 12000,
    discount: 0,
    total: 87000,
    status: 'cancelled',
    paymentMethod: 'credit_card',
    shipping: {
      recipientName: 'María García',
      phone: '+57 300 123 4567',
      address: 'Calle 123 #45-67, Apto 301',
      city: 'Bogotá',
      postalCode: '110111',
      country: 'Colombia',
    },
    notes: 'Cancelado por cliente - cambio de opinión',
    statusHistory: [
      {
        id: 'sh-6-1',
        fromStatus: null,
        toStatus: 'pending',
        changedBy: 'Sistema',
        changedAt: new Date('2024-11-10T12:00:00'),
        note: 'Pedido creado',
      },
      {
        id: 'sh-6-2',
        fromStatus: 'pending',
        toStatus: 'cancelled',
        changedBy: 'Admin',
        changedAt: new Date('2024-11-11T09:00:00'),
        note: 'Cancelado a solicitud del cliente',
        cancellationReason: 'Cambio de opinión - Cliente solicitó cancelación antes del pago',
      },
    ],
    createdAt: new Date('2024-11-10T12:00:00'),
    updatedAt: new Date('2024-11-11T09:00:00'),
  },
];

export const OrdersProvider = ({ children }: { children: ReactNode }) => {
  const [orders, setOrders] = useState<Order[]>(mockOrders);

  const getOrderById = (id: string) => {
    return orders.find((order) => order.id === id);
  };

  const getOrderByNumber = (orderNumber: string) => {
    return orders.find((order) => order.orderNumber === orderNumber);
  };

  const changeOrderStatus = ({
    orderId,
    newStatus,
    note,
    evidences,
    trackingNumber,
    trackingUrl,
    cancellationReason,
  }: ChangeStatusParams) => {
    setOrders((prev) =>
      prev.map((order) => {
        if (order.id === orderId) {
          const now = new Date();

          // Crear entrada en historial
          const historyEntry: StatusHistoryEntry = {
            id: `sh-${orderId}-${Date.now()}`,
            fromStatus: order.status,
            toStatus: newStatus,
            changedBy: 'Admin', // En producción vendría del usuario autenticado
            changedAt: now,
            note,
            trackingNumber,
            trackingUrl,
            cancellationReason,
          };

          // Agregar evidencias si las hay
          if (evidences && evidences.length > 0) {
            historyEntry.evidences = evidences.map((ev, idx) => ({
              ...ev,
              id: `ev-${orderId}-${Date.now()}-${idx}`,
              uploadedAt: now,
            }));
          }

          // Actualizar campos según el nuevo estado
          const updates: Partial<Order> = {
            status: newStatus,
            updatedAt: now,
            statusHistory: [...order.statusHistory, historyEntry],
          };

          if (newStatus === 'paid' && !order.paidAt) {
            updates.paidAt = now;
          }
          if (newStatus === 'shipped') {
            if (!order.shippedAt) updates.shippedAt = now;
            if (trackingNumber) updates.trackingNumber = trackingNumber;
            if (trackingUrl) updates.trackingUrl = trackingUrl;
          }
          if (newStatus === 'delivered' && !order.deliveredAt) {
            updates.deliveredAt = now;
          }
          if (newStatus === 'cancelled' && cancellationReason) {
            updates.notes = order.notes
              ? `${order.notes}\n[Cancelación] ${cancellationReason}`
              : `[Cancelación] ${cancellationReason}`;
          }

          return { ...order, ...updates };
        }
        return order;
      })
    );
  };

  const addEvidenceToStatus = (
    orderId: string,
    historyEntryId: string,
    evidence: Omit<PaymentEvidence, 'id' | 'uploadedAt'>
  ) => {
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

  const getOrdersByStatus = (status: OrderStatus) => {
    return orders.filter((order) => order.status === status);
  };

  const getOrdersReadyToShip = () => {
    return orders.filter((order) => order.status === 'processing' || order.status === 'paid');
  };

  const updateOrderStatus = (orderId: string, status: OrderStatus) => {
    changeOrderStatus({ orderId, newStatus: status });
  };

  const updateTrackingInfo = (orderId: string, trackingNumber: string, trackingUrl?: string) => {
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
  };

  const createOrder = (data: CreateOrderData): Order => {
    const now = new Date();
    const orderCount = orders.length + 1;
    const orderNumber = `ORD-${now.getFullYear()}-${String(orderCount).padStart(3, '0')}`;
    const orderId = `order-${Date.now()}`;

    const newOrder: Order = {
      id: orderId,
      orderNumber,
      userId: '', // Se asignará cuando haya autenticación
      userName: data.customerName,
      userEmail: data.customerEmail,
      items: data.items.map((item, index) => ({
        ...item,
        id: `item-${orderId}-${index}`,
      })),
      subtotal: data.subtotal,
      shippingCost: data.shippingCost,
      discount: data.discount,
      total: data.total,
      status: 'pending',
      paymentMethod: data.paymentMethod,
      shipping: {
        recipientName: data.customerName,
        phone: data.customerPhone,
        address: data.shippingAddress,
        city: data.shippingCity,
        postalCode: data.shippingPostalCode || '',
        country: 'Colombia',
        notes: data.shippingNotes,
      },
      statusHistory: [
        {
          id: `sh-${orderId}-1`,
          fromStatus: null,
          toStatus: 'pending',
          changedBy: 'Sistema',
          changedAt: now,
          note: 'Pedido creado - Esperando confirmación de pago',
        },
      ],
      createdAt: now,
      updatedAt: now,
    };

    setOrders((prev) => [newOrder, ...prev]);
    return newOrder;
  };

  const getOrdersByUserEmail = (email: string): Order[] => {
    return orders.filter((order) => order.userEmail.toLowerCase() === email.toLowerCase());
  };

  return (
    <OrdersContext.Provider
      value={{
        orders,
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
