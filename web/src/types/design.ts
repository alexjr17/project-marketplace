import type { PrintZone, ProductType } from './product';

// Diseño aplicado a una vista del template (front/back)
// El posicionamiento es libre sobre el área del template PNG
export interface Design {
  id: string;
  zoneId: PrintZone; // Ahora representa la vista (front/back) no una zona específica
  viewType: string; // 'front', 'back', etc. - tipo de vista donde está el diseño
  // Modo admin: identifica la zona de impresión concreta donde se colocó el diseño.
  // El cliente normal no los usa (un solo diseño por vista).
  slotKey?: string; // Clave única del "slot": vista para cliente, `${vista}::${zonaId}` para admin
  templateZoneId?: number; // Id de la zona de impresión del template (solo admin)
  zoneName?: string; // Nombre legible de la zona (solo admin)
  imageUrl: string;
  imageData?: string; // Base64 comprimido para preview
  originalImageData?: string; // Base64 original sin compresión para producción
  colorizedImageData?: string; // Base64 con color aplicado (para preview)
  originalFileName?: string; // Nombre original del archivo
  originalFileSize?: number; // Tamaño original en bytes
  // Posición como porcentaje del área del template (0-100)
  // 50,50 = centrado en el template
  position: {
    x: number; // Porcentaje horizontal (0=izquierda, 100=derecha)
    y: number; // Porcentaje vertical (0=arriba, 100=abajo)
  };
  // Tamaño como porcentaje del ancho del template
  size: {
    width: number;  // Porcentaje del ancho del template
    height: number; // Porcentaje del alto del template
  };
  rotation: number; // En grados
  opacity: number;  // 0 a 1
  tintColor?: string; // Color aplicado al diseño (hex)
  filters?: {
    brightness?: number;
    contrast?: number;
    grayscale?: boolean;
  };
}

// Imágenes de producción (originales sin compresión)
export interface ProductionImages {
  front?: string; // Base64 original para producción
  back?: string;
}

// Configuración de zona guardada (para recrear el diseño)
export interface SavedZoneConfig {
  zoneId: string;
  zoneName: string;
  zoneTypeSlug: string;
  positionX: number; // Porcentaje
  positionY: number;
  maxWidth: number;
  maxHeight: number;
}

// Producto personalizado
export interface CustomizedProduct {
  id: string;
  productId: string;
  productType: ProductType;
  productName: string;
  basePrice: number;
  selectedColor: string;
  selectedColorName?: string; // Nombre del color para mostrar
  colorId?: number; // ID del color para validación de stock
  selectedSize: string;
  sizeId?: number; // ID de la talla para validación de stock
  designs: Design[];
  previewImages: {
    front: string; // Comprimido para preview
    back?: string;
  };
  productionImages?: ProductionImages; // Originales para producción
  customizationPrice: number; // Precio adicional por personalización
  totalPrice: number;
  createdAt: Date;

  // Datos del template para poder recrear/editar
  templateId?: number;
  templateSlug?: string;
  templateImages?: {
    front: string;
    back?: string;
  };
  zoneTypeImages?: Record<string, string>; // Imágenes por tipo de zona
  savedZones?: SavedZoneConfig[]; // Configuración de zonas guardadas
}

// Estado del editor de personalización
export interface CustomizerState {
  productId: string | null;
  productType: ProductType | null;
  selectedColor: string;
  selectedSize: string;
  currentView: 'front' | 'back';
  currentZone: PrintZone | null;
  designs: Design[];
  isUploading: boolean;
  isSaving: boolean;
}
