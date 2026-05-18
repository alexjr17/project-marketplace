// Colores de marca para gradientes
export interface BrandColors {
  primary: string;   // Color principal (ej: #7c3aed - violet-600)
  secondary: string; // Color secundario (ej: #ec4899 - pink-500)
  accent: string;    // Color de acento (ej: #f59e0b - amber-500)
}

// Régimen tributario en Colombia
export type TaxRegime = 'responsable_iva' | 'no_responsable' | 'regimen_simple';

// Información fiscal de la empresa
export interface FiscalInfo {
  nit?: string;           // NIT de la empresa (ej: "901.234.567-8")
  taxRegime?: TaxRegime;  // Régimen tributario
  legalName?: string;     // Razón social (si es diferente al nombre comercial)
  // Datos de resolución de facturación DIAN (opcional, para factura electrónica)
  invoiceResolution?: string;      // Número de resolución
  invoiceResolutionDate?: string;  // Fecha de la resolución (YYYY-MM-DD)
  invoicePrefix?: string;          // Prefijo de facturación (ej: "FE")
  invoiceRangeFrom?: number;       // Rango autorizado desde
  invoiceRangeTo?: number;         // Rango autorizado hasta
}

// Settings types
export interface GeneralSettings {
  siteName: string;
  siteDescription: string;
  slogan?: string; // Subtexto que aparece debajo del nombre (ej: "Tu Estilo, Tu Diseño")
  logo?: string;
  favicon?: string;
  brandColors?: BrandColors; // Colores del gradiente de la marca
  contactEmail: string;
  contactPhone: string;
  address: string;
  city: string;
  country: string;
  currency: string;
  currencySymbol: string;
  socialLinks: {
    facebook?: string;
    instagram?: string;
    twitter?: string;
    whatsapp?: string;
  };
  // Información fiscal
  fiscal?: FiscalInfo;
}

// Presets de colores de marca
export const BRAND_COLOR_PRESETS = [
  { name: 'Violeta/Rosa/Ámbar', primary: '#7c3aed', secondary: '#ec4899', accent: '#f59e0b' },
  { name: 'Azul/Cian/Verde', primary: '#2563eb', secondary: '#06b6d4', accent: '#10b981' },
  { name: 'Rosa/Rojo/Naranja', primary: '#db2777', secondary: '#ef4444', accent: '#f97316' },
  { name: 'Verde/Esmeralda/Lima', primary: '#059669', secondary: '#10b981', accent: '#84cc16' },
  { name: 'Índigo/Púrpura/Rosa', primary: '#4f46e5', secondary: '#9333ea', accent: '#ec4899' },
  { name: 'Naranja/Rojo/Amarillo', primary: '#ea580c', secondary: '#dc2626', accent: '#eab308' },
];

// Configuración de apariencia del sitio
export interface AppearanceSettings {
  // Colores de marca (gradiente)
  brandColors: BrandColors;
  // Color principal para botones y elementos interactivos
  buttonColor: string;
  // Color de fondo del header
  headerBgColor: string;
  // Mostrar slogan en header
  showSlogan: boolean;
  // Estilo del header: 'default' | 'minimal' | 'centered'
  headerStyle: 'default' | 'minimal' | 'centered';
  // Color de fondo del footer
  footerBgColor: string;
  // Mostrar redes sociales en footer
  showSocialInFooter: boolean;
  // Mostrar horarios en footer
  showScheduleInFooter: boolean;
  // Color del hero en HomePage
  heroBgColor?: string;
  // Usar gradiente en hero
  useGradientHero: boolean;
}

