/** Cuánto falta para el envío gratis. null si no hay umbral configurado. */
export function freeShippingProgress(subtotal: number, threshold: number | null | undefined) {
  if (!threshold || threshold <= 0) return null;
  const remaining = Math.max(0, threshold - subtotal);
  return { remaining, reached: remaining === 0, pct: Math.min(100, Math.round((subtotal / threshold) * 100)) };
}
