import { createContext, useContext, ReactNode, useEffect, useState } from 'react';
import type { Cart, CartItemType, CartSummary } from '../types/cart';
import type { Product } from '../types/product';
import type { CustomizedProduct } from '../types/design';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { STORAGE_KEYS } from '../services/storage.service';

interface CartContextType {
  cart: Cart;
  addStandardProduct: (product: Product, color: string, size: string, quantity?: number) => void;
  addCustomizedProduct: (customizedProduct: CustomizedProduct, quantity?: number) => void;
  removeItem: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  clearCart: () => void;
  getCartSummary: () => CartSummary;
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

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [cartItems, setCartItems] = useLocalStorage<CartItemType[]>(STORAGE_KEYS.CART, []);
  const [cart, setCart] = useState<Cart>(INITIAL_CART);

  // Recalcular totales cuando cambien los items
  useEffect(() => {
    const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = cartItems.reduce((sum, item) => sum + item.subtotal, 0);
    const tax = subtotal * 0.16; // 16% de impuesto
    const shipping = subtotal > 50 ? 0 : 5.99; // Envío gratis sobre $50
    const total = subtotal + tax + shipping;

    setCart({
      items: cartItems,
      totalItems,
      subtotal,
      tax,
      shipping,
      discount: 0,
      total,
      updatedAt: new Date(),
    });
  }, [cartItems]);

  const addStandardProduct = (
    product: Product,
    color: string,
    size: string,
    quantity: number = 1
  ) => {
    const newItem: CartItemType = {
      id: `${product.id}-${color}-${size}-${Date.now()}`,
      type: 'standard',
      product,
      selectedColor: color,
      selectedSize: size,
      quantity,
      price: product.basePrice,
      subtotal: product.basePrice * quantity,
      addedAt: new Date(),
    };

    setCartItems((prev) => [...prev, newItem]);
  };

  const addCustomizedProduct = (customizedProduct: CustomizedProduct, quantity: number = 1) => {
    const newItem: CartItemType = {
      id: `custom-${customizedProduct.id}-${Date.now()}`,
      type: 'customized',
      customizedProduct,
      quantity,
      price: customizedProduct.totalPrice,
      subtotal: customizedProduct.totalPrice * quantity,
      addedAt: new Date(),
    };

    setCartItems((prev) => [...prev, newItem]);
  };

  const removeItem = (itemId: string) => {
    setCartItems((prev) => prev.filter((item) => item.id !== itemId));
  };

  const updateQuantity = (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(itemId);
      return;
    }

    setCartItems((prev) =>
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

  const clearCart = () => {
    setCartItems([]);
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
        addStandardProduct,
        addCustomizedProduct,
        removeItem,
        updateQuantity,
        clearCart,
        getCartSummary,
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
