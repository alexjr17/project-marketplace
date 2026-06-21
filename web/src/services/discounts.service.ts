import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const authHeader = () => {
  const raw = localStorage.getItem('marketplace_auth');
  let token: string | null = null;
  if (raw) {
    try {
      token = JSON.parse(raw).token || null;
    } catch {
      token = null;
    }
  }
  return token ? { Authorization: `Bearer ${token}` } : {};
};

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
  const res = await axios.get(`${API_URL}/discounts`, { headers: authHeader() });
  return res.data.data || [];
}

export async function createDiscount(data: DiscountInput): Promise<Discount> {
  const res = await axios.post(`${API_URL}/discounts`, data, { headers: authHeader() });
  return res.data.data;
}

export async function updateDiscount(id: number, data: DiscountInput): Promise<Discount> {
  const res = await axios.put(`${API_URL}/discounts/${id}`, data, { headers: authHeader() });
  return res.data.data;
}

export async function deleteDiscount(id: number): Promise<void> {
  await axios.delete(`${API_URL}/discounts/${id}`, { headers: authHeader() });
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
    const res = await axios.post(
      `${API_URL}/discounts/validate`,
      { code, items, channel },
      { headers: authHeader() }
    );
    return res.data.data as CouponResult;
  } catch (err: unknown) {
    const msg =
      (axios.isAxiosError(err) && (err.response?.data as { message?: string })?.message) ||
      'No se pudo validar el cupón';
    throw new Error(msg);
  }
}