// Presets de temas completos
export const THEME_PRESETS = [
  {
    name: 'Moderno (Violeta)',
    brandColors: { primary: '#7c3aed', secondary: '#ec4899', accent: '#f59e0b' },
    buttonColor: '#7c3aed',
    headerBgColor: '#ffffff',
    footerBgColor: '#111827',
  },
  {
    name: 'Profesional (Azul)',
    brandColors: { primary: '#2563eb', secondary: '#06b6d4', accent: '#10b981' },
    buttonColor: '#2563eb',
    headerBgColor: '#ffffff',
    footerBgColor: '#1e3a5f',
  },
  {
    name: 'Energético (Naranja)',
    brandColors: { primary: '#ea580c', secondary: '#dc2626', accent: '#eab308' },
    buttonColor: '#ea580c',
    headerBgColor: '#ffffff',
    footerBgColor: '#1c1917',
  },
  {
    name: 'Natural (Verde)',
    brandColors: { primary: '#059669', secondary: '#10b981', accent: '#84cc16' },
    buttonColor: '#059669',
    headerBgColor: '#ffffff',
    footerBgColor: '#14532d',
  },
];

// Zona geografica: un departamento con las ciudades cubiertas.
export interface ShippingZone {
  id: string;
  name: string;
  department?: string; // Departamento de Colombia al que pertenece la zona
  cities: string[];    // Municipios cubiertos dentro del departamento
  isActive: boolean;
}

// Tarifa de una transportadora para una zona especifica
export interface CarrierZoneRate {
  zoneId: string;
  baseCost: number; // Costo base del envio
  costPerKg: number; // Costo adicional por kg (se usa el mayor entre peso real y volumetrico)
  freeShippingThreshold?: number; // Umbral para envio gratis
  estimatedDays: { min: number; max: number };
  maxWeight?: number; // Peso maximo permitido
}

// Configuracion de paquete por defecto para calculos
export interface PackageDefaults {
  // Dimensiones base de un paquete estandar (cm)
  defaultLength: number;
  defaultWidth: number;
  defaultHeight: number;
  // Peso base por producto (kg)
  defaultWeightPerItem: number;
  // Factor para calcular peso volumetrico: (L x W x H) / factor
  volumetricDivisor: number;
}

// Direccion de origen de envio (desde donde salen los paquetes)
export interface ShippingOrigin {
  companyName: string; // Nombre de la empresa/remitente
  contactName: string; // Nombre de contacto
  phone: string;
  address: string;
  city: string;
  state: string; // Departamento
  postalCode?: string;
  country: string;
}

// Cómo cotiza una transportadora:
//  - 'table': tarifas por zona + peso definidas en el panel (sin internet)
//  - 'api'  : conexión HTTP genérica a la API de la transportadora
export type CarrierIntegrationType = 'table' | 'api';

// Autenticación para conectarse a la API de una transportadora.
export interface CarrierApiAuth {
  type: 'none' | 'apiKey' | 'bearer' | 'basic';
  // Para 'apiKey': dónde y con qué nombre se envía la credencial
  keyLocation?: 'header' | 'query';
  keyName?: string;  // ej. "Authorization", "X-Api-Key", "token"
  keyValue?: string; // la credencial / token
  // Para 'basic'
  username?: string;
  password?: string;
}

// Cómo leer la respuesta JSON de la API para extraer los datos que necesitamos.
// Las rutas son dot-paths, admiten índices: "data.0.valorFlete".
export interface CarrierApiResponseMapping {
  costPath: string;     // ruta al costo del envío
  daysPath?: string;    // ruta a los días estimados de entrega
  errorPath?: string;   // ruta a un mensaje de error de la API
  costIsString?: boolean; // true si el costo llega como texto ("12.500")
}

/**
 * Conexión API genérica y parametrizable de una transportadora.
 * Permite conectar Servientrega, Coordinadora, Interrapidísimo, etc.
 * configurando endpoint, autenticación y mapeo de datos — sin tocar código.
 */
