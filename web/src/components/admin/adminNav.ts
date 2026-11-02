/**
 * Estructura del panel de Administración: menú, pestañas de cada área y centro de Configuración.
 * Es la ÚNICA fuente de la navegación: el sidebar, las migas, las pestañas, el buscador (Ctrl+K)
 * y la página de Configuración se arman desde aquí. Para agregar un módulo: una línea en su sección.
 * Las URLs no cambian; solo cómo se agrupan.
 */
import type { LucideIcon } from 'lucide-react';
import {
  ArrowDownUp, ArrowRightLeft, BarChart3, Boxes, Building2, ClipboardCheck, ClipboardList, CreditCard, DollarSign,
  FileText, LayoutGrid, LayoutTemplate, Megaphone, Package, Palette, Receipt,
  RotateCcw, Scissors, Settings, Shield, Star, Store, Tag, Ticket, Truck, Users,
} from 'lucide-react';
import type { Permission } from '../../types/roles';

const BASE = '/admin-panel';

export interface NavTab { path: string; label: string; permission?: Permission }

export interface NavItem {
  label: string;
  icon: LucideIcon;
  /** Ruta a la que lleva el menú (la primera pestaña visible si tiene pestañas). */
  path: string;
  permission?: Permission;
  /** Coincidencia exacta (solo Resumen). */
  exact?: boolean;
  /** Sub-pantallas del área, como pestañas arriba del contenido. */
  tabs?: NavTab[];
  /** Otras rutas que pertenecen al ítem (detalle, crear…), para marcarlo activo. */
  also?: string[];
  description?: string;
}

export interface NavSection { label?: string; items: NavItem[] }

export const ADMIN_NAV: NavSection[] = [
  {
    items: [
      { label: 'Resumen', icon: BarChart3, path: `${BASE}`, exact: true, permission: 'dashboard.view' },
    ],
  },
  {
    label: 'Ventas',
    items: [
      { label: 'Pedidos', icon: FileText, path: `${BASE}/orders`, permission: 'orders.view', also: [`${BASE}/orders/`] },
      { label: 'Despachos', icon: Truck, path: `${BASE}/orders/shipping`, permission: 'shipping.dispatch' },
      { label: 'Pagos', icon: DollarSign, path: `${BASE}/payments`, permission: 'payments.view' },
    ],
  },
  {
    label: 'Catálogo',
    items: [
      { label: 'Productos', icon: Package, path: `${BASE}/products`, permission: 'products.view', also: [`${BASE}/barcodes/`] },
      { label: 'Variantes', icon: LayoutGrid, path: `${BASE}/variants`, permission: 'variants.view' },
      { label: 'Plantillas personalizables', icon: LayoutTemplate, path: `${BASE}/templates`, permission: 'templates.view', also: [`${BASE}/template-recipes`] },
      {
        label: 'Personalizador', icon: Scissors, path: `${BASE}/zone-types`,
        tabs: [
          { path: `${BASE}/zone-types`, label: 'Tipos de zona', permission: 'zone_types.view' },
          { path: `${BASE}/design-images`, label: 'Imágenes de diseño', permission: 'design_images.view' },
        ],
      },
      {
        label: 'Atributos', icon: Tag, path: `${BASE}/catalogs/categories`,
        tabs: [
          { path: `${BASE}/catalogs/categories`, label: 'Categorías', permission: 'categories.view' },
          { path: `${BASE}/catalogs/product-types`, label: 'Tipos de producto', permission: 'product_types.view' },
          { path: `${BASE}/catalogs/sizes`, label: 'Tallas', permission: 'sizes.view' },
          { path: `${BASE}/catalogs/colors`, label: 'Colores', permission: 'colors.view' },
        ],
      },
    ],
  },
  {
    label: 'Inventario',
    items: [
      {
        label: 'Insumos', icon: Boxes, path: `${BASE}/inputs`,
        tabs: [
          { path: `${BASE}/inputs`, label: 'Insumos', permission: 'inputs.view' },
          { path: `${BASE}/input-types`, label: 'Tipos de insumo', permission: 'input_types.view' },
        ],
      },
      { label: 'Movimientos', icon: ArrowDownUp, path: `${BASE}/inventory-movements`, permission: 'inventory_movements.view' },
      { label: 'Conteos físicos', icon: ClipboardCheck, path: `${BASE}/inventory-counts`, permission: 'inventory_counts.view' },
      { label: 'Conversiones', icon: ArrowRightLeft, path: `${BASE}/inventory-conversions`, permission: 'conversions.view' },
    ],
  },
  {
    label: 'Compras',
    items: [
      { label: 'Proveedores', icon: Building2, path: `${BASE}/suppliers`, permission: 'suppliers.view' },
      { label: 'Órdenes de compra', icon: ClipboardList, path: `${BASE}/purchase-orders`, permission: 'purchase_orders.view' },
      { label: 'Devoluciones', icon: RotateCcw, path: `${BASE}/purchase-returns`, permission: 'purchase_returns.view' },
    ],
  },
  {
    label: 'Clientes y marketing',
    items: [
      { label: 'Clientes', icon: Users, path: `${BASE}/users`, permission: 'users.view' },
      { label: 'Reseñas', icon: Star, path: `${BASE}/reviews`, permission: 'reviews.view' },
      { label: 'Cupones', icon: Ticket, path: `${BASE}/discounts` },
      { label: 'Anuncios', icon: Megaphone, path: `${BASE}/announcements` },
    ],
  },
];

