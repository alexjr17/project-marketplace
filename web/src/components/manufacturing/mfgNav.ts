/**
 * Navegación de la app Fábrica: única fuente del menú lateral y de las migas.
 * Para agregar un módulo: una línea en su sección. Las URLs no cambian.
 */
import type { LucideIcon } from 'lucide-react';
import {
  BadgeCheck, Box, Boxes, Building2, CalendarRange, ClipboardList, DollarSign, FileText,
  Layers, Palette, Ruler, ShoppingCart, Tag, Truck, Users, Warehouse, Workflow,
} from 'lucide-react';
import type { Permission } from '../../types/roles';

const BASE = '/manufacturing';

export interface MfgNavItem {
  label: string;
  icon: LucideIcon;
  path: string;
  permission?: Permission;
  /** Miga para las sub-rutas con id (por defecto "Detalle"). */
  detailLabel?: string;
}

export interface MfgNavSection { label: string; items: MfgNavItem[] }

export const MFG_NAV: MfgNavSection[] = [
  {
    label: 'Producción',
    items: [
      { label: 'Órdenes de producción', icon: ClipboardList, path: `${BASE}/orders`, permission: 'manufacturing.orders.view' },
      { label: 'Referencias', icon: FileText, path: `${BASE}/references`, permission: 'manufacturing.references.view', detailLabel: 'Editar' },
    ],
  },
  {
    label: 'Pedidos y despachos',
    items: [
      { label: 'Pedidos', icon: ShoppingCart, path: `${BASE}/purchase-orders`, permission: 'manufacturing.orders.view' },
      { label: 'Despachos', icon: Truck, path: `${BASE}/dispatches`, permission: 'manufacturing.orders.view' },
      { label: 'Clientes', icon: Users, path: `${BASE}/clients`, permission: 'manufacturing.catalogs.view' },
    ],
  },
  {
    label: 'Inventario',
    items: [
      { label: 'Inventario', icon: Boxes, path: `${BASE}/inventory`, permission: 'manufacturing.orders.view' },
      { label: 'Insumos', icon: Box, path: `${BASE}/inputs`, permission: 'manufacturing.catalogs.view' },
      { label: 'Tipos de insumo', icon: Layers, path: `${BASE}/input-types`, permission: 'manufacturing.catalogs.view' },
      { label: 'Bodegas', icon: Warehouse, path: `${BASE}/warehouses`, permission: 'manufacturing.catalogs.view' },
    ],
  },
  {
    label: 'Catálogos',
    items: [
      { label: 'Marcas', icon: BadgeCheck, path: `${BASE}/brands`, permission: 'manufacturing.catalogs.view' },
      { label: 'Colecciones', icon: CalendarRange, path: `${BASE}/collections`, permission: 'manufacturing.catalogs.view' },
      { label: 'Tipos de prenda', icon: Tag, path: `${BASE}/garment-types`, permission: 'manufacturing.catalogs.view' },
      { label: 'Colores', icon: Palette, path: `${BASE}/colors`, permission: 'manufacturing.catalogs.view' },
      { label: 'Tallas', icon: Ruler, path: `${BASE}/sizes`, permission: 'manufacturing.catalogs.view' },
      { label: 'Tasa de cambio', icon: DollarSign, path: `${BASE}/exchange-rates`, permission: 'manufacturing.catalogs.view' },
    ],
  },
  {
    label: 'Configuración',
    items: [
      { label: 'Procesos', icon: Workflow, path: `${BASE}/processes`, permission: 'manufacturing.catalogs.view' },
      { label: 'Talleres', icon: Building2, path: `${BASE}/workshops`, permission: 'manufacturing.catalogs.view' },
    ],
  },
];

/** Nombre de la pantalla según la sub-ruta (para la miga final: Nuevo, Detalle…). */
const subLabel = (item: MfgNavItem, rest: string) => (rest === 'new' ? 'Nuevo' : rest ? item.detailLabel ?? 'Detalle' : '');

/** Ítem activo para la ruta actual, con su sección y la miga extra (Nuevo / Detalle). */
export function findMfgActive(pathname: string): { section: string; item: MfgNavItem; extra: string } | null {
  for (const s of MFG_NAV) {
    for (const i of s.items) {
      if (pathname === i.path) return { section: s.label, item: i, extra: '' };
      if (pathname.startsWith(i.path + '/')) return { section: s.label, item: i, extra: subLabel(i, pathname.slice(i.path.length + 1)) };
    }
  }
  return null;
}
