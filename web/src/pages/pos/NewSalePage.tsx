import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { usePOS } from '../../context/POSContext';
import { useToast } from '../../context/ToastContext';
import { useSettings } from '../../context/SettingsContext';
import * as posService from '../../services/pos.service';
import type { SearchResult, TemplateSearchResult, ProductSearchResult, TemplateZoneInfo, PosVariant } from '../../services/pos.service';
import { VariantSelectModal } from '../../components/pos/VariantSelectModal';
import { catalogsService } from '../../services/catalogs.service';
import type { Category } from '../../types/catalog';
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
  Pencil,
  Shuffle,
} from 'lucide-react';
import { Alert, Button, Dialog, EmptyState, Field, MoneyInput, RadioGroup, Spinner, Thumb } from '../../components/ui';

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
    barcode: string | null;
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
          setSelectedTemplate(result.result as unknown as TemplateSearchResult);
        }
        setBarcodeInput('');
      } else {
        // No es un código de barras exacto: filtrar el catálogo de productos.
        runCatalogSearch(barcodeInput.trim());
        setBarcodeInput('');
      }
    } catch (error: any) {
      console.error('Error searching:', error);
      showToast(error?.message || 'Error al buscar', 'error');
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
        sku: v.sku ?? '',
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
      showToast(error?.message || 'Error al buscar', 'error');
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
    return <Spinner label="Validando sesión de caja…" className="py-24" />;
  }

  if (!currentSession) {
    return (
      <div className="p-4 md:p-6">
        <OpenSessionPrompt
          title="Sin sesión de caja"
          message="Abre una sesión de caja para comenzar a vender"
        />
      </div>
    );
  }

  // Si la caja tiene categorías asignadas, los chips solo muestran esas.
  const cajaCatIds = currentSession?.cashRegister?.categoryIds;
  const visibleCategories = Array.isArray(cajaCatIds) && cajaCatIds.length > 0
    ? categories.filter((c) => cajaCatIds.includes(c.id))
    : categories;

  const offerSavings = cart.reduce((acc, it) => {
    if (it.itemType === 'product' && it.hasDiscount && (it.basePrice ?? 0) > it.price) {
      return acc + ((it.basePrice as number) - it.price) * it.quantity;
    }
    return acc;
  }, 0);

  const closeProductInfo = () => {
    setProductInfoModal(null);
    barcodeInputRef.current?.focus();
  };

  const chip = (active: boolean) =>
    `h-9 px-3.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors border ${
      active ? 'bg-app-600 border-app-600 text-white' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900'
    }`;

  const payDisabled = cart.length === 0 || isProcessingSale;

  return (
    <div className="p-3 md:p-4 lg:h-full flex flex-col gap-3">
      {/* Aviso de edición de venta */}
      {editingSaleId && (
        <div className="flex-shrink-0">
          <Alert
            tone="warning"
            action={<Button variant="secondary" size="sm" onClick={exitEditing}>Cancelar edición</Button>}
          >
            <span className="inline-flex items-center gap-1.5"><Pencil className="w-4 h-4" /> Estás <strong>editando una venta</strong>. Al confirmar se <strong>actualiza</strong> (no se crea una nueva).</span>
          </Alert>
        </div>
      )}

      <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-3">
        {/* Columna izquierda: cliente, buscador y catálogo */}
        <div className="flex-1 min-w-0 flex flex-col min-h-0 gap-3">
          {/* Barra de trabajo: cliente + escáner / buscador */}
          <div className="bg-white rounded-xl border border-gray-200 p-3 flex flex-col xl:flex-row gap-2">
            <div className="xl:w-80 flex-shrink-0">
              <CustomerSelect value={selectedCustomer} onChange={(c) => setSelectedCustomer(c ?? DEFAULT_CUSTOMER)} />
            </div>
            <form onSubmit={handleScan} className="flex-1 flex gap-2">
              <div className="relative flex-1">
                <BarcodeIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5 pointer-events-none" />
                <input
                  ref={barcodeInputRef}
                  type="text"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  placeholder="Escanea o busca un producto…"
                  className="w-full h-11 pl-10 pr-3 rounded-lg border border-gray-300 bg-white text-base text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-app-200 focus:border-app-500 disabled:bg-gray-50"
                  disabled={isSearching}
                />
              </div>

              {/* Cámara (celular) */}
              {isMobile && (
                <Button
                  variant="secondary"
                  className="h-11 px-3"
                  onClick={() => setShowBarcodeScanner(true)}
                  disabled={isSearching}
                  title="Escanear con cámara"
                  icon={<Camera className="w-5 h-5" />}
                />
              )}

              <Button type="submit" className="h-11" isLoading={isSearching}>
                Buscar
              </Button>
            </form>
          </div>

          {/* Catálogo de productos (scroll infinito + búsqueda) */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden flex-1 flex flex-col min-h-0">
            {/* Categorías + alternar Productos/Plantillas */}
            <div className="flex items-center gap-3 px-3 py-2.5 border-b border-gray-100">
              <div className="flex gap-1.5 overflow-x-auto flex-1 min-w-0 scrollbar-thin">
                {visibleCategories.length > 0 && (
                  <>
                    <button type="button" onClick={() => selectCategory(null)} className={chip(browseCategory === null)}>
                      Todas
                    </button>
                    {visibleCategories.map((cat) => (
                      <button key={cat.id} type="button" onClick={() => selectCategory(cat.id)} className={chip(browseCategory === cat.id)}>
                        {cat.name}
                      </button>
                    ))}
                  </>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <RadioGroup
                  variant="segmented"
                  value={browseType}
                  onChange={selectBrowseType}
                  options={[{ value: 'product', label: 'Productos' }, { value: 'template', label: 'Plantillas' }]}
                />
                <span className="hidden sm:inline text-xs text-gray-500 whitespace-nowrap tabular-nums">{browseTotal}</span>
              </div>
            </div>

            {/* Filtro activo */}
            {browseSearch && (
              <div className="px-3 py-1.5 flex items-center justify-between gap-2 text-xs border-b border-gray-100 bg-gray-50">
                <span className="text-gray-600 truncate">Filtro: <strong className="text-gray-900">"{browseSearch}"</strong> ({browseItems.length})</span>
                <button type="button" onClick={clearCatalogSearch} className="text-gray-500 hover:text-red-600 flex items-center gap-0.5 flex-shrink-0 px-1.5 py-1 rounded" title="Quitar filtro">
                  <X className="w-3.5 h-3.5" />
                  Limpiar
                </button>
              </div>
            )}

            <div onScroll={handleProductsScroll} className="flex-1 min-h-0 overflow-y-auto p-3 max-h-[60vh] lg:max-h-none">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 2xl:grid-cols-5 gap-2.5">
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
                      className="group relative text-left bg-white border border-gray-200 rounded-xl overflow-hidden hover:border-app-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-app-500 transition-colors"
                    >
                      {/* Imagen cuadrada */}
                      <div className="relative aspect-square bg-gray-50 overflow-hidden">
                        {item.image ? (
                          <img src={item.image} alt={item.name} loading="lazy" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package className="w-10 h-10 text-gray-300" />
                          </div>
                        )}
                        {onSale ? (
                          <span className="absolute top-1.5 left-1.5 bg-green-600 text-white text-[11px] font-bold px-1.5 py-0.5 rounded-md">-{offPct}%</span>
                        ) : !isProduct ? (
                          <span className="absolute top-1.5 left-1.5 bg-gray-900/80 text-white text-[11px] font-semibold px-1.5 py-0.5 rounded-md">Plantilla</span>
                        ) : null}
                        {isProduct && (
                          <span className={`absolute top-1.5 right-1.5 text-[11px] font-semibold px-1.5 py-0.5 rounded-md ${
                            (stock ?? 0) > 0 ? 'bg-white/95 text-gray-700 border border-gray-200' : 'bg-red-600 text-white'
                          }`}>
                            {(stock ?? 0) > 0 ? `Stock ${stock}` : 'Agotado'}
                          </span>
                        )}
                      </div>
                      {/* Datos */}
                      <div className="px-2 py-1.5">
                        <p className="text-xs font-medium text-gray-900 leading-tight line-clamp-2 min-h-[2em]">{item.name}</p>
                        <div className="flex items-baseline gap-1 mt-0.5">
                          <span className={`text-sm font-bold ${onSale ? 'text-green-700' : 'text-gray-900'}`}>${price.toLocaleString()}</span>
                          {onSale && <span className="text-[10px] text-gray-400 line-through">${(prod!.basePrice as number).toLocaleString()}</span>}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {browseLoading && (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-app-600" />
                </div>
              )}
              {!browseLoading && browseItems.length === 0 && (
                <EmptyState icon={Package} title="No hay productos" description={browseSearch ? 'Prueba con otro término o quita el filtro.' : undefined} />
              )}
              {!browseLoading && browseItems.length > 0 && browsePage >= browseTotalPages && (
                <p className="text-center text-xs text-gray-400 py-3">No hay más productos</p>
              )}
            </div>
          </div>
        </div>

        {/* Columna derecha: carrito y cobro */}
        <div className="w-full lg:w-[380px] xl:w-[400px] flex-shrink-0 flex flex-col gap-3 min-h-0">
          {/* Carrito */}
          <div id="pos-cart" className="flex-1 bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col min-h-[220px] scroll-mt-3">
            <div className="px-4 h-14 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
              <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-app-600" />
                Carrito
                <span className="rounded-full bg-app-100 text-app-700 text-xs font-semibold px-2 py-0.5">{cart.length}</span>
              </h2>
              {cart.length > 0 && (
                <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50" icon={<Trash2 className="w-4 h-4" />} onClick={clearCart}>
                  Vaciar
                </Button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto min-h-0">
              {cart.length === 0 ? (
                <EmptyState icon={ShoppingCart} title="Carrito vacío" description="Escanea o toca un producto para comenzar" />
              ) : (
                <div className="divide-y divide-gray-100">
                  {cart.map((item, index) => (
                    <div key={index} className="px-4 py-3">
                      <div className="flex gap-3">
                        {item.product.image && <Thumb src={item.product.image} alt={item.product.name} size="lg" />}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <h3 className="font-medium text-gray-900 text-sm truncate">
                                {item.product.name}
                                {item.itemType === 'template' && (
                                  <span className="ml-1.5 inline-block px-1.5 py-0.5 bg-gray-100 text-gray-600 text-[11px] font-medium rounded">Personal.</span>
                                )}
                              </h3>
                              {item.itemType === 'product' ? (
                                <>
                                  {((item.color && item.color !== 'N/A') || (item.size && item.size !== 'N/A')) ? (
                                    <p className="text-xs text-gray-500 truncate">
                                      {[item.color, item.size].filter((x) => x && x !== 'N/A').join(' · ')}
                                    </p>
                                  ) : null}
                                  {item.hasDiscount && (item.basePrice ?? 0) > item.price ? (
                                    <p className="text-xs mt-0.5">
                                      <span className="text-gray-400 line-through">${(item.basePrice as number).toLocaleString()}</span>{' '}
                                      <span className="text-green-700 font-semibold">${item.price.toLocaleString()} c/u</span>
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
                              title="Quitar del carrito"
                              aria-label="Quitar del carrito"
                              className="p-1.5 -mr-1.5 -mt-1 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 flex-shrink-0"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>

                          {/* Cantidad y subtotal */}
                          <div className="flex items-center justify-between mt-2">
                            <div className="inline-flex items-center rounded-lg border border-gray-300">
                              <button
                                onClick={() => updateQuantity(index.toString(), item.quantity - 1)}
                                className="w-9 h-9 inline-flex items-center justify-center text-gray-600 hover:bg-gray-50 rounded-l-lg disabled:opacity-40"
                                disabled={item.quantity <= 1}
                                title="Restar"
                                aria-label="Restar"
                              >
                                <Minus className="w-4 h-4" />
                              </button>
                              <span className="w-9 text-center text-sm font-semibold text-gray-900 tabular-nums">{item.quantity}</span>
                              <button
                                onClick={() => updateQuantity(index.toString(), item.quantity + 1)}
                                className="w-9 h-9 inline-flex items-center justify-center text-gray-600 hover:bg-gray-50 rounded-r-lg disabled:opacity-40"
                                disabled={item.itemType === 'product' && item.quantity >= item.stock}
                                title="Sumar"
                                aria-label="Sumar"
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                            </div>
                            <p className="text-base font-bold text-gray-900 tabular-nums">${item.subtotal.toLocaleString()}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Totales (fijos al pie) */}
            <div className="border-t border-gray-200 px-4 py-3 space-y-1.5 text-sm flex-shrink-0">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal</span>
                <span className="tabular-nums">${subtotal.toLocaleString()}</span>
              </div>
              {offerSavings > 0 && (
                <div className="flex justify-between text-green-700">
                  <span>Ahorro en ofertas</span>
                  <span className="tabular-nums">-${offerSavings.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between items-center text-gray-600">
                <button
                  onClick={() => setShowDiscountModal(true)}
                  className="inline-flex items-center gap-1 -ml-1 px-1 py-0.5 rounded text-app-700 hover:bg-app-50 font-medium"
                  title="Aplicar descuento (F9)"
                >
                  <Percent className="w-3.5 h-3.5" /> Descuento <kbd className="ml-1 text-[10px] text-gray-400 font-normal">F9</kbd>
                </button>
                <span className={`tabular-nums ${discount > 0 ? 'text-red-600' : ''}`}>-${discount.toLocaleString()}</span>
              </div>
              {tax > 0 && (
                <div className="flex justify-between text-gray-600">
                  <span>IVA ({settings.payment?.taxRate || 19}%)</span>
                  <span className="tabular-nums">${tax.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between items-baseline border-t border-gray-200 pt-2 mt-2">
                <span className="text-base font-semibold text-gray-900">Total</span>
                <span className="text-2xl font-bold text-gray-900 tabular-nums">${total.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Cobrar con */}
          <div className="bg-white rounded-xl border border-gray-200 p-3 flex-shrink-0">
            <div className="flex items-center justify-between mb-2 px-1">
              <h3 className="text-sm font-semibold text-gray-900">Cobrar con</h3>
              <div className="relative group">
                <Info className="w-4 h-4 text-gray-400 cursor-help" />
                <div className="absolute right-0 bottom-6 z-20 hidden group-hover:block bg-gray-900 text-white text-xs rounded-lg p-3 w-56 shadow-xl">
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
              <PayButton hotkey="1" label="Efectivo" icon={<DollarSign className="w-5 h-5" />} primary onClick={() => openCheckoutWith('cash')} disabled={payDisabled} />
              <PayButton hotkey="2" label="Transfer" icon={<Smartphone className="w-5 h-5" />} onClick={() => openCheckoutWith('transfer')} disabled={payDisabled} />
              <PayButton hotkey="3" label="Mixto" icon={<Shuffle className="w-5 h-5" />} onClick={() => openCheckoutWith('mixed')} disabled={payDisabled} />
              <PayButton hotkey="4" label="Debe" icon={<Clock className="w-5 h-5 text-amber-600" />} onClick={() => openCheckoutWith('debe')} disabled={payDisabled} />
            </div>
            {isProcessingSale && <p className="text-center text-sm text-gray-500 mt-2">Procesando…</p>}
            <Button
              variant="ghost"
              size="lg"
              fullWidth
              className="mt-2 text-red-600 hover:text-red-700 hover:bg-red-50"
              icon={<Trash2 className="w-4 h-4" />}
              onClick={clearCart}
              disabled={cart.length === 0}
            >
              Cancelar venta
            </Button>
          </div>
        </div>
      </div>

      {/* Celular / tableta vertical: acceso rápido al carrito (el carrito queda debajo del catálogo) */}
      {cart.length > 0 && (
        <button
          type="button"
          onClick={() => document.getElementById('pos-cart')?.scrollIntoView({ behavior: 'smooth' })}
          className="lg:hidden sticky bottom-3 z-20 mx-auto flex items-center gap-3 h-12 px-5 rounded-full bg-gray-900 text-white text-sm font-semibold shadow-xl"
        >
          <ShoppingCart className="w-5 h-5" />
          Ver carrito ({cart.length})
          <span className="tabular-nums">${total.toLocaleString()}</span>
        </button>
      )}

      {/* Descuento */}
      <Dialog
        open={showDiscountModal}
        onClose={() => setShowDiscountModal(false)}
        size="sm"
        title="Aplicar descuento"
        description={`Subtotal: $${subtotal.toLocaleString()}`}
        footer={
          <>
            <Button variant="secondary" size="lg" onClick={() => setShowDiscountModal(false)}>Cancelar</Button>
            <Button size="lg" onClick={handleApplyDiscount}>Aplicar</Button>
          </>
        }
      >
        <Field label="Monto del descuento">
          <MoneyInput
            value={discountInput}
            onChange={(e) => setDiscountInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleApplyDiscount(); }}
            placeholder="0"
            max={subtotal}
            autoFocus
            className="h-12 text-lg font-semibold"
          />
        </Field>
      </Dialog>

      {/* Cobro (flujo unificado) */}
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

      {/* Zonas de la plantilla */}
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

      {/* Producto sin stock */}
      <Dialog
        open={!!productInfoModal}
        onClose={closeProductInfo}
        size="sm"
        title={productInfoModal?.name ?? ''}
        description={productInfoModal ? [productInfoModal.color, productInfoModal.size].filter(Boolean).join(' · ') || undefined : undefined}
        footer={<Button size="lg" fullWidth onClick={closeProductInfo}>Entendido</Button>}
      >
        {productInfoModal && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Thumb src={productInfoModal.image || null} alt={productInfoModal.name} size="lg" />
              <p className="text-2xl font-bold text-gray-900">${productInfoModal.price.toLocaleString()}</p>
            </div>
            <dl className="text-sm divide-y divide-gray-100 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between gap-3 px-3 py-2">
                <dt className="text-gray-500">SKU</dt>
                <dd className="font-mono text-gray-900 truncate">{productInfoModal.sku}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 px-3 py-2">
                <dt className="text-gray-500">Código de barras</dt>
                <dd className="font-mono text-gray-900 truncate">{productInfoModal.barcode || '—'}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 px-3 py-2">
                <dt className="text-gray-500">Stock</dt>
                <dd className="font-semibold text-red-600">{productInfoModal.stock}</dd>
              </div>
            </dl>
            <Alert tone="error">Sin stock disponible para vender</Alert>
          </div>
        )}
      </Dialog>

      {/* Escáner con cámara (celular) */}
      <BarcodeScanner
        isOpen={showBarcodeScanner}
        onClose={() => setShowBarcodeScanner(false)}
        onScan={handleCameraScan}
      />
    </div>
  );
}

/** Botón grande de método de pago (táctil), con su atajo de teclado. */
function PayButton({ hotkey, label, icon, onClick, disabled, primary }: {
  hotkey: string; label: string; icon: React.ReactNode; onClick: () => void; disabled?: boolean; primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`relative h-14 flex items-center justify-center gap-2 rounded-lg border text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-app-500 ${
        primary
          ? 'bg-app-600 border-app-600 text-white hover:bg-app-700 disabled:hover:bg-app-600'
          : 'bg-white border-gray-300 text-gray-800 hover:border-app-400 hover:bg-app-50 disabled:hover:bg-white disabled:hover:border-gray-300'
      }`}
    >
      {icon}
      {label}
      <kbd className={`absolute top-1 right-1.5 text-[10px] font-bold ${primary ? 'text-white/60' : 'text-gray-400'}`}>{hotkey}</kbd>
    </button>
  );
}
