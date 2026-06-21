import { useState, useEffect } from 'react';
import { Minus, Plus, Trash2, AlertTriangle } from 'lucide-react';
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

  return (
    <div className={`bg-white rounded-xl border-2 transition-colors overflow-hidden ${
      isOutOfStock ? 'border-red-300 bg-red-50' : hasInsufficientStock ? 'border-yellow-300 bg-yellow-50' : 'border-gray-200 hover:border-gray-300'
    }`}>
      {/* Layout móvil: vertical / Desktop: horizontal */}
      <div className="p-3 lg:p-4">
        {/* Alerta de stock */}
        {(isOutOfStock || hasInsufficientStock) && (
          <div className={`flex items-center gap-2 p-2 rounded-lg mb-3 ${
            isOutOfStock ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
          }`}>
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span className="text-xs font-medium">
              {isOutOfStock
                ? 'Este producto no tiene stock disponible. Por favor elimínalo del carrito.'
                : `Solo hay ${availableStock} unidades disponibles. Ajusta la cantidad.`
              }
            </span>
          </div>
        )}

        <div className="flex gap-3 lg:gap-4">
          {/* Imagen del producto */}
          <div className={`w-20 h-20 lg:w-24 lg:h-24 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0 ${
            isOutOfStock ? 'opacity-50' : ''
          }`}>
            <img
              src={item.product.images.front}
              alt={item.product.name}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover"
            />
          </div>

          {/* Información del producto */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <h3 className={`font-semibold text-sm lg:text-base truncate ${isOutOfStock ? 'text-gray-500' : 'text-gray-900'}`}>
                  {item.product.name}
                </h3>
                <p className="text-xs lg:text-sm text-gray-500 line-clamp-1 hidden lg:block">{item.product.description}</p>
              </div>
              {/* Botón eliminar - Desktop */}
              <button
                onClick={() => onRemove(item.id)}
                className="hidden lg:flex text-gray-400 hover:text-red-500 transition-colors p-1"
                aria-label="Eliminar producto"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>

            {/* Variantes */}
            <div className="flex flex-wrap items-center gap-2 mt-1 lg:mt-2 text-xs lg:text-sm">
              {(item.selectedColor || item.selectedSize) && (
                <div className="flex items-center gap-1">
                  {item.selectedColor && (
                    <div
                      className="w-4 h-4 rounded border border-gray-300"
                      style={{ backgroundColor: item.selectedColor }}
                    />
                  )}
                  {item.selectedSize && <span className="text-gray-600">{item.selectedSize}</span>}
                </div>
              )}
              {/* Precio unitario - móvil */}
              <span className="lg:hidden text-gray-500">• {format(item.price)} c/u</span>
              {/* Indicador de stock */}
              {!loadingStock && availableStock !== null && (
                <span className={`text-xs font-medium ${
                  isOutOfStock ? 'text-red-600' : hasInsufficientStock ? 'text-yellow-600' : 'text-green-600'
                }`}>
                  ({availableStock} disponibles)
                </span>
              )}
            </div>

            {/* Desktop: Precio y cantidad en línea */}
            <div className="hidden lg:flex items-center justify-between mt-3">
              <div className="text-sm text-gray-500">
                {format(item.price)} c/u
              </div>

              {/* Control de cantidad - Desktop */}
              <div className={`flex items-center gap-1 border rounded-lg overflow-hidden ${
                isOutOfStock ? 'border-red-300 opacity-50' : 'border-gray-300'
              }`}>
                <button
                  onClick={handleDecrease}
                  disabled={item.quantity <= 1 || isOutOfStock}
                  className="px-2 py-1 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  aria-label="Disminuir cantidad"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="px-3 py-1 font-semibold text-gray-900 min-w-[2rem] text-center text-sm">
                  {item.quantity}
                </span>
                <button
                  onClick={handleIncrease}
                  disabled={isOutOfStock || (availableStock !== null && item.quantity >= availableStock)}
                  className="px-2 py-1 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  aria-label="Aumentar cantidad"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              <div className={`text-lg font-bold ${isOutOfStock ? 'text-gray-400' : 'text-gray-900'}`}>
                {format(item.subtotal)}
              </div>
            </div>
          </div>
        </div>

        {/* Móvil: Fila de acciones */}
        <div className="lg:hidden flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
          {/* Control de cantidad */}
          <div className={`flex items-center gap-1 border rounded-lg overflow-hidden ${
            isOutOfStock ? 'border-red-300 opacity-50' : 'border-gray-300'
          }`}>
            <button
              onClick={handleDecrease}
              disabled={item.quantity <= 1 || isOutOfStock}
              className="px-2.5 py-1.5 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              aria-label="Disminuir cantidad"
            >
              <Minus className="w-4 h-4" />
            </button>
            <span className="px-3 py-1.5 font-semibold text-gray-900 min-w-[2rem] text-center text-sm">
              {item.quantity}
            </span>
            <button
              onClick={handleIncrease}
              disabled={isOutOfStock || (availableStock !== null && item.quantity >= availableStock)}
              className="px-2.5 py-1.5 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              aria-label="Aumentar cantidad"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Subtotal */}
          <div className={`font-bold ${isOutOfStock ? 'text-gray-400' : 'text-gray-900'}`}>
            {format(item.subtotal)}
          </div>

          {/* Botón eliminar - Móvil */}
          <button
            onClick={() => onRemove(item.id)}
            className="text-gray-400 hover:text-red-500 transition-colors p-2 -mr-2"
            aria-label="Eliminar producto"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