/** Grupos del centro de Configuración (/admin-panel/settings). Cada grupo es una tarjeta. */
export const SETTINGS_NAV: NavItem[] = [
  {
    label: 'Tienda', icon: Store, path: `${BASE}/settings/general`,
    description: 'Datos del negocio, apariencia y colores de cada app, página de inicio, catálogo y textos legales.',
    tabs: [
      { path: `${BASE}/settings/general`, label: 'General', permission: 'settings.general' },
      { path: `${BASE}/settings/appearance`, label: 'Apariencia', permission: 'settings.appearance' },
      { path: `${BASE}/settings/home`, label: 'Página de inicio', permission: 'settings.home' },
      { path: `${BASE}/settings/catalog`, label: 'Catálogo', permission: 'settings.catalog' },
      { path: `${BASE}/settings/legal`, label: 'Legal', permission: 'settings.legal' },
    ],
  },
  {
    label: 'Pagos', icon: CreditCard, path: `${BASE}/settings/payment`,
    description: 'Métodos de pago de la tienda y pasarelas (Wompi, Mercado Pago, transferencias).',
    tabs: [{ path: `${BASE}/settings/payment`, label: 'Métodos de pago', permission: 'settings.payment' }],
  },
  {
    label: 'Envíos', icon: Truck, path: `${BASE}/shipping/carriers`,
    description: 'Transportadoras, zonas y tarifas, conexiones con transportadoras y origen de los envíos.',
    tabs: [
      { path: `${BASE}/shipping/carriers`, label: 'Transportadoras', permission: 'shipping.carriers' },
      { path: `${BASE}/shipping/zones`, label: 'Zonas y tarifas', permission: 'shipping.zones' },
      { path: `${BASE}/shipping/connections`, label: 'Conexiones', permission: 'shipping.connections' },
      { path: `${BASE}/shipping/config`, label: 'Configuración', permission: 'shipping.config' },
    ],
    also: [`${BASE}/settings/shipping`],
  },
  {
    label: 'Punto de venta', icon: Receipt, path: `${BASE}/cash-registers`,
    description: 'Cajas registradoras, impresión de tickets y plantillas de etiquetas de código de barras.',
    tabs: [
      { path: `${BASE}/cash-registers`, label: 'Cajas', permission: 'pos.cash_register' },
      { path: `${BASE}/settings/printing`, label: 'Impresión', permission: 'settings.printing' },
      { path: `${BASE}/settings/label-templates`, label: 'Etiquetas', permission: 'settings.label_templates' },
    ],
  },
  {
    label: 'Equipo y permisos', icon: Shield, path: `${BASE}/admins`,
    description: 'Usuarios administradores del panel y roles con sus permisos.',
    tabs: [
      { path: `${BASE}/admins`, label: 'Administradores', permission: 'admins.view' },
      { path: `${BASE}/roles`, label: 'Roles y permisos', permission: 'roles.view' },
    ],
  },
  {
    label: 'Componentes', icon: Palette, path: `${BASE}/settings/design-system`,
    description: 'Referencia del estándar de diseño: botones, formularios, imágenes, tablas y avisos.',
    tabs: [{ path: `${BASE}/settings/design-system`, label: 'Componentes', permission: 'settings.appearance' }],
  },
];

export const SETTINGS_ITEM: NavItem = { label: 'Configuración', icon: Settings, path: `${BASE}/settings` };

type Can = (p: Permission) => boolean;

/** Pestañas visibles de un ítem según permisos. */
export const visibleTabs = (item: NavItem, can: Can) => (item.tabs ?? []).filter((t) => !t.permission || can(t.permission));

/** ¿El usuario puede ver el ítem? (su permiso o alguna pestaña). */
export const canSee = (item: NavItem, can: Can) =>
  item.tabs ? visibleTabs(item, can).length > 0 : !item.permission || can(item.permission);

/** Ruta de entrada del ítem: su primera pestaña visible. */
export const entryPath = (item: NavItem, can: Can) => (item.tabs ? visibleTabs(item, can)[0]?.path ?? item.path : item.path);

const matches = (pathname: string, path: string, exact?: boolean) =>
  exact ? pathname === path : pathname === path || pathname.startsWith(path + '/');

/** Ítem activo para la ruta actual (el de coincidencia más larga), con su sección. */
export function findActive(pathname: string): { section?: string; item: NavItem; inSettings: boolean } | null {
  let best: { section?: string; item: NavItem; inSettings: boolean; len: number } | null = null;
  const consider = (item: NavItem, section: string | undefined, inSettings: boolean) => {
    const paths = [item.path, ...(item.tabs ?? []).map((t) => t.path), ...(item.also ?? [])];
    for (const p of paths) {
      const ok = p.endsWith('/') ? pathname.startsWith(p) : matches(pathname, p, item.exact);
      if (ok && (!best || p.length > best.len)) best = { section, item, inSettings, len: p.length };
    }
  };
  ADMIN_NAV.forEach((s) => s.items.forEach((i) => consider(i, s.label, false)));
  SETTINGS_NAV.forEach((i) => consider(i, 'Configuración', true));
  if (!best && matches(pathname, SETTINGS_ITEM.path)) return { item: SETTINGS_ITEM, inSettings: true };
  return best;
}

/** Pestaña activa dentro del ítem. */
export const activeTab = (item: NavItem, pathname: string) =>
  [...(item.tabs ?? [])].sort((a, b) => b.path.length - a.path.length).find((t) => matches(pathname, t.path));
