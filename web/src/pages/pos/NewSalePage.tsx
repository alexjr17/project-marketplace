import { useState, useEffect, useRef } from 'react';
import { usePOS } from '../../context/POSContext';
import { useToast } from '../../context/ToastContext';
import { useSettings } from '../../context/SettingsContext';
import * as posService from '../../services/pos.service';
import type { SearchResult, TemplateSearchResult, ProductSearchResult, TemplateZoneInfo } from '../../services/pos.service';
import OpenSessionPrompt from '../../components/pos/OpenSessionPrompt';
import ZoneSelectionModal from '../../components/pos/ZoneSelectionModal';
import CheckoutModal from '../../components/pos/CheckoutModal';
import CustomerSelect, { type SelectedCustomer } from '../../components/pos/CustomerSelect';
import BarcodeScanner from '../../components/pos/BarcodeScanner';
import {
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  DollarSign,
  CreditCard,
  Percent,
  X,
  Barcode as BarcodeIcon,
  ChevronDown,
  ChevronUp,
  Smartphone,
  Camera,
  Package,
  Loader2,
  Clock,
} from 'lucide-react';

export default function NewSalePage() {
  const {
    cart,
    addToCart,
    addTemplateToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    subtotal,
    discount,
    tax,
    total,
    setDiscount,
    scanProduct,
    isScanningProduct,
    processSale,
    isProcessingSale,
    currentSession,
  } = usePOS();

  const { showToast } = useToast();
  const { settings } = useSettings();

  // Scanner input
  const [barcodeInput, setBarcodeInput] = useState('');
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Search state
  const [isSearching, setIsSearching] = useState(false);

  // Template zone selection
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateSearchResult | null>(null);

  // Payment state
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'transfer' | 'mixed' | 'debe'>('cash');
  const [selectedCustomer, setSelectedCustomer] = useState<SelectedCustomer | null>(null);
  const [abonoAmount, setAbonoAmount] = useState('');
  const [abonoMethod, setAbonoMethod] = useState<'cash' | 'transfer'>('cash');
  const [cashAmount, setCashAmount] = useState('');
  const [cardAmount, setCardAmount] = useState('');

  // Discount modal
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [discountInput, setDiscountInput] = useState('');

  // Checkout modal (unified flow)
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);

  // Product info modal (for out of stock products)
  const [productInfoModal, setProductInfoModal] = useState<{
    name: string;
    image: string;
    color: string;
    size: string;
    sku: string;
    barcode: string;
    price: number;
    stock: number;
  } | null>(null);

  // Camera barcode scanner (for mobile)
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);

  // Catálogo de productos (acordeón con scroll infinito + búsqueda)
  const [showProductsList, setShowProductsList] = useState(false);
  const [browseItems, setBrowseItems] = useState<SearchResult[]>([]);
  const [browsePage, setBrowsePage] = useState(0);
  const [browseTotalPages, setBrowseTotalPages] = useState(1);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [browseSearch, setBrowseSearch] = useState('');

  // Detect mobile device
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  // Auto-focus barcode input on mount
  useEffect(() => {
    barcodeInputRef.current?.focus();
  }, []);

  // Handle unified search (barcode or name)
  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;

    try {
      setIsSearching(true);
      const result = await posService.searchProductsAndTemplates(barcodeInput);

      if (result.type === 'single' && result.result) {
        // Barcode scan - single result
        if (result.result.type === 'product') {
          const productData = {
            variantId: result.result.variantId,
            product: {
              id: result.result.productId,
              name: result.result.name,
              image: result.result.image || '',
            },
            color: result.result.color,
            size: result.result.size,
            sku: result.result.sku,
            barcode: result.result.barcode,
            price: result.result.price,
            stock: result.result.stock,
            available: result.result.available,
          };

          // Check stock before adding
          if (productData.stock <= 0) {
            // Show product info modal without adding to cart
            setProductInfoModal({
              name: productData.product.name,
              image: productData.product.image,
              color: productData.color,
              size: productData.size,
              sku: productData.sku,
              barcode: productData.barcode,
              price: productData.price,
              stock: productData.stock,
            });
          } else {
            // Add to cart
            addToCart(productData, 1);
          }
        } else if (result.result.type === 'template') {
          // Template scanned - show zone selection modal
          setSelectedTemplate(result.result as TemplateSearchResult);
        }
        setBarcodeInput('');
      } else {
        // No es un código de barras exacto: filtrar el catálogo de productos.
        runCatalogSearch(barcodeInput.trim());
        setBarcodeInput('');
      }
    } catch (error: any) {
      console.error('Error searching:', error);
      showToast(error.response?.data?.message || 'Error al buscar', 'error');
    } finally {
      setIsSearching(false);
      barcodeInputRef.current?.focus();
    }
  };

  // Handle selecting a result (del catálogo o de un escaneo)
  const handleSelectSearchResult = (result: SearchResult) => {
    setBarcodeInput('');

    if (result.type === 'product') {
      // Add product to cart (with stock validation)
      const productResult = result as ProductSearchResult;
      const productData = {
        variantId: productResult.variantId,
        product: {
          id: productResult.productId,
          name: productResult.name,
          image: productResult.image || '',
        },
        color: productResult.color,
        size: productResult.size,
        sku: productResult.sku,
        barcode: productResult.barcode,
        price: productResult.price,
        stock: productResult.stock,
        available: productResult.available,
      };

      // Check stock before adding
      if (productData.stock <= 0) {
        // Show product info modal without adding to cart
        setProductInfoModal({
          name: productData.product.name,
          image: productData.product.image,
          color: productData.color,
          size: productData.size,
          sku: productData.sku,
          barcode: productData.barcode,
          price: productData.price,
          stock: productData.stock,
        });
      } else {
        // Add to cart
        addToCart(productData, 1);
      }
    } else if (result.type === 'template') {
      // Show zone selection modal for template
      setSelectedTemplate(result as TemplateSearchResult);
    }
  };

  // Catálogo de productos: trae una página (con o sin término de búsqueda).
  const fetchProducts = async (page: number, term: string) => {
    if (browseLoading) return;
    setBrowseLoading(true);
    try {
      const res = await posService.browseProducts(page, 12, term);
      setBrowseItems((prev) => (page === 1 ? res.results : [...prev, ...res.results]));
      setBrowsePage(res.page);
      setBrowseTotalPages(res.totalPages);
    } catch {
      showToast('Error al cargar el catálogo de productos', 'error');
    } finally {
      setBrowseLoading(false);
    }
  };

  // Ejecuta una búsqueda en el catálogo: lo abre y recarga desde la página 1.
  const runCatalogSearch = (term: string) => {
    setBrowseSearch(term);
    setBrowseItems([]);
    setBrowsePage(0);
    setBrowseTotalPages(1);
    setShowProductsList(true);
    fetchProducts(1, term);
  };

  // Abrir/cerrar el acordeón del catálogo; al abrir por primera vez, carga.
  const toggleProductsList = () => {
    const opening = !showProductsList;
    setShowProductsList(opening);
    if (opening && browsePage === 0 && !browseLoading) {
      fetchProducts(1, browseSearch);
    }
  };

  // Limpia el filtro de búsqueda del catálogo y recarga todo.
  const clearCatalogSearch = () => {
    runCatalogSearch('');
  };

  // Al hacer scroll cerca del fondo, cargar más productos.
  const handleProductsScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 80) {
      if (!browseLoading && browsePage < browseTotalPages) {
        fetchProducts(browsePage + 1, browseSearch);
      }
    }
  };

  // Handle zone selection confirmation
  const handleZoneSelectionConfirm = (selectedZones: TemplateZoneInfo[], totalPrice: number) => {
    if (!selectedTemplate) return;

    // Add template to cart
    addTemplateToCart(
      selectedTemplate.templateId,
      selectedTemplate.name,
      selectedTemplate.image || '',
      selectedTemplate.basePrice,
      selectedZones,
      totalPrice,
      1
    );

    setSelectedTemplate(null);
  };

  // Handle camera scan result
  const handleCameraScan = async (barcode: string) => {
    setBarcodeInput(barcode);
    try {
      setIsSearching(true);
      const result = await posService.searchProductsAndTemplates(barcode);

      if (result.type === 'single' && result.result) {
        handleSelectSearchResult(result.result);
      } else {
        // Sin coincidencia exacta: filtrar el catálogo de productos.
        runCatalogSearch(barcode.trim());
      }
    } catch (error: any) {
      console.error('Error searching:', error);
      showToast(error.response?.data?.message || 'Error al buscar', 'error');
    } finally {
      setIsSearching(false);
    }
  };

  // Calculate change
  const change =
    paymentMethod === 'cash'
      ? Math.max(0, parseFloat(cashAmount || '0') - total)
      : paymentMethod === 'mixed'
      ? Math.max(0, parseFloat(cashAmount || '0') + parseFloat(cardAmount || '0') - total)
      : 0;

  // Handle discount
  const handleApplyDiscount = () => {
    const discountValue = parseFloat(discountInput || '0');
    if (discountValue < 0 || discountValue > subtotal) {
      showToast('Descuento inválido', 'error');
      return;
    }
    setDiscount(discountValue);
    setShowDiscountModal(false);
    setDiscountInput('');
  };

  // Open checkout modal
  const handleOpenCheckout = () => {
    if (cart.length === 0) {
      showToast('El carrito está vacío', 'error');
      return;
    }

    // Para fiado (debe) no se recibe dinero ahora; el cliente se valida en el checkout.
    if (paymentMethod !== 'debe') {
      const totalPaid =
        paymentMethod === 'cash'
          ? parseFloat(cashAmount || '0')
          : paymentMethod === 'card' || paymentMethod === 'transfer'
          ? total
          : parseFloat(cashAmount || '0') + parseFloat(cardAmount || '0');

      if (totalPaid < total) {
        showToast('El monto pagado es insuficiente', 'error');
        return;
      }
    }

    setShowCheckoutModal(true);
  };

  // Close checkout modal and reset
  const handleCloseCheckout = () => {
    setShowCheckoutModal(false);
    setCashAmount('');
    setCardAmount('');
    setPaymentMethod('cash');
    setSelectedCustomer(null);
    setAbonoAmount('');
    setAbonoMethod('cash');
    barcodeInputRef.current?.focus();
  };

  // Process sale (called from CheckoutModal)
  const handleProcessSale = async (customerData: {
    customerId?: number;
    customerName?: string;
    customerEmail?: string;
    customerPhone?: string;
    customerNit?: string;
    cardReference?: string;
    cardType?: string;
    cardLastFour?: string;
  }) => {
    // Save data before processing (cart gets cleared after)
    const saleSubtotal = subtotal;
    const saleDiscount = discount;
    const saleTax = tax;
    const saleTotal = total;
    const saleChange = change;
    const salePaymentMethod = paymentMethod;

    const sale = await processSale({
      paymentMethod,
      cashAmount:
        paymentMethod === 'cash' || paymentMethod === 'mixed'
          ? parseFloat(cashAmount || '0')
          : paymentMethod === 'debe' && abonoMethod === 'cash'
          ? parseFloat(abonoAmount || '0')
          : undefined,
      cardAmount:
        paymentMethod === 'card' || paymentMethod === 'transfer'
          ? total
          : paymentMethod === 'mixed'
          ? parseFloat(cardAmount || '0')
          : paymentMethod === 'debe' && abonoMethod === 'transfer'
          ? parseFloat(abonoAmount || '0')
          : undefined,
      customerId: customerData.customerId,
      customerName: customerData.customerName,
      customerEmail: customerData.customerEmail,
      customerPhone: customerData.customerPhone,
      customerCedula: customerData.customerNit, // NIT/Cédula para registro de cliente
      cardReference: customerData.cardReference,
      cardType: customerData.cardType,
      cardLastFour: customerData.cardLastFour,
    });

    // Send email in background if provided
    if (customerData.customerEmail && sale.id) {
      posService.sendInvoiceEmail(sale.id, customerData.customerEmail)
        .then(() => showToast('Factura enviada por email', 'success'))
        .catch((err) => {
          console.error('Error sending invoice:', err);
          showToast('No se pudo enviar la factura por email', 'warning');
        });
    }

    return {
      sale: { id: sale.id, orderNumber: sale.orderNumber },
      subtotal: saleSubtotal,
      discount: saleDiscount,
      tax: saleTax,
      total: saleTotal,
      change: saleChange,
      paymentMethod: salePaymentMethod,
    };
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F9') {
        e.preventDefault();
        setShowDiscountModal(true);
      } else if (e.key === 'F12') {
        e.preventDefault();
        handleOpenCheckout();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        if (showDiscountModal) {
          setShowDiscountModal(false);
        }
        if (showCheckoutModal) {
          setShowCheckoutModal(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showDiscountModal, showCheckoutModal, cart, cashAmount, cardAmount, paymentMethod, total]);

  if (!currentSession) {
    return (
      <OpenSessionPrompt
        title="Sin Sesion de Caja"
        message="Abre una sesion de caja para comenzar a vender"
      />
    );
  }

  return (
    <div className="h-full flex flex-col lg:flex-row gap-4">
      {/* Left Column - Cart */}
      <div className="flex-1 flex flex-col min-h-0 lg:min-h-0 max-h-[50vh] lg:max-h-none">
        {/* Scanner Input */}
        <div className="bg-white rounded-lg shadow-sm p-3 sm:p-4 mb-3 sm:mb-4">
          <form onSubmit={handleScan} className="flex gap-2">
            <div className="flex-1">
              <div className="relative">
                <BarcodeIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  ref={barcodeInputRef}
                  type="text"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  placeholder="Escanea o busca..."
                  className="w-full pl-10 pr-4 py-2.5 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base sm:text-lg"
                  disabled={isSearching}
                />
              </div>
            </div>

            {/* Camera button for mobile */}
            {isMobile && (
              <button
                type="button"
                onClick={() => setShowBarcodeScanner(true)}
                className="px-3 py-2.5 sm:py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
                disabled={isSearching}
                title="Escanear con cámara"
              >
                <Camera className="w-5 h-5" />
              </button>
            )}

            <button
              type="submit"
              className="px-4 lg:px-6 py-2.5 sm:py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm lg:text-base"
              disabled={isSearching}
            >
              {isSearching ? '...' : 'Buscar'}
            </button>
          </form>
        </div>

        {/* Catálogo de productos (acordeón con scroll infinito + búsqueda) */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="w-full px-3 lg:px-4 py-3 flex items-center justify-between">
            <button
              type="button"
              onClick={toggleProductsList}
              className="flex items-center gap-2 flex-1 min-w-0"
            >
              <Package className="w-4 h-4 lg:w-5 lg:h-5 text-gray-600 flex-shrink-0" />
              <span className="text-base lg:text-lg font-semibold text-gray-900">Productos</span>
              {browseItems.length > 0 && (
                <span className="text-xs text-gray-500">({browseItems.length})</span>
              )}
              {browseSearch && (
                <span className="text-xs text-blue-600 truncate">· filtro: "{browseSearch}"</span>
              )}
            </button>
            <div className="flex items-center gap-2 flex-shrink-0">
              {browseSearch && (
                <button
                  type="button"
                  onClick={clearCatalogSearch}
                  className="text-xs text-gray-500 hover:text-red-600 flex items-center gap-0.5"
                  title="Quitar filtro"
                >
                  <X className="w-3.5 h-3.5" />
                  Limpiar
                </button>
              )}
              <button type="button" onClick={toggleProductsList} aria-label="Mostrar/ocultar">
                {showProductsList ? (
                  <ChevronUp className="w-4 h-4 lg:w-5 lg:h-5 text-gray-500" />
                ) : (
                  <ChevronDown className="w-4 h-4 lg:w-5 lg:h-5 text-gray-500" />
                )}
              </button>
            </div>
          </div>

          {showProductsList && (
            <div
              onScroll={handleProductsScroll}
              className="max-h-80 overflow-y-auto border-t border-gray-200 p-3"
            >
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                {browseItems.map((item, index) => {
                  const isProduct = item.type === 'product';
                  const price = isProduct
                    ? (item as ProductSearchResult).price
                    : Number((item as TemplateSearchResult).basePrice);
                  return (
                    <button
                      key={index}
                      type="button"
                      onClick={() => handleSelectSearchResult(item)}
                      className="text-left border border-gray-200 rounded-lg p-2 hover:border-blue-400 hover:shadow-sm transition-all"
                    >
                      {item.image ? (
                        <img
                          src={item.image}
                          alt={item.name}
                          className="w-full h-20 object-cover rounded mb-1.5"
                        />
                      ) : (
                        <div className="w-full h-20 bg-gray-100 rounded mb-1.5 flex items-center justify-center">
                          <Package className="w-6 h-6 text-gray-300" />
                        </div>
                      )}
                      <p className="text-xs font-medium text-gray-900 leading-tight line-clamp-2">
                        {item.name}
                      </p>
                      <div className="flex items-center justify-between mt-1">
                        <span
                          className={`text-sm font-bold ${isProduct ? 'text-gray-900' : 'text-purple-600'}`}
                        >
                          ${price.toLocaleString()}
                        </span>
                        {isProduct && (
                          <span className="text-[10px] text-gray-500">
                            Stock: {(item as ProductSearchResult).stock}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {browseLoading && (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                </div>
              )}
              {!browseLoading && browseItems.length === 0 && (
                <p className="text-center text-sm text-gray-500 py-6">No hay productos</p>
              )}
              {!browseLoading && browseItems.length > 0 && browsePage >= browseTotalPages && (
                <p className="text-center text-xs text-gray-400 py-3">
                  No hay más productos
                </p>
              )}
            </div>
          )}
        </div>

        {/* Cart Items */}
        <div className="flex-1 bg-white rounded-lg shadow-sm overflow-hidden flex flex-col min-h-[200px]">
          <div className="p-3 lg:p-4 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 lg:w-5 lg:h-5 text-gray-600" />
              <h2 className="text-base lg:text-lg font-semibold text-gray-900">
                Carrito ({cart.length})
              </h2>
            </div>
            {cart.length > 0 && (
              <button
                onClick={clearCart}
                className="text-sm text-red-600 hover:text-red-700 flex items-center gap-1"
              >
                <Trash2 className="w-4 h-4" />
                Limpiar
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {cart.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-400 py-8 lg:py-0">
                <div className="text-center">
                  <ShoppingCart className="w-12 h-12 lg:w-16 lg:h-16 mx-auto mb-3 lg:mb-4 opacity-50" />
                  <p className="text-sm lg:text-base">Carrito vacío</p>
                  <p className="text-xs lg:text-sm mt-1">Escanea productos para comenzar</p>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {cart.map((item, index) => (
                  <div key={index} className="p-3 lg:p-4 hover:bg-gray-50">
                    <div className="flex gap-3">
                      {/* Imagen del producto */}
                      {item.product.image && (
                        <img
                          src={item.product.image}
                          alt={item.product.name}
                          className="w-12 h-12 lg:w-14 lg:h-14 object-cover rounded flex-shrink-0"
                        />
                      )}

                      {/* Info del producto */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h3 className="font-medium text-gray-900 text-sm lg:text-base truncate">
                              {item.product.name}
                              {item.itemType === 'template' && (
                                <span className="ml-2 inline-block px-1.5 py-0.5 bg-purple-100 text-purple-800 text-xs rounded">
                                  Personal.
                                </span>
                              )}
                            </h3>
                            {item.itemType === 'product' ? (
                              <p className="text-xs lg:text-sm text-gray-500 truncate">
                                {item.color} - {item.size}
                              </p>
                            ) : (
                              <p className="text-xs text-gray-500">
                                Base: ${item.basePrice.toLocaleString()}
                                {item.selectedZones.length > 0 && ` + ${item.selectedZones.length} zonas`}
                              </p>
                            )}
                          </div>
                          <button
                            onClick={() => removeFromCart(index.toString())}
                            className="text-red-500 hover:text-red-700 flex-shrink-0"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Controles de cantidad y precio */}
                        <div className="flex items-center justify-between mt-2">
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => updateQuantity(index.toString(), item.quantity - 1)}
                              className="p-1 rounded border border-gray-300 hover:bg-gray-100"
                              disabled={item.quantity <= 1}
                            >
                              <Minus className="w-3 h-3 lg:w-4 lg:h-4" />
                            </button>
                            <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                            <button
                              onClick={() => updateQuantity(index.toString(), item.quantity + 1)}
                              className="p-1 rounded border border-gray-300 hover:bg-gray-100"
                              disabled={item.itemType === 'product' && item.quantity >= item.stock}
                            >
                              <Plus className="w-3 h-3 lg:w-4 lg:h-4" />
                            </button>
                          </div>
                          <p className="text-base lg:text-lg font-bold text-gray-900">
                            ${item.subtotal.toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right Column - Payment */}
      <div className="w-full lg:w-96 flex flex-col gap-3 lg:gap-4">
        {/* Totals */}
        <div className="bg-white rounded-lg shadow-sm p-3 lg:p-4">
          <h3 className="font-semibold text-gray-900 mb-2 lg:mb-4">Resumen</h3>

          <div className="space-y-1 lg:space-y-2">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal:</span>
              <span>${subtotal.toLocaleString()}</span>
            </div>

            <div className="flex justify-between text-gray-600">
              <span>Descuento:</span>
              <div className="flex items-center gap-2">
                <span className="text-red-600">-${discount.toLocaleString()}</span>
                <button
                  onClick={() => setShowDiscountModal(true)}
                  className="text-blue-600 hover:text-blue-700"
                  title="Aplicar descuento (F9)"
                >
                  <Percent className="w-4 h-4" />
                </button>
              </div>
            </div>

            {tax > 0 && (
              <div className="flex justify-between text-gray-600">
                <span>IVA ({settings.payment?.taxRate || 19}%):</span>
                <span>${tax.toLocaleString()}</span>
              </div>
            )}

            <div className="border-t border-gray-300 pt-2 mt-2">
              <div className="flex justify-between text-lg lg:text-xl font-bold text-gray-900">
                <span>Total:</span>
                <span>${total.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Cliente */}
        <div className="bg-white rounded-lg shadow-sm p-3 lg:p-4">
          <h3 className="font-semibold text-gray-900 mb-2 lg:mb-3">Cliente</h3>
          <CustomerSelect value={selectedCustomer} onChange={setSelectedCustomer} />
        </div>

        {/* Payment Method */}
        <div className="bg-white rounded-lg shadow-sm p-3 lg:p-4">
          <h3 className="font-semibold text-gray-900 mb-2 lg:mb-3">Método de Pago</h3>

          {/* Opciones principales en grid 2x2 */}
          <div className="grid grid-cols-2 gap-1.5 lg:gap-2 mb-2">
            <label className={`flex items-center gap-1.5 lg:gap-2 p-2 lg:p-2.5 border-2 rounded-lg cursor-pointer transition-colors ${paymentMethod === 'cash' ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:bg-gray-50'}`}>
              <input
                type="radio"
                name="paymentMethod"
                value="cash"
                checked={paymentMethod === 'cash'}
                onChange={() => setPaymentMethod('cash')}
                className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-green-600"
              />
              <DollarSign className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-green-600" />
              <span className="text-xs lg:text-sm font-medium">Efectivo</span>
            </label>

            <label className={`flex items-center gap-1.5 lg:gap-2 p-2 lg:p-2.5 border-2 rounded-lg cursor-pointer transition-colors ${paymentMethod === 'transfer' ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:bg-gray-50'}`}>
              <input
                type="radio"
                name="paymentMethod"
                value="transfer"
                checked={paymentMethod === 'transfer'}
                onChange={() => setPaymentMethod('transfer')}
                className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-purple-600"
              />
              <Smartphone className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-purple-600" />
              <span className="text-xs lg:text-sm font-medium">Transfer</span>
            </label>

            <label className={`flex items-center gap-1.5 lg:gap-2 p-2 lg:p-2.5 border-2 rounded-lg cursor-pointer transition-colors ${paymentMethod === 'mixed' ? 'border-orange-500 bg-orange-50' : 'border-gray-200 hover:bg-gray-50'}`}>
              <input
                type="radio"
                name="paymentMethod"
                value="mixed"
                checked={paymentMethod === 'mixed'}
                onChange={() => setPaymentMethod('mixed')}
                className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-orange-600"
              />
              <div className="flex -space-x-1">
                <DollarSign className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-green-600" />
                <Smartphone className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-purple-600" />
              </div>
              <span className="text-xs lg:text-sm font-medium">Mixto</span>
            </label>

            <label className="flex items-center gap-1.5 lg:gap-2 p-2 lg:p-2.5 border-2 border-gray-200 rounded-lg cursor-not-allowed opacity-40">
              <input
                type="radio"
                name="paymentMethod"
                value="card"
                disabled
                className="w-3.5 h-3.5 lg:w-4 lg:h-4"
              />
              <CreditCard className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-blue-600" />
              <span className="text-xs lg:text-sm font-medium text-gray-500">Tarjeta</span>
            </label>
          </div>

          {/* Debe / Fiado */}
          <label className={`flex items-center gap-1.5 lg:gap-2 p-2 lg:p-2.5 border-2 rounded-lg cursor-pointer transition-colors mb-2 ${paymentMethod === 'debe' ? 'border-amber-500 bg-amber-50' : 'border-gray-200 hover:bg-gray-50'}`}>
            <input
              type="radio"
              name="paymentMethod"
              value="debe"
              checked={paymentMethod === 'debe'}
              onChange={() => setPaymentMethod('debe')}
              className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-amber-600"
            />
            <Clock className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-amber-600" />
            <span className="text-xs lg:text-sm font-medium">Debe (fiado)</span>
          </label>

          {paymentMethod === 'debe' && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 lg:p-3 mb-2 space-y-2">
              <p className="text-xs lg:text-sm text-amber-800">
                Venta a crédito: elige/registra el cliente que queda debiendo. Se cobra después desde "Fiados".
              </p>
              <div>
                <label className="block text-xs font-medium text-amber-900 mb-1">Abono ahora (opcional)</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={abonoAmount}
                    onChange={(e) => setAbonoAmount(e.target.value)}
                    placeholder="0"
                    min="0"
                    max={total}
                    className="flex-1 px-3 py-2 border border-amber-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500"
                  />
                  <select
                    value={abonoMethod}
                    onChange={(e) => setAbonoMethod(e.target.value as 'cash' | 'transfer')}
                    className="px-2 py-2 border border-amber-300 rounded-lg text-sm bg-white"
                  >
                    <option value="cash">Efectivo</option>
                    <option value="transfer">Transfer</option>
                  </select>
                </div>
                {parseFloat(abonoAmount || '0') > 0 && (
                  <p className="text-xs text-amber-800 mt-1">
                    Queda debiendo:{' '}
                    <strong>${Math.max(0, total - parseFloat(abonoAmount || '0')).toLocaleString()}</strong>
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Info del método bloqueado - Hidden on mobile */}
          <p className="hidden lg:block text-xs text-gray-400 text-center mb-3">
            Tarjeta disponible próximamente con integración de datáfono
          </p>

          {/* Payment Inputs */}
          {paymentMethod === 'cash' && (
            <div className="space-y-2 lg:space-y-3 mt-2 lg:mt-0">
              <div>
                <label className="block text-xs lg:text-sm font-medium text-gray-700 mb-1">
                  Monto Recibido
                </label>
                <input
                  type="number"
                  value={cashAmount}
                  onChange={(e) => setCashAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
                  step="0.01"
                  min="0"
                />
              </div>
              {parseFloat(cashAmount || '0') > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-2 lg:p-3">
                  <p className="text-xs lg:text-sm text-gray-600">Cambio:</p>
                  <p className="text-xl lg:text-2xl font-bold text-green-600">
                    ${change.toLocaleString()}
                  </p>
                </div>
              )}
            </div>
          )}

          {paymentMethod === 'mixed' && (
            <div className="space-y-2 lg:space-y-3 mt-2 lg:mt-0">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs lg:text-sm font-medium text-gray-700 mb-1">
                    Efectivo
                  </label>
                  <input
                    type="number"
                    value={cashAmount}
                    onChange={(e) => setCashAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
                    step="0.01"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-xs lg:text-sm font-medium text-gray-700 mb-1">
                    Transfer
                  </label>
                  <input
                    type="number"
                    value={cardAmount}
                    onChange={(e) => setCardAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-base"
                    step="0.01"
                    min="0"
                  />
                </div>
              </div>
              {(parseFloat(cashAmount || '0') > 0 || parseFloat(cardAmount || '0') > 0) && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-2 lg:p-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-xs lg:text-sm text-gray-600">Total Pagado:</p>
                      <p className="text-lg lg:text-xl font-bold text-purple-600">
                        ${(parseFloat(cashAmount || '0') + parseFloat(cardAmount || '0')).toLocaleString()}
                      </p>
                    </div>
                    {change > 0 && (
                      <div className="text-right">
                        <p className="text-xs lg:text-sm text-gray-600">Cambio:</p>
                        <p className="text-lg lg:text-xl font-bold text-green-600">
                          ${change.toLocaleString()}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="space-y-2 lg:space-y-3">
          <button
            onClick={handleOpenCheckout}
            disabled={cart.length === 0 || isProcessingSale}
            className="w-full py-3 lg:py-4 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-base lg:text-lg flex items-center justify-center gap-2"
          >
            {isProcessingSale ? (
              'Procesando...'
            ) : (
              <>
                <DollarSign className="w-5 h-5 lg:w-6 lg:h-6" />
                <span className="lg:hidden">COBRAR</span>
                <span className="hidden lg:inline">COBRAR (F12)</span>
              </>
            )}
          </button>

          <button
            onClick={clearCart}
            disabled={cart.length === 0}
            className="w-full py-2.5 lg:py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2"
          >
            <Trash2 className="w-4 h-4 lg:w-5 lg:h-5" />
            Cancelar Venta
          </button>
        </div>

        {/* Shortcuts Help - Hidden on mobile */}
        <div className="hidden lg:block bg-gray-50 rounded-lg p-3 text-xs text-gray-600">
          <p className="font-semibold mb-2">Atajos de Teclado:</p>
          <div className="space-y-1">
            <p><kbd className="px-2 py-1 bg-white border rounded">F9</kbd> Descuento</p>
            <p><kbd className="px-2 py-1 bg-white border rounded">F12</kbd> Cobrar</p>
            <p><kbd className="px-2 py-1 bg-white border rounded">ESC</kbd> Cancelar</p>
          </div>
        </div>
      </div>

      {/* Discount Modal */}
      {showDiscountModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Aplicar Descuento</h2>
            </div>

            <div className="p-6">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Monto del Descuento
                </label>
                <input
                  type="number"
                  value={discountInput}
                  onChange={(e) => setDiscountInput(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
                  step="0.01"
                  min="0"
                  max={subtotal}
                  autoFocus
                />
                <p className="text-sm text-gray-500 mt-2">
                  Subtotal: ${subtotal.toLocaleString()}
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowDiscountModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleApplyDiscount}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Aplicar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Checkout Modal (unified flow) */}
      <CheckoutModal
        isOpen={showCheckoutModal}
        onClose={handleCloseCheckout}
        onConfirm={handleProcessSale}
        total={total}
        paymentMethod={paymentMethod}
        initialCustomer={selectedCustomer}
        taxRate={settings.payment?.taxRate || 19}
      />

      {/* Zone Selection Modal */}
      {selectedTemplate && (
        <ZoneSelectionModal
          template={selectedTemplate}
          onConfirm={handleZoneSelectionConfirm}
          onCancel={() => setSelectedTemplate(null)}
        />
      )}

      {/* Product Info Modal (Out of Stock) */}
      {productInfoModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 bg-red-50">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-red-800">Producto Sin Stock</h2>
                <button
                  onClick={() => {
                    setProductInfoModal(null);
                    barcodeInputRef.current?.focus();
                  }}
                  className="text-red-600 hover:text-red-700"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6">
              {/* Product Image */}
              {productInfoModal.image && (
                <div className="mb-4 flex justify-center">
                  <img
                    src={productInfoModal.image}
                    alt={productInfoModal.name}
                    className="w-48 h-48 object-cover rounded-lg border-2 border-gray-200"
                  />
                </div>
              )}

              {/* Product Info */}
              <div className="space-y-3">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">
                    {productInfoModal.name}
                  </h3>
                  <p className="text-gray-600">
                    {productInfoModal.color} - {productInfoModal.size}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-gray-50 p-3 rounded">
                    <p className="text-gray-500 mb-1">SKU</p>
                    <p className="font-mono font-medium text-gray-900">{productInfoModal.sku}</p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded">
                    <p className="text-gray-500 mb-1">Código de Barras</p>
                    <p className="font-mono font-medium text-gray-900">{productInfoModal.barcode}</p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded">
                    <p className="text-gray-500 mb-1">Precio</p>
                    <p className="text-lg font-bold text-gray-900">
                      ${productInfoModal.price.toLocaleString()}
                    </p>
                  </div>
                  <div className="bg-red-50 p-3 rounded border border-red-200">
                    <p className="text-red-600 mb-1 font-medium">Stock</p>
                    <p className="text-lg font-bold text-red-700">
                      {productInfoModal.stock}
                    </p>
                  </div>
                </div>

                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mt-4">
                  <p className="text-red-800 font-medium text-center">
                    ⚠️ Este producto no tiene stock disponible
                  </p>
                </div>
              </div>

              {/* Action Button */}
              <div className="mt-6">
                <button
                  onClick={() => {
                    setProductInfoModal(null);
                    barcodeInputRef.current?.focus();
                  }}
                  className="w-full px-4 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-medium"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Barcode Scanner Modal (Mobile) */}
      <BarcodeScanner
        isOpen={showBarcodeScanner}
        onClose={() => setShowBarcodeScanner(false)}
        onScan={handleCameraScan}
      />

    </div>
  );
}
