import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { usePOS } from '../../context/POSContext';
import { useToast } from '../../context/ToastContext';
import { useSettings } from '../../context/SettingsContext';
import * as posService from '../../services/pos.service';
import type { SearchResult, TemplateSearchResult, ProductSearchResult, TemplateZoneInfo, PosVariant } from '../../services/pos.service';
import { VariantSelectModal } from '../../components/pos/VariantSelectModal';
import { catalogsService, type Category } from '../../services/catalogs.service';
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
  Percent,
  X,
  Barcode as BarcodeIcon,
  Smartphone,
  Camera,
  Package,
  Loader2,
  Clock,
  Info,
  AlertTriangle,
  Pencil,
} from 'lucide-react';

// Cliente por defecto (consumidor final): siempre hay un cliente seleccionado
// para poder cobrar. El cajero puede cambiarlo o crear otro.
const DEFAULT_CUSTOMER: SelectedCustomer = { name: 'Consumidor Final' };

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
    isLoadingSession,
    editingSaleId,
    loadSaleForEditing,
    cancelEditing,
  } = usePOS();

  const { showToast } = useToast();
  const { settings } = useSettings();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const editParam = searchParams.get('edit');
  const editLoadedRef = useRef(false);
  // Datos de transacción (transferencia/tarjeta) de la venta que se edita.
  const [editTxn, setEditTxn] = useState<{ reference: string; type: string; lastFour: string } | null>(null);

  // Cargar una venta para editar cuando se entra con ?edit=<id>
  useEffect(() => {
    if (!editParam || editLoadedRef.current) return;
    editLoadedRef.current = true;
    (async () => {
      try {
        const sale = await posService.getSaleDetail(Number(editParam));
        loadSaleForEditing(sale);
        if (sale.posCustomer || sale.customerName) {
          setSelectedCustomer({
            id: sale.posCustomer?.id,
            name: sale.posCustomer?.name || sale.customerName || 'Consumidor Final',
            cedula: sale.posCustomer?.cedula ?? null,
            phone: sale.posCustomer?.phone ?? sale.customerPhone ?? null,
            email: sale.posCustomer?.email ?? sale.customerEmail ?? null,
          });
        }
        if (['cash', 'card', 'transfer', 'mixed', 'debe'].includes(sale.paymentMethod)) {
          setPaymentMethod(sale.paymentMethod as typeof paymentMethod);
        }
        // Precargar datos de transacción y montos de la venta.
        setEditTxn({
          reference: sale.cardReference || '',
          type: sale.cardType || '',
          lastFour: sale.cardLastFour || '',
        });
        if (sale.cashAmount) setCashAmount(String(sale.cashAmount));
        if (sale.cardAmount) setCardAmount(String(sale.cardAmount));
        showToast(`Editando venta ${sale.orderNumber}`, 'info');
      } catch (error) {
        console.error('Error cargando la venta a editar:', error);
        showToast('No se pudo cargar la venta para editar', 'error');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editParam]);

  // Salir del modo edición y volver al historial.
  const exitEditing = () => {
    cancelEditing();
    setSelectedCustomer(DEFAULT_CUSTOMER);
    navigate('/pos/history');
  };

  // Scanner input
  const [barcodeInput, setBarcodeInput] = useState('');
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Search state
  const [isSearching, setIsSearching] = useState(false);

  // Template zone selection
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateSearchResult | null>(null);
  const [variantModal, setVariantModal] = useState<{ name: string; variants: PosVariant[] } | null>(null);

  // Payment state
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'transfer' | 'mixed' | 'debe'>('cash');
  const [selectedCustomer, setSelectedCustomer] = useState<SelectedCustomer | null>(DEFAULT_CUSTOMER);
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

  // Catálogo de productos (scroll infinito + búsqueda)
  const [browseItems, setBrowseItems] = useState<SearchResult[]>([]);
  const [browsePage, setBrowsePage] = useState(0);
  const [browseTotalPages, setBrowseTotalPages] = useState(1);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [browseSearch, setBrowseSearch] = useState('');
  const [browseCategory, setBrowseCategory] = useState<number | null>(null);
  const [browseType, setBrowseType] = useState<'product' | 'template'>('product');
  const [browseTotal, setBrowseTotal] = useState(0);
  const [categories, setCategories] = useState<Category[]>([]);

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
        basePrice: productResult.basePrice ?? productResult.price,
        hasDiscount: productResult.hasDiscount ?? false,
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

  // Click en una tarjeta del grid: si el producto tiene variantes (color/talla),
  // abre el selector; si no, lo agrega directo (o la plantilla a su modal).
  const handleTileClick = async (item: SearchResult) => {
    if (item.type === 'product' && (item as ProductSearchResult).hasOptions) {
      const p = item as ProductSearchResult;
      try {
        const variants = await posService.getProductVariants(p.productId);
        if (variants.length <= 1) {
          handleSelectSearchResult(item);
          return;
        }
        setVariantModal({ name: p.name, variants });
      } catch {
        showToast('No se pudieron cargar las variantes', 'error');
      }
      return;
    }
    handleSelectSearchResult(item);
  };

  // Agrega al carrito la variante elegida en el modal.
  const addVariantToCart = (v: PosVariant) => {
    if (v.stock <= 0) {
      showToast('Sin stock', 'error');
      return;
    }
    addToCart(
      {
        variantId: v.variantId,
        product: { id: v.productId, name: v.name, image: v.image || '' },
        color: v.colorName || 'N/A',
        size: v.size || 'N/A',
        sku: v.sku,
        barcode: v.barcode,
        price: v.price,
        basePrice: v.basePrice,
        hasDiscount: v.hasDiscount,
        stock: v.stock,
        available: v.available,
      },
      1
    );
    setVariantModal(null);
  };

  // Catálogo: trae una página (término, categoría y tipo producto/plantilla).
  const fetchProducts = async (page: number, term: string, categoryId: number | null, type: 'product' | 'template' = browseType) => {
    if (browseLoading) return;
    setBrowseLoading(true);
    try {
      const res = await posService.browseProducts(page, 12, term, categoryId, type);
      setBrowseItems((prev) => (page === 1 ? res.results : [...prev, ...res.results]));
      setBrowsePage(res.page);
      setBrowseTotalPages(res.totalPages);
      setBrowseTotal(res.total);
    } catch {
      showToast('Error al cargar el catálogo de productos', 'error');
    } finally {
      setBrowseLoading(false);
    }
  };

  // Ejecuta una búsqueda en el catálogo: lo abre y recarga desde la página 1.
  const runCatalogSearch = (term: string, categoryId: number | null = browseCategory, type: 'product' | 'template' = browseType) => {
    setBrowseSearch(term);
    setBrowseCategory(categoryId);
    setBrowseItems([]);
    setBrowsePage(0);
    setBrowseTotalPages(1);
    fetchProducts(1, term, categoryId, type);
  };

  // Alterna entre productos de catálogo y plantillas.
  const selectBrowseType = (type: 'product' | 'template') => {
    setBrowseType(type);
    runCatalogSearch(browseSearch, browseCategory, type);
  };

  // Limpia el filtro de búsqueda del catálogo y recarga todo.
  const clearCatalogSearch = () => {
    runCatalogSearch('');
  };

  // Seleccionar una categoría (chip). null = todas.
  const selectCategory = (categoryId: number | null) => {
    runCatalogSearch(browseSearch, categoryId);
  };

  // Carga inicial del catálogo + categorías al entrar al POS.
  useEffect(() => {
    runCatalogSearch('');
    catalogsService.getCategories().then(setCategories).catch(() => setCategories([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Al hacer scroll cerca del fondo, cargar más productos.
  const handleProductsScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 80) {
      if (!browseLoading && browsePage < browseTotalPages) {
        fetchProducts(browsePage + 1, browseSearch, browseCategory, browseType);
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

  // Abrir el checkout ya seleccionando el método de pago.
  const openCheckoutWith = (method: 'cash' | 'transfer' | 'mixed' | 'debe') => {
    if (cart.length === 0) {
      showToast('El carrito está vacío', 'error');
      return;
    }
    setPaymentMethod(method);
    setCashAmount('');
    setCardAmount('');
    setAbonoAmount('');
    setShowCheckoutModal(true);
  };

  // Close checkout modal and reset
  const handleCloseCheckout = () => {
    setShowCheckoutModal(false);
    setCashAmount('');
    setCardAmount('');
    setPaymentMethod('cash');
    setSelectedCustomer(DEFAULT_CUSTOMER);
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
        return;
      }
      if (e.key === 'F12') {
        e.preventDefault();
        openCheckoutWith('cash');
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        if (showDiscountModal) {
          setShowDiscountModal(false);
        }
        if (showCheckoutModal) {
          setShowCheckoutModal(false);
        }
        return;
      }

      // Atajos numéricos: solo si no se está escribiendo y no hay modales abiertos.
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (showDiscountModal || showCheckoutModal) return;

      if (e.key === '1') {
        e.preventDefault();
        openCheckoutWith('cash');
      } else if (e.key === '2') {
        e.preventDefault();
        openCheckoutWith('transfer');
      } else if (e.key === '3') {
        e.preventDefault();
        openCheckoutWith('mixed');
      } else if (e.key === '4') {
        e.preventDefault();
        openCheckoutWith('debe');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showDiscountModal, showCheckoutModal, cart, cashAmount, cardAmount, paymentMethod, total]);

  // Esperar la validación de sesión para no mostrar un falso "Sin Sesión".
  if (isLoadingSession) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-gray-500">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-500 mb-3" />
        <p className="text-sm">Validando sesión de caja…</p>
      </div>
    );
  }

  if (!currentSession) {
    return (
      <OpenSessionPrompt
        title="Sin Sesion de Caja"
        message="Abre una sesion de caja para comenzar a vender"
      />
    );
  }

  // Si la caja tiene categorías asignadas, los chips solo muestran esas.
  const cajaCatIds = currentSession?.cashRegister?.categoryIds;
  const visibleCategories = Array.isArray(cajaCatIds) && cajaCatIds.length > 0
    ? categories.filter((c) => cajaCatIds.includes(c.id))
    : categories;

  return (
    <div className="lg:h-full flex flex-col gap-3">
      {/* Banner de edición de venta */}
      {editingSaleId && (
        <div className="flex items-center justify-between gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 flex-shrink-0">
          <div className="flex items-center gap-2 text-amber-800 text-sm">
            <Pencil className="w-4 h-4 flex-shrink-0" />
            <span>Estás <strong>editando una venta</strong>. Al confirmar se <strong>actualiza</strong> (no se crea una nueva).</span>
          </div>
          <button
            onClick={exitEditing}
            className="text-sm font-medium text-amber-700 hover:text-amber-900 underline whitespace-nowrap"
          >
            Cancelar edición
          </button>
        </div>
      )}

      <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-4">
      {/* Left Column - Productos */}
      <div className="flex-1 flex flex-col min-h-0 lg:max-h-none gap-3 lg:gap-4">
        {/* Cliente (sin label: el buscador/selector ya es explícito) */}
        <div className="bg-white rounded-lg shadow-sm p-2.5 lg:p-3">
          <CustomerSelect value={selectedCustomer} onChange={(c) => setSelectedCustomer(c ?? DEFAULT_CUSTOMER)} />
        </div>

        {/* Catálogo de productos (acordeón con scroll infinito + búsqueda) */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden flex-1 flex flex-col min-h-0">
          {/* Buscador / escáner dentro de la card */}
          <div className="p-3 border-b border-gray-200">
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

          {/* Chips de categoría (izquierda) + alternar Productos/Plantillas (derecha) */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 bg-gray-50/60">
            <div className="flex gap-1.5 overflow-x-auto flex-1 min-w-0">
              {visibleCategories.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={() => selectCategory(null)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                      browseCategory === null ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    Todas
                  </button>
                  {visibleCategories.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => selectCategory(cat.id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                        browseCategory === cat.id ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      {cat.name}
                    </button>
                  ))}
                </>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="flex items-center bg-white border border-gray-200 rounded-full p-0.5">
                <button
                  type="button"
                  onClick={() => selectBrowseType('product')}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${browseType === 'product' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                  Productos
                </button>
                <button
                  type="button"
                  onClick={() => selectBrowseType('template')}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${browseType === 'template' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                  Plantillas
                </button>
              </div>
              <span className="text-xs text-gray-500 whitespace-nowrap">
                {browseType === 'product' ? 'Productos' : 'Plantillas'} ({browseTotal})
              </span>
            </div>
          </div>

          {/* Barra de filtro fina: solo cuando hay una búsqueda activa */}
          {browseSearch && (
            <div className="px-3 py-1.5 flex items-center justify-between text-xs border-b border-gray-100 bg-gray-50">
              <span className="text-blue-600 truncate">Filtro: "{browseSearch}" ({browseItems.length})</span>
              <button
                type="button"
                onClick={clearCatalogSearch}
                className="text-gray-500 hover:text-red-600 flex items-center gap-0.5 flex-shrink-0"
                title="Quitar filtro"
              >
                <X className="w-3.5 h-3.5" />
                Limpiar
              </button>
            </div>
          )}

          <div
            onScroll={handleProductsScroll}
            className="flex-1 min-h-0 overflow-y-auto p-3 max-h-[60vh] lg:max-h-none"
          >
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                {browseItems.map((item, index) => {
                  const isProduct = item.type === 'product';
                  const prod = isProduct ? (item as ProductSearchResult) : null;
                  const price = isProduct
                    ? (item as ProductSearchResult).price
                    : Number((item as TemplateSearchResult).basePrice);
                  const onSale = !!(prod?.hasDiscount && prod.basePrice && prod.basePrice > price);
                  const offPct = onSale ? Math.round((1 - price / (prod!.basePrice as number)) * 100) : 0;
                  const stock = isProduct ? prod!.stock : null;
                  return (
                    <button
                      key={index}
                      type="button"
                      onClick={() => handleTileClick(item)}
                      className="group relative text-left bg-white border border-gray-200 rounded-xl overflow-hidden hover:border-blue-400 hover:shadow-md transition-all"
                    >
                      {/* Imagen cuadrada */}
                      <div className="relative aspect-square bg-gray-100 overflow-hidden">
                        {item.image ? (
                          <img
                            src={item.image}
                            alt={item.name}
                            loading="lazy"
                            className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package className="w-10 h-10 text-gray-300" />
                          </div>
                        )}
                        {/* Badges sobre la imagen */}
                        {onSale ? (
                          <span className="absolute top-1.5 left-1.5 bg-emerald-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md shadow">
                            -{offPct}%
                          </span>
                        ) : !isProduct ? (
                          <span className="absolute top-1.5 left-1.5 bg-purple-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md shadow">
                            Plantilla
                          </span>
                        ) : null}
                        {isProduct && (
                          <span className={`absolute top-1.5 right-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-md shadow ${
                            (stock ?? 0) > 0 ? 'bg-white/90 text-gray-700' : 'bg-red-600 text-white'
                          }`}>
                            {(stock ?? 0) > 0 ? `Stock ${stock}` : 'Agotado'}
                          </span>
                        )}
                      </div>
                      {/* Info */}
                      <div className="p-2">
                        <p className="text-xs lg:text-sm font-medium text-gray-900 leading-tight line-clamp-2 min-h-[2.1em]">
                          {item.name}
                        </p>
                        <div className="flex items-baseline gap-1.5 mt-1">
                          <span className={`text-sm lg:text-base font-bold ${onSale ? 'text-emerald-600' : isProduct ? 'text-gray-900' : 'text-purple-600'}`}>
                            ${price.toLocaleString()}
                          </span>
                          {onSale && (
                            <span className="text-[10px] text-gray-400 line-through">
                              ${(prod!.basePrice as number).toLocaleString()}
                            </span>
                          )}
                        </div>
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
        </div>

      </div>

      {/* Right Column - Payment */}
      <div className="w-full lg:w-96 flex flex-col gap-3 lg:gap-4">
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

          <div className="flex-1 overflow-y-auto min-h-0">
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
                              <>
                                {((item.color && item.color !== 'N/A') || (item.size && item.size !== 'N/A')) ? (
                                  <p className="text-xs lg:text-sm text-gray-500 truncate">
                                    {[item.color, item.size].filter((x) => x && x !== 'N/A').join(' - ')}
                                  </p>
                                ) : null}
                                {item.hasDiscount && (item.basePrice ?? 0) > item.price ? (
                                  <p className="text-xs mt-0.5">
                                    <span className="text-gray-400 line-through">${(item.basePrice as number).toLocaleString()}</span>{' '}
                                    <span className="text-emerald-600 font-semibold">${item.price.toLocaleString()} c/u</span>
                                  </p>
                                ) : null}
                              </>
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

          {/* Totals (footer, no-scroll) */}
          <div className="border-t border-gray-200 p-3 lg:p-4">
          <div className="space-y-1 lg:space-y-2">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal:</span>
              <span>${subtotal.toLocaleString()}</span>
            </div>

            {(() => {
              const offerSavings = cart.reduce((s, it) => {
                if (it.itemType === 'product' && it.hasDiscount && (it.basePrice ?? 0) > it.price) {
                  return s + ((it.basePrice as number) - it.price) * it.quantity;
                }
                return s;
              }, 0);
              return offerSavings > 0 ? (
                <div className="flex justify-between text-emerald-600">
                  <span>Ahorro en ofertas:</span>
                  <span>-${offerSavings.toLocaleString()}</span>
                </div>
              ) : null;
            })()}

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
        </div>

        {/* Action Buttons - Cobrar con método */}
        <div className="space-y-2 lg:space-y-3">
          <div className="bg-white rounded-lg shadow-sm p-3 lg:p-4">
            <div className="flex items-center justify-between mb-2 lg:mb-3">
              <h3 className="font-semibold text-gray-900">Cobrar con:</h3>
              <div className="relative group">
                <Info className="w-4 h-4 text-gray-400 cursor-help" />
                <div className="absolute right-0 top-6 z-20 hidden group-hover:block bg-gray-900 text-white text-xs rounded-lg p-3 w-52 shadow-xl">
                  <p className="font-semibold mb-1.5">Atajos de teclado</p>
                  <div className="space-y-1 text-gray-200">
                    <p><kbd className="px-1.5 py-0.5 bg-white/15 rounded">1</kbd> Efectivo · <kbd className="px-1.5 py-0.5 bg-white/15 rounded">2</kbd> Transfer</p>
                    <p><kbd className="px-1.5 py-0.5 bg-white/15 rounded">3</kbd> Mixto · <kbd className="px-1.5 py-0.5 bg-white/15 rounded">4</kbd> Debe</p>
                    <p><kbd className="px-1.5 py-0.5 bg-white/15 rounded">F9</kbd> Descuento · <kbd className="px-1.5 py-0.5 bg-white/15 rounded">F12</kbd> Efectivo</p>
                    <p><kbd className="px-1.5 py-0.5 bg-white/15 rounded">ESC</kbd> Cerrar</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => openCheckoutWith('cash')}
                disabled={cart.length === 0 || isProcessingSale}
                className="relative flex items-center justify-center gap-2 py-3 border-2 border-green-200 rounded-lg hover:border-green-500 hover:bg-green-50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-green-200 disabled:hover:bg-transparent transition-colors"
              >
                <DollarSign className="w-5 h-5 text-green-600" />
                <span className="text-sm font-medium text-gray-900">Efectivo</span>
                <span className="absolute top-1 right-1 px-1.5 py-0.5 bg-gray-100 text-gray-500 text-[10px] font-bold rounded">1</span>
              </button>

              <button
                onClick={() => openCheckoutWith('transfer')}
                disabled={cart.length === 0 || isProcessingSale}
                className="relative flex items-center justify-center gap-2 py-3 border-2 border-purple-200 rounded-lg hover:border-purple-500 hover:bg-purple-50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-purple-200 disabled:hover:bg-transparent transition-colors"
              >
                <Smartphone className="w-5 h-5 text-purple-600" />
                <span className="text-sm font-medium text-gray-900">Transfer</span>
                <span className="absolute top-1 right-1 px-1.5 py-0.5 bg-gray-100 text-gray-500 text-[10px] font-bold rounded">2</span>
              </button>

              <button
                onClick={() => openCheckoutWith('mixed')}
                disabled={cart.length === 0 || isProcessingSale}
                className="relative flex items-center justify-center gap-2 py-3 border-2 border-orange-200 rounded-lg hover:border-orange-500 hover:bg-orange-50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-orange-200 disabled:hover:bg-transparent transition-colors"
              >
                <div className="flex -space-x-1">
                  <DollarSign className="w-4 h-4 text-green-600" />
                  <Smartphone className="w-4 h-4 text-purple-600" />
                </div>
                <span className="text-sm font-medium text-gray-900">Mixto</span>
                <span className="absolute top-1 right-1 px-1.5 py-0.5 bg-gray-100 text-gray-500 text-[10px] font-bold rounded">3</span>
              </button>

              <button
                onClick={() => openCheckoutWith('debe')}
                disabled={cart.length === 0 || isProcessingSale}
                className="relative flex items-center justify-center gap-2 py-3 border-2 border-amber-200 rounded-lg hover:border-amber-500 hover:bg-amber-50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-amber-200 disabled:hover:bg-transparent transition-colors"
              >
                <Clock className="w-5 h-5 text-amber-600" />
                <span className="text-sm font-medium text-gray-900">Debe</span>
                <span className="absolute top-1 right-1 px-1.5 py-0.5 bg-gray-100 text-gray-500 text-[10px] font-bold rounded">4</span>
              </button>
            </div>
            {isProcessingSale && (
              <p className="text-center text-sm text-gray-500 mt-2">Procesando...</p>
            )}
          </div>

          <button
            onClick={clearCart}
            disabled={cart.length === 0}
            className="w-full py-2.5 lg:py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2"
          >
            <Trash2 className="w-4 h-4 lg:w-5 lg:h-5" />
            Cancelar Venta
          </button>
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
        onCustomerChange={(c) => setSelectedCustomer(c ?? DEFAULT_CUSTOMER)}
        abono={paymentMethod === 'debe' ? parseFloat(abonoAmount || '0') : 0}
        taxRate={settings.payment?.taxRate || 19}
        subtotal={subtotal}
        discount={discount}
        itemCount={cart.length}
        cashAmount={cashAmount}
        onCashAmountChange={setCashAmount}
        cardAmount={cardAmount}
        onCardAmountChange={setCardAmount}
        abonoAmount={abonoAmount}
        onAbonoAmountChange={setAbonoAmount}
        abonoMethod={abonoMethod}
        onAbonoMethodChange={setAbonoMethod}
        initialCardReference={editTxn?.reference}
        initialCardType={editTxn?.type}
        initialCardLastFour={editTxn?.lastFour}
      />

      {/* Zone Selection Modal */}
      {selectedTemplate && (
        <ZoneSelectionModal
          template={selectedTemplate}
          onConfirm={handleZoneSelectionConfirm}
          onCancel={() => setSelectedTemplate(null)}
        />
      )}

      {variantModal && (
        <VariantSelectModal
          productName={variantModal.name}
          variants={variantModal.variants}
          onSelect={addVariantToCart}
          onClose={() => setVariantModal(null)}
        />
      )}

      {/* Product Info Modal (Out of Stock) */}
      {productInfoModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full overflow-hidden">
            {/* Encabezado: imagen + nombre lado a lado */}
            <div className="flex items-start gap-3 p-4 border-b border-gray-100">
              <div className="w-16 h-16 flex-shrink-0 rounded-lg border border-gray-200 bg-gray-50 overflow-hidden flex items-center justify-center">
                {productInfoModal.image ? (
                  <img
                    src={productInfoModal.image}
                    alt={productInfoModal.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Package className="w-7 h-7 text-gray-300" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-semibold text-gray-900 leading-tight truncate">
                  {productInfoModal.name}
                </h3>
                {(productInfoModal.color || productInfoModal.size) && (
                  <p className="text-xs text-gray-500 mt-0.5 truncate">
                    {[productInfoModal.color, productInfoModal.size].filter(Boolean).join(' · ')}
                  </p>
                )}
                <p className="text-lg font-bold text-gray-900 mt-1">
                  ${productInfoModal.price.toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => {
                  setProductInfoModal(null);
                  barcodeInputRef.current?.focus();
                }}
                className="text-gray-400 hover:text-gray-600 -mt-1 -mr-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Datos compactos */}
            <div className="px-4 py-3 space-y-2 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-gray-500">SKU</span>
                <span className="font-mono text-gray-900 truncate">{productInfoModal.sku}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-gray-500">Código de barras</span>
                <span className="font-mono text-gray-900 truncate">{productInfoModal.barcode || '—'}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-gray-500">Stock</span>
                <span className="font-semibold text-red-600">{productInfoModal.stock}</span>
              </div>
            </div>

            {/* Aviso + acción */}
            <div className="px-4 pb-4 pt-1">
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
                <p className="text-xs text-red-800 font-medium">Sin stock disponible para vender</p>
              </div>
              <button
                onClick={() => {
                  setProductInfoModal(null);
                  barcodeInputRef.current?.focus();
                }}
                className="w-full px-4 py-2.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 text-sm font-medium"
              >
                Entendido
              </button>
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
