import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ShoppingCart, Check, ZoomIn, Star, Share2, Copy, PackageX, Truck, ShieldCheck, RotateCcw, Palette, Ruler } from 'lucide-react';
import { Badge, Button, Dialog, EmptyState, Field, IconButton, Skeleton, Tabs, TextInput } from '../components/ui';
import { QuantityStepper } from '../components/cart/QuantityStepper';
import { PageHeader } from '../components/shared/PageHeader';
import { StoreContainer } from '../components/shared/StoreContainer';
import { ProductImage } from '../components/products/ProductImage';
import { useCatalogs } from '../context/CatalogsContext';
import { useSettings } from '../context/SettingsContext';
import { getSizeChart } from '../data/sizeCharts';
import { sizeChartType } from '../components/customizer/customizerModel';
import { useCurrency } from '../hooks/useCurrency';
import { useCart } from '../context/CartContext';
import { getVariantByProductColorSize } from '../services/variants.service';
import { Seo } from '../components/seo/Seo';
import { FavoriteButton } from '../components/products/FavoriteButton';
import productsService from '../services/products.service';
import type { Product } from '../types/product';
import { RelatedProducts } from '../components/products/RelatedProducts';
import { ProductReviewSection } from '../components/reviews/ProductReviewSection';
import toast from '../lib/toast';
import { errorMessage } from '../lib/http';

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
  const { format } = useCurrency();
  const { addStandardProduct, orderConfig } = useCart();
  const { categories } = useCatalogs();
  const { settings } = useSettings();
  const [infoTab, setInfoTab] = useState<'description' | 'sizes' | 'shipping'>('description');
  const [imageFailed, setImageFailed] = useState(false);

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


  // Cargar producto
  useEffect(() => {
    const fetchProduct = async () => {
      if (!id) return;

      setLoading(true);
      setError(null);

      try {
        const productData = await productsService.getById(Number(id));
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
      toast.error(errorMessage(error, 'No se pudo agregar al carrito'));
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
    setImageFailed(false);
    scrollToThumbnail(index);
  }, [scrollToThumbnail]);

  // Handlers para el zoom
  const handleMouseEnter = () => setIsZooming(!imageFailed && productImages.length > 0);
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

  // Cargando
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <StoreContainer className="py-6 lg:py-8 grid grid-cols-1 md:grid-cols-2 gap-8">
          <Skeleton className="aspect-square w-full rounded-xl" />
          <div className="space-y-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-7 w-32" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-10 w-2/3" />
            <Skeleton className="h-12 w-full" />
          </div>
        </StoreContainer>
      </div>
    );
  }

  // Error
  if (error || !product) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-2xl mx-auto px-3 md:px-6 py-16">
          <div className="bg-white rounded-xl border border-gray-200">
            <EmptyState
              icon={PackageX}
              title="Producto no encontrado"
              description={error || 'El producto que buscas no existe'}
              action={<Button onClick={() => navigate('/catalog')}>Ver catálogo</Button>}
            />
          </div>
        </div>
      </div>
    );
  }

  // Categoría por nombre (no el slug), con enlace al catálogo filtrado.
  const categorySlug = product.categorySlug || (typeof product.category === 'string' ? product.category : '');
  const categoryName = product.categoryName || categories.find((c) => c.slug === categorySlug)?.name || 'Catálogo';
  const categoryLink = categorySlug ? `/catalog?category=${encodeURIComponent(categorySlug)}` : '/catalog';
  // Guía de tallas solo si la tabla del tipo tiene alguna de las tallas del producto
  // (un bolso de talla única no muestra la tabla de camisetas).
  const chartCandidate = needsSize ? getSizeChart(sizeChartType(product.typeSlug, product.typeName)) : undefined;
  const productSizes = product.sizes.map((sz) => (typeof sz === 'string' ? sz : sz.abbreviation));
  const sizeChart = chartCandidate?.sizes.some((r) => productSizes.includes(r.size)) ? chartCandidate : undefined;
  const freeShipping = orderConfig.freeShippingThreshold;
  const returnsActive = settings.legal?.returnsPolicy?.isActive;
  const unitPrice = product.salePrice ?? product.basePrice;
  const addLabel = isAdding ? 'Agregando…' : addedSuccess ? 'Agregado' : 'Agregar al carrito';
  const onSale = product.hasDiscount && product.salePrice != null;
  const selectedColorName = product.colors.find((c) => c.hexCode === selectedColor)?.name;
  const optionLabel = 'text-sm font-medium text-gray-900';

  return (
    <div className="min-h-screen bg-gray-50">
      <Seo
        title={product.name}
        description={product.description}
        image={product.images.front}
        type="product"
      />
      {/* Migas: Inicio › Categoría › Producto (el título va junto al precio) */}
      <PageHeader variant="crumbs" title={product.name} backTo={categoryLink} backLabel={categoryName} />

      <StoreContainer className="py-6 lg:py-8 pb-28 md:pb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-10 items-start">
          {/* Galería */}
          <div className="md:sticky" style={{ top: 'calc(var(--store-header-h, 120px) + 1rem)' }}>
            <div
              ref={imageContainerRef}
              className="relative aspect-square rounded-xl overflow-hidden bg-white border border-gray-200 cursor-zoom-in"
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
              onMouseMove={handleMouseMove}
            >
              <ProductImage
                key={productImages[currentImageIndex]?.url ?? 'none'}
                src={productImages[currentImageIndex]?.url}
                alt={`${product.name} · ${productImages[currentImageIndex]?.label ?? 'imagen'}`}
                width={900}
                priority
                fit="contain"
                iconClassName="w-14 h-14"
                onFailed={() => { setImageFailed(true); setIsZooming(false); }}
                className={`bg-white transition-opacity duration-200 ${isZooming ? 'opacity-0' : 'opacity-100'}`}
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

              {onSale && (
                <div className="absolute top-3 left-3">
                  <Badge tone="green">
                    {product.discountType === 'percent' && product.discountValue ? `-${Math.round(product.discountValue)}%` : 'Oferta'}
                  </Badge>
                </div>
              )}

              {!isZooming && !imageFailed && productImages.length > 0 && (
                <div className="absolute bottom-3 right-3 hidden md:flex items-center gap-1 bg-white/90 border border-gray-200 text-gray-600 text-xs px-2 py-1 rounded-full">
                  <ZoomIn className="w-3.5 h-3.5" />
                  <span>Pasa el cursor para ampliar</span>
                </div>
              )}
            </div>

            {/* Miniaturas */}
            {productImages.length > 1 && (
              <div
                ref={thumbnailsContainerRef}
                className="flex gap-2 overflow-x-auto mt-3 pb-1 scroll-smooth"
                style={{ scrollbarWidth: 'thin' }}
              >
                {productImages.map((img, index) => (
                  <button
                    type="button"
                    key={index}
                    ref={(el) => { thumbnailRefs.current[index] = el; }}
                    onClick={() => handleImageChange(index)}
                    title={img.label}
                    className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 bg-white transition-colors ${
                      currentImageIndex === index ? 'border-app-600' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <ProductImage src={img.url} alt={img.label} width={120} iconClassName="w-5 h-5" draggable={false} />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Información y compra */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 md:p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link to={categoryLink} className="text-xs font-medium uppercase tracking-wide text-gray-500 hover:text-app-700">{categoryName}</Link>
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mt-1">{product.name}</h1>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0 -mr-2">
                <FavoriteButton productId={Number(product.id)} size={20} className="w-10 h-10 hover:bg-gray-100" />
                <IconButton title="Compartir" onClick={() => setShowShareModal(true)} className="w-10 h-10 flex items-center justify-center">
                  <Share2 className="w-5 h-5" />
                </IconButton>
              </div>
            </div>

            {/* Valoración */}
            {product.rating ? (
              <div className="flex items-center gap-1.5 mt-2 text-sm text-gray-600">
                <div className="flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className={`w-4 h-4 ${i < Math.round(Number(product.rating)) ? 'fill-amber-400 text-amber-400' : 'fill-gray-200 text-gray-200'}`} />
                  ))}
                </div>
                <span className="font-medium text-gray-900">{product.rating}</span>
                {product.reviewsCount ? <span className="text-gray-400">({product.reviewsCount} reseñas)</span> : null}
              </div>
            ) : null}

            {/* Precio */}
            <div className="flex items-baseline gap-2 flex-wrap mt-4">
              {onSale ? (
                <>
                  <span className="text-3xl font-bold text-gray-900">{format(product.salePrice!)}</span>
                  <span className="text-base text-gray-400 line-through">{format(product.basePrice)}</span>
                  {product.discountType === 'percent' && product.discountValue ? (
                    <Badge tone="green">Ahorras {Math.round(product.discountValue)}%</Badge>
                  ) : null}
                </>
              ) : (
                <span className="text-3xl font-bold text-gray-900">{format(product.basePrice)}</span>
              )}
            </div>

            {/* Descripción corta (la completa está en la pestaña Descripción) */}
            {product.description && (
              <p className="text-sm text-gray-600 leading-relaxed mt-4 line-clamp-3">{product.description}</p>
            )}

            <div className="border-t border-gray-100 my-5" />

            {/* Color */}
            {needsColor && (
              <div className="mb-5">
                <p className={optionLabel}>
                  Color{selectedColorName && <span className="font-normal text-gray-500">: {selectedColorName}</span>}
                </p>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  {product.colors.map((color) => (
                    <button
                      type="button"
                      key={color.hexCode}
                      onClick={() => {
                        setSelectedColor(color.hexCode);
                        if (color.image) {
                          const idx = productImages.findIndex((img) => img.url === color.image);
                          if (idx >= 0) setCurrentImageIndex(idx);
                        }
                      }}
                      className={`relative w-9 h-9 rounded-full transition-shadow ${
                        selectedColor === color.hexCode ? 'ring-2 ring-offset-2 ring-app-600' : 'hover:ring-2 hover:ring-offset-2 hover:ring-gray-300'
                      }`}
                      style={{ backgroundColor: color.hexCode }}
                      title={color.name}
                      aria-label={color.name}
                      aria-pressed={selectedColor === color.hexCode}
                    >
                      <span className={`absolute inset-0 rounded-full border ${isLightColor(color.hexCode) ? 'border-gray-300' : 'border-transparent'}`} />
                      {selectedColor === color.hexCode && (
                        <Check className={`absolute inset-0 m-auto w-4 h-4 ${isLightColor(color.hexCode) ? 'text-gray-800' : 'text-white'}`} />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Talla */}
            {needsSize && (
              <div className="mb-5">
                <div className="flex items-center justify-between gap-2">
                  <p className={optionLabel}>Talla</p>
                  {sizeChart && (
                    <button
                      type="button"
                      onClick={() => {
                        setInfoTab('sizes');
                        document.getElementById('product-info')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }}
                      className="inline-flex items-center gap-1 text-xs font-medium text-app-700 hover:underline"
                    >
                      <Ruler className="w-3.5 h-3.5" />Guía de tallas
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {product.sizes.map((size) => {
                    const sizeValue = typeof size === 'string' ? size : size.abbreviation;
                    const sizeName = typeof size === 'string' ? size : size.name;
                    const active = selectedSize === sizeValue;
                    return (
                      <button
                        type="button"
                        key={sizeValue}
                        onClick={() => setSelectedSize(sizeValue)}
                        className={`min-w-[3rem] h-10 px-3 rounded-lg border text-sm font-medium transition-colors ${
                          active ? 'border-app-600 bg-app-50 text-app-700 ring-1 ring-app-600' : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                        }`}
                        title={sizeName}
                        aria-pressed={active}
                      >
                        {sizeValue}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Cantidad y disponibilidad */}
            <div className="mb-5">
              <p className={optionLabel}>Cantidad</p>
              <div className="flex items-center gap-3 mt-2">
                <QuantityStepper
                  value={quantity}
                  onDecrease={() => setQuantity(Math.max(1, quantity - 1))}
                  onIncrease={() => setQuantity(quantity + 1)}
                  canDecrease={quantity > 1}
                  canIncrease={!(availableStock !== null && quantity >= availableStock)}
                />
                {loadingStock ? (
                  <span className="text-sm text-gray-400">Verificando disponibilidad…</span>
                ) : availableStock !== null && (
                  <span className={`text-sm font-medium ${isOutOfStock ? 'text-red-600' : hasInsufficientStock ? 'text-amber-700' : 'text-green-700'}`}>
                    {isOutOfStock ? 'Sin stock' : `${availableStock} disponibles`}
                  </span>
                )}
              </div>
            </div>

            {/* Agregar al carrito */}
            <Button
              size="lg"
              fullWidth
              onClick={handleAddToCart}
              disabled={!canAddToCart}
              isLoading={isAdding}
              variant={addedSuccess ? 'success' : 'primary'}
              icon={addedSuccess ? <Check className="w-5 h-5" /> : isAdding ? undefined : <ShoppingCart className="w-5 h-5" />}
            >
              {isAdding
                ? 'Agregando…'
                : addedSuccess
                  ? 'Agregado al carrito'
                  : `Agregar al carrito · ${format(unitPrice * quantity)}`}
            </Button>
            {product.isTemplate && (
              <Button
                size="lg"
                fullWidth
                variant="secondary"
                className="mt-2"
                icon={<Palette className="w-5 h-5" />}
                onClick={() => navigate(`/customize?template=${product.id}`)}
              >
                Personalizar con tu diseño
              </Button>
            )}
            {!hasRequiredSelection && (
              <p className="text-xs text-gray-500 text-center mt-2">
                Selecciona {[needsColor && !selectedColor && 'un color', needsSize && !selectedSize && 'una talla'].filter(Boolean).join(' y ')} para continuar
              </p>
            )}

            <ul className="mt-5 pt-5 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-gray-500">
              <li className="flex items-center gap-1.5"><Truck className="w-4 h-4 text-gray-400" />Envío a todo el país</li>
              <li className="flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-gray-400" />Pago seguro</li>
              <li className="flex items-center gap-1.5"><RotateCcw className="w-4 h-4 text-gray-400" />Devolución en 30 días</li>
            </ul>
          </div>
        </div>

        {/* Descripción · Guía de tallas · Envío y devoluciones */}
        <section id="product-info" className="mt-8 bg-white rounded-xl border border-gray-200 scroll-mt-40">
          <div className="px-4 md:px-6 pt-2">
            <Tabs
              value={infoTab}
              onChange={setInfoTab}
              tabs={[
                { value: 'description', label: 'Descripción' },
                { value: 'sizes', label: 'Guía de tallas', hidden: !sizeChart },
                { value: 'shipping', label: 'Envío y devoluciones' },
              ]}
            />
          </div>
          <div className="p-4 md:p-6 text-sm text-gray-600 leading-relaxed">
            {infoTab === 'description' && (
              <div className="space-y-3 max-w-3xl">
                {product.description ? <p className="whitespace-pre-line">{product.description}</p> : <p className="text-gray-400">Este producto aún no tiene descripción.</p>}
                {product.tags && product.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">{product.tags.map((t) => <Badge key={t}>{t}</Badge>)}</div>
                )}
                {product.sku && <p className="text-xs text-gray-400">Referencia: {product.sku}</p>}
              </div>
            )}
            {infoTab === 'sizes' && sizeChart && (
              <div className="space-y-3">
                <p className="max-w-3xl">{sizeChart.guide}</p>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                        <th className="py-2 pr-4 font-semibold">Talla</th>
                        {sizeChart.sizes.some((r) => r.chest) && <th className="py-2 pr-4 font-semibold">Pecho (cm)</th>}
                        {sizeChart.sizes.some((r) => r.length) && <th className="py-2 pr-4 font-semibold">Largo (cm)</th>}
                        {sizeChart.sizes.some((r) => r.shoulders) && <th className="py-2 pr-4 font-semibold">Hombros (cm)</th>}
                        {sizeChart.sizes.some((r) => r.sleeves) && <th className="py-2 pr-4 font-semibold">Manga (cm)</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {sizeChart.sizes.map((r) => (
                        <tr key={r.size} className={`border-b border-gray-100 ${r.size === selectedSize ? 'bg-app-50 text-app-800 font-medium' : ''}`}>
                          <td className="py-2 pr-4 font-semibold text-gray-900">{r.size}</td>
                          {sizeChart.sizes.some((x) => x.chest) && <td className="py-2 pr-4">{r.chest ?? '—'}</td>}
                          {sizeChart.sizes.some((x) => x.length) && <td className="py-2 pr-4">{r.length ?? '—'}</td>}
                          {sizeChart.sizes.some((x) => x.shoulders) && <td className="py-2 pr-4">{r.shoulders ?? '—'}</td>}
                          {sizeChart.sizes.some((x) => x.sleeves) && <td className="py-2 pr-4">{r.sleeves ?? '—'}</td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-gray-400">Medidas aproximadas de la prenda.</p>
              </div>
            )}
            {infoTab === 'shipping' && (
              <ul className="space-y-3 max-w-3xl">
                <li className="flex gap-2.5"><Truck className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" /><span>Enviamos a todo el país. El costo exacto se calcula en el pago según tu ciudad{freeShipping > 0 ? <>, y es <strong className="text-gray-900">gratis desde {format(freeShipping)}</strong></> : null}.</span></li>
                <li className="flex gap-2.5"><RotateCcw className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" /><span>Tienes 30 días para cambios y devoluciones.{returnsActive && <> Revisa la <Link to="/legal/returns" className="text-app-700 hover:underline">política de devoluciones</Link>.</>}</span></li>
                <li className="flex gap-2.5"><ShieldCheck className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" /><span>Pago seguro: tus datos viajan cifrados.</span></li>
              </ul>
            )}
          </div>
        </section>

        {/* Productos relacionados */}
        <div className="mt-10">
          <RelatedProducts product={product} />
        </div>

        {/* Reseñas */}
        <div className="mt-10 bg-white rounded-xl border border-gray-200 p-4 md:p-6">
          <ProductReviewSection productId={product.id} />
        </div>
      </StoreContainer>

      {/* Celular: precio y "Agregar" siempre a mano, encima de la navegación inferior.
          El espaciador evita que la barra tape el final de la página. */}
      <div className="md:hidden h-[72px]" aria-hidden="true" />
      <div className="md:hidden fixed inset-x-0 bottom-[var(--store-bottom-nav)] z-40 bg-white border-t border-gray-200 px-3 py-2.5 shadow-[0_-4px_12px_rgba(0,0,0,0.04)]">
        <div className="flex items-center gap-3">
          <div className="min-w-0">
            <p className="text-base font-bold text-gray-900 leading-tight">{format(unitPrice * quantity)}</p>
            <p className={`text-xs truncate ${isOutOfStock ? 'text-red-600' : 'text-gray-500'}`}>
              {isOutOfStock ? 'Sin stock' : [selectedColorName, selectedSize && `Talla ${selectedSize}`, quantity > 1 && `${quantity} u.`].filter(Boolean).join(' · ') || product.name}
            </p>
          </div>
          <Button
            className="flex-1"
            onClick={handleAddToCart}
            disabled={!canAddToCart}
            isLoading={isAdding}
            variant={addedSuccess ? 'success' : 'primary'}
            icon={addedSuccess ? <Check className="w-4 h-4" /> : isAdding ? undefined : <ShoppingCart className="w-4 h-4" />}
          >
            {addLabel}
          </Button>
        </div>
      </div>

      {/* Compartir */}
      <Dialog open={showShareModal} onClose={() => setShowShareModal(false)} title="Compartir producto" size="sm">
        <div className="grid grid-cols-4 gap-2 mb-5">
          {[
            { label: 'WhatsApp', onClick: shareOnWhatsApp, Icon: WhatsAppIcon, cls: 'bg-[#25D366]' },
            { label: 'Facebook', onClick: shareOnFacebook, Icon: FacebookIcon, cls: 'bg-[#1877F2]' },
            { label: 'X', onClick: shareOnTwitter, Icon: TwitterIcon, cls: 'bg-black' },
            { label: 'Telegram', onClick: shareOnTelegram, Icon: TelegramIcon, cls: 'bg-[#229ED9]' },
          ].map(({ label, onClick, Icon, cls }) => (
            <button
              type="button"
              key={label}
              onClick={onClick}
              className="flex flex-col items-center gap-2 p-2 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <span className={`w-11 h-11 rounded-full flex items-center justify-center text-white ${cls}`}>
                <Icon />
              </span>
              <span className="text-xs text-gray-600">{label}</span>
            </button>
          ))}
        </div>

        <Field label="O copia el enlace">
          <div className="flex gap-2">
            <TextInput readOnly value={getShareUrl()} className="flex-1 min-w-0 text-gray-600" onFocus={(e) => e.currentTarget.select()} />
            <Button
              variant={copySuccess ? 'success' : 'secondary'}
              onClick={copyLink}
              icon={copySuccess ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            >
              {copySuccess ? 'Copiado' : 'Copiar'}
            </Button>
          </div>
        </Field>
      </Dialog>
    </div>
  );
}
