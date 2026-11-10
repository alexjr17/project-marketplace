/**
 * Ofertas automáticas en el carrito: precio de lista de cada línea y cuánto ahorra el cliente.
 * El precio de la línea (item.price) ya trae la oferta; esto es solo para mostrarla.
 */
import type { CartItemType, CartItem, CustomizedCartItem } from '../types/cart';

/** Precio unitario sin la oferta, o null si la línea no tiene oferta. */
export function listUnitPrice(item: CartItemType): number | null {
  if (item.type === 'customized') {
    const cp = (item as CustomizedCartItem).customizedProduct;
    const list = cp.listPrice ?? 0;
    return list > (cp.basePrice || 0) ? item.price + (list - (cp.basePrice || 0)) : null;
  }
  const p = (item as CartItem).product;
  return p.hasDiscount && (p.basePrice ?? 0) > item.price ? p.basePrice : null;
}

/** Total ahorrado en ofertas en todo el carrito. */
export function offerSavings(items: CartItemType[]): number {
  return items.reduce((sum, it) => {
    const list = listUnitPrice(it);
    return list ? sum + (list - it.price) * it.quantity : sum;
  }, 0);
}
