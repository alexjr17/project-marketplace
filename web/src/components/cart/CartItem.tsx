import { useState, useEffect } from 'react';
import { Trash2 } from 'lucide-react';
import { Alert, Badge, IconButton } from '../ui';
import { QuantityStepper } from './QuantityStepper';
import { ProductImage } from '../products/ProductImage';
import { useCurrency } from '../../hooks/useCurrency';
import { getVariantByProductColorSize } from '../../services/variants.service';
import type { CartItem as CartItemType } from '../../types/cart';

interface CartItemProps {
  item: CartItemType;
  onUpdateQuantity: (itemId: string, quantity: number) => void;
  onRemove: (itemId: string) => void;
  onStockChange?: (itemId: string, hasStock: boolean, availableStock: number) => void;
}

export const CartItem = ({ item, onUpdateQuantity, onRemove, onStockChange }: CartItemProps) => {
  const { format } = useCurrency();
  // Si el item ya tiene availableStock de la DB, usar ese valor
  const [availableStock, setAvailableStock] = useState<number | null>(
    item.availableStock !== undefined ? item.availableStock : null
  );
  const [loadingStock, setLoadingStock] = useState(item.availableStock === undefined);

  // Obtener stock disponible (solo si no viene de la DB)
  useEffect(() => {
    // Si ya tenemos el stock de la DB, no hacer llamada adicional
    if (item.availableStock !== undefined) {
      setAvailableStock(item.availableStock);
      setLoadingStock(false);
      if (onStockChange) {
        onStockChange(item.id, item.hasStock ?? true, item.availableStock);
      }
      return;
    }

    // Solo hacer llamada si tenemos color y talla válidos
    if (!item.selectedColor || !item.selectedSize) {
      setLoadingStock(false);
      return;
    }

    const fetchStock = async () => {
      try {
        setLoadingStock(true);
        const variant = await getVariantByProductColorSize(
          item.product.id,
          item.selectedColor,
          item.selectedSize
        );

        if (variant) {
          setAvailableStock(variant.stock);
          if (onStockChange) {
            onStockChange(item.id, variant.stock >= item.quantity, variant.stock);
          }
        } else {
          setAvailableStock(0);
          if (onStockChange) {
            onStockChange(item.id, false, 0);
          }
        }
      } catch (error) {
        console.error('Error fetching stock:', error);
        setAvailableStock(null);
      } finally {
        setLoadingStock(false);
      }
    };

    fetchStock();
  }, [item.product.id, item.selectedColor, item.selectedSize, item.quantity, item.id, item.availableStock, item.hasStock, onStockChange]);

  const isOutOfStock = availableStock !== null && availableStock === 0;
  const hasInsufficientStock = availableStock !== null && availableStock > 0 && availableStock < item.quantity;

  // Oferta: precio original tachado + porcentaje de descuento.
  const original = item.product.basePrice ?? item.price;
  const onSale = (item.product.hasDiscount ?? false) && original > item.price;
  const offPct = onSale ? Math.round((1 - item.price / original) * 100) : 0;

  const handleDecrease = () => {
    if (item.quantity > 1) {
      onUpdateQuantity(item.id, item.quantity - 1);
    }
  };

  const handleIncrease = () => {
    const maxQuantity = availableStock !== null ? Math.min(99, availableStock) : 99;
    if (item.quantity < maxQuantity) {
      onUpdateQuantity(item.id, item.quantity + 1);
    }
  };

  const canIncrease = !isOutOfStock && !(availableStock !== null && item.quantity >= availableStock);

  return (
    <div className={`bg-white rounded-xl border p-3 sm:p-4 ${isOutOfStock ? 'border-red-200' : hasInsufficientStock ? 'border-amber-200' : 'border-gray-200'}`}>
      {(isOutOfStock || hasInsufficientStock) && (
        <div className="mb-3">
          <Alert tone={isOutOfStock ? 'error' : 'warning'}>
            {isOutOfStock
              ? 'Este producto no tiene stock disponible. Por favor elimínalo del carrito.'
              : `Solo hay ${availableStock} unidades disponibles. Ajusta la cantidad.`}
          </Alert>
        </div>
      )}

      <div className="flex gap-3 sm:gap-4">
        {/* Imagen */}
        <div className={`w-20 h-20 sm:w-24 sm:h-24 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0 ${isOutOfStock ? 'opacity-50' : ''}`}>
          <ProductImage
            src={item.product.colors?.find((c) => c.hexCode === item.selectedColor)?.image || item.product.images.front}
            alt={item.product.name}
            width={200}
            iconClassName="w-6 h-6"
          />
        </div>

        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className={`font-medium text-sm sm:text-base truncate ${isOutOfStock ? 'text-gray-500' : 'text-gray-900'}`}>
                {item.product.name}
              </h3>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-xs text-gray-500">
                {item.selectedColor && (
                  <span className="inline-flex items-center gap-1">
                    <span className="w-3.5 h-3.5 rounded-full ring-1 ring-gray-300" style={{ backgroundColor: item.selectedColor }} />
                    {item.product.colors?.find((c) => c.hexCode === item.selectedColor)?.name ?? 'Color'}
                  </span>
                )}
                {item.selectedSize && <span>Talla {item.selectedSize}</span>}
                {!loadingStock && availableStock !== null && (
                  <span className={isOutOfStock ? 'text-red-600' : hasInsufficientStock ? 'text-amber-700' : 'text-green-700'}>
                    {availableStock} disponibles
                  </span>
                )}
              </div>
            </div>
            <IconButton title="Eliminar producto" tone="danger" onClick={() => onRemove(item.id)} className="-mr-1 -mt-1">
              <Trash2 className="w-4 h-4" />
            </IconButton>
          </div>

          <div className="mt-1 text-xs text-gray-500 flex flex-wrap items-center gap-1.5">
            {onSale ? (
              <>
                <span className="line-through">{format(original)}</span>
                <span className="font-medium text-gray-900">{format(item.price)}</span>
                <Badge tone="green">-{offPct}%</Badge>
                <span>c/u</span>
              </>
            ) : (
              <span>{format(item.price)} c/u</span>
            )}
          </div>

          <div className="mt-auto pt-3 flex items-center justify-between gap-3">
            <QuantityStepper
              size="sm"
              value={item.quantity}
              onDecrease={handleDecrease}
              onIncrease={handleIncrease}
              canDecrease={item.quantity > 1}
              canIncrease={canIncrease}
              disabled={isOutOfStock}
            />
            <span className={`text-base font-semibold ${isOutOfStock ? 'text-gray-400' : 'text-gray-900'}`}>{format(item.subtotal)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
