import { ShoppingCart, ArrowLeft, ShoppingBag } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { CartItem, CustomizedCartItem, CartSummary } from '../components/cart';

export const CartPage = () => {
  const navigate = useNavigate();
  const { cart, removeItem, updateQuantity } = useCart();

  const handleCheckout = () => {
    navigate('/checkout');
  };

  const handleContinueShopping = () => {
    navigate('/catalog');
  };

  const isEmpty = cart.items.length === 0;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={handleContinueShopping}
            className="flex items-center gap-2 text-purple-600 hover:text-purple-700 font-medium mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Continuar Comprando
          </button>

          <div className="flex items-center gap-3">
            <ShoppingCart className="w-8 h-8 text-purple-600" />
            <h1 className="text-4xl font-bold text-gray-900">Carrito de Compras</h1>
          </div>

          {!isEmpty && (
            <p className="text-gray-600 mt-2">
              Tienes {cart.totalItems} {cart.totalItems === 1 ? 'producto' : 'productos'} en tu carrito
            </p>
          )}
        </div>

        {isEmpty ? (
          /* Carrito vacío */
          <div className="text-center py-16">
            <div className="inline-flex items-center justify-center w-24 h-24 bg-gray-100 rounded-full mb-6">
              <ShoppingBag className="w-12 h-12 text-gray-400" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Tu carrito está vacío
            </h2>
            <p className="text-gray-600 mb-8">
              Explora nuestro catálogo y encuentra productos increíbles para personalizar
            </p>
            <div className="flex gap-4 justify-center">
              <button
                onClick={handleContinueShopping}
                className="bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold py-3 px-6 rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all shadow-md hover:shadow-lg"
              >
                Ir al Catálogo
              </button>
              <button
                onClick={() => navigate('/customize')}
                className="bg-white text-purple-600 font-semibold py-3 px-6 rounded-lg border-2 border-purple-600 hover:bg-purple-50 transition-all"
              >
                Personalizar Producto
              </button>
            </div>
          </div>
        ) : (
          /* Carrito con productos */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Lista de productos */}
            <div className="lg:col-span-2 space-y-4">
              {cart.items.map((item) => {
                if (item.type === 'customized') {
                  return (
                    <CustomizedCartItem
                      key={item.id}
                      item={item}
                      onUpdateQuantity={updateQuantity}
                      onRemove={removeItem}
                    />
                  );
                } else {
                  return (
                    <CartItem
                      key={item.id}
                      item={item}
                      onUpdateQuantity={updateQuantity}
                      onRemove={removeItem}
                    />
                  );
                }
              })}

              {/* Botón para seguir comprando (mobile) */}
              <button
                onClick={handleContinueShopping}
                className="w-full py-3 px-6 border-2 border-gray-300 text-gray-700 font-semibold rounded-lg hover:border-purple-300 hover:text-purple-600 transition-colors"
              >
                Agregar más productos
              </button>
            </div>

            {/* Resumen de compra */}
            <div className="lg:col-span-1">
              <CartSummary cart={cart} onCheckout={handleCheckout} />
            </div>
          </div>
        )}

        {/* Información adicional */}
        {!isEmpty && (
          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-lg shadow-md">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <ShoppingBag className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Envío Seguro</h3>
              <p className="text-sm text-gray-600">
                Todos los productos son empacados con cuidado y enviados de forma segura
              </p>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Compra Segura</h3>
              <p className="text-sm text-gray-600">
                Tu información está protegida con encriptación de última generación
              </p>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Garantía de Calidad</h3>
              <p className="text-sm text-gray-600">
                Productos de alta calidad con garantía de satisfacción 100%
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
