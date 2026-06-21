import { ShoppingBag, Truck, Heart, AlertTriangle } from 'lucide-react';
import { PageHeader } from '../components/shared/PageHeader';
import { useNavigate } from 'react-router-dom';
import { useState, useCallback } from 'react';
import { useCart } from '../context/CartContext';
import { useSettings } from '../context/SettingsContext';
import { CartItem, CustomizedCartItem, CartSummary } from '../components/cart';

interface StockStatus {
  hasStock: boolean;
  availableStock: number;
}

export const CartPage = () => {
  const navigate = useNavigate();
  const { cart, removeItem, updateQuantity } = useCart();
  const { settings } = useSettings();

  // Estado para rastrear el stock de cada item
  const [stockStatuses, setStockStatuses] = useState<Record<string, StockStatus>>({});

  // Colores de marca dinámicos
  const brandColors = settings.appearance?.brandColors || settings.general.brandColors || {
    primary: '#7c3aed',
    secondary: '#ec4899',
    accent: '#f59e0b',
  };
  const gradientStyle = `linear-gradient(to right, ${brandColors.primary}, ${brandColors.secondary}, ${brandColors.accent})`;

  // Callback para recibir cambios de stock de CustomizedCartItem
  const handleStockChange = useCallback((itemId: string, hasStock: boolean, availableStock: number) => {
    setStockStatuses(prev => ({
      ...prev,
      [itemId]: { hasStock, availableStock }
    }));
  }, []);

  // Separar items disponibles y no disponibles
  const availableItems = cart.items.filter(item => {
    const status = stockStatuses[item.id];
    // Si no tenemos estado aún, asumimos disponible
    return !status || status.hasStock;
  });

  const unavailableItems = cart.items.filter(item => {
    const status = stockStatuses[item.id];
    return status && !status.hasStock;
  });

  // Calcular subtotal solo de items disponibles
  const availableSubtotal = availableItems.reduce((sum, item) => sum + (item.subtotal || 0), 0);
  const availableItemsCount = availableItems.reduce((sum, item) => sum + item.quantity, 0);

  const handleCheckout = () => {
    // Solo ir al checkout si hay items disponibles
    if (availableItems.length > 0) {
      navigate('/checkout');
    }
  };

  const handleContinueShopping = () => {
    navigate('/catalog');
  };

  const isEmpty = cart.items.length === 0;
  const hasUnavailableItems = unavailableItems.length > 0;
  const hasAvailableItems = availableItems.length > 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header con gradiente dinámico */}
      <PageHeader
        title="Carrito"
        subtitle={isEmpty ? 'Tu carrito de compras' : `${cart.totalItems} ${cart.totalItems === 1 ? 'producto' : 'productos'}`}
        backLabel="Seguir comprando"
        onBack={handleContinueShopping}
      />

      <div className="max-w-7xl mx-auto px-4 py-4 lg:py-8">
        {isEmpty ? (
          /* Carrito vacío */
          <div className="text-center py-8 lg:py-16">
            <div className="inline-flex items-center justify-center w-20 h-20 lg:w-24 lg:h-24 bg-gray-100 rounded-full mb-4 lg:mb-6">
              <ShoppingBag className="w-10 h-10 lg:w-12 lg:h-12 text-gray-400" />
            </div>
            <h2 className="text-xl lg:text-2xl font-bold text-gray-900 mb-2">
              Tu carrito está vacío
            </h2>
            <p className="text-gray-600 mb-6 lg:mb-8 text-sm lg:text-base px-4">
              Explora nuestro catálogo y encuentra productos increíbles
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center px-4 sm:px-0">
              <button
                onClick={handleContinueShopping}
                style={{ backgroundColor: brandColors.primary }}
                className="text-white font-semibold py-3 px-6 rounded-lg hover:opacity-90 transition-all shadow-md hover:shadow-lg"
              >
                Ir al Catálogo
              </button>
              <button
                onClick={() => navigate('/customize')}
                className="bg-white text-gray-700 font-semibold py-3 px-6 rounded-lg border-2 border-gray-300 hover:bg-gray-50 hover:border-gray-400 transition-all"
              >
                Personalizar Producto
              </button>
            </div>
          </div>
        ) : (
          /* Carrito con productos */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-8">
            {/* Lista de productos */}
            <div className="lg:col-span-2 space-y-4 lg:space-y-6">
              {/* Sección: Productos disponibles */}
              {hasAvailableItems && (
                <div className="space-y-3 lg:space-y-4">
                  <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <ShoppingBag className="w-5 h-5" style={{ color: brandColors.primary }} />
                    Productos disponibles ({availableItemsCount})
                  </h2>
                  {availableItems.map((item) => {
                    if (item.type === 'customized') {
                      return (
                        <CustomizedCartItem
                          key={item.id}
                          item={item}
                          onUpdateQuantity={updateQuantity}
                          onRemove={removeItem}
                          onStockChange={handleStockChange}
                        />
                      );
                    } else {
                      return (
                        <CartItem
                          key={item.id}
                          item={item}
                          onUpdateQuantity={updateQuantity}
                          onRemove={removeItem}
                          onStockChange={handleStockChange}
                        />
                      );
                    }
                  })}
                </div>
              )}

              {/* Sección: Productos sin stock */}
              {hasUnavailableItems && (
                <div className="space-y-3 lg:space-y-4">
                  <div className="flex items-center gap-2 pt-4 border-t border-gray-200">
                    <AlertTriangle className="w-5 h-5 text-red-500" />
                    <h2 className="text-lg font-semibold text-red-600">
                      Productos sin stock ({unavailableItems.length})
                    </h2>
                  </div>
                  <p className="text-sm text-gray-500">
                    Estos productos no están disponibles actualmente. Elimínalos o espera a que haya stock.
                  </p>
                  {unavailableItems.map((item) => {
                    if (item.type === 'customized') {
                      return (
                        <CustomizedCartItem
                          key={item.id}
                          item={item}
                          onUpdateQuantity={updateQuantity}
                          onRemove={removeItem}
                          onStockChange={handleStockChange}
                        />
                      );
                    } else {
                      return (
                        <CartItem
                          key={item.id}
                          item={item}
                          onUpdateQuantity={updateQuantity}
                          onRemove={removeItem}
                          onStockChange={handleStockChange}
                        />
                      );
                    }
                  })}
                </div>
              )}

              {/* Botón para seguir comprando */}
              <button
                onClick={handleContinueShopping}
                className="w-full py-2.5 lg:py-3 px-6 border-2 border-dashed border-gray-300 text-gray-600 font-medium rounded-xl hover:border-gray-400 hover:text-gray-900 hover:bg-gray-50 transition-colors text-sm lg:text-base flex items-center justify-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Agregar más productos
              </button>
            </div>

            {/* Resumen de compra */}
            <div className="lg:col-span-1">
              <CartSummary
                cart={cart}
                onCheckout={hasAvailableItems ? handleCheckout : undefined}
              />

              {/* Alerta si hay items no disponibles */}
              {hasUnavailableItems && (
                <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-yellow-800">
                        {unavailableItems.length} producto{unavailableItems.length > 1 ? 's' : ''} sin stock
                      </p>
                      <p className="text-xs text-yellow-700 mt-1">
                        {hasAvailableItems
                          ? 'Solo podrás comprar los productos disponibles.'
                          : 'Elimina los productos sin stock para continuar.'}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Información adicional - Solo desktop */}
        {!isEmpty && (
          <div className="hidden lg:flex mt-8 justify-center">
            <div className="bg-white px-8 py-3 rounded-full shadow-sm flex items-center gap-8 border border-gray-100">
              <div className="flex items-center gap-2 text-gray-600">
                <Truck className="w-4 h-4 text-green-500" />
                <span className="text-sm font-medium">Envío seguro</span>
              </div>
              <div className="w-px h-4 bg-gray-200" />
              <div className="flex items-center gap-2 text-gray-600">
                <Heart className="w-4 h-4 text-red-500" />
                <span className="text-sm font-medium">Garantía 100%</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
