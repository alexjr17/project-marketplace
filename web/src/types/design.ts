import type { ProductTypeSlug } from './product';

/**
 * Diseño colocado sobre una vista del modelo. Posición y tamaño en % de la imagen de la
 * vista: position = centro del diseño, size = ancho y alto.
 */
export interface Design {
  id: string;
  /** Vista donde está el diseño (slug del tipo de zona: "frente", "espalda"…). */
  viewSlug?: string;
  /** Igual a viewSlug; se conserva porque los ítems viejos del carrito solo traen este. */
  viewType: string;
  /** "view-<slug>" (formato viejo). */
  zoneId: string;
  /** Zona de impresión del modelo (la que define el precio). */
  templateZoneId?: number;
  zoneName?: string;
  /** Formato viejo, sin uso. */
  slotKey?: string;
  imageUrl?: string;
  /** Imagen para mostrar (comprimida) o su URL subida. */
  imageData?: string;
  /** Imagen de producción (calidad original) o su URL subida. */
  originalImageData?: string;
  originalFileName?: string;
  originalFileSize?: number;
  /** Píxeles de la imagen original (para estimar la resolución de impresión). */
  pixelWidth?: number;
  pixelHeight?: number;
  position: { x: number; y: number };
  size: { width: number; height: number };
  rotation: number; // grados
  opacity: number; // 0 a 1
}

/** Imágenes de producción (originales). */
export interface ProductionImages {
  front?: string;
  back?: string;
}

/** Precio de una zona usada en la personalización. */
export interface ZonePriceLine {
  id: number;
  name: string;
  zoneTypeSlug: string;
  price: number;
}

/** Producto personalizado tal como se guarda en el carrito. */
export interface CustomizedProduct {
  id: string;
  /** 2 = personalizador nuevo (zonas con precio, vistas previas por vista). Sin valor = formato viejo. */
  version?: 2;
  productId: string;
  productType: ProductTypeSlug;
  productName: string;
  basePrice: number;
  selectedColor: string;
  selectedColorName?: string;
  colorId?: number;
  selectedSize: string;
  sizeId?: number;
  designs: Design[];
  /** Mockup de cada vista con diseño, por slug de vista. */
  previews?: Record<string, string>;
  previewImages: {
    front: string;
    back?: string;
  };
  productionImages?: ProductionImages;
  zonePrices?: ZonePriceLine[];
  customizationPrice: number;
  totalPrice: number;
  createdAt: Date;
  templateId?: number;
  templateSlug?: string;
  /** Formato viejo (ya no se escriben). */
  templateImages?: { front: string; back?: string };
  zoneTypeImages?: Record<string, string>;
}

/** Diseño dentro de `customization` del pedido (contrato v2). */
export interface OrderCustomizationDesign {
  id: string;
  viewSlug: string;
  templateZoneId: number | null;
  zoneName?: string;
  imageData: string;
  originalImageData?: string;
  originalFileName?: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  rotation: number;
  opacity: number;
}

/**
 * `items[].customization` del pedido. v2 trae todo el diseño; las claves designFront/Back y
 * originalFront/Back se mantienen (son las que leen el detalle del pedido y producción).
 */
export interface OrderCustomization {
  version?: 2;
  templateId?: number;
  colorId?: number | null;
  sizeId?: number | null;
  designs?: OrderCustomizationDesign[];
  previews?: Record<string, string>;
  designFront?: string;
  designBack?: string;
  originalFront?: string;
  originalBack?: string;
  customizationPrice?: number;
  totalPrice?: number;
}
