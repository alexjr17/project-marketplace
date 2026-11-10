import { useEffect, useMemo, useState } from 'react';
import { offerSavings } from '../../utils/offerSavings';
import { Truck, Lock, RotateCcw, ShieldCheck } from 'lucide-react';
import { Button } from '../ui';
import { useCurrency } from '../../hooks/useCurrency';
import { useCart } from '../../context/CartContext';
import { useSettings } from '../../context/SettingsContext';
import { useAuth } from '../../context/AuthContext';
import { addressesService } from '../../services/addresses.service';
import { quoteShipping } from '../../utils/shippingQuote';
import type { Cart } from '../../types/cart';
import { FreeShippingBar } from './FreeShippingBar';

interface CartSummaryProps {
  cart: Cart;
  onCheckout?: () => void;
}

export const CartSummary = ({ cart, onCheckout }: CartSummaryProps) => {
  const { format } = useCurrency();
  const { orderConfig } = useCart();
  const { settings } = useSettings();
  const hasItems = cart.items.length > 0;
  // Ofertas automáticas que ya trae el precio de los productos (se muestran para que el cliente las vea).
  const savings = offerSavings(cart.items);


  // Obtener configuración del CartContext
  const { freeShippingThreshold, taxEnabled, taxRate, taxIncluded } = orderConfig;
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

  const row = 'flex items-center justify-between gap-3 text-sm';

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-5">
      <h2 className="text-base font-semibold text-gray-900 mb-4">Resumen del pedido</h2>

      <div className="space-y-3">
        <div className={row}>
          <span className="text-gray-500">Productos ({cart.totalItems})</span>
          <span className="font-medium text-gray-900">{format(cart.subtotal)}</span>
        </div>
        {savings > 0 && (
          <div className={row}>
            <span className="text-green-700">Ahorro en ofertas <span className="text-xs text-green-600">· ya incluido</span></span>
            <span className="font-medium text-green-700">-{format(savings)}</span>
          </div>
        )}

        <div className={row}>
          <span className="text-gray-500">Envío</span>
          {loadingShipping ? (
            <span className="text-gray-400 animate-pulse">Calculando…</span>
          ) : shippingCost === 0 ? (
            <span className="font-medium text-green-700">Gratis</span>
          ) : (
            <span className="font-medium text-gray-900">{format(shippingCost)}</span>
          )}
        </div>

        {!loadingShipping && shippingQuote && (
          <p className="text-xs text-gray-400 -mt-2">
            Estimado a {defaultCity} · {shippingQuote.carrierName}
          </p>
        )}

        {/* Envío gratis: umbral de la zona cotizada o, sin cotización, el general */}
        {!loadingShipping && (
          <FreeShippingBar
            subtotal={cart.subtotal}
            threshold={shippingQuote ? shippingQuote.freeShippingThreshold : freeShippingThreshold}
            city={shippingQuote ? defaultCity : undefined}
          />
        )}

        {/* Solo si el negocio cobra impuestos (Configuración → Pagos). */}
        {taxEnabled && (
          <div className={row}>
            <span className="text-gray-500">IVA ({taxPercentage}%){taxIncluded && <span className="text-xs text-gray-400"> · incluido</span>}</span>
            <span className="font-medium text-gray-900">{format(taxIncluded ? calculatedTax : cart.tax)}</span>
          </div>
        )}

        {cart.discount > 0 && (
          <div className={row}>
            <span className="text-gray-500">Descuento</span>
            <span className="font-medium text-green-700">-{format(cart.discount)}</span>
          </div>
        )}
      </div>

      <div className="border-t border-gray-200 mt-4 pt-4 flex items-baseline justify-between">
        <span className="text-base font-semibold text-gray-900">Total</span>
        <span className="text-xl font-bold text-gray-900">
          {loadingShipping ? <span className="text-gray-400 animate-pulse">…</span> : format(displayTotal)}
        </span>
      </div>

      {onCheckout && (
        <Button size="lg" fullWidth className="mt-4" onClick={onCheckout} disabled={!hasItems} icon={<Lock className="w-4 h-4" />}>
          {hasItems ? 'Proceder al pago' : 'Carrito vacío'}
        </Button>
      )}

      {!hasItems && (
        <p className="text-center text-xs text-gray-500 mt-3">Agrega productos al carrito para continuar</p>
      )}

      <ul className="mt-4 pt-4 border-t border-gray-100 space-y-1.5 text-xs text-gray-500">
        <li className="flex items-center gap-2"><Truck className="w-3.5 h-3.5 text-gray-400" />Envío gratis en compras mayores a {format(freeShippingThreshold)}</li>
        <li className="flex items-center gap-2"><RotateCcw className="w-3.5 h-3.5 text-gray-400" />Devoluciones gratuitas en 30 días</li>
        <li className="flex items-center gap-2"><ShieldCheck className="w-3.5 h-3.5 text-gray-400" />Garantía de satisfacción 100%</li>
      </ul>
    </div>
  );
};
