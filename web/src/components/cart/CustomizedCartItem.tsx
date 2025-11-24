import { Minus, Plus, Trash2, Sparkles } from 'lucide-react';
import type { CartItemCustomized } from '../../types/cart';

interface CustomizedCartItemProps {
  item: CartItemCustomized;
  onUpdateQuantity: (itemId: string, quantity: number) => void;
  onRemove: (itemId: string) => void;
}

export const CustomizedCartItem = ({ item, onUpdateQuantity, onRemove }: CustomizedCartItemProps) => {
  const { customizedProduct } = item;

  const handleDecrease = () => {
    if (item.quantity > 1) {
      onUpdateQuantity(item.id, item.quantity - 1);
    }
  };

  const handleIncrease = () => {
    if (item.quantity < 99) {
      onUpdateQuantity(item.id, item.quantity + 1);
    }
  };

  return (
    <div className="relative overflow-hidden flex gap-4 p-4 bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg border-2 border-purple-200 hover:border-purple-300 transition-colors">
      {/* Badge de personalizado */}
      <div className="absolute top-2 left-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1 shadow-md">
        <Sparkles className="w-3 h-3" />
        <span>PERSONALIZADO</span>
      </div>

      {/* Preview del producto personalizado */}
      <div className="w-32 h-32 bg-white rounded-lg flex items-center justify-center flex-shrink-0 shadow-md mt-6">
        {customizedProduct.previewImages?.front ? (
          <img
            src={customizedProduct.previewImages.front}
            alt={`Preview de ${customizedProduct.productName}`}
            className="w-full h-full object-contain rounded-lg"
          />
        ) : (
          <div
            className="w-28 h-28 rounded-lg"
            style={{ backgroundColor: customizedProduct.selectedColor }}
          />
        )}
      </div>

      {/* Información del producto */}
      <div className="flex-1 min-w-0 mt-6">
        <h3 className="font-semibold text-gray-900 mb-1">{customizedProduct.productName}</h3>
        <p className="text-sm text-gray-600 mb-3">Producto Personalizado</p>

        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-gray-500">Color:</span>
            <div className="flex items-center gap-1">
              <div
                className="w-4 h-4 rounded border border-gray-300"
                style={{ backgroundColor: customizedProduct.selectedColor }}
              />
              <span className="text-gray-700">{customizedProduct.selectedColor}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-gray-500">Talla:</span>
            <span className="font-medium text-gray-700">{customizedProduct.selectedSize}</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-gray-500">Diseños:</span>
            <span className="font-medium text-purple-700">
              {customizedProduct.designs?.length || 0} zona{(customizedProduct.designs?.length || 0) > 1 ? 's' : ''}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-gray-500">Precio base:</span>
            <span className="text-gray-700">${(customizedProduct.basePrice || 0).toFixed(2)}</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-gray-500">Personalización:</span>
            <span className="text-purple-700 font-medium">
              +${(customizedProduct.customizationPrice || 0).toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Precio y controles */}
      <div className="flex flex-col items-end justify-between">
        <button
          onClick={() => onRemove(item.id)}
          className="text-gray-400 hover:text-red-500 transition-colors p-1"
          aria-label="Eliminar producto"
        >
          <Trash2 className="w-5 h-5" />
        </button>

        <div className="text-right">
          <p className="text-sm text-gray-500 mb-1">
            ${(item.price || 0).toFixed(2)} c/u
          </p>
          <p className="text-xs text-purple-600 mb-2">
            (${(customizedProduct.basePrice || 0).toFixed(2)} + ${(customizedProduct.customizationPrice || 0).toFixed(2)})
          </p>
          <p className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600">
            ${(item.subtotal || 0).toFixed(2)}
          </p>
        </div>

        {/* Control de cantidad */}
        <div className="flex items-center gap-2 border-2 border-purple-300 rounded-lg overflow-hidden bg-white">
          <button
            onClick={handleDecrease}
            disabled={item.quantity <= 1}
            className="px-2 py-1 hover:bg-purple-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label="Disminuir cantidad"
          >
            <Minus className="w-4 h-4 text-purple-600" />
          </button>

          <span className="px-3 py-1 font-bold text-purple-700 min-w-[2rem] text-center">
            {item.quantity}
          </span>

          <button
            onClick={handleIncrease}
            disabled={item.quantity >= 99}
            className="px-2 py-1 hover:bg-purple-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label="Aumentar cantidad"
          >
            <Plus className="w-4 h-4 text-purple-600" />
          </button>
        </div>
      </div>
    </div>
  );
};
