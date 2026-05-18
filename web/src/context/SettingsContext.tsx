import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import type {
  Settings,
  GeneralSettings,
  AppearanceSettings,
  ShippingSettings,
  PaymentSettings,
  LegalSettings,
  LegalPage,
  ShippingZone,
  ShippingCarrier,
  PaymentMethodConfig,
  CarrierZoneRate,
  HomeSettings,
  FeatureCard,
  ProductSection,
  WhatsAppButtonSettings,
  CatalogSettings,
  PromoBanner,
} from '../types/settings';
import { settingsService } from '../services/settings.service';
import { useAuth } from './AuthContext';

// Mock data inicial
const mockSettings: Settings = {
  general: {
    siteName: 'StylePrint',
    siteDescription: 'Tu marketplace de camisetas personalizadas',
    slogan: 'Tu Estilo, Tu Diseño',
    logo: '',
    brandColors: {
      primary: '#7c3aed',   // violet-600
      secondary: '#ec4899', // pink-500
      accent: '#f59e0b',    // amber-500
    },
    contactEmail: 'contacto@styleprint.com',
    contactPhone: '+57 300 123 4567',
    address: 'Calle 123 #45-67',
    city: 'Bogotá',
    country: 'Colombia',
    currency: 'COP',
    currencySymbol: '$',
    socialLinks: {
      facebook: 'https://facebook.com/styleprint',
      instagram: 'https://instagram.com/styleprint',
      whatsapp: '+573001234567',
    },
    fiscal: {
      nit: '901.234.567-8',
      taxRegime: 'responsable_iva',
      legalName: 'StylePrint S.A.S.',
    },
  },
  appearance: {
    brandColors: {
      primary: '#7c3aed',
      secondary: '#ec4899',
      accent: '#f59e0b',
    },
    buttonColor: '#7c3aed',
    headerBgColor: '#ffffff',
    showSlogan: true,
    headerStyle: 'default',
    footerBgColor: '#111827',
    showSocialInFooter: true,
    showScheduleInFooter: true,
    useGradientHero: true,
  },
  shipping: {
    // Sin datos hardcodeados: la configuración real de envíos vive en la base
    // de datos (key shipping_settings — ver ShippingSeeder). Esto es solo el
    // estado inicial vacío mientras se cargan los datos del servidor.
    origin: {
      companyName: '',
      contactName: '',
      phone: '',
      address: '',
      city: '',
      state: '',
      postalCode: '',
      country: 'Colombia',
    },
    zones: [],
    carriers: [],
    handlingTime: 1,
    packageDefaults: {
      defaultLength: 30,
      defaultWidth: 25,
      defaultHeight: 5,
      defaultWeightPerItem: 0.25,
      volumetricDivisor: 5000,
    },
  },
  payment: {
    methods: [
      {
        id: 'pm-1',
        type: 'wompi',
        name: 'Wompi',
        description: 'Paga con tarjeta de crédito/débito, PSE o Nequi',
        isActive: true,
        wompiConfig: {
          publicKey: 'pub_test_SIMULATION',
          isTestMode: true,
        },
      },
      {
        id: 'pm-2',
        type: 'transfer',
        name: 'Transferencia Bancaria',
        description: 'Paga directamente desde tu banco',
        instructions: 'Realiza la transferencia y sube el comprobante en tu pedido.',
        isActive: false,
        bankInfo: {
          bankName: 'Bancolombia',
          accountType: 'Ahorros',
          accountNumber: '123-456789-00',
          accountHolder: 'StylePrint SAS',
          documentType: 'NIT',
          documentNumber: '901.234.567-8',
        },
      },
      {
        id: 'pm-3',
        type: 'cash',
        name: 'Pago Contra Entrega',
        description: 'Paga cuando recibas tu pedido',
        instructions: 'Solo disponible para Bogotá. El domiciliario recibe efectivo o Nequi.',
        isActive: false,
      },
      {
        id: 'pm-4',
        type: 'pickup',
        name: 'Pago en Punto Físico',
        description: 'Recoge y paga en nuestra tienda',
        instructions: 'Tu pedido estará listo para recoger en 2-3 días hábiles.',
        isActive: true,
        pickupConfig: {
          storeName: 'StylePrint Store',
          address: 'Calle 123 #45-67, Local 101',
          city: 'Bogotá',
          scheduleWeekdays: 'Lunes a Viernes: 9:00 AM - 6:00 PM',
          scheduleWeekends: 'Sábados: 10:00 AM - 2:00 PM',
          phone: '+57 300 123 4567',
        },
      },
    ],
    taxEnabled: false, // Por defecto deshabilitado para pequeños negocios
    taxRate: 19,
    taxIncluded: true,
  },
  home: {
    enableCustomizer: true,
    hero: {
      cards: [], // Se usan los defaults de HeroSection si está vacío
      showSideCards: true,
      sideCardsVisibleOnMobile: false,
    },
    features: [
      {
        id: 'feature-1',
        icon: 'palette',
        title: 'Personalización Fácil',
        description: 'Editor visual intuitivo para crear diseños únicos en minutos',
        isActive: true,
        order: 1,
      },
      {
        id: 'feature-2',
        icon: 'sparkles',
        title: 'Alta Calidad',
        description: 'Productos premium con impresión de alta resolución',
        isActive: true,
        order: 2,
      },
      {
        id: 'feature-3',
        icon: 'package',
        title: 'Entrega Rápida',
        description: 'Producción y envío en tiempo récord',
        isActive: true,
        order: 3,
      },
    ],
    showFeatures: true,
    productSections: [
      {
        id: 'section-1',
        title: 'Productos Destacados',
        subtitle: 'Los favoritos de nuestros clientes para sublimación',
        filters: { featured: true },
        maxProducts: 5,
        showViewAll: true,
        viewAllLink: '/catalog?featured=true',
        isActive: true,
        order: 1,
      },
      {
        id: 'section-2',
        title: 'Los Más Vendidos',
        subtitle: 'Lo que más eligen nuestros clientes',
        filters: { bestsellers: true },
        maxProducts: 5,
        showViewAll: true,
        viewAllLink: '/catalog?sort=bestsellers',
        isActive: true,
        order: 2,
      },
      {
        id: 'section-3',
        title: 'Tazas y Termos',
        subtitle: 'Personaliza tu bebida favorita con diseños únicos',
        filters: { category: 'bebidas' },
        maxProducts: 5,
        showViewAll: true,
        viewAllLink: '/catalog?category=bebidas',
        isActive: true,
        order: 3,
      },
      {
        id: 'section-4',
        title: 'Decoración y Hogar',
        subtitle: 'Cuadros, posa vasos y más para tu espacio',
        filters: { category: 'hogar' },
        maxProducts: 5,
        showViewAll: true,
        viewAllLink: '/catalog?category=hogar',
        isActive: true,
        order: 4,
      },
    ],
    promoBanners: [],
    cta: {
      badge: 'Crea sin límites',
      showBadge: true,
      title: '¿Listo para crear algo único?',
      subtitle: 'Empieza a diseñar tu prenda personalizada ahora y dale vida a tu creatividad',
      buttonText: 'Personalizar Ahora',
      buttonLink: '/customize',
      showButton: true,
      isActive: true,
    },
    whatsappButton: {
      isActive: true,
      phoneNumber: '573001234567',
      defaultMessage: '¡Hola! Me interesa obtener más información sobre sus productos.',
      position: 'bottom-right',
      showOnMobile: true,
      showOnDesktop: true,
      buttonColor: '#25D366',
      pulseAnimation: true,
      showTooltip: true,
      tooltipText: '¿Necesitas ayuda?',
    },
  },
  catalog: {
    filters: {
      showCategoryFilter: true,
      showTypeFilter: true,
      showPriceFilter: true,
      showStockFilter: true,
      showFeaturedFilter: true,
      enabledCategories: ['clothing', 'accessories', 'drinkware', 'home', 'office'],
      enabledProductTypes: [
        'tshirt', 'hoodie', 'sweatshirt', 'polo', 'cap',
        'mug', 'magicmug', 'bottle', 'tumbler',
        'aluminumframe', 'coaster', 'pillow', 'puzzle',
        'keychain', 'mousepad'
      ],
    },
    defaultProductsPerPage: 12,
    showSortOptions: true,
  },
  legal: {
    termsAndConditions: {
      id: 'terms',
      title: 'Términos y Condiciones',
      slug: 'terms',
      content: `<h2>1. Aceptación de los Términos</h2>
<p>Al acceder y utilizar este sitio web, usted acepta estar sujeto a estos términos y condiciones de uso.</p>

<h2>2. Uso del Sitio</h2>
<p>El contenido de este sitio web es únicamente para su información general y uso personal. Está sujeto a cambios sin previo aviso.</p>

<h2>3. Productos Personalizados</h2>
<p>Los productos personalizados son creados según las especificaciones proporcionadas por el cliente. StylePrint no se hace responsable por errores en el diseño proporcionado por el cliente.</p>

<h2>4. Precios y Pagos</h2>
<p>Todos los precios están expresados en pesos colombianos (COP) e incluyen IVA. Nos reservamos el derecho de modificar los precios sin previo aviso.</p>

<h2>5. Envíos</h2>
<p>Los tiempos de entrega son estimados y pueden variar según la ubicación y disponibilidad del producto. StylePrint no se hace responsable por retrasos causados por terceros.</p>

<h2>6. Propiedad Intelectual</h2>
<p>El cliente garantiza que tiene los derechos necesarios sobre las imágenes y diseños que sube para personalización. StylePrint no se hace responsable por violaciones de derechos de autor.</p>`,
      isActive: true,
      lastUpdated: new Date(),
    },
    privacyPolicy: {
      id: 'privacy',
      title: 'Política de Privacidad',
      slug: 'privacy',
      content: `<h2>1. Información que Recopilamos</h2>
<p>Recopilamos información personal que usted nos proporciona directamente, como nombre, correo electrónico, dirección de envío y número de teléfono.</p>

<h2>2. Uso de la Información</h2>
<p>Utilizamos su información para:</p>
<ul>
<li>Procesar y enviar sus pedidos</li>
<li>Comunicarnos con usted sobre su pedido</li>
<li>Mejorar nuestros productos y servicios</li>
<li>Enviar información promocional (si ha dado su consentimiento)</li>
</ul>

<h2>3. Protección de Datos</h2>
<p>Implementamos medidas de seguridad apropiadas para proteger su información personal contra acceso no autorizado, alteración, divulgación o destrucción.</p>

<h2>4. Cookies</h2>
<p>Utilizamos cookies para mejorar su experiencia de navegación. Puede configurar su navegador para rechazar cookies, aunque esto puede afectar la funcionalidad del sitio.</p>

<h2>5. Compartir Información</h2>
<p>No vendemos ni compartimos su información personal con terceros, excepto cuando sea necesario para procesar su pedido (ej: empresas de envío).</p>

<h2>6. Sus Derechos</h2>
<p>Usted tiene derecho a acceder, rectificar o eliminar su información personal. Contáctenos para ejercer estos derechos.</p>`,
      isActive: true,
      lastUpdated: new Date(),
    },
    returnsPolicy: {
      id: 'returns',
      title: 'Política de Devoluciones',
      slug: 'returns',
      content: `<h2>1. Productos Personalizados</h2>
<p>Debido a la naturaleza personalizada de nuestros productos, <strong>no aceptamos devoluciones ni cambios</strong> una vez que el pedido ha sido procesado, excepto en casos de defectos de fabricación.</p>

<h2>2. Defectos de Fabricación</h2>
<p>Si su producto presenta defectos de fabricación (errores de impresión, tallas incorrectas enviadas, daños en el producto), contáctenos dentro de las 48 horas siguientes a la recepción.</p>

<h2>3. Proceso de Reclamación</h2>
<p>Para reportar un defecto:</p>
<ol>
<li>Envíe un correo a contacto@styleprint.com</li>
<li>Incluya fotos claras del defecto</li>
<li>Proporcione su número de pedido</li>
</ol>

<h2>4. Soluciones</h2>
<p>En caso de defecto comprobado, ofrecemos:</p>
<ul>
<li>Reimpresión del producto sin costo adicional</li>
<li>Reembolso completo del valor del producto</li>
</ul>

<h2>5. Tiempos de Respuesta</h2>
<p>Nos comprometemos a responder su reclamación dentro de 3 días hábiles y resolver el caso en un máximo de 10 días hábiles.</p>

<h2>6. Productos Estándar</h2>
<p>Para productos no personalizados, aceptamos devoluciones dentro de los 15 días siguientes a la compra, siempre que el producto esté en su empaque original y sin usar.</p>`,
      isActive: true,
      lastUpdated: new Date(),
    },
  },
  updatedAt: new Date(),
  updatedBy: 'Admin',
};

