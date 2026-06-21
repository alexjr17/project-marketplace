import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import * as posService from '../services/pos.service';
import * as cashRegisterService from '../services/cash-register.service';
import type { ScanProductResponse, Sale, SaleItem, CreateSaleRequest, TemplateZoneInfo } from '../services/pos.service';
import type { CashSession } from '../services/cash-register.service';
import { useToast } from './ToastContext';
import { useSettings } from './SettingsContext';

// ==================== TYPES ====================

// Product cart item (variant-based)
export interface ProductCartItem extends ScanProductResponse {
  itemType: 'product';
  quantity: number;
  subtotal: number;
}

// Template cart item (customizable)
export interface TemplateCartItem {
  itemType: 'template';
  templateId: number;
  product: {
    id: number;
    name: string;
    image: string;
  };
  basePrice: number;
  selectedZones: TemplateZoneInfo[];
  quantity: number;
  price: number; // basePrice + sum of zone prices
  subtotal: number; // price * quantity
}

// Union type for cart items
export type CartItem = ProductCartItem | TemplateCartItem;

interface POSContextType {
  // Session
  currentSession: CashSession | null;
  isLoadingSession: boolean;
  loadSession: () => Promise<void>;

  // Cart
  cart: CartItem[];
  addToCart: (product: ScanProductResponse, quantity?: number) => void;
  addTemplateToCart: (templateId: number, templateName: string, templateImage: string, basePrice: number, selectedZones: TemplateZoneInfo[], totalPrice: number, quantity?: number) => void;
  removeFromCart: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  clearCart: () => void;

  // Totals
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  setDiscount: (amount: number) => void;

  // Sales
  isProcessingSale: boolean;
  processSale: (data: Omit<CreateSaleRequest, 'items' | 'cashRegisterId'>) => Promise<Sale>;

  // Edición de una venta existente (desde Historial → Nueva Venta)
  editingSaleId: number | null;
  loadSaleForEditing: (sale: Sale) => void;
  cancelEditing: () => void;

  // Barcode scanning
  scanProduct: (barcode: string) => Promise<void>;
  isScanningProduct: boolean;
}

const POSContext = createContext<POSContextType | undefined>(undefined);

// ==================== PROVIDER ====================

