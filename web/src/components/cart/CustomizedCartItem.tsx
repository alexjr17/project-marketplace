import { Trash2, Sparkles, Pencil } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useCurrency } from '../../hooks/useCurrency';
import { Alert, Badge, IconButton } from '../ui';
import { QuantityStepper } from './QuantityStepper';
import { templateRecipesService } from '../../services/template-recipes.service';
import type { CartItemCustomized } from '../../types/cart';
import { assetUrl } from '../../utils/assetUrl';
import { cartThumbnails } from '../customizer/customizerModel';

interface CustomizedCartItemProps {
  item: CartItemCustomized;
  onUpdateQuantity: (itemId: string, quantity: number) => void;
  onRemove: (itemId: string) => void;
  onStockChange?: (itemId: string, hasStock: boolean, availableStock: number) => void;
}

export const CustomizedCartItem = ({ item, onUpdateQuantity, onRemove, onStockChange }: CustomizedCartItemProps) => {
  const { format } = useCurrency();
  const navigate = useNavigate();
  const { customizedProduct } = item;

  // Estado de stock - usar valores de DB si están disponibles
  const [availableStock, setAvailableStock] = useState<number | null>(
    item.availableStock !== undefined ? item.availableStock : null
  );
  const [loadingStock, setLoadingStock] = useState(item.availableStock === undefined);
  const [active, setActive] = useState(0);


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

  const canIncrease = !isOutOfStock && !(availableStock !== null && item.quantity >= availableStock);
  const designsCount = customizedProduct.designs?.length || 0;
  const thumbs = cartThumbnails(customizedProduct);
  const zoneNames = (customizedProduct.zonePrices || []).map((z) => z.name.toLowerCase()).join(' y ');

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
        {/* Vista previa: una miniatura por vista con diseño (la primera grande) */}
        <div className={`flex-shrink-0 ${isOutOfStock ? 'opacity-50' : ''}`}>
          <div className="w-20 h-20 sm:w-28 sm:h-28 bg-gray-50 rounded-lg border border-gray-200 flex items-center justify-center p-1.5">
            {thumbs[0] ? (
              <img src={assetUrl(thumbs[active]?.src || thumbs[0].src)} alt={`Vista previa de ${customizedProduct.productName}`} loading="lazy" decoding="async" className="max-w-full max-h-full object-contain" />
            ) : (
              <div className="w-full h-full rounded-md" style={{ backgroundColor: customizedProduct.selectedColor }} />
            )}
          </div>
          {thumbs.length > 1 && (
            <div className="flex gap-1 mt-1.5">
              {thumbs.map((t, i) => (
                <button key={t.key} type="button" onClick={() => setActive(i)} title={t.key}
                  className={`w-8 h-8 rounded border bg-gray-50 p-0.5 ${i === active ? 'border-app-500' : 'border-gray-200'}`}>
                  <img src={assetUrl(t.src)} alt="" className="w-full h-full object-contain" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <h3 className={`font-medium text-sm sm:text-base truncate ${isOutOfStock ? 'text-gray-500' : 'text-gray-900'}`}>
                  {customizedProduct.productName}
                </h3>
                <Badge tone={isOutOfStock ? 'red' : 'app'} className="flex-shrink-0">
                  <Sparkles className="w-3 h-3" />{isOutOfStock ? 'Sin stock' : 'Personalizado'}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-xs text-gray-500">
                <span className="inline-flex items-center gap-1">
                  <span className="w-3.5 h-3.5 rounded-full ring-1 ring-gray-300" style={{ backgroundColor: customizedProduct.selectedColor }} />
                  Talla {customizedProduct.selectedSize}
                </span>
                <span>{designsCount} {designsCount === 1 ? 'diseño' : 'diseños'}{zoneNames ? ` · ${zoneNames}` : ''}</span>
                {!loadingStock && availableStock !== null && (
                  <span className={isOutOfStock ? 'text-red-600' : hasInsufficientStock ? 'text-amber-700' : 'text-green-700'}>
                    {availableStock} disponibles
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center -mr-1 -mt-1">
              {customizedProduct.templateId && (
                <IconButton title="Editar diseño" tone="app" onClick={handleEdit}>
                  <Pencil className="w-4 h-4" />
                </IconButton>
              )}
              <IconButton title="Eliminar producto" tone="danger" onClick={() => onRemove(item.id)}>
                <Trash2 className="w-4 h-4" />
              </IconButton>
            </div>
          </div>

          <p className="mt-1 text-xs text-gray-500">
            {(customizedProduct.listPrice ?? 0) > (customizedProduct.basePrice || 0) && (
              <><s className="text-gray-400">{format(customizedProduct.listPrice!)}</s>{' '}</>
            )}
            {format(customizedProduct.basePrice || 0)}
            {(customizedProduct.listPrice ?? 0) > (customizedProduct.basePrice || 0) && (
              <span className="text-green-700"> (oferta -{Math.round((1 - (customizedProduct.basePrice || 0) / customizedProduct.listPrice!) * 100)}%)</span>
            )}
            {' '}+ {format(customizedProduct.customizationPrice || 0)} personalización =
            <span className="font-medium text-gray-900"> {format(item.price || 0)}</span> c/u
          </p>

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
            <span className={`text-base font-semibold ${isOutOfStock ? 'text-gray-400' : 'text-gray-900'}`}>{format(item.subtotal || 0)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