export interface CarrierApiConfig {
  quoteUrl: string;           // endpoint de cotización
  method: 'GET' | 'POST';
  auth: CarrierApiAuth;
  headers?: Record<string, string>; // headers fijos adicionales
  /**
   * Plantilla del request (JSON) con variables que se reemplazan en cada
   * cotización. Variables disponibles:
   *   {{origin.city}} {{origin.department}} {{origin.postalCode}}
   *   {{destination.city}} {{destination.department}} {{destination.postalCode}}
   *   {{weight}} {{declaredValue}} {{length}} {{width}} {{height}} {{units}}
   */
  requestTemplate: string;
  responseMapping: CarrierApiResponseMapping;
  timeoutMs?: number;         // tiempo máximo de espera (default 8000)
}

// Plantilla base de conexión para una transportadora o agregador.
export interface CarrierConnectionPreset {
  id: string;
  label: string;
  description: string;
  config: CarrierApiConfig;
}

/**
 * Plantillas base de conexión. Son PUNTOS DE PARTIDA, no conexiones listas:
 * la URL real y las credenciales se obtienen al registrarse con la
 * transportadora o el agregador, y los nombres de los campos se ajustan
 * con SU documentación. Acelera el armado, no lo reemplaza.
 */
export const CARRIER_CONNECTION_PRESETS: CarrierConnectionPreset[] = [
  {
    id: 'custom',
    label: 'No aplica',
    description: 'Sin plantilla — configura la conexión manualmente.',
    config: {
      quoteUrl: '',
      method: 'POST',
      auth: { type: 'apiKey', keyLocation: 'header', keyName: 'Authorization', keyValue: '' },
      headers: {},
      requestTemplate: `{
  "origen": "{{origin.city}}",
  "destino": "{{destination.city}}",
  "peso": "{{weight}}",
  "valorDeclarado": "{{declaredValue}}"
}`,
      responseMapping: { costPath: 'data.valor', daysPath: 'data.dias', errorPath: 'message' },
      timeoutMs: 8000,
    },
  },
  {
    id: 'envia',
    label: 'Envía (envia.com)',
    description:
      'Cotizador de Envia.com. Trae la URL de PRODUCCIÓN; pega tu Bearer token del panel shipping.envia.com. Para sandbox usa api-test.envia.com con un token de ship-test.envia.com.',
    config: {
      quoteUrl: 'https://api.envia.com/ship/rate/',
      method: 'POST',
      auth: { type: 'bearer', keyValue: '' },
      headers: { 'Content-Type': 'application/json' },
      requestTemplate: `{
  "origin": {
    "country": "CO",
    "state": "{{origin.stateCode}}",
    "city": "{{origin.dane}}",
    "postalCode": "{{origin.dane}}"
  },
  "destination": {
    "country": "CO",
    "state": "{{destination.stateCode}}",
    "city": "{{destination.dane}}",
    "postalCode": "{{destination.dane}}"
  },
  "packages": [
    {
      "content": "productos",
      "amount": 1,
      "type": "box",
      "weight": "{{weight}}",
      "weightUnit": "KG",
      "lengthUnit": "CM",
      "declaredValue": "{{declaredValue}}",
      "dimensions": { "length": "{{length}}", "width": "{{width}}", "height": "{{height}}" }
    }
  ],
  "shipment": { "type": 1, "carrier": "{{carrier}}" }
}`,
      responseMapping: {
        costPath: 'data.0.totalPrice',
        daysPath: 'data.0.deliveryDate.dateDifference',
        errorPath: 'error.message',
      },
      timeoutMs: 20000,
    },
  },
];

// Registro de una sincronización de tarifas con la transportadora.
export interface RateSyncRecord {
  id: string;
  syncedAt: string;                       // fecha ISO
  source: 'api' | 'simulated' | 'mixed';  // de dónde salieron las tarifas
  zonesUpdated: number;
  rates: CarrierZoneRate[];               // foto de las tarifas aplicadas
  note?: string;
}