export function POSProvider({ children }: { children: React.ReactNode }) {
  const { showToast } = useToast();
  const { settings } = useSettings();

  // Session state
  const [currentSession, setCurrentSession] = useState<CashSession | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(true);

  // Cart state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState(0);
  // Si se está editando una venta existente, su id (si no, null = venta nueva).
  const [editingSaleId, setEditingSaleId] = useState<number | null>(null);

  // Loading states
  const [isProcessingSale, setIsProcessingSale] = useState(false);
  const [isScanningProduct, setIsScanningProduct] = useState(false);

  // Tax configuration from settings
  const taxConfig = useMemo(() => ({
    enabled: settings.payment?.taxEnabled ?? false,
    rate: (settings.payment?.taxRate ?? 19) / 100, // Convert percentage to decimal
    included: settings.payment?.taxIncluded ?? false,
  }), [settings.payment?.taxEnabled, settings.payment?.taxRate, settings.payment?.taxIncluded]);

  // Calculate totals
  const subtotal = cart.reduce((sum, item) => sum + item.subtotal, 0);
  const taxableAmount = subtotal - discount;
  // Solo calcular impuesto si está habilitado
  const tax = taxConfig.enabled && !taxConfig.included ? Math.round(taxableAmount * taxConfig.rate) : 0;
  const total = subtotal - discount + tax;

  /**
   * Load current session
   */
  const loadSession = useCallback(async () => {
    try {
      setIsLoadingSession(true);
      const session = await cashRegisterService.getMySession();
      setCurrentSession(session);
    } catch (error: any) {
      console.error('Error loading session:', error);
      setCurrentSession(null);
    } finally {
      setIsLoadingSession(false);
    }
  }, []);

  /**
   * Add product to cart
   */
  const addToCart = useCallback(
    (product: ScanProductResponse, quantity: number = 1) => {
      let added = false;

      setCart((prevCart) => {
        // Check if product already in cart
        const existingItem = prevCart.find(
          (item) => item.itemType === 'product' && (item as ProductCartItem).variantId === product.variantId
        ) as ProductCartItem | undefined;

        if (existingItem) {
          // Update quantity
          const newQuantity = existingItem.quantity + quantity;

          // Check stock
          if (newQuantity > product.stock) {
            showToast('Stock insuficiente', 'error');
            return prevCart;
          }

          added = true;
          return prevCart.map((item) =>
            item.itemType === 'product' && (item as ProductCartItem).variantId === product.variantId
              ? {
                  ...item,
                  quantity: newQuantity,
                  subtotal: newQuantity * item.price,
                }
              : item
          );
        } else {
          // Add new item
          if (quantity > product.stock) {
            showToast('Stock insuficiente', 'error');
            return prevCart;
          }

          added = true;
          return [
            ...prevCart,
            {
              itemType: 'product' as const,
              ...product,
              quantity,
              subtotal: quantity * product.price,
            } as ProductCartItem,
          ];
        }
      });

      if (added) {
        showToast('Producto agregado al carrito', 'success');
      }
    },
    [showToast]
  );

  /**
   * Add template to cart
   */
  const addTemplateToCart = useCallback(
    (
      templateId: number,
      templateName: string,
      templateImage: string,
      basePrice: number,
      selectedZones: TemplateZoneInfo[],
      totalPrice: number,
      quantity: number = 1
    ) => {
      const newItem: TemplateCartItem = {
        itemType: 'template',
        templateId,
        product: {
          id: templateId,
          name: templateName,
          image: templateImage,
        },
        basePrice,
        selectedZones,
        quantity,
        price: totalPrice,
        subtotal: totalPrice * quantity,
      };

      setCart((prevCart) => [...prevCart, newItem]);
      showToast('Template agregado al carrito', 'success');
    },
    [showToast]
  );

  /**
   * Remove item from cart by index
   */
  const removeFromCart = useCallback((itemId: string) => {
    const index = parseInt(itemId);
    setCart((prevCart) => prevCart.filter((_, i) => i !== index));
  }, []);

  /**
   * Update item quantity by index
   */
  const updateQuantity = useCallback(
    (itemId: string, quantity: number) => {
      const index = parseInt(itemId);

      if (quantity <= 0) {
        removeFromCart(itemId);
        return;
      }

      setCart((prevCart) =>
        prevCart.map((item, i) => {
          if (i === index) {
            // Check stock for products only
            if (item.itemType === 'product' && quantity > (item as ProductCartItem).stock) {
              showToast('Stock insuficiente', 'error');
              return item;
            }

            return {
              ...item,
              quantity,
              subtotal: quantity * item.price,
            };
          }
          return item;
        })
      );
    },
    [removeFromCart, showToast]
  );

  /**
   * Clear cart
   */
  const clearCart = useCallback(() => {
    setCart([]);
    setDiscount(0);
  }, []);

  /**
   * Cargar una venta existente al carrito para editarla en "Nueva Venta".
   * Usa stock alto para no bloquear el ajuste de cantidades durante la edición.
   */
  const loadSaleForEditing = useCallback((sale: Sale) => {
    const items: CartItem[] = (sale.items || []).map((it: any) => {
      const price = Number(it.unitPrice ?? it.price) || 0;
      const quantity = Number(it.quantity) || 1;
      return {
        itemType: 'product' as const,
        variantId: it.variantId,
        product: {
          id: it.product?.id ?? 0,
          name: it.productName || it.product?.name || 'Producto',
          image: it.product?.image || it.image || '',
        },
        color: it.color || it.variant?.color?.name || '',
        size: it.size || it.variant?.size?.name || '',
        sku: it.sku || it.variant?.sku || '',
        barcode: it.barcode ?? null,
        price,
        stock: 999999,
        available: true,
        quantity,
        subtotal: price * quantity,
      } as ProductCartItem;
    });
    setCart(items);
    setDiscount(Number(sale.discount) || 0);
    setEditingSaleId(sale.id);
  }, []);

  /** Salir del modo edición (descarta los cambios en el carrito). */
  const cancelEditing = useCallback(() => {
    setEditingSaleId(null);
    setCart([]);
    setDiscount(0);
  }, []);

  /**
   * Scan product by barcode
   */
  const scanProduct = useCallback(
    async (barcode: string) => {
      if (!barcode.trim()) return;

      try {
        setIsScanningProduct(true);
        const product = await posService.scanProduct(barcode);
        addToCart(product, 1);
      } catch (error: any) {
        console.error('Error scanning product:', error);
        showToast(
          error.response?.data?.message || 'Producto no encontrado',
          'error'
        );
      } finally {
        setIsScanningProduct(false);
      }
    },
    [addToCart, showToast]
  );

  /**
   * Process sale
   */
  const processSale = useCallback(
    async (data: Omit<CreateSaleRequest, 'items' | 'cashRegisterId'>): Promise<Sale> => {
      if (!currentSession) {
        throw new Error('No hay una sesión de caja abierta');
      }

      if (cart.length === 0) {
        throw new Error('El carrito está vacío');
      }

      try {
        setIsProcessingSale(true);

        // Prepare sale items
        const items: SaleItem[] = cart.map((item) => ({
          variantId: item.variantId,
          quantity: item.quantity,
          price: item.price,
        }));

        let sale: Sale;
        if (editingSaleId) {
          // Editar la venta existente en vez de crear una nueva.
          sale = await posService.updateSale(editingSaleId, {
            items,
            customerId: data.customerId,
            customerName: data.customerName,
            customerPhone: data.customerPhone,
            customerEmail: data.customerEmail,
            customerCedula: data.customerCedula,
            paymentMethod: data.paymentMethod,
            discount,
            notes: data.notes,
            cashAmount: data.cashAmount,
            cardAmount: data.cardAmount,
            cardReference: data.cardReference,
            cardType: data.cardType,
            cardLastFour: data.cardLastFour,
          });
          setEditingSaleId(null);
        } else {
          // Create sale
          sale = await posService.createSale({
            ...data,
            cashRegisterId: currentSession.cashRegisterId,
            items,
            discount,
          });
        }

        // Clear cart on success
        clearCart();

        // Reload session to update counters
        await loadSession();

        showToast(editingSaleId ? 'Venta actualizada exitosamente' : 'Venta procesada exitosamente', 'success');

        return sale;
      } catch (error: any) {
        console.error('Error processing sale:', error);
        showToast(
          error.response?.data?.message || 'Error al procesar la venta',
          'error'
        );
        throw error;
      } finally {
        setIsProcessingSale(false);
      }
    },
    [currentSession, cart, discount, editingSaleId, clearCart, loadSession, showToast]
  );

  // Load session on mount
  useEffect(() => {
    loadSession();
  }, [loadSession]);

  const value: POSContextType = {
    // Session
    currentSession,
    isLoadingSession,
    loadSession,

    // Cart
    cart,
    addToCart,
    addTemplateToCart,
    removeFromCart,
    updateQuantity,
    clearCart,

    // Totals
    subtotal,
    discount,
    tax,
    total,
    setDiscount,

    // Sales
    isProcessingSale,
    processSale,

    // Edición
    editingSaleId,
    loadSaleForEditing,
    cancelEditing,

    // Barcode scanning
    scanProduct,
    isScanningProduct,
  };

  return <POSContext.Provider value={value}>{children}</POSContext.Provider>;
}

// ==================== HOOK ====================

export function usePOS() {
  const context = useContext(POSContext);
  if (context === undefined) {
    throw new Error('usePOS must be used within a POSProvider');
  }
  return context;
}
