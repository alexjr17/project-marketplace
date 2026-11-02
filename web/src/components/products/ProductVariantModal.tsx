import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { X, ShoppingCart, Check, ZoomIn, Star } from 'lucide-react';
import { useSettings } from '../../context/SettingsContext';
import { useCurrency } from '../../hooks/useCurrency';
import { getVariantByProductColorSize } from '../../services/variants.service';
import type { Product } from '../../types/product';

interface ProductVariantModalProps {
  product: Product;
  isOpen: boolean;
  onClose: () => void;
  onAddToCart: (product: Product, color: string, size: string, quantity: number) => void;
}

export const ProductVariantModal = ({
  product,
  isOpen,
  onClose,
  onAddToCart,
}: ProductVariantModalProps) => {
  const { settings } = useSettings();
  const { format } = useCurrency();

  const [selectedColor, setSelectedColor] = useState<string>('');
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [quantity, setQuantity] = useState(1);
  const [availableStock, setAvailableStock] = useState<number | null>(null);
  const [loadingStock, setLoadingStock] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Estados para el zoom
  const [isZooming, setIsZooming] = useState(false);
  const [zoomPosition, setZoomPosition] = useState({ x: 0, y: 0 });
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const thumbnailsContainerRef = useRef<HTMLDivElement>(null);
  const thumbnailRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Colores de marca
  const brandColors = settings.appearance?.brandColors || settings.general.brandColors || {
    primary: '#7c3aed',
    secondary: '#ec4899',
    accent: '#f59e0b',
  };

  // Obtener todas las imágenes disponibles del producto (hasta 5)
  const productImages = useMemo(() => {
    const images: { url: string; label: string }[] = [];

    // Imagen frontal (siempre existe)
    if (product.images.front) {
      images.push({ url: product.images.front, label: 'Frente' });
    }

    // Imagen trasera (opcional)
    if (product.images.back) {
      images.push({ url: product.images.back, label: 'Atrás' });
    }

    // Imagen lateral (opcional)
    if (product.images.side) {
      images.push({ url: product.images.side, label: 'Lateral' });
    }

    // Imagen extra 1 (opcional)
    if (product.images.extra1) {
      images.push({ url: product.images.extra1, label: 'Detalle 1' });
    }

    // Imagen extra 2 (opcional)
    if (product.images.extra2) {
      images.push({ url: product.images.extra2, label: 'Detalle 2' });
    }

    // Imágenes por color (si existen y no duplican)
    product.colors.forEach((color) => {
      if (color.image && !images.some(img => img.url === color.image)) {
        images.push({ url: color.image, label: color.name });
      }
    });

    return images;
  }, [product]);

  // Resetear selección cuando cambia el producto o se abre el modal
  useEffect(() => {
    if (isOpen && product) {
      setSelectedColor(product.colors[0]?.hexCode || '');
      const firstSize = product.sizes[0];
      setSelectedSize(typeof firstSize === 'string' ? firstSize : firstSize?.abbreviation || '');
      setQuantity(1);
      setAvailableStock(null);
      setCurrentImageIndex(0);
    }
  }, [isOpen, product]);

  // Verificar stock cuando cambia color o talla
  useEffect(() => {
    const fetchStock = async () => {
      if (!selectedColor || !selectedSize || !product) return;

      setLoadingStock(true);
      try {
        const variant = await getVariantByProductColorSize(
          product.id,
          selectedColor,
          selectedSize
        );
        setAvailableStock(variant?.stock ?? 0);
      } catch (error) {
        console.error('Error fetching stock:', error);
        setAvailableStock(null);
      } finally {
        setLoadingStock(false);
      }
    };

    fetchStock();
  }, [selectedColor, selectedSize, product]);

  const handleAddToCart = async () => {
    if (!selectedColor || !selectedSize) return;

    setIsAdding(true);
    try {
      await onAddToCart(product, selectedColor, selectedSize, quantity);
      onClose();
    } finally {
      setIsAdding(false);
    }
  };

  // Función para hacer scroll al thumbnail seleccionado
  const scrollToThumbnail = useCallback((index: number) => {
    const thumbnail = thumbnailRefs.current[index];
    if (thumbnail && thumbnailsContainerRef.current) {
      thumbnail.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      });
    }
  }, []);

  // Cambiar imagen y hacer scroll al thumbnail
  const handleImageChange = useCallback((index: number) => {
    setCurrentImageIndex(index);
    scrollToThumbnail(index);
  }, [scrollToThumbnail]);

  // Handlers para el zoom estilo Amazon
  const handleMouseEnter = () => {
    setIsZooming(true);
  };

  const handleMouseLeave = () => {
    setIsZooming(false);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!imageContainerRef.current) return;

    const rect = imageContainerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    setZoomPosition({ x, y });
  };

  const isOutOfStock = availableStock !== null && availableStock === 0;
  const hasInsufficientStock = availableStock !== null && availableStock > 0 && availableStock < quantity;
  const canAddToCart = selectedColor && selectedSize && !isOutOfStock && !hasInsufficientStock;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[95vh] overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header - minimalista */}
        <div className="absolute top-3 right-3 z-20">
          <button
            onClick={onClose}
            className="p-2 bg-white/90 hover:bg-white rounded-full shadow-md transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(95vh-80px)]">
          {/* Layout: imagen a la izquierda, opciones a la derecha en desktop */}
          <div className="md:flex">
            {/* Galería de imágenes */}
            <div className="md:w-1/2 p-4 bg-gray-50">
              {/* Imagen principal con zoom */}
              <div
                ref={imageContainerRef}
                className="relative aspect-square rounded-xl overflow-hidden bg-white mb-3 cursor-zoom-in"
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                onMouseMove={handleMouseMove}
              >
                {/* Imagen normal */}
                <img
                  src={productImages[currentImageIndex]?.url}
                  alt={productImages[currentImageIndex]?.label}
                  className={`w-full h-full object-contain transition-opacity duration-200 ${
                    isZooming ? 'opacity-0 md:opacity-0' : 'opacity-100'
                  }`}
                  draggable={false}
                />

                {/* Imagen con zoom (solo desktop) */}
                {isZooming && (
                  <div
                    className="absolute inset-0 hidden md:block"
                    style={{
                      backgroundImage: `url(${productImages[currentImageIndex]?.url})`,
                      backgroundPosition: `${zoomPosition.x}% ${zoomPosition.y}%`,
                      backgroundSize: '200%',
                      backgroundRepeat: 'no-repeat',
                    }}
                  />
                )}

                {/* Indicador de zoom (solo desktop) */}
                {!isZooming && (
                  <div className="absolute bottom-3 right-3 hidden md:flex items-center gap-1 bg-black/50 text-white text-xs px-2 py-1 rounded-full">
                    <ZoomIn className="w-3 h-3" />
                    <span>Hover para zoom</span>
                  </div>
                )}

              </div>

              {/* Thumbnails con auto-scroll */}
              {productImages.length > 1 && (
                <div
                  ref={thumbnailsContainerRef}
                  className="flex gap-2 overflow-x-auto pb-2 scroll-smooth"
                  style={{ scrollbarWidth: 'thin' }}
                >
                  {productImages.map((img, index) => (
                    <button
                      key={index}
                      ref={(el) => { thumbnailRefs.current[index] = el; }}
                      onClick={() => handleImageChange(index)}
                      className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                        currentImageIndex === index
                          ? 'border-gray-900 ring-2 ring-gray-900/20'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <img
                        src={img.url}
                        alt={img.label}
                        className="w-full h-full object-cover"
                        draggable={false}
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Opciones de producto */}
            <div className="md:w-1/2 p-4 flex flex-col">
              {/* Título del producto */}
              <h2 className="text-lg font-semibold text-gray-900 mb-2 leading-tight">{product.name}</h2>

              {/* Descripción del producto */}
              {product.description && (
                <p className="text-sm text-gray-500 leading-relaxed mb-3">{product.description}</p>
              )}

              {/* Rating y reviews */}
              {(product.rating || product.reviewsCount) && (
                <div className="flex items-center gap-2 mb-3">
                  {product.rating && (
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                      <span className="text-sm font-medium text-gray-700">{product.rating}</span>
                    </div>
                  )}
                  {product.reviewsCount && (
                    <span className="text-xs text-gray-400">({product.reviewsCount} reseñas)</span>
                  )}
                </div>
              )}

              {/* Tags */}
              {product.tags && product.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {product.tags.slice(0, 4).map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Separador */}
              <div className="border-t border-gray-100 my-2" />

              {/* Color Selection - compacto */}
              <div className="flex items-center gap-3 mb-3">
                <span className="text-xs font-medium text-gray-500 w-12">Color</span>
                <div className="flex items-center gap-1.5 flex-1">
                  {product.colors.map((color) => (
                    <button
                      key={color.hexCode}
                      onClick={() => setSelectedColor(color.hexCode)}
                      className={`relative w-7 h-7 rounded-full transition-all ${
                        selectedColor === color.hexCode
                          ? 'ring-2 ring-offset-1 ring-gray-800'
                          : 'hover:scale-110'
                      }`}
                      style={{ backgroundColor: color.hexCode }}
                      title={color.name}
                    >
                      <span
                        className={`absolute inset-0 rounded-full border ${
                          isLightColor(color.hexCode) ? 'border-gray-300' : 'border-transparent'
                        }`}
                      />
                      {selectedColor === color.hexCode && (
                        <Check
                          className={`absolute inset-0 m-auto w-3.5 h-3.5 ${
                            isLightColor(color.hexCode) ? 'text-gray-800' : 'text-white'
                          }`}
                        />
                      )}
                    </button>
                  ))}
                </div>
                <span className="text-xs text-gray-400 truncate max-w-[80px]">
                  {product.colors.find(c => c.hexCode === selectedColor)?.name}
                </span>
              </div>

              {/* Size Selection - compacto */}
              <div className="flex items-center gap-3 mb-3">
                <span className="text-xs font-medium text-gray-500 w-12">Talla</span>
                <div className="flex flex-wrap gap-1 flex-1">
                  {product.sizes.map((size) => {
                    const sizeValue = typeof size === 'string' ? size : size.abbreviation;
                    const sizeName = typeof size === 'string' ? size : size.name;
                    return (
                      <button
                        key={sizeValue}
                        onClick={() => setSelectedSize(sizeValue)}
                        className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                          selectedSize === sizeValue
                            ? 'bg-gray-900 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                        title={sizeName}
                      >
                        {sizeValue}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Quantity + Stock - compacto */}
              <div className="flex items-center gap-3 mb-3">
                <span className="text-xs font-medium text-gray-500 w-12">Cant.</span>
                <div className="flex items-center">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="w-8 h-8 rounded-l border border-r-0 border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors text-gray-600 disabled:opacity-40"
                    disabled={quantity <= 1}
                  >
                    −
                  </button>
                  <div className="w-10 h-8 border-y border-gray-200 flex items-center justify-center bg-gray-50">
                    <span className="text-sm font-semibold text-gray-900">{quantity}</span>
                  </div>
                  <button
                    onClick={() => setQuantity(quantity + 1)}
                    className="w-8 h-8 rounded-r border border-l-0 border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors text-gray-600 disabled:opacity-40"
                    disabled={availableStock !== null && quantity >= availableStock}
                  >
                    +
                  </button>
                </div>
                {/* Stock Status inline */}
                <div className="flex-1 text-right">
                  {loadingStock ? (
                    <span className="text-xs text-gray-400">Verificando...</span>
                  ) : availableStock !== null && (
                    <span className={`text-xs font-medium ${
                      isOutOfStock ? 'text-red-500' : hasInsufficientStock ? 'text-amber-600' : 'text-green-600'
                    }`}>
                      {isOutOfStock ? 'Sin stock' : `${availableStock} disponibles`}
                    </span>
                  )}
                </div>
              </div>

              {/* Spacer para empujar el footer hacia abajo en desktop */}
              <div className="flex-1" />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-gray-50">
          <button
            onClick={handleAddToCart}
            disabled={!canAddToCart || isAdding}
            className={`w-full py-3.5 px-4 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all text-base ${
              canAddToCart
                ? 'text-white hover:opacity-90 active:scale-[0.98]'
                : 'bg-gray-200 text-gray-500 cursor-not-allowed'
            }`}
            style={canAddToCart ? { backgroundColor: brandColors.primary } : undefined}
          >
            {isAdding ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Agregando...
              </>
            ) : (
              <>
                <ShoppingCart className="w-5 h-5" />
                Agregar al carrito - {format(product.basePrice * quantity)}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// Helper para determinar si un color es claro
function isLightColor(hexColor: string): boolean {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5;
}