export interface ShippingCarrier {
  id: string;
  name: string;
  code: string;
  trackingUrlTemplate?: string;
  isActive: boolean;
  // Factor volumetrico de esta transportadora (usualmente 5000 aereo, 6000 terrestre)
  volumetricFactor: number;
  // Cómo se cotiza esta transportadora. Si no está definido se asume 'table'.
  integrationType?: CarrierIntegrationType;
  // Conexión API (solo cuando integrationType === 'api').
  apiConfig?: CarrierApiConfig;
  // Código de la transportadora dentro de la API/agregador (ej. "serviEntrega",
  // "tcc", "interRapidisimo"). Se inserta en la plantilla como {{carrier}}.
  apiCarrierCode?: string;
  // Tarifas por zona (modo 'table', o respaldo cuando la API falla).
  zoneRates: CarrierZoneRate[];
  // Historial de sincronizaciones de tarifas (más reciente primero).
  rateSyncHistory?: RateSyncRecord[];
}

export interface ShippingSettings {
  origin: ShippingOrigin; // Direccion de origen de todos los envios
  zones: ShippingZone[];
  carriers: ShippingCarrier[];
  defaultCarrierId?: string;
  handlingTime: number;
  packageDefaults: PackageDefaults;
}

export interface PaymentMethodConfig {
  id: string;
  type: 'credit_card' | 'debit_card' | 'pse' | 'cash' | 'transfer' | 'wompi' | 'pickup';
  name: string;
  description?: string;
  instructions?: string;
  isActive: boolean;
  bankInfo?: {
    bankName: string;
    accountType: string;
    accountNumber: string;
    accountHolder: string;
    documentType: string;
    documentNumber: string;
  };
  // Configuración específica de Wompi
  wompiConfig?: WompiConfig;
  // Configuración específica de Punto Físico
  pickupConfig?: PickupConfig;
}

// Configuración de punto físico
export interface PickupConfig {
  storeName: string;
  address: string;
  city: string;
  scheduleWeekdays: string; // ej: "Lunes a Viernes 9am - 6pm"
  scheduleWeekends?: string; // ej: "Sábados 10am - 2pm"
  phone?: string;
  mapUrl?: string; // URL de Google Maps
  additionalInfo?: string;
}

// Configuración completa de Wompi
export interface WompiConfig {
  publicKey: string;
  privateKey?: string; // Solo se guarda encriptado, usado para verificación de webhooks
  integrityKey?: string; // Clave de integridad para firmar transacciones
  eventSecret?: string; // Secreto para webhooks
  isTestMode: boolean;
}

export interface PaymentSettings {
  methods: PaymentMethodConfig[];
  taxEnabled: boolean; // Si los impuestos están habilitados
  taxRate: number;     // Tasa de impuesto (ej: 19 para 19%)
  taxIncluded: boolean; // Si los precios ya incluyen impuestos
}

// Página legal individual
export interface LegalPage {
  id: string;
  title: string;
  slug: string; // URL amigable: terms, privacy, returns
  content: string; // Contenido en texto/HTML
  isActive: boolean;
  lastUpdated: Date;
}

// Configuración de páginas legales
export interface LegalSettings {
  termsAndConditions: LegalPage;
  privacyPolicy: LegalPage;
  returnsPolicy: LegalPage;
}

// ============================================
// Configuración de la Página de Inicio (Home)
// ============================================

// Tipo de fondo para las cartas del hero
export type HeroBackgroundType = 'gradient' | 'image' | 'video' | 'carousel';

// Configuración de fondo para una carta del hero
export interface HeroCardBackground {
  type: HeroBackgroundType;
  // Para tipo 'gradient' - usa los colores de marca por defecto
  gradientColors?: {
    from: string;
    via?: string;
    to: string;
  };
  // Para tipo 'image'
  imageUrl?: string;
  // Para tipo 'video'
  videoUrl?: string;
  videoPoster?: string; // Imagen de preview mientras carga el video
  videoMuted?: boolean;
  videoLoop?: boolean;
  // Para tipo 'carousel'
  carouselImages?: string[];
  carouselInterval?: number; // Intervalo en ms (default: 5000)
  carouselTransition?: 'fade' | 'slide'; // Tipo de transición
  // Overlay oscuro sobre el fondo (para mejor legibilidad del texto)
  overlayOpacity?: number; // 0-100
}

