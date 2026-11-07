import api from './api.service';
import type { CustomizedProduct } from '../types/design';

/** El carrito responde con su propia forma: { success, items } o { success, item }. */
interface CartEnvelope {
  items?: CartItemDB[];
  item?: CartItemDB | null;
}

export interface ProductInfo {
  id: number;
  name: string;
  description: string | null;
  images: {
    front: string | null;
    back: string | null;
    side: string | null;
    extra1: string | null;
    extra2: string | null;
  };
  basePrice: number;
  /** Precio con el descuento directo del producto ya aplicado (lo calcula el API). */
  salePrice?: number;
  hasDiscount?: boolean;
}

export interface VariantInfo {
  id: number;
  colorName: string;
  colorHex: string;
  sizeName: string;
  sizeAbbreviation: string;
}

export interface CartItemDB {
  id: number;
  productId: number | null;
  variantId: number | null;
  isCustomized: boolean;
  customization: CustomizedProduct | null;
  quantity: number;
  unitPrice: number;
  availableStock: number;
  hasStock: boolean;
  product?: ProductInfo;
  variant?: VariantInfo;
}

export interface CartItemInput {
  productId?: number;
  variantId?: number;
  isCustomized: boolean;
  customization?: CustomizedProduct;
  quantity: number;
  unitPrice: number;
}

class CartService {
  private baseUrl = '/cart';

  /**
   * Obtener carrito del usuario con validacion de stock
   */
  async getCart(): Promise<CartItemDB[]> {
    const response = await api.get<CartItemDB[]>(this.baseUrl);
    return (response as CartEnvelope).items || [];
  }

  /**
   * Agregar item al carrito
   */
  async addItem(item: CartItemInput): Promise<CartItemDB> {
    const response = await api.post<CartItemDB>(`${this.baseUrl}/items`, item);
    return (response as CartEnvelope).item as CartItemDB;
  }

  /**
   * Actualizar cantidad de un item
   */
  async updateItem(itemId: number, quantity: number): Promise<CartItemDB | null> {
    const response = await api.put<CartItemDB | null>(`${this.baseUrl}/items/${itemId}`, { quantity });
    return (response as CartEnvelope).item ?? null;
  }

  /**
   * Actualizar customization de un item personalizado
   */
  async updateItemCustomization(itemId: number, customization: CustomizedProduct, unitPrice: number): Promise<CartItemDB> {
    const response = await api.patch<CartItemDB>(`${this.baseUrl}/items/${itemId}/customization`, {
      customization,
      unitPrice,
    });
    return (response as CartEnvelope).item as CartItemDB;
  }

  /**
   * Eliminar item del carrito
   */
  async removeItem(itemId: number): Promise<void> {
    await api.delete(`${this.baseUrl}/items/${itemId}`);
  }

  /**
   * Vaciar carrito
   */
  async clearCart(): Promise<void> {
    await api.delete(this.baseUrl);
  }

  /**
   * Sincronizar localStorage con carrito en DB
   */
  async syncCart(items: CartItemInput[]): Promise<CartItemDB[]> {
    const response = await api.post<CartItemDB[]>(`${this.baseUrl}/sync`, { items });
    return (response as CartEnvelope).items || [];
  }
}

export const cartService = new CartService();
