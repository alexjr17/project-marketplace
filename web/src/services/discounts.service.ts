import { httpKeepUrls as client, isApiError } from '../lib/http';

export type DiscountType = 'percent' | 'fixed';
export type DiscountAppliesTo = 'all' | 'product' | 'category' | 'user';
export type DiscountChannel = 'all' | 'online' | 'pos';

export interface Discount {
  id: number;
  isAuto: boolean;        // true = descuento automático (sin código)
  code?: string | null;   // null cuando es automático
  name?: string | null;
  type: DiscountType;
  value: number;
  appliesTo: DiscountAppliesTo;
  targetIds?: number[] | null;
  channel: DiscountChannel;
  minSubtotal?: number | null;
  maxUses?: number | null;
  maxUsesPerUser?: number | null;
  usedCount: number;
  isActive: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
}

export type DiscountInput = Omit<Discount, 'id' | 'usedCount'>;

/** Ítem mínimo para validar un cupón (el backend resuelve categoría/subtotal). */
export interface CouponItem {
  productId: number;
  price: number;
  quantity: number;
}

export interface CouponResult {
  code: string;
  name?: string | null;
  type: DiscountType;
  value: number;
  amount: number;
}

export async function listDiscounts(): Promise<Discount[]> {
  return (await client.get<Discount[]>('/discounts')) || [];
}

export async function createDiscount(data: DiscountInput): Promise<Discount> {
  return client.post<Discount>('/discounts', data);
}

export async function updateDiscount(id: number, data: DiscountInput): Promise<Discount> {
  return client.put<Discount>(`/discounts/${id}`, data);
}

export async function deleteDiscount(id: number): Promise<void> {
  await client.delete(`/discounts/${id}`);
}

/**
 * Valida un cupón sin aplicarlo. Devuelve el descuento o lanza un Error con
 * el mensaje legible del backend (cupón inválido, vencido, no aplica, etc.).
 */
export async function validateCoupon(
  code: string,
  items: CouponItem[],
  channel: 'online' | 'pos' = 'online'
): Promise<CouponResult> {
  try {
    return await client.post<CouponResult>('/discounts/validate', { code, items, channel });
  } catch (err: unknown) {
    const msg = (isApiError(err) && err.status > 0 && err.message) || 'No se pudo validar el cupón';
    throw new Error(msg);
  }
}