// Botón de una carta del hero
export interface HeroCardButton {
  id: string;
  text: string;
  link: string;
  style: 'primary' | 'secondary' | 'outline';
  icon?: string; // Icono de lucide-react
  isActive: boolean;
}

// Carta individual del hero
export interface HeroCard {
  id: string;
  // Posición: 'main' para la carta principal, 'side' para las laterales
  position: 'main' | 'side';
  // Orden de las cartas laterales (1, 2, 3)
  order: number;
  // Contenido
  badge?: string;
  showBadge: boolean;
  title: string;
  titleLine2?: string; // Segunda línea del título (opcional)
  subtitle?: string;
  showSubtitle: boolean;
  // Icono para cartas laterales
  icon?: string;
  // Botones (máximo 2)
  buttons: HeroCardButton[];
  // Configuración de fondo
  background: HeroCardBackground;
  // Estado
  isActive: boolean;
}

// Hero Section - Estructura con cartas configurables
export interface HeroSettings {
  // Cartas del hero (1 principal + hasta 3 laterales)
  cards: HeroCard[];
  // Configuración general del hero
  showSideCards: boolean; // Mostrar cartas laterales en desktop
  sideCardsVisibleOnMobile: boolean; // Mostrar laterales en mobile (como stack)
}

// Característica/Feature Card
export interface FeatureCard {
  id: string;
  icon: 'palette' | 'sparkles' | 'package' | 'truck' | 'shield' | 'heart' | 'star' | 'zap' | 'gift' | 'percent';
  title: string;
  description: string;
  isActive: boolean;
  order: number;
}

// Filtros disponibles para secciones de productos
export interface SectionFilters {
  // Filtros de selección
  featured?: boolean;        // Solo productos destacados
  bestsellers?: boolean;     // Solo más vendidos
  newArrivals?: boolean;     // Solo nuevos
  // Filtros de categoría/tipo (usando slugs de la BD)
  category?: string;         // Filtrar por categoría slug (ropa, accesorios, bebidas, hogar, oficina)
  type?: string;             // Filtrar por tipo slug (camiseta, taza, etc)
  // Filtros legacy (mantener para compatibilidad)
  categoryId?: string;       // DEPRECATED: usar 'category' en su lugar
  productTypeId?: string;    // DEPRECATED: usar 'type' en su lugar
  // Filtros de ordenamiento (coincide con mockProducts)
  sortBy?: 'rating' | 'price' | 'newest' | 'reviewsCount';
  // Filtros de precio
  minPrice?: number;
  maxPrice?: number;
  // Solo en stock
  inStock?: boolean;
}

// Sección de productos
export interface ProductSection {
  id: string;
  title: string;
  subtitle?: string;
  showSubtitle?: boolean; // Mostrar/ocultar subtítulo
  // Filtros aplicados a esta sección
  filters: SectionFilters;
  maxProducts: number;
  showViewAll: boolean;
  viewAllLink?: string;
  isActive: boolean;
  order: number;
}

// CTA Section (llamada a la acción al final)
export interface CTASettings {
  badge: string;
  showBadge: boolean; // Mostrar/ocultar badge
  title: string;
  subtitle: string;
  buttonText: string;
  buttonLink: string;
  showButton: boolean; // Mostrar/ocultar botón
  isActive: boolean;
}

