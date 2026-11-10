import { ShoppingBag, Plus, Palette } from 'lucide-react';
import { PageHeader } from '../components/shared/PageHeader';
import { StoreContainer } from '../components/shared/StoreContainer';
import { useNavigate } from 'react-router-dom';
import { useState, useCallback, useMemo } from 'react';
import { useCart } from '../context/CartContext';
import { Alert, Button } from '../components/ui';
import { CartItem, CustomizedCartItem, CartSummary } from '../components/cart';
import { ProductRail } from '../components/products/ProductRail';
import { excludeIds } from '../components/products/recommendations';
import { useStoreData } from '../hooks/useStoreData';
import { fetchShowcase } from '../components/home/storeQueries';
import { Seo } from '../components/seo/Seo';

interface StockStatus {
  hasStock: boolean;
  availableStock: number;
}

export const CartPage = () => {
  const navigate = useNavigate();
  // Los precios vigentes los recarga el carrito en cada cambio de página.
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

  // Recomendaciones: los más valorados (misma consulta y caché que la vitrina de la portada),
  // sin los que ya están en el carrito.
  const { data: topProducts, loading: loadingTop } = useStoreData('showcase:top', fetchShowcase('top'));
  const inCartIds = useMemo(
    () => cart.items.map((i) => (i.type === 'standard' ? i.product.id : Number(i.customizedProduct.productId))),
    [cart.items],
  );
  const suggestions = useMemo(() => excludeIds(topProducts ?? [], inCartIds, 10), [topProducts, inCartIds]);

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
      <Seo title="Carrito" />
      <PageHeader
        title="Carrito"
        subtitle={isEmpty ? 'Tu carrito de compras' : `${cart.totalItems} ${cart.totalItems === 1 ? 'producto' : 'productos'}`}
        backLabel="Seguir comprando"
        onBack={handleContinueShopping}
      />

      <StoreContainer>
        {isEmpty ? (
          <div className="bg-white rounded-xl border border-gray-200 px-6 py-12 text-center">
            <div className="w-14 h-14 mx-auto rounded-full bg-app-50 text-app-600 flex items-center justify-center">
              <ShoppingBag className="w-7 h-7" />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-gray-900">Tu carrito está vacío</h2>
            <p className="mt-1 text-sm text-gray-500">Explora el catálogo o crea una prenda con tu propio diseño.</p>
            <div className="mt-6 flex flex-col sm:flex-row justify-center gap-2">
              <Button onClick={handleContinueShopping}>Ir al catálogo</Button>
              <Button variant="secondary" icon={<Palette className="w-4 h-4" />} onClick={() => navigate('/customize')}>
                Personalizar una prenda
              </Button>
            </div>
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

            {/* Resumen de compra: acompaña el scroll en escritorio */}
            <div className="lg:col-span-1 space-y-4 lg:sticky" style={{ top: 'calc(var(--store-header-h, 120px) + 1rem)' }}>
              <CartSummary cart={cart} onCheckout={hasAvailableItems ? handleCheckout : undefined} />

              {hasUnavailableItems && (
                <Alert tone="warning" title={`${unavailableItems.length} producto${unavailableItems.length > 1 ? 's' : ''} sin stock`}>
                  {hasAvailableItems ? 'Solo podrás comprar los productos disponibles.' : 'Elimina los productos sin stock para continuar.'}
                </Alert>
              )}
            </div>
          </div>
        )}

        <div className="mt-10">
          <ProductRail
            title={isEmpty ? 'Te pueden gustar' : 'Completa tu compra'}
            products={suggestions}
            loading={loadingTop}
            viewAllTo="/catalog"
          />
        </div>
      </StoreContainer>
    </div>
  );
};
