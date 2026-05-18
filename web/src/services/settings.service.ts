import api from './api.service';
import type {
  Settings,
  GeneralSettings,
  AppearanceSettings,
  ShippingSettings,
  PaymentSettings as FrontendPaymentSettings,
  HomeSettings,
  CatalogSettings,
  LegalSettings,
  PrintSettings,
} from '../types/settings';

export interface PublicSettings {
  store: {
    name: string;
    description?: string;
    logo?: string;
    phone?: string;
    email: string;
    socialMedia?: {
      facebook?: string;
      instagram?: string;
      twitter?: string;
      whatsapp?: string;
    };
  };
  shipping: ShippingSettings;
  tax: {
    rate: number;
  };
  paymentMethods: string[];
  general?: GeneralSettings;
  appearance?: AppearanceSettings;
  home?: HomeSettings;
  catalog?: CatalogSettings;
}

export interface StoreSettings {
  storeName: string;
  storeDescription?: string;
  storeLogo?: string;
  storeEmail: string;
  storePhone?: string;
  storeAddress?: string;
  socialMedia?: {
    facebook?: string;
    instagram?: string;
    twitter?: string;
    whatsapp?: string;
  };
}

export interface OrderSettings {
  shippingCost: number;
  freeShippingThreshold: number;
  taxRate: number;
  minOrderAmount?: number;
  maxOrderItems?: number;
}

export interface PaymentSettings {
  enabledMethods: string[];
  bankInfo?: {
    bankName?: string;
    accountType?: string;
    accountNumber?: string;
    accountHolder?: string;
  };
  nequiNumber?: string;
  daviplataNumber?: string;
}

