import { useEffect, useMemo, useState } from 'react';
import { ShoppingBag, Truck, Receipt, Tag } from 'lucide-react';
import { useCurrency } from '../../hooks/useCurrency';
import { useCart } from '../../context/CartContext';
import { useSettings } from '../../context/SettingsContext';
import { useAuth } from '../../context/AuthContext';
import { addressesService } from '../../services/addresses.service';
import { quoteShipping } from '../../utils/shippingQuote';
import type { Cart } from '../../types/cart';

interface CartSummaryProps {
  cart: Cart;
  onCheckout?: () => void;
}

export const CartSummary = ({ cart, onCheckout }: CartSummaryProps) => {
  const { format } = useCurrency();
  const { orderConfig } = useCart();
  const { settings } = useSettings();
  const hasItems = cart.items.length > 0;

  // Colores de marca dinámicos
  const brandColors = settings.appearance?.brandColors || settings.general.brandColors || {
    primary: '#7c3aed',
    secondary: '#ec4899',
    accent: '#f59e0b',
  };

  // Obtener configuración del CartContext
  const { freeShippingThreshold, taxRate, taxIncluded } = orderConfig;
  const taxPercentage = Math.round(taxRate * 100);

  // Calcular el valor del impuesto para mostrar
  const calculatedTax = taxIncluded
    ? Math.round(cart.subtotal - (cart.subtotal / (1 + taxRate)))
    : Math.round(cart.subtotal * taxRate);

  // Envío estimado: usa la dirección predeterminada del usuario para dar un
  // precio inicial. El costo exacto se confirma en el checkout con la dirección.
  const { isAuthenticated } = useAuth();
  const [defaultCity, setDefaultCity] = useState('');
  const [loadingShipping, setLoadingShipping] = useState(isAuthenticated);

  useEffect(() => {
    if (!isAuthenticated) {
      setLoadingShipping(false);
      return;
    }
    let active = true;
    setLoadingShipping(true);
    addressesService
      .list()
      .then((list) => {
        if (!active) return;
        const def = list.find((a) => a.isDefault) ?? list[0];
        if (def) setDefaultCity(def.city);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoadingShipping(false);
      });
    return () => {
      active = false;
    };
  }, [isAuthenticated]);

  const shippingQuote = useMemo(() => {
    if (!defaultCity) return null;
    const perItem = settings.shipping?.packageDefaults?.defaultWeightPerItem ?? 0.5;
    const weight = perItem * Math.max(1, cart.totalItems);
    return quoteShipping(settings.shipping, defaultCity, weight, cart.subtotal);
  }, [settings.shipping, defaultCity, cart.totalItems, cart.subtotal]);

  const shippingCost = shippingQuote ? shippingQuote.cost : cart.shipping;
  const displayTotal = cart.subtotal + cart.tax + shippingCost - cart.discount;

  return (
    <div className="bg-white rounded-xl shadow-lg p-4 lg:p-6 sticky top-4 lg:top-6">
      <h2 className="text-lg lg:text-xl font-bold text-gray-900 mb-4 lg:mb-6 flex items-center gap-2">
        <Receipt className="w-5 h-5" style={{ color: brandColors.primary }} />
        Resumen
      </h2>

      <div className="space-y-3 lg:space-y-4 mb-4 lg:mb-6 text-sm lg:text-base">
        {/* Total de items */}
        <div className="flex items-center justify-between text-gray-600">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-4 h-4" />
            <span>Productos ({cart.totalItems})</span>
          </div>
          <span className="font-semibold text-gray-900">
            {format(cart.subtotal)}
          </span>
        </div>

        {/* Envío */}
        <div className="flex items-center justify-between text-gray-600">
          <div className="flex items-center gap-2">
            <Truck className="w-4 h-4" />
            <span>Envío</span>
          </div>
          {loadingShipping ? (
            <span className="text-sm text-gray-400 animate-pulse">Calculando…</span>
          ) : shippingCost === 0 ? (
            <span className="font-semibold text-green-600">GRATIS</span>
          ) : (
            <span className="font-semibold text-gray-900">
              {format(shippingCost)}
            </span>
          )}
        </div>

        {!loadingShipping && shippingQuote && (
          <p className="text-xs text-gray-400 -mt-1">
            Estimado a {defaultCity} · {shippingQuote.carrierName}
          </p>
        )}

        {/* Envío gratis: umbral de la zona cotizada */}
        {!loadingShipping &&
          shippingQuote &&
          !shippingQuote.free &&
          shippingQuote.freeShippingThreshold != null &&
          cart.subtotal < shippingQuote.freeShippingThreshold && (
            <p className="text-xs text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg">
              Agrega {format(shippingQuote.freeShippingThreshold - cart.subtotal)} más para envío
              gratis a {defaultCity}
            </p>
          )}

        {/* Envío gratis: umbral global (sin cotización por zona) */}
        {!loadingShipping && !shippingQuote && cart.subtotal > 0 && cart.subtotal < freeShippingThreshold && (
          <p className="text-xs text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg">
            Agrega {format(freeShippingThreshold - cart.subtotal)} más para envío gratis
          </p>
        )}

        {/* Impuestos */}
        <div className="flex items-center justify-between text-gray-600">
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4" />
            <span>IVA ({taxPercentage}%)</span>
          </div>
          <div className="text-right">
            <span className="font-semibold text-gray-900">
              {format(taxIncluded ? calculatedTax : cart.tax)}
            </span>
            {taxIncluded && (
              <span className="text-xs text-green-600 ml-1">(incl.)</span>
            )}
          </div>
        </div>

        {/* Descuento (si aplica) */}
        {cart.discount > 0 && (
          <div className="flex items-center justify-between text-green-600">
            <span>Descuento</span>
            <span className="font-semibold">-{format(cart.discount)}</span>
          </div>
        )}
      </div>

      {/* Total */}
      <div className="border-t border-gray-200 pt-4 mb-4 lg:mb-6">
        <div className="flex items-center justify-between">
          <span className="text-base lg:text-lg font-bold text-gray-900">Total</span>
          <span className="text-xl lg:text-2xl font-bold text-gray-900">
            {loadingShipping ? (
              <span className="text-gray-400 animate-pulse">…</span>
            ) : (
              format(displayTotal)
            )}
          </span>
        </div>
      </div>

      {/* Botón de checkout */}
      {onCheckout && (
        <button
          onClick={onCheckout}
          disabled={!hasItems}
          style={{ backgroundColor: hasItems ? brandColors.primary : undefined }}
          className="w-full text-white font-bold py-3 px-6 rounded-lg hover:opacity-90 disabled:bg-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg text-sm lg:text-base"
        >
          {hasItems ? 'Proceder al Pago' : 'Carrito Vacío'}
        </button>
      )}

      {!hasItems && (
        <p className="text-center text-xs lg:text-sm text-gray-500 mt-3 lg:mt-4">
          Agrega productos al carrito para continuar
        </p>
      )}

      {/* Políticas - solo desktop */}
      <div className="hidden lg:block mt-6 pt-6 border-t border-gray-200 space-y-2 text-xs text-gray-500">
        <p className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: brandColors.primary }}></span>
          Envío gratis en compras mayores a {format(freeShippingThreshold)}
        </p>
        <p className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: brandColors.primary }}></span>
          Devoluciones gratuitas en 30 días
        </p>
        <p className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: brandColors.primary }}></span>
          Garantía de satisfacción 100%
        </p>
      </div>
    </div>
  );
};
