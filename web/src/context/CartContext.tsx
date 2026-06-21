import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import type { Cart, CartItemType, CartSummary } from '../types/cart';
import type { Product } from '../types/product';
import type { CustomizedProduct } from '../types/design';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { STORAGE_KEYS } from '../services/storage.service';
import { settingsService } from '../services/settings.service';
import { cartService, type CartItemDB } from '../services/cart.service';
import { getVariantByProductColorSize } from '../services/variants.service';
import { useAuth } from './AuthContext';

interface OrderConfig {
  shippingCost: number;
  freeShippingThreshold: number;
  taxEnabled: boolean;
  taxRate: number;
  taxIncluded: boolean;
}

interface CartContextType {
  cart: Cart;
  orderConfig: OrderConfig;
  addStandardProduct: (product: Product, color: string, size: string, quantity?: number) => Promise<void> | void;
  addCustomizedProduct: (customizedProduct: CustomizedProduct, quantity?: number) => Promise<void> | void;
  updateCustomizedProduct: (itemId: string, customizedProduct: CustomizedProduct) => Promise<void> | void;
  getCartItemById: (itemId: string) => CartItemType | undefined;
  removeItem: (itemId: string) => Promise<void> | void;
  updateQuantity: (itemId: string, quantity: number) => Promise<void> | void;
  clearCart: () => Promise<void> | void;
  getCartSummary: () => CartSummary;
  isSyncing: boolean;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const INITIAL_CART: Cart = {
  items: [],
  totalItems: 0,
  subtotal: 0,
  tax: 0,
  shipping: 0,
  discount: 0,
  total: 0,
  updatedAt: new Date(),
};

// Configuración por defecto (fallback)
const DEFAULT_ORDER_CONFIG: OrderConfig = {
  shippingCost: 12000,
  freeShippingThreshold: 150000,
  taxEnabled: false, // Por defecto deshabilitado
  taxRate: 0.19,
  taxIncluded: true,
};

// Helper para normalizar imágenes de producto (pueden venir como JSON string, soporta hasta 5 imágenes)
function normalizeProductImages(images: any): { front: string; back?: string; side?: string; extra1?: string; extra2?: string } {
  // Si es null o undefined, retornar objeto vacío con placeholder
  if (!images) {
    return { front: '' };
  }

  // Si es string, intentar parsearlo como JSON
  if (typeof images === 'string') {
    try {
      const parsed = JSON.parse(images);
      return normalizeProductImages(parsed);
    } catch {
      // Si no es JSON válido, asumir que es una URL de imagen front
      return { front: images };
    }
  }

  // Si es un array, convertir a objeto {front, back, side, extra1, extra2}
  if (Array.isArray(images)) {
    const result: { front: string; back?: string; side?: string; extra1?: string; extra2?: string } = { front: '' };
    images.forEach((img: any, index: number) => {
      if (typeof img === 'string') {
        if (index === 0) result.front = img;
        else if (index === 1) result.back = img;
        else if (index === 2) result.side = img;
        else if (index === 3) result.extra1 = img;
        else if (index === 4) result.extra2 = img;
      } else if (img && typeof img === 'object') {
        // Si es objeto con position o url
        const url = img.url || img.src || img.front || '';
        const position = img.position || img.type || index;
        if (position === 'front' || position === 0) result.front = url;
        else if (position === 'back' || position === 1) result.back = url;
        else if (position === 'side' || position === 2) result.side = url;
        else if (position === 'extra1' || position === 3) result.extra1 = url;
        else if (position === 'extra2' || position === 4) result.extra2 = url;
      }
    });
    return result;
  }

  // Si ya es un objeto, asegurar que tenga la estructura correcta
  if (typeof images === 'object') {
    return {
      front: images.front || images[0] || '',
      back: images.back || images[1] || undefined,
      side: images.side || images[2] || undefined,
      extra1: images.extra1 || images[3] || undefined,
      extra2: images.extra2 || images[4] || undefined,
    };
  }

  return { front: '' };
}

// Helper para normalizar items del carrito (convertir objetos de talla a strings)
const normalizeCartItem = (item: CartItemType): CartItemType => {
  if (item.type === 'standard') {
    const standardItem = item as import('../types/cart').CartItem;
    // Si selectedSize es un objeto, extraer la abreviación
    let normalizedSize = standardItem.selectedSize;
    if (typeof normalizedSize === 'object' && normalizedSize !== null) {
      normalizedSize = (normalizedSize as any).abbreviation || (normalizedSize as any).name || 'M';
    }

    return {
      ...standardItem,
      selectedSize: normalizedSize as string,
    };
  }
  return item;
};

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated, user } = useAuth();
  const [rawCartItems, setRawCartItems] = useLocalStorage<CartItemType[]>(STORAGE_KEYS.CART, []);

  // Normalizar items cuando se cargan desde localStorage
  const [cartItems, setCartItems] = useState<CartItemType[]>(() => {
    return rawCartItems.map(normalizeCartItem);
  });

  const [cart, setCart] = useState<Cart>(INITIAL_CART);
  const [orderConfig, setOrderConfig] = useState<OrderConfig>(DEFAULT_ORDER_CONFIG);

  // Estado para controlar la sincronizacion con DB
  const [isSyncingWithDB, setIsSyncingWithDB] = useState(false);
  const [dbCartItems, setDbCartItems] = useState<CartItemDB[]>([]);
  const prevAuthRef = useRef<boolean>(false);
  const hasSyncedRef = useRef<boolean>(false);
  const isInitialLoadRef = useRef<boolean>(true);

  // Sincronizar con localStorage y normalizar
  useEffect(() => {
    const normalized = rawCartItems.map(normalizeCartItem);
    setCartItems(normalized);
    // Guardar items normalizados de vuelta a localStorage
    if (JSON.stringify(normalized) !== JSON.stringify(rawCartItems)) {
      setRawCartItems(normalized);
    }
  }, [rawCartItems]);

  // Cargar carrito desde DB cuando usuario esta autenticado
  const loadCartFromDB = useCallback(async () => {
    if (!isAuthenticated) return;

    try {
      setIsSyncingWithDB(true);
      const dbItems = await cartService.getCart();
      setDbCartItems(dbItems);
      console.log('[Cart] Carrito cargado desde DB:', dbItems.length, 'items');
    } catch (error) {
      console.error('[Cart] Error al cargar carrito desde DB:', error);
    } finally {
      setIsSyncingWithDB(false);
    }
  }, [isAuthenticated]);

  // Sincronizar con DB cuando el usuario se loguea
  useEffect(() => {
    const syncWithDatabase = async () => {
      // Si el usuario acaba de autenticarse y hay items en localStorage
      if (isAuthenticated && !prevAuthRef.current && rawCartItems.length > 0 && !hasSyncedRef.current) {
        setIsSyncingWithDB(true);
        try {
          console.log('[Cart] Usuario logueado, sincronizando localStorage con DB...');

          // Preparar items para enviar al backend
          const itemsToSync = rawCartItems.map((item) => {
            if (item.type === 'customized') {
              const customItem = item as import('../types/cart').CustomizedCartItem;
              return {
                isCustomized: true,
                customization: customItem.customizedProduct,
                quantity: item.quantity,
                unitPrice: item.price,
              };
            } else {
              const standardItem = item as import('../types/cart').CartItem;
              return {
                productId: standardItem.product.id,
                variantId: standardItem.variantId,
                isCustomized: false,
                quantity: item.quantity,
                unitPrice: item.price,
              };
            }
          });

          // Sincronizar con backend
          const syncedItems = await cartService.syncCart(itemsToSync);
          setDbCartItems(syncedItems);

          // Limpiar localStorage ya que ahora los datos estan en DB
          setRawCartItems([]);
          hasSyncedRef.current = true;
          console.log('[Cart] Sincronizacion completada:', syncedItems.length, 'items');
        } catch (error) {
          console.error('[Cart] Error al sincronizar con DB:', error);
        } finally {
          setIsSyncingWithDB(false);
        }
      }
      // Si usuario ya estaba autenticado al cargar la pagina, cargar desde DB
      else if (isAuthenticated && isInitialLoadRef.current) {
        isInitialLoadRef.current = false;
        await loadCartFromDB();
      }

      // Actualizar referencia del estado de autenticacion
      prevAuthRef.current = isAuthenticated;

      // Si el usuario se desloguea, limpiar items de DB y resetear flags
      if (!isAuthenticated) {
        setDbCartItems([]);
        hasSyncedRef.current = false;
        isInitialLoadRef.current = true;
      }
    };

    syncWithDatabase();
  }, [isAuthenticated, rawCartItems, loadCartFromDB]);

  // Cargar configuración de pedidos desde el backend
  useEffect(() => {
    const loadOrderConfig = async () => {
      try {
        const publicSettings = await settingsService.getPublicSettings();

        // El costo de envío exacto se calcula en el checkout según la zona
        // destino. El carrito usa un estimado por defecto mientras tanto.
        const shippingCost = DEFAULT_ORDER_CONFIG.shippingCost;
        const freeShippingThreshold = DEFAULT_ORDER_CONFIG.freeShippingThreshold;

        // Obtener configuración de impuestos
        const taxEnabled = (publicSettings.tax as any)?.enabled ?? DEFAULT_ORDER_CONFIG.taxEnabled;

        // Obtener tasa de impuestos - puede venir de tax.rate o de payment.taxRate
        let taxRate = DEFAULT_ORDER_CONFIG.taxRate;
        if (publicSettings.tax?.rate !== undefined) {
          // Si viene como porcentaje (ej: 19), convertir a decimal
          taxRate = publicSettings.tax.rate > 1 ? publicSettings.tax.rate / 100 : publicSettings.tax.rate;
        }

        // Determinar si el impuesto está incluido en el precio
        // Por defecto true (estándar en Colombia)
        const taxIncluded = (publicSettings.tax as any)?.included ?? true;

        setOrderConfig({
          shippingCost,
          freeShippingThreshold,
          taxEnabled,
          taxRate,
          taxIncluded,
        });
      } catch (error) {
        console.error('Error loading order config:', error);
        // Usar valores por defecto si falla
      }
    };

    loadOrderConfig();
  }, []);

  // Convertir items de DB a formato local para mostrar en UI
  const dbItemsAsLocal = useCallback((): CartItemType[] => {
    return dbCartItems.map((dbItem) => {
      if (dbItem.isCustomized && dbItem.customization) {
        return {
          id: `db-${dbItem.id}`,
          type: 'customized' as const,
          customizedProduct: dbItem.customization,
          quantity: dbItem.quantity,
          price: dbItem.unitPrice,
          subtotal: dbItem.unitPrice * dbItem.quantity,
          addedAt: new Date(),
          dbId: dbItem.id,
          hasStock: dbItem.hasStock,
          availableStock: dbItem.availableStock,
        };
      }

      // Construir objeto Product usando los datos del backend
      // Normalizar imágenes que pueden venir como JSON string
      const normalizedImages = dbItem.product
        ? normalizeProductImages(dbItem.product.images)
        : { front: '' };

      const productFromDB: Product = dbItem.product
        ? {
            id: dbItem.product.id,
            name: dbItem.product.name,
            description: dbItem.product.description || '',
            basePrice: dbItem.product.basePrice,
            images: normalizedImages,
            // Campos requeridos con valores por defecto
            featured: false,
            stock: dbItem.availableStock,
            colors: [],
            sizes: [],
            createdAt: new Date(),
            updatedAt: new Date(),
          }
        : ({ id: dbItem.productId } as Product);

      return {
        id: `db-${dbItem.id}`,
        type: 'standard' as const,
        product: productFromDB,
        selectedColor: dbItem.variant?.colorHex || '',
        selectedSize: dbItem.variant?.sizeAbbreviation || '',
        variantId: dbItem.variantId || undefined,
        quantity: dbItem.quantity,
        price: dbItem.unitPrice,
        subtotal: dbItem.unitPrice * dbItem.quantity,
        addedAt: new Date(),
        dbId: dbItem.id,
        hasStock: dbItem.hasStock,
        availableStock: dbItem.availableStock,
      };
    });
  }, [dbCartItems]);

  // Recalcular totales cuando cambien los items o la configuración
  const recalculateTotals = useCallback(() => {
    // Usar items de DB si esta autenticado, sino usar localStorage
    const itemsToUse = isAuthenticated ? dbItemsAsLocal() : cartItems;

    // Filtrar solo items que tienen stock disponible para el resumen de totales
    // hasStock puede ser undefined para items de localStorage (no autenticado)
    const itemsWithStock = itemsToUse.filter((item) => item.hasStock !== false);

    const totalItems = itemsWithStock.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = itemsWithStock.reduce((sum, item) => sum + item.subtotal, 0);

    // Calcular impuestos según configuración
    // Solo calcular si taxEnabled es true
    // Si taxIncluded es true, el impuesto ya está incluido en el precio
    // Si taxIncluded es false, se suma al subtotal
    const tax = orderConfig.taxEnabled && !orderConfig.taxIncluded
      ? Math.round(subtotal * orderConfig.taxRate)
      : 0;

    // Calcular envío: gratis si supera el umbral
    const shipping = subtotal >= orderConfig.freeShippingThreshold ? 0 : orderConfig.shippingCost;

    // Total = subtotal + impuestos (si no están incluidos) + envío
    const total = subtotal + tax + shipping;

    setCart({
      items: itemsToUse,
      totalItems,
      subtotal,
      tax,
      shipping,
      discount: 0,
      total,
      updatedAt: new Date(),
    });
  }, [cartItems, orderConfig, isAuthenticated, dbItemsAsLocal]);

  useEffect(() => {
    recalculateTotals();
  }, [recalculateTotals]);

  const addStandardProduct = async (
    product: Product,
    color: string,
    size: string,
    quantity: number = 1
  ) => {
    // Precio efectivo: usa el precio de oferta del producto si lo tiene.
    const effPrice = product.salePrice ?? product.basePrice;
    const newItem: CartItemType = {
      id: `${product.id}-${color}-${size}-${Date.now()}`,
      type: 'standard',
      product,
      selectedColor: color,
      selectedSize: size,
      quantity,
      price: effPrice,
      subtotal: effPrice * quantity,
      addedAt: new Date(),
    };

    // Si esta autenticado, guardar en DB
    if (isAuthenticated) {
      try {
        // Obtener el variantId para la combinación color+size
        const variant = await getVariantByProductColorSize(
          Number(product.id),
          color,
          size
        );

        if (!variant) {
          console.error('[Cart] No se encontró variante para color:', color, 'size:', size);
          // Fallback a localStorage sin variante
          setRawCartItems((prev) => [...prev, newItem]);
          return;
        }

        await cartService.addItem({
          productId: Number(product.id),
          variantId: variant.id,
          isCustomized: false,
          quantity,
          unitPrice: effPrice,
        });
        console.log('[Cart] Producto agregado a DB con variantId:', variant.id);
        // Recargar carrito desde DB
        await loadCartFromDB();
      } catch (error) {
        console.error('[Cart] Error al agregar a DB:', error);
        // Fallback a localStorage
        setRawCartItems((prev) => [...prev, newItem]);
        return;
      }
    } else {
      // Si no esta autenticado, guardar en localStorage
      setRawCartItems((prev) => [...prev, newItem]);
    }
  };

  const addCustomizedProduct = async (customizedProduct: CustomizedProduct, quantity: number = 1) => {
    const newItem: CartItemType = {
      id: `custom-${customizedProduct.id}-${Date.now()}`,
      type: 'customized',
      customizedProduct,
      quantity,
      price: customizedProduct.totalPrice,
      subtotal: customizedProduct.totalPrice * quantity,
      addedAt: new Date(),
    };

    // Si esta autenticado, guardar en DB
    if (isAuthenticated) {
      try {
        await cartService.addItem({
          productId: customizedProduct.templateId,
          isCustomized: true,
          customization: customizedProduct,
          quantity,
          unitPrice: customizedProduct.totalPrice,
        });
        console.log('[Cart] Producto personalizado agregado a DB');
        // Recargar carrito desde DB
        await loadCartFromDB();
      } catch (error) {
        console.error('[Cart] Error al agregar a DB:', error);
        // Fallback a localStorage
        setRawCartItems((prev) => [...prev, newItem]);
        return;
      }
    } else {
      // Si no esta autenticado, guardar en localStorage
      setRawCartItems((prev) => [...prev, newItem]);
    }
  };

  // Actualizar un producto personalizado existente en el carrito
  const updateCustomizedProduct = async (itemId: string, customizedProduct: CustomizedProduct) => {
    // Verificar si es un item de DB (id empieza con "db-")
    if (isAuthenticated && itemId.startsWith('db-')) {
      const dbId = parseInt(itemId.replace('db-', ''));
      if (!isNaN(dbId)) {
        try {
          await cartService.updateItemCustomization(dbId, customizedProduct, customizedProduct.totalPrice);
          console.log('[Cart] Customization actualizada en DB:', dbId);
          // Recargar carrito desde DB
          await loadCartFromDB();
          return;
        } catch (error) {
          console.error('[Cart] Error al actualizar customization en DB:', error);
        }
      }
    }

    // Fallback: actualizar en localStorage
    setRawCartItems((prev) =>
      prev.map((item) => {
        if (item.id === itemId && item.type === 'customized') {
          return {
            ...item,
            customizedProduct,
            price: customizedProduct.totalPrice,
            subtotal: customizedProduct.totalPrice * item.quantity,
          };
        }
        return item;
      })
    );
  };

  // Obtener un item del carrito por ID
  const getCartItemById = (itemId: string): CartItemType | undefined => {
    // Buscar en cart.items que ya tiene los items correctos (DB o localStorage)
    return cart.items.find((item) => item.id === itemId);
  };

  const removeItem = async (itemId: string) => {
    // Verificar si es un item de DB (id empieza con "db-")
    if (isAuthenticated && itemId.startsWith('db-')) {
      const dbId = parseInt(itemId.replace('db-', ''));
      if (!isNaN(dbId)) {
        try {
          await cartService.removeItem(dbId);
          console.log('[Cart] Item eliminado de DB:', dbId);
          // Recargar carrito desde DB
          await loadCartFromDB();
          return;
        } catch (error) {
          console.error('[Cart] Error al eliminar item de DB:', error);
        }
      }
    }
    // Fallback: eliminar de localStorage
    setRawCartItems((prev) => prev.filter((item) => item.id !== itemId));
  };

  const updateQuantity = async (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      await removeItem(itemId);
      return;
    }

    // Verificar si es un item de DB (id empieza con "db-")
    if (isAuthenticated && itemId.startsWith('db-')) {
      const dbId = parseInt(itemId.replace('db-', ''));
      if (!isNaN(dbId)) {
        try {
          await cartService.updateItem(dbId, quantity);
          console.log('[Cart] Cantidad actualizada en DB:', dbId, quantity);
          // Recargar carrito desde DB
          await loadCartFromDB();
          return;
        } catch (error) {
          console.error('[Cart] Error al actualizar cantidad en DB:', error);
        }
      }
    }

    // Fallback: actualizar en localStorage
    setRawCartItems((prev) =>
      prev.map((item) => {
        if (item.id === itemId) {
          return {
            ...item,
            quantity,
            subtotal: item.price * quantity,
          };
        }
        return item;
      })
    );
  };

  const clearCart = async () => {
    // Si esta autenticado, vaciar tambien en DB
    if (isAuthenticated) {
      try {
        await cartService.clearCart();
        setDbCartItems([]);
        console.log('[Cart] Carrito vaciado en DB');
      } catch (error) {
        console.error('[Cart] Error al vaciar carrito en DB:', error);
      }
    }
    setRawCartItems([]);
  };

  const getCartSummary = (): CartSummary => {
    return {
      itemCount: cart.totalItems,
      subtotal: cart.subtotal,
      total: cart.total,
    };
  };

  return (
    <CartContext.Provider
      value={{
        cart,
        orderConfig,
        addStandardProduct,
        addCustomizedProduct,
        updateCustomizedProduct,
        getCartItemById,
        removeItem,
        updateQuantity,
        clearCart,
        getCartSummary,
        isSyncing: isSyncingWithDB,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
