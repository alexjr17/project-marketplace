import { Minus, Plus, Trash2, Sparkles, Pencil, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useCurrency } from '../../hooks/useCurrency';
import { useSettings } from '../../context/SettingsContext';
import { templateRecipesService } from '../../services/template-recipes.service';
import type { CartItemCustomized } from '../../types/cart';

interface CustomizedCartItemProps {
  item: CartItemCustomized;
  onUpdateQuantity: (itemId: string, quantity: number) => void;
  onRemove: (itemId: string) => void;
  onStockChange?: (itemId: string, hasStock: boolean, availableStock: number) => void;
}

export const CustomizedCartItem = ({ item, onUpdateQuantity, onRemove, onStockChange }: CustomizedCartItemProps) => {
  const { format } = useCurrency();
  const navigate = useNavigate();
  const { settings } = useSettings();
  const { customizedProduct } = item;

  // Estado de stock - usar valores de DB si están disponibles
  const [availableStock, setAvailableStock] = useState<number | null>(
    item.availableStock !== undefined ? item.availableStock : null
  );
  const [loadingStock, setLoadingStock] = useState(item.availableStock === undefined);

  // Colores de marca dinámicos
  const brandColors = settings.appearance?.brandColors || settings.general.brandColors || {
    primary: '#7c3aed',
    secondary: '#ec4899',
    accent: '#f59e0b',
  };
  const gradientStyle = `linear-gradient(to right, ${brandColors.primary}, ${brandColors.secondary}, ${brandColors.accent})`;

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

    const fetchStock = async () => {
      if (!customizedProduct.templateId) {
        // Sin templateId no podemos verificar stock, dejamos como indeterminado
        setAvailableStock(null);
        setLoadingStock(false);
        return;
      }

      try {
        setLoadingStock(true);

        // Usar el mismo método que el checkout: buscar por colorHex y sizeName
        // El backend hará el matching igual que en orders.service.ts
        const stockInfo = await templateRecipesService.getVariantStock(
          customizedProduct.templateId,
          customizedProduct.colorId || null,
          customizedProduct.sizeId || null,
          customizedProduct.selectedColor, // hexCode del color
          customizedProduct.selectedSize   // nombre o abreviatura de la talla
        );

        if (stockInfo && stockInfo.availableStock !== undefined) {
          setAvailableStock(stockInfo.availableStock);
          // Notificar al padre sobre el estado del stock
          if (onStockChange) {
            onStockChange(item.id, stockInfo.availableStock >= item.quantity, stockInfo.availableStock);
          }
        } else {
          setAvailableStock(null);
        }
      } catch (error) {
        console.error('Error fetching stock:', error);
        // En caso de error, dejamos como indeterminado (no bloquear)
        setAvailableStock(null);
      } finally {
        setLoadingStock(false);
      }
    };

    fetchStock();
  }, [customizedProduct.templateId, customizedProduct.colorId, customizedProduct.sizeId, customizedProduct.selectedColor, customizedProduct.selectedColorName, customizedProduct.selectedSize, item.quantity, item.id, item.availableStock, item.hasStock, onStockChange]);

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

  // Editar el producto personalizado
  const handleEdit = () => {
    navigate(`/customize?edit=${item.id}`);
  };

  return (
    <div className={`bg-white rounded-xl border-2 transition-colors overflow-hidden ${
      isOutOfStock ? 'border-red-300 bg-red-50' : hasInsufficientStock ? 'border-yellow-300 bg-yellow-50' : 'border-gray-200 hover:border-gray-300'
    }`}>
      {/* Badge de personalizado */}
      <div className="px-3 py-1.5 flex items-center gap-1.5" style={{ background: isOutOfStock ? '#dc2626' : gradientStyle }}>
        <Sparkles className="w-3.5 h-3.5 text-white" />
        <span className="text-white text-xs font-bold">
          {isOutOfStock ? 'SIN STOCK' : 'PERSONALIZADO'}
        </span>
      </div>

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
          {/* Preview del producto personalizado */}
          <div className={`w-24 h-24 lg:w-32 lg:h-32 bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg flex items-center justify-center flex-shrink-0 p-2 border ${
            isOutOfStock ? 'border-red-200 opacity-50' : 'border-gray-200'
          }`}>
            {customizedProduct.previewImages?.front ? (
              <img
                src={customizedProduct.previewImages.front}
                alt={`Preview de ${customizedProduct.productName}`}
                loading="lazy"
                decoding="async"
                className="max-w-full max-h-full object-contain rounded"
              />
            ) : (
              <div
                className="w-20 h-20 lg:w-24 lg:h-24 rounded-lg shadow-inner"
                style={{ backgroundColor: customizedProduct.selectedColor }}
              />
            )}
          </div>

          {/* Información del producto */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <h3 className={`font-semibold text-sm lg:text-base truncate ${isOutOfStock ? 'text-gray-500' : 'text-gray-900'}`}>
                  {customizedProduct.productName}
                </h3>
                <p className="text-xs text-gray-500">Personalizado</p>
              </div>
              {/* Botones - Desktop */}
              <div className="hidden lg:flex items-center gap-1">
                {customizedProduct.templateId && (
                  <button
                    onClick={handleEdit}
                    className="text-gray-400 hover:text-blue-500 transition-colors p-1"
                    aria-label="Editar diseño"
                    title="Editar diseño"
                  >
                    <Pencil className="w-5 h-5" />
                  </button>
                )}
                <button
                  onClick={() => onRemove(item.id)}
                  className="text-gray-400 hover:text-red-500 transition-colors p-1"
                  aria-label="Eliminar producto"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Variantes - compacto en móvil */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs lg:text-sm">
              <div className="flex items-center gap-1">
                <div
                  className="w-4 h-4 rounded border border-gray-300"
                  style={{ backgroundColor: customizedProduct.selectedColor }}
                />
                <span className="text-gray-600">{customizedProduct.selectedSize}</span>
              </div>
              <span className="text-gray-500">
                {customizedProduct.designs?.length || 0} diseño{(customizedProduct.designs?.length || 0) > 1 ? 's' : ''}
              </span>
              {/* Indicador de stock */}
              {!loadingStock && availableStock !== null && (
                <span className={`text-xs font-medium ${
                  isOutOfStock ? 'text-red-600' : hasInsufficientStock ? 'text-yellow-600' : 'text-green-600'
                }`}>
                  ({availableStock} disponibles)
                </span>
              )}
            </div>

            {/* Precio desglosado - móvil compacto */}
            <div className="mt-2 text-xs text-gray-500">
              <span>{format(customizedProduct.basePrice || 0)}</span>
              <span className="mx-1">+</span>
              <span className="text-gray-700 font-medium">{format(customizedProduct.customizationPrice || 0)}</span>
              <span className="ml-1">= {format(item.price || 0)} c/u</span>
            </div>

            {/* Desktop: Precio y cantidad en línea */}
            <div className="hidden lg:flex items-center justify-between mt-3">
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
                {format(item.subtotal || 0)}
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
            {format(item.subtotal || 0)}
          </div>

          {/* Botones - Móvil */}
          <div className="flex items-center gap-1">
            {customizedProduct.templateId && (
              <button
                onClick={handleEdit}
                className="text-gray-400 hover:text-blue-500 transition-colors p-2"
                aria-label="Editar diseño"
              >
                <Pencil className="w-5 h-5" />
              </button>
            )}
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
    </div>
  );
};