// Configuración del botón flotante de WhatsApp
export interface WhatsAppButtonSettings {
  isActive: boolean;
  phoneNumber: string; // Número con código de país sin + (ej: 573001234567)
  defaultMessage: string; // Mensaje predeterminado
  position: 'bottom-right' | 'bottom-left';
  showOnMobile: boolean;
  showOnDesktop: boolean;
  // Personalización visual
  buttonColor: string;
  pulseAnimation: boolean;
  showTooltip: boolean;
  tooltipText: string;
}

// Configuración de filtros del catálogo
export interface CatalogFilterConfig {
  showCategoryFilter: boolean;
  showTypeFilter: boolean;
  showPriceFilter: boolean;
  showStockFilter: boolean;
  showFeaturedFilter: boolean;
  // Categorías habilitadas para mostrar en filtro
  enabledCategories: string[];
  // Tipos de productos habilitados para mostrar en filtro
  enabledProductTypes: string[];
}

// Configuración del catálogo
export interface CatalogSettings {
  filters: CatalogFilterConfig;
  defaultProductsPerPage: number;
  showSortOptions: boolean;
}

// Banner promocional para intercalar entre secciones de productos
export interface PromoBanner {
  id: string;
  // Orden global en el que aparece mezclado con las secciones de productos
  order: number;
  // Contenido
  title: string;
  subtitle?: string;
  // Botón de acción
  buttonText?: string;
  buttonLink?: string;
  // Fondo (reutiliza el mismo sistema del hero)
  background: HeroCardBackground;
  // Altura del banner
  height: 'small' | 'medium' | 'large'; // small: 120px, medium: 180px, large: 240px
  // Alineación del contenido
  contentAlign: 'left' | 'center' | 'right';
  // Estado
  isActive: boolean;
}

// Tipo discriminado para contenido mixto del Home (secciones + banners)
export type HomeContentItem =
  | { itemType: 'section'; data: ProductSection }
  | { itemType: 'banner'; data: PromoBanner };

// Configuración completa del Home
export interface HomeSettings {
  // Habilitar/deshabilitar módulo de personalización
  enableCustomizer: boolean;
  // Hero section
  hero: HeroSettings;
  // Tarjetas de características
  features: FeatureCard[];
  showFeatures: boolean;
  // Secciones de productos
  productSections: ProductSection[];
  // Banners promocionales entre secciones
  promoBanners: PromoBanner[];
  // CTA final
  cta: CTASettings;
  // Botón flotante de WhatsApp
  whatsappButton: WhatsAppButtonSettings;
}

// Iconos disponibles para las feature cards
export const FEATURE_ICONS = [
  { id: 'palette', label: 'Paleta (Personalización)' },
  { id: 'sparkles', label: 'Destellos (Calidad)' },
  { id: 'flame', label: 'Fuego (Hot/Tendencia)' },
  { id: 'package', label: 'Paquete (Envío)' },
  { id: 'truck', label: 'Camión (Delivery)' },
  { id: 'shield', label: 'Escudo (Garantía)' },
  { id: 'heart', label: 'Corazón (Favoritos)' },
  { id: 'star', label: 'Estrella (Premium)' },
  { id: 'zap', label: 'Rayo (Rápido)' },
  { id: 'gift', label: 'Regalo (Promoción)' },
  { id: 'percent', label: 'Porcentaje (Descuento)' },
] as const;

// Tipos de secciones de productos
export const PRODUCT_SECTION_TYPES = [
  { id: 'featured', label: 'Productos Destacados' },
  { id: 'bestsellers', label: 'Más Vendidos' },
  { id: 'new', label: 'Nuevos Productos' },
  { id: 'category', label: 'Por Categoría' },
  { id: 'productType', label: 'Por Tipo de Producto' },
  { id: 'custom', label: 'Selección Manual' },
] as const;

// Categorías de productos disponibles (sublimación)
export const PRODUCT_CATEGORIES = [
  { id: 'clothing', label: 'Ropa' },
  { id: 'accessories', label: 'Accesorios' },
  { id: 'drinkware', label: 'Bebidas' },
  { id: 'home', label: 'Hogar y Decoración' },
  { id: 'office', label: 'Oficina' },
] as const;

