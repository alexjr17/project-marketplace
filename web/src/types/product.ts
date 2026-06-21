// Tipos de productos disponibles (enfocados en sublimación)
export type ProductType =
  // Ropa sublimable
  | 'tshirt'           // Camiseta
  | 'hoodie'           // Hoodie/Buzo con capucha
  | 'sweatshirt'       // Suéter/Buzo sin capucha
  | 'polo'             // Polo
  | 'tanktop'          // Camisilla
  | 'longsleeve'       // Manga larga
  // Accesorios sublimables
  | 'cap'              // Gorra
  | 'totebag'          // Bolsa de tela
  | 'keychain'         // Llavero
  | 'mousepad'         // Mouse pad
  | 'phonecase'        // Funda de celular
  | 'lanyard'          // Cordón/Lanyard
  // Drinkware (bebidas)
  | 'mug'              // Taza cerámica
  | 'magicmug'         // Taza mágica (cambia color)
  | 'bottle'           // Botella/Termo
  | 'tumbler'          // Vaso térmico
  // Hogar y decoración
  | 'aluminumframe'    // Cuadro en aluminio
  | 'coaster'          // Posa vasos
  | 'pillow'           // Cojín/Almohada
  | 'blanket'          // Manta/Cobija
  | 'clock'            // Reloj de pared
  | 'puzzle'           // Rompecabezas
  // Oficina
  | 'notebook'         // Libreta/Cuaderno
  | 'calendar';        // Calendario

// Categorías de productos
export type ProductCategory = 'clothing' | 'accessories' | 'drinkware' | 'home' | 'office';

// Zonas de estampado para cada tipo de producto
export type PrintZone =
  | 'front'          // Frente genérico
  | 'back'           // Espalda genérico
  | 'front-regular'  // Frente regular 18x25cm
  | 'front-large'    // Frente grande 20x30cm
  | 'back-large'     // Espalda grande
  | 'back-neck'      // Cuello (espalda)
  | 'back-center'    // Centro mediano (espalda)
  | 'sleeve-small'   // Manga pequeña 6x7cm
  | 'sleeve-large'   // Manga grande 7x30cm
  | 'left-sleeve'    // Manga izquierda
  | 'right-sleeve'   // Manga derecha
  | 'chest'          // Pecho (pequeño)
  | 'around'         // Alrededor (botellas, tazas)
  | 'top';           // Superior (gorras)

// Configuración de zona de estampado
export interface PrintZoneConfig {
  id: PrintZone;
  name: string;
  maxWidth: number;  // Ancho máximo en píxeles
  maxHeight: number; // Alto máximo en píxeles
  position: {
    x: number;
    y: number;
  };
}

// Configuración de tipo de producto
export interface ProductTypeConfig {
  type: ProductType;
  name: string;
  category: ProductCategory;
  basePrice: number;
  printZones: PrintZoneConfig[];
  availableColors: string[];
  availableSizes: string[];
  description: string;
}

// Producto base del catálogo
export interface Product {
  id: number | string; // Puede ser número (DB) o string (mock)
  sku?: string;
  slug?: string;
  name: string;
  description: string;
  // Campos de relación con la BD (slugs en español)
  categorySlug?: string;  // Slug de categoría (ropa, accesorios, bebidas, hogar, oficina)
  categoryId?: number;    // ID de categoría en la BD
  typeSlug?: string;      // Slug de tipo de producto
  typeId?: number;        // ID de tipo de producto en la BD
  typeName?: string;      // Nombre del tipo de producto
  // Campos legacy para compatibilidad (se usarán categorySlug/typeSlug en su lugar)
  type?: ProductType | string;
  category?: ProductCategory | string;
  isTemplate?: boolean;   // Si es true, es un modelo/plantilla para personalización
  basePrice: number;
  // Descuento directo del producto (sin cupón).
  discountType?: 'none' | 'percent' | 'fixed';
  discountValue?: number;
  salePrice?: number;     // precio efectivo ya con el descuento aplicado (lo calcula el backend)
  hasDiscount?: boolean;
  images: {
    front: string;
    back?: string;
    side?: string;
    extra1?: string;  // Imagen adicional 4
    extra2?: string;  // Imagen adicional 5
  };
  colors: ProductColor[];
  sizes: ProductSize[] | string[]; // Puede ser array de objetos (BD) o strings (legacy)
  featured: boolean;
  stock: number;
  rating?: number;
  reviewsCount?: number;
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
}

// Color disponible para un producto (estructura de la BD)
export interface ProductColor {
  id: number;
  name: string;
  slug: string;
  hexCode: string;
  image?: string; // URL de imagen del producto en este color (opcional)
}

// Talla disponible para un producto (estructura de la BD)
export interface ProductSize {
  id: number;
  name: string;
  abbreviation: string;
}

// Filtros para productos
export interface ProductFilters {
  category?: ProductCategory;
  type?: ProductType;
  minPrice?: number;
  maxPrice?: number;
  colors?: string[];
  sizes?: string[];
  inStock?: boolean;
  featured?: boolean;
  search?: string;
}

// Opciones de ordenamiento
export type ProductSortOption =
  | 'price-asc'
  | 'price-desc'
  | 'name-asc'
  | 'name-desc'
  | 'newest'
  | 'rating'
  | 'popular';
