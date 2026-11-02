import { ShoppingBag, Plus, Palette } from 'lucide-react';
import { PageHeader } from '../components/shared/PageHeader';
import { useNavigate } from 'react-router-dom';
import { useState, useCallback } from 'react';
import { useCart } from '../context/CartContext';
import { Alert, Button, EmptyState } from '../components/ui';
import { CartItem, CustomizedCartItem, CartSummary } from '../components/cart';

interface StockStatus {
  hasStock: boolean;
  availableStock: number;
}

export const CartPage = () => {
  const navigate = useNavigate();
  const { cart, removeItem, updateQuantity } = useCart();

  // Estado para rastrear el stock de cada item
  const [stockStatuses, setStockStatuses] = useState<Record<string, StockStatus>>({});

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

  const renderItem = (item: (typeof cart.items)[number]) =>
    item.type === 'customized' ? (
      <CustomizedCartItem key={item.id} item={item} onUpdateQuantity={updateQuantity} onRemove={removeItem} onStockChange={handleStockChange} />
    ) : (
      <CartItem key={item.id} item={item} onUpdateQuantity={updateQuantity} onRemove={removeItem} onStockChange={handleStockChange} />
    );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Encabezado de la tienda (gradiente de marca) */}
      <PageHeader
        title="Carrito"
        subtitle={isEmpty ? 'Tu carrito de compras' : `${cart.totalItems} ${cart.totalItems === 1 ? 'producto' : 'productos'}`}
        backLabel="Seguir comprando"
        onBack={handleContinueShopping}
      />

      <div className="max-w-7xl mx-auto px-4 py-6 lg:py-8">
        {isEmpty ? (
          <div className="bg-white rounded-xl border border-gray-200 max-w-2xl mx-auto">
            <EmptyState
              icon={ShoppingBag}
              title="Tu carrito está vacío"
              description="Explora nuestro catálogo y encuentra productos increíbles."
              action={
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button onClick={handleContinueShopping}>Ir al catálogo</Button>
                  <Button variant="secondary" icon={<Palette className="w-4 h-4" />} onClick={() => navigate('/customize')}>
                    Personalizar producto
                  </Button>
                </div>
              }
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 items-start">
            {/* Lista de productos */}
            <div className="lg:col-span-2 space-y-6">
              {hasAvailableItems && (
                <section className="space-y-3">
                  <h2 className="text-base font-semibold text-gray-900">
                    Productos disponibles <span className="text-gray-400 font-normal">({availableItemsCount})</span>
                  </h2>
                  {availableItems.map(renderItem)}
                </section>
              )}

              {hasUnavailableItems && (
                <section className="space-y-3">
                  <Alert tone="error" title={`Productos sin stock (${unavailableItems.length})`}>
                    Estos productos no están disponibles actualmente. Elimínalos o espera a que haya stock.
                  </Alert>
                  {unavailableItems.map(renderItem)}
                </section>
              )}

              <Button variant="ghost" icon={<Plus className="w-4 h-4" />} onClick={handleContinueShopping}>
                Agregar más productos
              </Button>
            </div>

            {/* Resumen de compra */}
            <div className="lg:col-span-1 space-y-4 lg:sticky lg:top-24">
              <CartSummary cart={cart} onCheckout={hasAvailableItems ? handleCheckout : undefined} />

              {hasUnavailableItems && (
                <Alert tone="warning" title={`${unavailableItems.length} producto${unavailableItems.length > 1 ? 's' : ''} sin stock`}>
                  {hasAvailableItems ? 'Solo podrás comprar los productos disponibles.' : 'Elimina los productos sin stock para continuar.'}
                </Alert>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
