import { useRef, useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, ImageIcon, Loader2 } from 'lucide-react';
import { designImagesService, type DesignImage } from '../../services/design-images.service';

interface ImageCarouselProps {
  onImageSelect: (thumbnailUrl: string, fullUrl: string, imageName: string) => void;
  isLoading?: boolean;
}

export const ImageCarousel = ({ onImageSelect, isLoading }: ImageCarouselProps) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [images, setImages] = useState<DesignImage[]>([]);
  const [loadingImages, setLoadingImages] = useState(true);

  // Cargar imágenes desde la API
  useEffect(() => {
    const loadImages = async () => {
      try {
        setLoadingImages(true);
        const data = await designImagesService.getAll({ isActive: true });
        // Asegurar que siempre sea un array
        setImages(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Error cargando imágenes de diseño:', error);
        setImages([]);
      } finally {
        setLoadingImages(false);
      }
    };
    loadImages();
  }, []);

  // Verificar scroll disponible
  const checkScroll = () => {
    const container = scrollContainerRef.current;
    if (container) {
      setCanScrollLeft(container.scrollLeft > 0);
      setCanScrollRight(
        container.scrollLeft < container.scrollWidth - container.clientWidth - 10
      );
    }
  };

  useEffect(() => {
    checkScroll();
    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener('scroll', checkScroll);
      return () => container.removeEventListener('scroll', checkScroll);
    }
  }, []);

  const scroll = (direction: 'left' | 'right') => {
    const container = scrollContainerRef.current;
    if (container) {
      const scrollAmount = 200;
      container.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  // Usar imagen - envía thumbnail para preview y fullUrl para el pedido
  const handleImageClick = async (image: DesignImage) => {
    setSelectedId(image.id);

    try {
      // Convertir thumbnail a base64 para el preview en el personalizador
      const response = await fetch(image.thumbnailUrl);
      const blob = await response.blob();
      const reader = new FileReader();

      reader.onloadend = () => {
        const base64 = reader.result as string;
        // Enviar: thumbnail (base64 para preview), fullUrl (URL original para pedido), nombre
        onImageSelect(base64, image.fullUrl, image.name);
      };

      reader.readAsDataURL(blob);
    } catch (error) {
      console.error('Error loading image:', error);
      // Si falla, usar las URLs directamente
      onImageSelect(image.thumbnailUrl, image.fullUrl, image.name);
    }
  };

  // Si está cargando las imágenes
  if (loadingImages) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="w-6 h-6 animate-spin text-app-600" />
        <span className="ml-2 text-sm text-gray-500">Cargando diseños...</span>
      </div>
    );
  }

  // Si no hay imágenes disponibles
  if (!images || images.length === 0) {
    return (
      <div className="text-center py-4">
        <ImageIcon className="w-8 h-8 text-gray-300 mx-auto mb-2" />
        <p className="text-sm text-gray-500">No hay diseños disponibles</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ImageIcon className="w-4 h-4 text-gray-600" />
          <span className="text-sm font-medium text-gray-700">Diseños prediseñados</span>
        </div>
        <span className="text-xs text-gray-500">{images.length} disponibles</span>
      </div>

      <div className="relative group">
        {/* Botón scroll izquierda */}
        {canScrollLeft && (
          <button
            onClick={() => scroll('left')}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white/90 hover:bg-white shadow-md rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <ChevronLeft className="w-4 h-4 text-gray-700" />
          </button>
        )}

        {/* Contenedor con scroll horizontal */}
        <div
          ref={scrollContainerRef}
          className="flex gap-3 overflow-x-auto scrollbar-hide pb-2 scroll-smooth"
          style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        >
          {images.map((image) => (
            <div key={image.id} className="flex-shrink-0 relative group">
              <button
                onClick={() => handleImageClick(image)}
                disabled={isLoading}
                className={`w-16 h-16 rounded-lg border-2 overflow-hidden transition-all focus:outline-none focus:ring-2 focus:ring-app-400 ${
                  selectedId === image.id
                    ? 'border-app-600 ring-2 ring-app-200'
                    : 'border-gray-200 hover:border-app-300'
                } ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                title={`Usar ${image.name}`}
              >
                <img
                  src={image.thumbnailUrl}
                  alt={image.name}
                  className="w-full h-full object-contain p-2 bg-gray-50"
                  loading="lazy"
                />
              </button>
            </div>
          ))}
        </div>

        {/* Botón scroll derecha */}
        {canScrollRight && (
          <button
            onClick={() => scroll('right')}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white/90 hover:bg-white shadow-md rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <ChevronRight className="w-4 h-4 text-gray-700" />
          </button>
        )}

        {/* Indicador de scroll en móvil */}
        <div className="flex justify-center gap-1 mt-2 md:hidden">
          <div className={`h-1 rounded-full transition-all ${canScrollLeft ? 'w-4 bg-app-400' : 'w-2 bg-gray-300'}`} />
          <div className={`h-1 rounded-full transition-all ${canScrollRight ? 'w-4 bg-app-400' : 'w-2 bg-gray-300'}`} />
        </div>
      </div>

      <p className="text-xs text-gray-500 text-center">
        Toca una imagen para usarla en tu diseño
      </p>
    </div>
  );
};