interface SettingsContextType {
  settings: Settings;
  isLoading: boolean;
  error: string | null;
  // Métodos de actualización
  updateGeneralSettings: (data: Partial<GeneralSettings>) => Promise<void>;
  updateAppearanceSettings: (data: Partial<AppearanceSettings>) => Promise<void>;
  updateShippingSettings: (data: Partial<ShippingSettings>) => Promise<void>;
  updatePaymentSettings: (data: Partial<PaymentSettings>) => Promise<void>;
  updateLegalPage: (pageKey: keyof LegalSettings, data: Partial<LegalPage>) => Promise<void>;
  // Zonas de envío
  addShippingZone: (zone: Omit<ShippingZone, 'id'>) => Promise<void>;
  updateShippingZone: (id: string, data: Partial<ShippingZone>) => Promise<void>;
  deleteShippingZone: (id: string) => Promise<void>;
  // Transportadoras
  addCarrier: (carrier: Omit<ShippingCarrier, 'id'>) => Promise<void>;
  updateCarrier: (id: string, data: Partial<ShippingCarrier>) => Promise<void>;
  deleteCarrier: (id: string) => Promise<void>;
  // Tarifas de transportadora por zona
  updateCarrierZoneRate: (carrierId: string, zoneId: string, data: Partial<CarrierZoneRate>) => Promise<void>;
  addCarrierZoneRate: (carrierId: string, rate: CarrierZoneRate) => Promise<void>;
  deleteCarrierZoneRate: (carrierId: string, zoneId: string) => Promise<void>;
  // Métodos de pago
  addPaymentMethod: (method: Omit<PaymentMethodConfig, 'id'>) => Promise<void>;
  updatePaymentMethod: (id: string, data: Partial<PaymentMethodConfig>) => Promise<void>;
  deletePaymentMethod: (id: string) => Promise<void>;
  togglePaymentMethod: (id: string) => Promise<void>;
  // Home settings
  updateHomeSettings: (data: Partial<HomeSettings>) => Promise<void>;
  // Catalog settings
  updateCatalogSettings: (data: Partial<CatalogSettings>) => Promise<void>;
  // Features
  addFeature: (feature: Omit<FeatureCard, 'id'>) => Promise<void>;
  updateFeature: (id: string, data: Partial<FeatureCard>) => Promise<void>;
  deleteFeature: (id: string) => Promise<void>;
  // Product sections
  addProductSection: (section: Omit<ProductSection, 'id'>) => Promise<void>;
  updateProductSection: (id: string, data: Partial<ProductSection>) => Promise<void>;
  deleteProductSection: (id: string) => Promise<void>;
  // WhatsApp button
  updateWhatsAppButton: (data: Partial<WhatsAppButtonSettings>) => Promise<void>;
  // Recargar settings
  refreshSettings: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

/**
 * Usa el valor traído del API solo si es un objeto con datos. Si la
 * configuración nunca se guardó, el API devuelve un arreglo/objeto vacío;
 * en ese caso se conservan los valores por defecto para no dejar el
 * formulario sin las propiedades anidadas que espera (evita pantalla en
 * blanco).
 */
function withFallback<T>(loaded: unknown, fallback: T): T {
  if (
    loaded &&
    typeof loaded === 'object' &&
    !Array.isArray(loaded) &&
    Object.keys(loaded as object).length > 0
  ) {
    return loaded as T;
  }
  return fallback;
}

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  const [settings, setSettings] = useState<Settings>(mockSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [publicLoaded, setPublicLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user, isAuthenticated } = useAuth();

  // Cargar settings públicos al iniciar (sin autenticación) - para evitar flash de colores
  useEffect(() => {
    const loadPublicSettings = async () => {
      try {
        const publicSettings = await settingsService.getPublicSettings();
        setSettings((prev) => ({
          ...prev,
          general: withFallback(publicSettings.general, prev.general),
          appearance: withFallback(publicSettings.appearance, prev.appearance),
          home: withFallback(publicSettings.home, prev.home),
          catalog: withFallback(publicSettings.catalog, prev.catalog),
          // El cliente también necesita la config de envíos para calcular el costo.
          shipping: withFallback(publicSettings.shipping, prev.shipping),
        }));
      } catch (err) {
        console.error('Error loading public settings:', err);
      } finally {
        setPublicLoaded(true);
        setIsLoading(false);
      }
    };

    loadPublicSettings();
  }, []);

  // Cargar settings completos desde la API (solo para admin)
  const loadSettings = useCallback(async () => {
    // Solo cargar desde API si es admin (case-insensitive) o roleId = 1
    const userRole = user?.roleName?.toLowerCase() || '';
    const isAdmin = userRole === 'admin' || userRole === 'superadmin' || user?.roleId === 1;

    if (!isAuthenticated || !isAdmin) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const loadedSettings = await settingsService.loadAllSettings();
      // Cada sección que no tenga configuración guardada conserva el
      // valor por defecto, para que el formulario siempre tenga datos.
      setSettings((prev) => ({
        ...prev,
        general: withFallback(loadedSettings.general, prev.general),
        appearance: withFallback(loadedSettings.appearance, prev.appearance),
        shipping: withFallback(loadedSettings.shipping, prev.shipping),
        payment: withFallback(loadedSettings.payment, prev.payment),
        home: withFallback(loadedSettings.home, prev.home),
        catalog: withFallback(loadedSettings.catalog, prev.catalog),
        legal: withFallback(loadedSettings.legal, prev.legal),
        updatedAt: new Date(),
      }));
    } catch (err) {
      console.error('Error loading settings from API:', err);
      // Si falla, usar mockSettings como fallback
      setError('Error cargando configuración. Usando valores locales.');
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, user]);

  // Cargar settings completos cuando el usuario admin se autentica
  useEffect(() => {
    if (publicLoaded && isAuthenticated) {
      loadSettings();
    }
  }, [publicLoaded, isAuthenticated, loadSettings]);

  const refreshSettings = async (): Promise<void> => {
    await loadSettings();
  };

  const updateGeneralSettings = async (data: Partial<GeneralSettings>): Promise<void> => {
    const newGeneral = { ...settings.general, ...data };

    try {
      await settingsService.updateGeneralSettings(newGeneral);
      setSettings((prev) => ({
        ...prev,
        general: newGeneral,
        updatedAt: new Date(),
      }));
    } catch (err) {
      console.error('Error updating general settings:', err);
      // Actualizar localmente aunque falle la API
      setSettings((prev) => ({
        ...prev,
        general: newGeneral,
        updatedAt: new Date(),
      }));
    }
  };

  const updateAppearanceSettings = async (data: Partial<AppearanceSettings>): Promise<void> => {
    const newAppearance = { ...settings.appearance, ...data };

    try {
      await settingsService.updateAppearanceSettings(newAppearance);
      setSettings((prev) => ({
        ...prev,
        appearance: newAppearance,
        updatedAt: new Date(),
      }));
    } catch (err) {
      console.error('Error updating appearance settings:', err);
      setSettings((prev) => ({
        ...prev,
        appearance: newAppearance,
        updatedAt: new Date(),
      }));
    }
  };

  const updateShippingSettings = async (data: Partial<ShippingSettings>): Promise<void> => {
    const newShipping = { ...settings.shipping, ...data };

    try {
      await settingsService.updateShippingSettings(newShipping);
      setSettings((prev) => ({
        ...prev,
        shipping: newShipping,
        updatedAt: new Date(),
      }));
    } catch (err) {
      console.error('Error updating shipping settings:', err);
      setSettings((prev) => ({
        ...prev,
        shipping: newShipping,
        updatedAt: new Date(),
      }));
    }
  };

  const updatePaymentSettings = async (data: Partial<PaymentSettings>): Promise<void> => {
    const newPayment = { ...settings.payment, ...data };

    try {
      await settingsService.updateFrontendPaymentSettings(newPayment);
      setSettings((prev) => ({
        ...prev,
        payment: newPayment,
        updatedAt: new Date(),
      }));
    } catch (err) {
      console.error('Error updating payment settings:', err);
      setSettings((prev) => ({
        ...prev,
        payment: newPayment,
        updatedAt: new Date(),
      }));
    }
  };

  const updateLegalPage = async (pageKey: keyof LegalSettings, data: Partial<LegalPage>): Promise<void> => {
    const newLegal = {
      ...settings.legal,
      [pageKey]: {
        ...settings.legal[pageKey],
        ...data,
        lastUpdated: new Date(),
      },
    };

    try {
      await settingsService.updateLegalSettings(newLegal);
      setSettings((prev) => ({
        ...prev,
        legal: newLegal,
        updatedAt: new Date(),
      }));
    } catch (err) {
      console.error('Error updating legal settings:', err);
      setSettings((prev) => ({
        ...prev,
        legal: newLegal,
        updatedAt: new Date(),
      }));
    }
  };

  // Helper para persistir shipping settings
  const persistShippingSettings = async (newShipping: ShippingSettings): Promise<void> => {
    try {
      await settingsService.updateShippingSettings(newShipping);
    } catch (err) {
      console.error('Error persisting shipping settings:', err);
    }
  };

  // Helper para persistir payment settings
  const persistPaymentSettings = async (newPayment: PaymentSettings): Promise<void> => {
    try {
      await settingsService.updateFrontendPaymentSettings(newPayment);
    } catch (err) {
      console.error('Error persisting payment settings:', err);
      throw err; // Propagar el error para que el llamador pueda manejarlo
    }
  };

  // Helper para persistir home settings
  const persistHomeSettings = async (newHome: HomeSettings): Promise<void> => {
    try {
      await settingsService.updateHomeSettings(newHome);
    } catch (err) {
      console.error('Error persisting home settings:', err);
      throw err; // Propagar el error para que el llamador pueda manejarlo
    }
  };

  // Zonas de envío
  const addShippingZone = async (zone: Omit<ShippingZone, 'id'>): Promise<void> => {
    const newZoneId = `zone-${Date.now()}`;
    const newZone: ShippingZone = {
      ...zone,
      id: newZoneId,
    };

    const defaultRate: CarrierZoneRate = {
      zoneId: newZoneId,
      baseCost: 15000,
      costPerKg: 2000,
      estimatedDays: { min: 3, max: 6 },
    };

    const newShipping = {
      ...settings.shipping,
      zones: [...settings.shipping.zones, newZone],
      carriers: settings.shipping.carriers.map((carrier) => ({
        ...carrier,
        zoneRates: [...carrier.zoneRates, defaultRate],
      })),
    };

    setSettings((prev) => ({ ...prev, shipping: newShipping, updatedAt: new Date() }));
    await persistShippingSettings(newShipping);
  };

  const updateShippingZone = async (id: string, data: Partial<ShippingZone>): Promise<void> => {
    const newShipping = {
      ...settings.shipping,
      zones: settings.shipping.zones.map((zone) =>
        zone.id === id ? { ...zone, ...data } : zone
      ),
    };

    setSettings((prev) => ({ ...prev, shipping: newShipping, updatedAt: new Date() }));
    await persistShippingSettings(newShipping);
  };

  const deleteShippingZone = async (id: string): Promise<void> => {
    const newShipping = {
      ...settings.shipping,
      zones: settings.shipping.zones.filter((zone) => zone.id !== id),
      carriers: settings.shipping.carriers.map((carrier) => ({
        ...carrier,
        zoneRates: carrier.zoneRates.filter((rate) => rate.zoneId !== id),
      })),
    };

    setSettings((prev) => ({ ...prev, shipping: newShipping, updatedAt: new Date() }));
    await persistShippingSettings(newShipping);
  };

  // Transportadoras
  const addCarrier = async (carrier: Omit<ShippingCarrier, 'id'>): Promise<void> => {
    const newCarrier: ShippingCarrier = {
      ...carrier,
      id: `carrier-${Date.now()}`,
    };
    const newShipping = {
      ...settings.shipping,
      carriers: [...settings.shipping.carriers, newCarrier],
    };

    setSettings((prev) => ({ ...prev, shipping: newShipping, updatedAt: new Date() }));
    await persistShippingSettings(newShipping);
  };

  const updateCarrier = async (id: string, data: Partial<ShippingCarrier>): Promise<void> => {
    const newShipping = {
      ...settings.shipping,
      carriers: settings.shipping.carriers.map((carrier) =>
        carrier.id === id ? { ...carrier, ...data } : carrier
      ),
    };

    setSettings((prev) => ({ ...prev, shipping: newShipping, updatedAt: new Date() }));
    await persistShippingSettings(newShipping);
  };

  const deleteCarrier = async (id: string): Promise<void> => {
    const newShipping = {
      ...settings.shipping,
      carriers: settings.shipping.carriers.filter((carrier) => carrier.id !== id),
      defaultCarrierId:
        settings.shipping.defaultCarrierId === id ? undefined : settings.shipping.defaultCarrierId,
    };

    setSettings((prev) => ({ ...prev, shipping: newShipping, updatedAt: new Date() }));
    await persistShippingSettings(newShipping);
  };

  // Tarifas de transportadora por zona
  const updateCarrierZoneRate = async (carrierId: string, zoneId: string, data: Partial<CarrierZoneRate>): Promise<void> => {
    const newShipping = {
      ...settings.shipping,
      carriers: settings.shipping.carriers.map((carrier) => {
        if (carrier.id !== carrierId) return carrier;
        return {
          ...carrier,
          zoneRates: carrier.zoneRates.map((rate) =>
            rate.zoneId === zoneId ? { ...rate, ...data } : rate
          ),
        };
      }),
    };

    setSettings((prev) => ({ ...prev, shipping: newShipping, updatedAt: new Date() }));
    await persistShippingSettings(newShipping);
  };

  const addCarrierZoneRate = async (carrierId: string, rate: CarrierZoneRate): Promise<void> => {
    const newShipping = {
      ...settings.shipping,
      carriers: settings.shipping.carriers.map((carrier) => {
        if (carrier.id !== carrierId) return carrier;
        if (carrier.zoneRates.some((r) => r.zoneId === rate.zoneId)) return carrier;
        return {
          ...carrier,
          zoneRates: [...carrier.zoneRates, rate],
        };
      }),
    };

    setSettings((prev) => ({ ...prev, shipping: newShipping, updatedAt: new Date() }));
    await persistShippingSettings(newShipping);
  };

  const deleteCarrierZoneRate = async (carrierId: string, zoneId: string): Promise<void> => {
    const newShipping = {
      ...settings.shipping,
      carriers: settings.shipping.carriers.map((carrier) => {
        if (carrier.id !== carrierId) return carrier;
        return {
          ...carrier,
          zoneRates: carrier.zoneRates.filter((rate) => rate.zoneId !== zoneId),
        };
      }),
    };

    setSettings((prev) => ({ ...prev, shipping: newShipping, updatedAt: new Date() }));
    await persistShippingSettings(newShipping);
  };

  // Métodos de pago
  const addPaymentMethod = async (method: Omit<PaymentMethodConfig, 'id'>): Promise<void> => {
    const newMethod: PaymentMethodConfig = {
      ...method,
      id: `pm-${Date.now()}`,
    };
    const currentPayment = settings.payment || { taxEnabled: false, taxRate: 0, taxIncluded: false, methods: [] };
    const newPayment = {
      ...currentPayment,
      methods: [...(currentPayment.methods || []), newMethod],
    };

    setSettings((prev) => ({ ...prev, payment: newPayment, updatedAt: new Date() }));
    await persistPaymentSettings(newPayment);
  };

  const updatePaymentMethod = async (id: string, data: Partial<PaymentMethodConfig>): Promise<void> => {
    const currentPayment = settings.payment || { taxEnabled: false, taxRate: 0, taxIncluded: false, methods: [] };
    const newPayment = {
      ...currentPayment,
      methods: (currentPayment.methods || []).map((method) =>
        method.id === id ? { ...method, ...data } : method
      ),
    };

    setSettings((prev) => ({ ...prev, payment: newPayment, updatedAt: new Date() }));
    await persistPaymentSettings(newPayment);
  };

  const deletePaymentMethod = async (id: string): Promise<void> => {
    const currentPayment = settings.payment || { taxEnabled: false, taxRate: 0, taxIncluded: false, methods: [] };
    const newPayment = {
      ...currentPayment,
      methods: (currentPayment.methods || []).filter((method) => method.id !== id),
    };

    setSettings((prev) => ({ ...prev, payment: newPayment, updatedAt: new Date() }));
    await persistPaymentSettings(newPayment);
  };

  const togglePaymentMethod = async (id: string): Promise<void> => {
    const currentPayment = settings.payment || { taxEnabled: false, taxRate: 0, taxIncluded: false, methods: [] };
    const newPayment = {
      ...currentPayment,
      methods: (currentPayment.methods || []).map((method) =>
        method.id === id ? { ...method, isActive: !method.isActive } : method
      ),
    };

    setSettings((prev) => ({ ...prev, payment: newPayment, updatedAt: new Date() }));
    await persistPaymentSettings(newPayment);
  };

  // Home settings
  const updateHomeSettings = async (data: Partial<HomeSettings>): Promise<void> => {
    const newHome = { ...settings.home, ...data };

    try {
      await settingsService.updateHomeSettings(newHome);
      // Solo actualizar el estado local si la persistencia fue exitosa
      setSettings((prev) => ({ ...prev, home: newHome, updatedAt: new Date() }));
    } catch (err) {
      console.error('Error persisting home settings:', err);
      throw err; // Propagar el error para que el componente pueda mostrarlo
    }
  };

  // Catalog settings
  const updateCatalogSettings = async (data: Partial<CatalogSettings>): Promise<void> => {
    const newCatalog = {
      ...settings.catalog,
      ...data,
      filters: data.filters
        ? { ...settings.catalog.filters, ...data.filters }
        : settings.catalog.filters,
    };

    try {
      await settingsService.updateCatalogSettings(newCatalog);
      setSettings((prev) => ({ ...prev, catalog: newCatalog, updatedAt: new Date() }));
    } catch (err) {
      console.error('Error updating catalog settings:', err);
      setSettings((prev) => ({ ...prev, catalog: newCatalog, updatedAt: new Date() }));
    }
  };

  // Features
  const addFeature = async (feature: Omit<FeatureCard, 'id'>): Promise<void> => {
    const newFeature: FeatureCard = {
      ...feature,
      id: `feature-${Date.now()}`,
    };
    const newHome = {
      ...settings.home,
      features: [...settings.home.features, newFeature],
    };

    setSettings((prev) => ({ ...prev, home: newHome, updatedAt: new Date() }));
    await persistHomeSettings(newHome);
  };

  const updateFeature = async (id: string, data: Partial<FeatureCard>): Promise<void> => {
    const newHome = {
      ...settings.home,
      features: settings.home.features.map((f) =>
        f.id === id ? { ...f, ...data } : f
      ),
    };

    setSettings((prev) => ({ ...prev, home: newHome, updatedAt: new Date() }));
    await persistHomeSettings(newHome);
  };

  const deleteFeature = async (id: string): Promise<void> => {
    const newHome = {
      ...settings.home,
      features: settings.home.features.filter((f) => f.id !== id),
    };

    setSettings((prev) => ({ ...prev, home: newHome, updatedAt: new Date() }));
    await persistHomeSettings(newHome);
  };

  // Product sections
  const addProductSection = async (section: Omit<ProductSection, 'id'>): Promise<void> => {
    const newSection: ProductSection = {
      ...section,
      id: `section-${Date.now()}`,
    };
    const newHome = {
      ...settings.home,
      productSections: [...settings.home.productSections, newSection],
    };

    setSettings((prev) => ({ ...prev, home: newHome, updatedAt: new Date() }));
    await persistHomeSettings(newHome);
  };

  const updateProductSection = async (id: string, data: Partial<ProductSection>): Promise<void> => {
    const newHome = {
      ...settings.home,
      productSections: settings.home.productSections.map((s) =>
        s.id === id ? { ...s, ...data } : s
      ),
    };

    setSettings((prev) => ({ ...prev, home: newHome, updatedAt: new Date() }));
    await persistHomeSettings(newHome);
  };

  const deleteProductSection = async (id: string): Promise<void> => {
    const newHome = {
      ...settings.home,
      productSections: settings.home.productSections.filter((s) => s.id !== id),
    };

    setSettings((prev) => ({ ...prev, home: newHome, updatedAt: new Date() }));
    await persistHomeSettings(newHome);
  };

  // WhatsApp button
  const updateWhatsAppButton = async (data: Partial<WhatsAppButtonSettings>): Promise<void> => {
    const newHome = {
      ...settings.home,
      whatsappButton: { ...settings.home.whatsappButton, ...data },
    };

    setSettings((prev) => ({ ...prev, home: newHome, updatedAt: new Date() }));
    await persistHomeSettings(newHome);
  };

  return (
    <SettingsContext.Provider
      value={{
        settings,
        isLoading,
        error,
        updateGeneralSettings,
        updateAppearanceSettings,
        updateShippingSettings,
        updatePaymentSettings,
        updateLegalPage,
        addShippingZone,
        updateShippingZone,
        deleteShippingZone,
        addCarrier,
        updateCarrier,
        deleteCarrier,
        updateCarrierZoneRate,
        addCarrierZoneRate,
        deleteCarrierZoneRate,
        addPaymentMethod,
        updatePaymentMethod,
        deletePaymentMethod,
        togglePaymentMethod,
        updateHomeSettings,
        updateCatalogSettings,
        addFeature,
        updateFeature,
        deleteFeature,
        addProductSection,
        updateProductSection,
        deleteProductSection,
        updateWhatsAppButton,
        refreshSettings,
      }}
    >
      {publicLoaded ? children : null}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};