// Tipos de productos disponibles (sublimación)
export const PRODUCT_TYPES = [
  // Ropa sublimable
  { id: 'tshirt', label: 'Camiseta', category: 'clothing' },
  { id: 'hoodie', label: 'Buzo con Capucha', category: 'clothing' },
  { id: 'sweatshirt', label: 'Suéter/Buzo', category: 'clothing' },
  { id: 'polo', label: 'Polo', category: 'clothing' },
  { id: 'tanktop', label: 'Camisilla', category: 'clothing' },
  { id: 'longsleeve', label: 'Manga Larga', category: 'clothing' },
  // Accesorios
  { id: 'cap', label: 'Gorra', category: 'accessories' },
  { id: 'totebag', label: 'Bolsa de Tela', category: 'accessories' },
  { id: 'keychain', label: 'Llavero', category: 'accessories' },
  { id: 'mousepad', label: 'Mouse Pad', category: 'accessories' },
  { id: 'phonecase', label: 'Funda Celular', category: 'accessories' },
  { id: 'lanyard', label: 'Cordón/Lanyard', category: 'accessories' },
  // Drinkware
  { id: 'mug', label: 'Taza Cerámica', category: 'drinkware' },
  { id: 'magicmug', label: 'Taza Mágica', category: 'drinkware' },
  { id: 'bottle', label: 'Botella/Termo', category: 'drinkware' },
  { id: 'tumbler', label: 'Vaso Térmico', category: 'drinkware' },
  // Hogar y decoración
  { id: 'aluminumframe', label: 'Cuadro en Aluminio', category: 'home' },
  { id: 'coaster', label: 'Posa Vasos', category: 'home' },
  { id: 'pillow', label: 'Cojín', category: 'home' },
  { id: 'blanket', label: 'Manta/Cobija', category: 'home' },
  { id: 'clock', label: 'Reloj de Pared', category: 'home' },
  { id: 'puzzle', label: 'Rompecabezas', category: 'home' },
  // Oficina
  { id: 'notebook', label: 'Libreta', category: 'office' },
  { id: 'calendar', label: 'Calendario', category: 'office' },
] as const;

export interface Settings {
  general: GeneralSettings;
  appearance: AppearanceSettings;
  shipping: ShippingSettings;
  payment: PaymentSettings;
  legal: LegalSettings;
  home: HomeSettings;
  catalog: CatalogSettings;
  updatedAt: Date;
  updatedBy: string;
}

export const PAYMENT_TYPE_LABELS: Record<PaymentMethodConfig['type'], string> = {
  credit_card: 'Tarjeta de Credito',
  debit_card: 'Tarjeta de Debito',
  pse: 'PSE',
  cash: 'Efectivo',
  transfer: 'Transferencia Bancaria',
  wompi: 'Wompi (Tarjeta, PSE, Nequi)',
  pickup: 'Pago en Punto Físico',
};

export const CURRENCY_OPTIONS = [
  { code: 'COP', symbol: '$', name: 'Peso Colombiano' },
  { code: 'USD', symbol: '$', name: 'Dolar Estadounidense' },
  { code: 'EUR', symbol: 'E', name: 'Euro' },
  { code: 'MXN', symbol: '$', name: 'Peso Mexicano' },
];

// ============================================
// Configuración de Impresión (POS)
// ============================================

// Tipo de formato de papel
export type PaperFormat = '58mm' | '80mm' | 'letter' | 'a4' | 'custom';

// Plantilla de papel predefinida
export interface PaperTemplate {
  id: string;
  name: string;
  description: string;
  format: PaperFormat;
  width: number;  // en mm
  height: number; // en mm (0 = continuo para tickets)
  compatiblePrinters: string[];
  recommended: boolean;
  previewImage?: string;
}

