import type { ProductType } from './catalog';

export const LabelZoneType = {
  PRODUCT_NAME: 'PRODUCT_NAME',
  SIZE: 'SIZE',
  COLOR: 'COLOR',
  BARCODE: 'BARCODE',
  BARCODE_TEXT: 'BARCODE_TEXT',
  SKU: 'SKU',
  PRICE: 'PRICE',
  CUSTOM_TEXT: 'CUSTOM_TEXT',
} as const;
export type LabelZoneType = (typeof LabelZoneType)[keyof typeof LabelZoneType];

export interface LabelZone {
  id: number;
  labelTemplateId: number;
  zoneType: LabelZoneType;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontWeight: string;
  textAlign: string;
  fontColor: string;
  showLabel: boolean;
  rotation: number;
  zIndex: number;
  createdAt: string;
  updatedAt: string;
}

export interface LabelTemplateProductType {
  id: number;
  labelTemplateId: number;
  productTypeId: number;
  productType: ProductType;
  createdAt: string;
}

export interface LabelTemplate {
  id: number;
  name: string;
  backgroundImage: string | null;
  width: number;
  height: number;
  pageType: string;
  pageMargin: number;
  labelSpacing: number;
  isDefault: boolean;
  isActive: boolean;
  zones: LabelZone[];
  productTypes: LabelTemplateProductType[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateLabelTemplateInput {
  name: string;
  productTypeIds?: number[];
  backgroundImage?: string | null;
  width?: number;
  height?: number;
  pageType?: string;
  pageMargin?: number;
  labelSpacing?: number;
  isDefault?: boolean;
}

export interface UpdateLabelTemplateInput {
  name?: string;
  productTypeIds?: number[];
  backgroundImage?: string | null;
  width?: number;
  height?: number;
  pageType?: string;
  pageMargin?: number;
  labelSpacing?: number;
  isDefault?: boolean;
  isActive?: boolean;
}

export interface CreateLabelZoneInput {
  zoneType: LabelZoneType;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize?: number;
  fontWeight?: string;
  textAlign?: string;
  fontColor?: string;
  showLabel?: boolean;
  rotation?: number;
  zIndex?: number;
}

export interface UpdateLabelZoneInput {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fontSize?: number;
  fontWeight?: string;
  textAlign?: string;
  fontColor?: string;
  showLabel?: boolean;
  rotation?: number;
  zIndex?: number;
}

// Helpers para las etiquetas de los tipos de zona
export const ZONE_TYPE_LABELS: Record<LabelZoneType, string> = {
  [LabelZoneType.PRODUCT_NAME]: 'Nombre del Producto',
  [LabelZoneType.SIZE]: 'Talla',
  [LabelZoneType.COLOR]: 'Color',
  [LabelZoneType.BARCODE]: 'Código de Barras (Imagen)',
  [LabelZoneType.BARCODE_TEXT]: 'Código de Barras (Número)',
  [LabelZoneType.SKU]: 'SKU',
  [LabelZoneType.PRICE]: 'Precio',
  [LabelZoneType.CUSTOM_TEXT]: 'Texto Personalizado',
};

// Datos de ejemplo para vista previa
export const ZONE_SAMPLE_DATA: Record<LabelZoneType, string> = {
  [LabelZoneType.PRODUCT_NAME]: 'Camiseta Personalizada',
  [LabelZoneType.SIZE]: 'Talla: M',
  [LabelZoneType.COLOR]: 'Color: Azul',
  [LabelZoneType.BARCODE]: '[BARCODE]', // Se renderiza como imagen
  [LabelZoneType.BARCODE_TEXT]: '1234567890123',
  [LabelZoneType.SKU]: 'SKU: CAM-001-M',
  [LabelZoneType.PRICE]: '$28,000',
  [LabelZoneType.CUSTOM_TEXT]: 'Texto personalizado',
};
