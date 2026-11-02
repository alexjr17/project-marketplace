import type { ProductTypeSlug } from '../types/product';

// Medidas en centímetros
export interface SizeMeasurements {
  size: string;
  chest?: number;      // Contorno de pecho
  length?: number;     // Largo total
  shoulders?: number;  // Ancho de hombros
  sleeves?: number;    // Largo de manga
  waist?: number;      // Contorno de cintura
  hips?: number;       // Contorno de cadera
  diameter?: number;   // Diámetro (para gorras, botellas)
  height?: number;     // Altura (para botellas, tazas)
  width?: number;      // Ancho (para almohadas)
  scale?: number;      // Factor de escala visual (0.8 - 1.2, donde 1.0 es M)
}

export interface SizeChart {
  productType: ProductTypeSlug;
  productName: string;
  sizes: SizeMeasurements[];
  guide: string; // Guía de cómo medir
}

export const sizeCharts: SizeChart[] = [
  {
    productType: 'tshirt',
    productName: 'Camiseta',
    guide: 'Mide el contorno del pecho en la parte más ancha y el largo desde el hombro hasta el final de la prenda.',
    sizes: [
      { size: 'XS', chest: 86, length: 68, shoulders: 41, sleeves: 19, scale: 0.85 },
      { size: 'S', chest: 91, length: 70, shoulders: 44, sleeves: 20, scale: 0.92 },
      { size: 'M', chest: 97, length: 72, shoulders: 47, sleeves: 21, scale: 1.0 },
      { size: 'L', chest: 104, length: 74, shoulders: 50, sleeves: 22, scale: 1.08 },
      { size: 'XL', chest: 112, length: 76, shoulders: 53, sleeves: 23, scale: 1.15 },
      { size: 'XXL', chest: 120, length: 78, shoulders: 56, sleeves: 24, scale: 1.22 },
    ],
  },
  {
    productType: 'hoodie',
    productName: 'Sudadera',
    guide: 'Mide el contorno del pecho en la parte más ancha, el largo desde el cuello hasta el final y el ancho de hombros.',
    sizes: [
      { size: 'S', chest: 102, length: 68, shoulders: 50, sleeves: 60, scale: 0.92 },
      { size: 'M', chest: 108, length: 70, shoulders: 52, sleeves: 62, scale: 1.0 },
      { size: 'L', chest: 114, length: 72, shoulders: 54, sleeves: 64, scale: 1.08 },
      { size: 'XL', chest: 120, length: 74, shoulders: 56, sleeves: 66, scale: 1.15 },
      { size: 'XXL', chest: 126, length: 76, shoulders: 58, sleeves: 68, scale: 1.22 },
    ],
  },
  {
    productType: 'cap',
    productName: 'Gorra',
    guide: 'Talla única ajustable que se adapta a la mayoría de las cabezas.',
    sizes: [
      { size: 'Única', diameter: 58 }, // Circunferencia estándar
    ],
  },
  {
    productType: 'bottle',
    productName: 'Botella Térmica',
    guide: 'Capacidad y dimensiones de la botella.',
    sizes: [
      { size: '500ml', diameter: 7, height: 23 },
    ],
  },
  {
    productType: 'mug',
    productName: 'Taza',
    guide: 'Capacidad y dimensiones de la taza.',
    sizes: [
      { size: '350ml', diameter: 8, height: 10 },
    ],
  },
  {
    productType: 'pillow',
    productName: 'Almohada Decorativa',
    guide: 'Dimensiones del cojín cuadrado.',
    sizes: [
      { size: '45x45cm', width: 45, height: 45 },
    ],
  },
];

// Helper para obtener la guía de tallas de un producto
export const getSizeChart = (productType: ProductTypeSlug): SizeChart | undefined => {
  return sizeCharts.find(chart => chart.productType === productType);
};

// Helper para obtener las tallas disponibles de un producto
export const getAvailableSizes = (productType: ProductTypeSlug): string[] => {
  const chart = getSizeChart(productType);
  return chart?.sizes.map(s => s.size) || [];
};

// Helper para obtener las medidas de una talla específica
export const getSizeMeasurements = (productType: ProductTypeSlug, size: string): SizeMeasurements | undefined => {
  const chart = getSizeChart(productType);
  return chart?.sizes.find(s => s.size === size);
};