// Configuración de impresión seleccionada (solo POS)
export interface PrintSettings {
  // Formato de papel para tickets POS
  ticketFormat: PaperFormat;
  ticketWidth: number;  // ancho en mm
  ticketHeight?: number; // alto en mm (0 = continuo para tickets térmicos)
  ticketMargins: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  // Logo del ticket (puede ser diferente al logo general)
  ticketLogo?: string;
  // Opciones de visibilidad del header
  showLogo: boolean;
  showStoreName: boolean; // Mostrar nombre de la empresa
  showNit: boolean; // Mostrar NIT
  // Opciones generales
  showQR: boolean;
  fontSize: 'small' | 'medium' | 'large';
  // Mostrar modal de vista previa antes de imprimir
  showPreviewModal: boolean;
  // Plantilla seleccionada
  selectedTemplateId?: string;
}

// Plantillas de papel predefinidas para POS
export const PAPER_TEMPLATES: PaperTemplate[] = [
  // Tickets térmicos pequeños (58mm)
  {
    id: 'thermal-58mm',
    name: 'Ticket Térmico 58mm',
    description: 'Para impresoras térmicas pequeñas. El más común en terminales de pago.',
    format: '58mm',
    width: 58,
    height: 0, // Continuo
    compatiblePrinters: [
      'Epson TM-T20',
      'Star TSP100',
      'POS-58',
      'XP-58',
      'Bixolon SRP-350',
    ],
    recommended: false,
  },
  // Tickets estándar POS (80mm)
  {
    id: 'thermal-80mm',
    name: 'Ticket Térmico 80mm',
    description: 'Estándar para la mayoría de impresoras POS profesionales.',
    format: '80mm',
    width: 80,
    height: 0,
    compatiblePrinters: [
      'Epson TM-T88',
      'Epson TM-T82',
      'Star TSP650',
      'Bixolon SRP-330',
      'Citizen CT-S310',
      'HP Engage One',
      'NCR RealPOS',
    ],
    recommended: true,
  },
  // Hoja Carta
  {
    id: 'letter',
    name: 'Hoja Carta',
    description: 'Formato estándar de carta (8.5" x 11"). Ideal para facturas formales.',
    format: 'letter',
    width: 216,
    height: 279,
    compatiblePrinters: [
      'Cualquier impresora de escritorio',
      'HP LaserJet',
      'Epson EcoTank',
      'Canon PIXMA',
      'Brother HL',
    ],
    recommended: false,
  },
  // Hoja A4
  {
    id: 'a4',
    name: 'Hoja A4',
    description: 'Formato internacional A4 (210mm x 297mm). Estándar en muchos países.',
    format: 'a4',
    width: 210,
    height: 297,
    compatiblePrinters: [
      'Cualquier impresora de escritorio',
      'HP LaserJet',
      'Epson EcoTank',
      'Canon PIXMA',
      'Brother HL',
    ],
    recommended: false,
  },
  // Media carta
  {
    id: 'half-letter',
    name: 'Media Carta',
    description: 'Mitad de hoja carta. Útil para facturas compactas.',
    format: 'custom',
    width: 140,
    height: 216,
    compatiblePrinters: [
      'Impresoras de escritorio con alimentación manual',
    ],
    recommended: false,
  },
];

// Configuración por defecto de impresión (solo POS)
export const DEFAULT_PRINT_SETTINGS: PrintSettings = {
  ticketFormat: '80mm',
  ticketWidth: 80,
  ticketHeight: 0, // 0 = continuo para tickets térmicos
  ticketMargins: { top: 5, right: 5, bottom: 10, left: 5 },
  ticketLogo: '',
  showLogo: true,
  showStoreName: true,
  showNit: true,
  showQR: false,
  fontSize: 'medium',
  showPreviewModal: true,
  selectedTemplateId: 'thermal-80mm',
};