export interface NotificationSettings {
  emailNotifications: boolean;
  orderConfirmation: boolean;
  orderStatusUpdates: boolean;
  lowStockAlerts: boolean;
  lowStockThreshold?: number;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export const settingsService = {
  // Obtener configuración pública (no requiere auth)
  async getPublicSettings(): Promise<PublicSettings> {
    const response = await api.get<PublicSettings>('/settings/public');
    if (!response.data) throw new Error('Error obteniendo configuración');
    return response.data;
  },

  // ==================== ADMIN ONLY ====================

  // Obtener toda la configuración
  async getAllSettings(): Promise<Record<string, any>> {
    const response = await api.get<Record<string, any>>('/settings');
    return response.data || {};
  },

  // Store Settings
  async getStoreSettings(): Promise<StoreSettings> {
    const response = await api.get<StoreSettings>('/settings/store/config');
    if (!response.data) throw new Error('Error obteniendo configuración de tienda');
    return response.data;
  },

  async updateStoreSettings(data: StoreSettings): Promise<StoreSettings> {
    const response = await api.put<{ value: StoreSettings }>('/settings/store/config', data);
    if (!response.data) throw new Error('Error actualizando configuración');
    return response.data.value;
  },

  // Order Settings
  async getOrderSettings(): Promise<OrderSettings> {
    const response = await api.get<OrderSettings>('/settings/orders/config');
    if (!response.data) throw new Error('Error obteniendo configuración de pedidos');
    return response.data;
  },

  async updateOrderSettings(data: OrderSettings): Promise<OrderSettings> {
    const response = await api.put<{ value: OrderSettings }>('/settings/orders/config', data);
    if (!response.data) throw new Error('Error actualizando configuración');
    return response.data.value;
  },

  // Payment Settings
  async getPaymentSettings(): Promise<PaymentSettings> {
    const response = await api.get<PaymentSettings>('/settings/payments/config');
    if (!response.data) throw new Error('Error obteniendo configuración de pagos');
    return response.data;
  },

  async updatePaymentSettings(data: PaymentSettings): Promise<PaymentSettings> {
    const response = await api.put<{ value: PaymentSettings }>('/settings/payments/config', data);
    if (!response.data) throw new Error('Error actualizando configuración');
    return response.data.value;
  },

  // Notification Settings
  async getNotificationSettings(): Promise<NotificationSettings> {
    const response = await api.get<NotificationSettings>('/settings/notifications/config');
    if (!response.data) throw new Error('Error obteniendo configuración de notificaciones');
    return response.data;
  },

  async updateNotificationSettings(data: NotificationSettings): Promise<NotificationSettings> {
    const response = await api.put<{ value: NotificationSettings }>('/settings/notifications/config', data);
    if (!response.data) throw new Error('Error actualizando configuración');
    return response.data.value;
  },

  // ==================== CONFIGURACIONES DEL FRONTEND ====================

  // General Settings
  async getGeneralSettings(): Promise<GeneralSettings> {
    const response = await api.get<GeneralSettings>('/settings/general/config');
    if (!response.data) throw new Error('Error obteniendo configuración general');
    return response.data;
  },

  async updateGeneralSettings(data: Partial<GeneralSettings>): Promise<GeneralSettings> {
    const response = await api.put<{ value: GeneralSettings }>('/settings/general/config', data);
    if (!response.data) throw new Error('Error actualizando configuración general');
    return response.data.value;
  },

  // Appearance Settings
  async getAppearanceSettings(): Promise<AppearanceSettings> {
    const response = await api.get<AppearanceSettings>('/settings/appearance/config');
    if (!response.data) throw new Error('Error obteniendo configuración de apariencia');
    return response.data;
  },

  async updateAppearanceSettings(data: Partial<AppearanceSettings>): Promise<AppearanceSettings> {
    const response = await api.put<{ value: AppearanceSettings }>('/settings/appearance/config', data);
    if (!response.data) throw new Error('Error actualizando configuración de apariencia');
    return response.data.value;
  },

  // Shipping Settings (full - con zonas y carriers)
  async getShippingSettings(): Promise<ShippingSettings> {
    const response = await api.get<ShippingSettings>('/settings/shipping/config');
    if (!response.data) throw new Error('Error obteniendo configuración de envíos');
    return response.data;
  },

  async updateShippingSettings(data: Partial<ShippingSettings>): Promise<ShippingSettings> {
    const response = await api.put<{ value: ShippingSettings }>('/settings/shipping/config', data);
    if (!response.data) throw new Error('Error actualizando configuración de envíos');
    return response.data.value;
  },

  // Payment Settings (full - con methods)
  async getFrontendPaymentSettings(): Promise<FrontendPaymentSettings> {
    const response = await api.get<FrontendPaymentSettings>('/settings/payments/config');
    if (!response.data) throw new Error('Error obteniendo configuración de pagos');
    return response.data;
  },

  async updateFrontendPaymentSettings(data: Partial<FrontendPaymentSettings>): Promise<FrontendPaymentSettings> {
    const response = await api.put<{ value: FrontendPaymentSettings }>('/settings/payments/config', data);
    if (!response.data) throw new Error('Error actualizando configuración de pagos');
    return response.data.value;
  },

  // Home Settings
  async getHomeSettings(): Promise<HomeSettings> {
    const response = await api.get<HomeSettings>('/settings/home/config');
    if (!response.data) throw new Error('Error obteniendo configuración de home');
    return response.data;
  },

  async updateHomeSettings(data: Partial<HomeSettings>): Promise<HomeSettings> {
    const response = await api.put<{ value: HomeSettings }>('/settings/home/config', data);
    if (!response.data) throw new Error('Error actualizando configuración de home');
    return response.data.value;
  },

  // Catalog Settings
  async getCatalogSettings(): Promise<CatalogSettings> {
    const response = await api.get<CatalogSettings>('/settings/catalog/config');
    if (!response.data) throw new Error('Error obteniendo configuración de catálogo');
    return response.data;
  },

  async updateCatalogSettings(data: Partial<CatalogSettings>): Promise<CatalogSettings> {
    const response = await api.put<{ value: CatalogSettings }>('/settings/catalog/config', data);
    if (!response.data) throw new Error('Error actualizando configuración de catálogo');
    return response.data.value;
  },

  // Legal Settings
  async getLegalSettings(): Promise<LegalSettings> {
    const response = await api.get<LegalSettings>('/settings/legal/config');
    if (!response.data) throw new Error('Error obteniendo configuración legal');
    return response.data;
  },

  async updateLegalSettings(data: Partial<LegalSettings>): Promise<LegalSettings> {
    const response = await api.put<{ value: LegalSettings }>('/settings/legal/config', data);
    if (!response.data) throw new Error('Error actualizando configuración legal');
    return response.data.value;
  },

  // Printing Settings
  async getPrintingSettings(): Promise<PrintSettings> {
    const response = await api.get<PrintSettings>('/settings/printing/config');
    if (!response.data) throw new Error('Error obteniendo configuración de impresión');
    return response.data;
  },

  async updatePrintingSettings(data: Partial<PrintSettings>): Promise<PrintSettings> {
    const response = await api.put<{ value: PrintSettings }>('/settings/printing/config', data);
    if (!response.data) throw new Error('Error actualizando configuración de impresión');
    return response.data.value;
  },

  // ==================== CARGAR TODAS LAS CONFIGURACIONES ====================
  async loadAllSettings(): Promise<Settings> {
    try {
      const [general, appearance, shipping, payment, home, catalog, legal] = await Promise.all([
        this.getGeneralSettings(),
        this.getAppearanceSettings(),
        this.getShippingSettings(),
        this.getFrontendPaymentSettings(),
        this.getHomeSettings(),
        this.getCatalogSettings(),
        this.getLegalSettings(),
      ]);

      return {
        general,
        appearance,
        shipping,
        payment,
        home,
        catalog,
        legal,
        updatedAt: new Date(),
        updatedBy: 'API',
      };
    } catch (error) {
      console.error('Error loading all settings:', error);
      throw error;
    }
  },
};

export default settingsService;
