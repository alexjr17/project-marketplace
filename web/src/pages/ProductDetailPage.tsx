import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ShoppingCart, Check, ZoomIn, Star, Loader2, Share2, X, Copy } from 'lucide-react';
import { BackButton } from '../components/shared/BackButton';
import { useSettings } from '../context/SettingsContext';
import { useCurrency } from '../hooks/useCurrency';
import { useCart } from '../context/CartContext';
import { getVariantByProductColorSize } from '../services/variants.service';
import { Seo } from '../components/seo/Seo';
import { FavoriteButton } from '../components/products/FavoriteButton';
import productsService from '../services/products.service';
import type { Product } from '../types/product';
import { RelatedProducts } from '../components/products/RelatedProducts';
import { ProductReviewSection } from '../components/reviews/ProductReviewSection';

// Iconos de redes sociales como componentes SVG
const FacebookIcon = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
  </svg>
);

const TwitterIcon = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
  </svg>
);

const TelegramIcon = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
  </svg>
);

const WhatsAppIcon = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

// Helper para determinar si un color es claro
function isLightColor(hexColor: string): boolean {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5;
}

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { settings } = useSettings();
  const { format } = useCurrency();
  const { addStandardProduct } = useCart();

  // Estados del producto
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Estados de selección
  const [selectedColor, setSelectedColor] = useState<string>('');
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [quantity, setQuantity] = useState(1);
  const [availableStock, setAvailableStock] = useState<number | null>(null);
  const [loadingStock, setLoadingStock] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [addedSuccess, setAddedSuccess] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Estados para el zoom
  const [isZooming, setIsZooming] = useState(false);
  const [zoomPosition, setZoomPosition] = useState({ x: 0, y: 0 });

  // Estados para compartir
  const [showShareModal, setShowShareModal] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const thumbnailsContainerRef = useRef<HTMLDivElement>(null);
  const thumbnailRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Colores de marca
  const brandColors = settings.appearance?.brandColors || settings.general.brandColors || {
    primary: '#7c3aed',
    secondary: '#ec4899',
    accent: '#f59e0b',
  };

  // Cargar producto
  useEffect(() => {
    const fetchProduct = async () => {
      if (!id) return;

      setLoading(true);
      setError(null);

      try {
        const productData = await productsService.getById(id);
        if (productData) {
          setProduct(productData);
          // Inicializar selección
          setSelectedColor(productData.colors[0]?.hexCode || '');
          const firstSize = productData.sizes[0];
          setSelectedSize(typeof firstSize === 'string' ? firstSize : firstSize?.abbreviation || '');
          setQuantity(1);
          setCurrentImageIndex(0);
        } else {
          setError('Producto no encontrado');
        }
      } catch (err) {
        console.error('Error fetching product:', err);
        setError('Error al cargar el producto');
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [id]);

  // Obtener todas las imágenes disponibles del producto (hasta 5)
  const productImages = useMemo(() => {
    if (!product) return [];

    const images: { url: string; label: string }[] = [];

    if (product.images.front) {
      images.push({ url: product.images.front, label: 'Frente' });
    }
    if (product.images.back) {
      images.push({ url: product.images.back, label: 'Atrás' });
    }
    if (product.images.side) {
      images.push({ url: product.images.side, label: 'Lateral' });
    }
    if (product.images.extra1) {
      images.push({ url: product.images.extra1, label: 'Detalle 1' });
    }
    if (product.images.extra2) {
      images.push({ url: product.images.extra2, label: 'Detalle 2' });
    }

    // Imágenes por color
    product.colors.forEach((color) => {
      if (color.image && !images.some(img => img.url === color.image)) {
        images.push({ url: color.image, label: color.name });
      }
    });

    return images;
  }, [product]);

  // Verificar stock cuando cambia color o talla.
  // Productos simples (sin color/talla) usan la variante por defecto.
  useEffect(() => {
    const fetchStock = async () => {
      if (!product) return;
      const needsColor = product.colors.length > 0;
      const needsSize = product.sizes.length > 0;

      // Producto simple (sin color/talla): el stock ya viene en product.stock
      // (suma de variantes activas). Evita el endpoint de variante (requiere login).
      if (!needsColor && !needsSize) {
        setAvailableStock(product.stock ?? 0);
        return;
      }

      if ((needsColor && !selectedColor) || (needsSize && !selectedSize)) return;

      setLoadingStock(true);
      try {
        const variant = await getVariantByProductColorSize(
          Number(product.id),
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
    if (!product) return;
    const needsColor = product.colors.length > 0;
    const needsSize = product.sizes.length > 0;
    if ((needsColor && !selectedColor) || (needsSize && !selectedSize)) return;

    setIsAdding(true);
    try {
      await addStandardProduct(product, selectedColor, selectedSize, quantity);
      setAddedSuccess(true);
      setTimeout(() => setAddedSuccess(false), 2000);
    } catch (error) {
      console.error('Error adding to cart:', error);
    } finally {
      setIsAdding(false);
    }
  };

  // Funciones para compartir en redes sociales
  const getShareUrl = () => window.location.href;
  const getShareText = () => product ? `${product.name} - ${format(product.basePrice)}` : '';

  const shareOnWhatsApp = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(`${getShareText()}\n${getShareUrl()}`)}`;
    window.open(url, '_blank');
    setShowShareModal(false);
  };

  const shareOnFacebook = () => {
    const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(getShareUrl())}`;
    window.open(url, '_blank');
    setShowShareModal(false);
  };

  const shareOnTwitter = () => {
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(getShareText())}&url=${encodeURIComponent(getShareUrl())}`;
    window.open(url, '_blank');
    setShowShareModal(false);
  };

  const shareOnTelegram = () => {
    const url = `https://t.me/share/url?url=${encodeURIComponent(getShareUrl())}&text=${encodeURIComponent(getShareText())}`;
    window.open(url, '_blank');
    setShowShareModal(false);
  };

  const copyLink = async () => {
    const url = getShareUrl();
    try {
      // Intentar con Clipboard API moderna
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(url);
      } else {
        // Fallback para contextos no seguros
        const textArea = document.createElement('textarea');
        textArea.value = url;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopySuccess(true);
      setTimeout(() => {
        setCopySuccess(false);
        setShowShareModal(false);
      }, 1500);
    } catch (err) {
      console.error('Error al copiar enlace:', err);
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

  const handleImageChange = useCallback((index: number) => {
    setCurrentImageIndex(index);
    scrollToThumbnail(index);
  }, [scrollToThumbnail]);

  // Handlers para el zoom
  const handleMouseEnter = () => setIsZooming(true);
  const handleMouseLeave = () => setIsZooming(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!imageContainerRef.current) return;
    const rect = imageContainerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setZoomPosition({ x, y });
  };

  const isOutOfStock = availableStock !== null && availableStock === 0;
  const hasInsufficientStock = availableStock !== null && availableStock > 0 && availableStock < quantity;
  // Solo exigir color/talla si el producto los tiene (los simples no).
  const needsColor = (product?.colors.length ?? 0) > 0;
  const needsSize = (product?.sizes.length ?? 0) > 0;
  const hasRequiredSelection = (!needsColor || !!selectedColor) && (!needsSize || !!selectedSize);
  const canAddToCart = hasRequiredSelection && !isOutOfStock && !hasInsufficientStock;

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-gray-400" />
          <p className="text-gray-500">Cargando producto...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !product) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Producto no encontrado</h1>
          <p className="text-gray-500 mb-6">{error || 'El producto que buscas no existe'}</p>
          <button
            onClick={() => navigate('/catalog')}
            className="px-6 py-3 rounded-lg text-white font-medium"
            style={{ backgroundColor: brandColors.primary }}
          >
            Ver catálogo
          </button>
        </div>
      </div>
    );
  }

  // Obtener nombre de categoría para header
  const categoryName = product.categorySlug || product.category || 'Productos';
  const gradientStyle = `linear-gradient(to right, ${brandColors.primary}, ${brandColors.secondary}, ${brandColors.accent})`;

  return (
    <div className="min-h-screen bg-gray-50">
      <Seo
        title={product.name}
        description={product.description}
        image={product.images.front}
        type="product"
      />
      {/* Header con gradiente */}
      <div className="text-white py-4 shadow-md" style={{ background: gradientStyle }}>
        <div className="max-w-7xl mx-auto px-4 flex items-center gap-3">
          <BackButton />
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wide text-white/70">Detalle del producto</p>
            <p className="text-lg font-bold capitalize truncate">{categoryName}</p>
          </div>
        </div>
      </div>

      {/* Contenido principal - altura limitada al viewport */}
      <div className="max-w-6xl w-full mx-auto px-4 py-3">
        <div className="bg-white rounded-xl shadow-sm overflow-hidden" style={{ maxHeight: 'calc(100vh - 100px)' }}>
          <div className="md:flex h-full max-h-[calc(100vh-100px)]">
            {/* Galería de imágenes - altura adaptativa */}
            <div className="md:w-[42%] p-3 bg-gray-50 flex flex-col">
              {/* Imagen principal con zoom - altura controlada */}
              <div
                ref={imageContainerRef}
                className="relative h-[35vh] md:h-[calc(100vh-200px)] max-h-[400px] rounded-xl overflow-hidden bg-white mb-2 cursor-zoom-in"
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                onMouseMove={handleMouseMove}
              >
                <img
                  src={productImages[currentImageIndex]?.url}
                  alt={productImages[currentImageIndex]?.label}
                  className={`w-full h-full object-contain transition-opacity duration-200 ${
                    isZooming ? 'opacity-0 md:opacity-0' : 'opacity-100'
                  }`}
                  draggable={false}
                />

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

                {!isZooming && (
                  <div className="absolute bottom-2 right-2 hidden md:flex items-center gap-1 bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                    <ZoomIn className="w-3 h-3" />
                    <span>Zoom</span>
                  </div>
                )}
              </div>

              {/* Thumbnails - compactos */}
              {productImages.length > 1 && (
                <div
                  ref={thumbnailsContainerRef}
                  className="flex gap-1.5 overflow-x-auto pb-1 scroll-smooth flex-shrink-0"
                  style={{ scrollbarWidth: 'thin' }}
                >
                  {productImages.map((img, index) => (
                    <button
                      key={index}
                      ref={(el) => { thumbnailRefs.current[index] = el; }}
                      onClick={() => handleImageChange(index)}
                      className={`flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-all ${
                        currentImageIndex === index
                          ? 'border-gray-900 ring-1 ring-gray-900/20'
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

            {/* Información del producto */}
            <div className="md:w-[58%] p-4 md:p-5 flex flex-col overflow-y-auto">
              {/* Nombre del producto con botón de compartir */}
              <div className="flex items-start justify-between gap-2 mb-2">
                <h1 className="text-xl md:text-2xl font-bold text-gray-900">{product.name}</h1>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <FavoriteButton productId={Number(product.id)} size={20} className="p-2 rounded-lg hover:bg-gray-100" />
                  <button
                    onClick={() => setShowShareModal(true)}
                    className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-500 hover:text-gray-700"
                    title="Compartir"
                  >
                    <Share2 className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Precio y Rating en línea */}
              <div className="flex items-center justify-between mb-3">
                {product.hasDiscount && product.salePrice != null ? (
                  <span className="flex items-baseline gap-2">
                    <span className="text-2xl md:text-3xl font-bold text-emerald-600">{format(product.salePrice)}</span>
                    <span className="text-base text-gray-400 line-through">{format(product.basePrice)}</span>
                    {product.discountType === 'percent' && product.discountValue ? (
                      <span className="text-xs font-bold bg-emerald-600 text-white px-2 py-0.5 rounded">-{Math.round(product.discountValue)}%</span>
                    ) : null}
                  </span>
                ) : (
                  <span className="text-2xl md:text-3xl font-bold" style={{ color: brandColors.primary }}>
                    {format(product.basePrice)}
                  </span>
                )}
                {product.rating && (
                  <span className="inline-flex items-center gap-1 text-sm text-gray-600">
                    <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    {product.rating}
                    {product.reviewsCount && <span className="text-gray-400">({product.reviewsCount})</span>}
                  </span>
                )}
              </div>

              {/* Descripción */}
              {product.description && (
                <p className="text-sm text-gray-600 leading-relaxed mb-3 line-clamp-2">{product.description}</p>
              )}

              {/* Tags */}
              {product.tags && product.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {product.tags.slice(0, 4).map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full"
                    >
                      {tag}
                    </span>
                  ))}
                  {product.tags.length > 4 && (
                    <span className="text-xs text-gray-400">+{product.tags.length - 4}</span>
                  )}
                </div>
              )}

              {/* Separador */}
              <div className="border-t border-gray-200 my-3" />

              {/* Color Selection */}
              <div className="flex items-center gap-3 mb-3">
                <span className="text-xs font-medium text-gray-500 w-14">Color</span>
                <div className="flex items-center gap-1.5 flex-1">
                  {product.colors.map((color) => (
                    <button
                      key={color.hexCode}
                      onClick={() => {
                        setSelectedColor(color.hexCode);
                        if (color.image) {
                          const idx = productImages.findIndex((img) => img.url === color.image);
                          if (idx >= 0) setCurrentImageIndex(idx);
                        }
                      }}
                      className={`relative w-8 h-8 rounded-full transition-all ${
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
                          className={`absolute inset-0 m-auto w-4 h-4 ${
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

              {/* Size Selection */}
              <div className="flex items-center gap-3 mb-3">
                <span className="text-xs font-medium text-gray-500 w-14">Talla</span>
                <div className="flex flex-wrap gap-1.5 flex-1">
                  {product.sizes.map((size) => {
                    const sizeValue = typeof size === 'string' ? size : size.abbreviation;
                    const sizeName = typeof size === 'string' ? size : size.name;
                    return (
                      <button
                        key={sizeValue}
                        onClick={() => setSelectedSize(sizeValue)}
                        className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
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

              {/* Quantity + Stock */}
              <div className="flex items-center gap-3 mb-4">
                <span className="text-xs font-medium text-gray-500 w-14">Cantidad</span>
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
                {/* Stock Status */}
                <div className="flex-1 text-right">
                  {loadingStock ? (
                    <span className="text-xs text-gray-400">Verificando...</span>
                  ) : availableStock !== null && (
                    <span className={`text-xs font-medium ${
                      isOutOfStock ? 'text-red-500' : hasInsufficientStock ? 'text-orange-500' : 'text-green-600'
                    }`}>
                      {isOutOfStock ? 'Sin stock' : `${availableStock} disponibles`}
                    </span>
                  )}
                </div>
              </div>

              {/* Add to Cart Button */}
              <div className="mt-auto">
                <button
                  onClick={handleAddToCart}
                  disabled={!canAddToCart || isAdding}
                  className={`w-full py-3 px-4 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all ${
                    addedSuccess
                      ? 'bg-green-500 text-white'
                      : canAddToCart
                      ? 'text-white hover:opacity-90 active:scale-[0.98]'
                      : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  }`}
                  style={canAddToCart && !addedSuccess ? { backgroundColor: brandColors.primary } : undefined}
                >
                  {isAdding ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Agregando...
                    </>
                  ) : addedSuccess ? (
                    <>
                      <Check className="w-5 h-5" />
                      Agregado al carrito
                    </>
                  ) : (
                    <>
                      <ShoppingCart className="w-5 h-5" />
                      Agregar al carrito - {format((product.salePrice ?? product.basePrice) * quantity)}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Productos relacionados - fuera del área principal, con scroll propio */}
      <div className="max-w-6xl w-full mx-auto px-4 pb-4">
        <RelatedProducts product={product} />
      </div>

      {/* Sección de Reviews */}
      <div className="max-w-6xl w-full mx-auto px-4 pb-8">
        <div className="bg-white rounded-xl shadow-sm p-6">
          <ProductReviewSection productId={product.id} />
        </div>
      </div>

      {/* Modal de compartir */}
      {showShareModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowShareModal(false)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-sm shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header del modal */}
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900">Compartir producto</h3>
              <button
                onClick={() => setShowShareModal(false)}
                className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Opciones de compartir */}
            <div className="p-4">
              <div className="grid grid-cols-4 gap-4 mb-6">
                {/* WhatsApp */}
                <button
                  onClick={shareOnWhatsApp}
                  className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-gray-50 transition-colors group"
                >
                  <div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center text-white group-hover:scale-110 transition-transform">
                    <WhatsAppIcon />
                  </div>
                  <span className="text-xs text-gray-600">WhatsApp</span>
                </button>

                {/* Facebook */}
                <button
                  onClick={shareOnFacebook}
                  className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-gray-50 transition-colors group"
                >
                  <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center text-white group-hover:scale-110 transition-transform">
                    <FacebookIcon />
                  </div>
                  <span className="text-xs text-gray-600">Facebook</span>
                </button>

                {/* Twitter/X */}
                <button
                  onClick={shareOnTwitter}
                  className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-gray-50 transition-colors group"
                >
                  <div className="w-12 h-12 rounded-full bg-black flex items-center justify-center text-white group-hover:scale-110 transition-transform">
                    <TwitterIcon />
                  </div>
                  <span className="text-xs text-gray-600">X</span>
                </button>

                {/* Telegram */}
                <button
                  onClick={shareOnTelegram}
                  className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-gray-50 transition-colors group"
                >
                  <div className="w-12 h-12 rounded-full bg-sky-500 flex items-center justify-center text-white group-hover:scale-110 transition-transform">
                    <TelegramIcon />
                  </div>
                  <span className="text-xs text-gray-600">Telegram</span>
                </button>
              </div>

              {/* Copiar enlace */}
              <div className="border-t border-gray-100 pt-4">
                <p className="text-xs text-gray-500 mb-2">O copia el enlace</p>
                <div className="flex gap-2">
                  <div className="flex-1 px-3 py-2 bg-gray-100 rounded-lg text-sm text-gray-600 truncate">
                    {getShareUrl()}
                  </div>
                  <button
                    onClick={copyLink}
                    className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-all ${
                      copySuccess
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-900 text-white hover:bg-gray-800'
                    }`}
                  >
                    {copySuccess ? (
                      <>
                        <Check className="w-4 h-4" />
                        Copiado
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        Copiar
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
