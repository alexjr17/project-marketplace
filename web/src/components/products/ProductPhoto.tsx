/**
 * Foto principal de un producto en la tienda: si el producto tiene fondo, la foto recortada sobre ese
 * fondo; si no, la foto tal cual (ProductImage).
 */
import type { ProductBackdrop } from '../../types/product';
import { assetUrl } from '../../utils/assetUrl';
import { ProductImage } from './ProductImage';

export function ProductPhoto({ src, backdrop, alt, className = '', fit, padded = true, sizes }: {
  src?: string | null;
  backdrop?: ProductBackdrop | null;
  alt: string;
  className?: string;
  fit?: 'cover' | 'contain';
  /** Margen alrededor del producto sobre el fondo. */
  padded?: boolean;
  sizes?: number;
}) {
  if (!backdrop?.url) return <ProductImage src={src ?? undefined} alt={alt} className={className} fit={fit} width={sizes} />;
  const fg = backdrop.cutout || src;
  return (
    <div className={`relative w-full h-full overflow-hidden ${className}`} style={{ backgroundImage: `url("${assetUrl(backdrop.url)}")`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
      {fg && (
        <img src={assetUrl(fg)} alt={alt} loading="lazy" draggable={false}
          className={`absolute inset-0 w-full h-full object-contain ${padded ? 'p-[8%]' : ''} ${backdrop.cutout ? 'drop-shadow-[0_18px_22px_rgba(0,0,0,0.28)]' : 'rounded-lg'}`} />
      )}
    </div>
  );
}
