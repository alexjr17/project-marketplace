import { useState, type ImgHTMLAttributes } from 'react';
import { ImageOff } from 'lucide-react';

/** Para imágenes servidas por nuestro endpoint (/api/img/…), pide un ancho acorde. */
export function sizedImage(url: string | null | undefined, w: number): string {
  if (!url) return '';
  if (!url.includes('/api/img/')) return url;
  return url + (url.includes('?') ? '&' : '?') + 'w=' + w;
}

interface ProductImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'onError'> {
  src?: string | null;
  alt: string;
  /** Ancho pedido al endpoint de imágenes (si la URL es nuestra). */
  width?: number;
  /** Carga con prioridad (primeras tarjetas visibles). */
  priority?: boolean;
  /** Tamaño del icono del respaldo. */
  iconClassName?: string;
  /** cover (tarjetas, por defecto) o contain (galería: se ve la prenda completa). */
  fit?: 'cover' | 'contain';
  /** Avisa cuando la imagen no carga (p. ej. para apagar el zoom). */
  onFailed?: () => void;
}

/**
 * Imagen de producto o categoría que llena a su contenedor (el contenedor fija la proporción).
 * Si no hay URL o la imagen falla, muestra un respaldo limpio (fondo gris con icono) en vez
 * del texto alternativo o el icono roto del navegador.
 */
export function ProductImage({ src, alt, width = 400, priority = false, className = '', iconClassName = 'w-8 h-8', fit = 'cover', onFailed, ...rest }: ProductImageProps) {
  const url = sizedImage(src, width);
  const [failed, setFailed] = useState<string | null>(null);

  if (!url || failed === url) {
    return (
      <div role="img" aria-label={alt} className={`w-full h-full flex items-center justify-center bg-gray-100 text-gray-300 ${className}`}>
        <ImageOff className={iconClassName} strokeWidth={1.5} />
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={alt}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : 'auto'}
      decoding="async"
      width={width}
      height={width}
      onError={() => { setFailed(url); onFailed?.(); }}
      className={`w-full h-full ${fit === 'contain' ? 'object-contain' : 'object-cover'} bg-gray-100 text-transparent ${className}`}
      {...rest}
    />
  );
}

export default ProductImage;
