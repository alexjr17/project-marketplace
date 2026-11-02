import { describe, expect, it } from 'vitest';
import { ADMIN_NAV, SETTINGS_NAV, SETTINGS_ITEM, activeTab, canSee, entryPath, findActive, visibleTabs, type NavItem } from './adminNav';
import type { Permission } from '../../types/roles';

const can = (...perms: string[]) => (p: Permission) => perms.includes(p);
const item = (label: string): NavItem => {
  const all = [...ADMIN_NAV.flatMap((s) => s.items), ...SETTINGS_NAV];
  const found = all.find((i) => i.label === label);
  if (!found) throw new Error(`No existe el ítem ${label}`);
  return found;
};

describe('adminNav (caracterización)', () => {
  describe('visibleTabs', () => {
    it('filtra pestañas por permiso, en orden', () => {
      const atributos = item('Atributos');
      expect(visibleTabs(atributos, can('sizes.view', 'categories.view')).map((t) => t.label)).toEqual(['Categorías', 'Tallas']);
      expect(visibleTabs(atributos, can())).toEqual([]);
    });

    it('ítem sin pestañas → []', () => {
      expect(visibleTabs(item('Pedidos'), can('orders.view'))).toEqual([]);
    });
  });

  describe('canSee', () => {
    it('ítem simple: según su permiso', () => {
      expect(canSee(item('Pedidos'), can('orders.view'))).toBe(true);
      expect(canSee(item('Pedidos'), can())).toBe(false);
    });

    it('ítem con pestañas: si alguna pestaña es visible', () => {
      expect(canSee(item('Insumos'), can('input_types.view'))).toBe(true);
      expect(canSee(item('Insumos'), can('orders.view'))).toBe(false);
    });

    it('ítem sin permiso ni pestañas: siempre visible', () => {
      expect(canSee(SETTINGS_ITEM, can())).toBe(true);
    });
  });

  describe('entryPath', () => {
    it('primera pestaña visible', () => {
      expect(entryPath(item('Insumos'), can('input_types.view'))).toBe('/admin-panel/input-types');
      expect(entryPath(item('Insumos'), can('inputs.view', 'input_types.view'))).toBe('/admin-panel/inputs');
    });

    it('sin pestañas visibles: el path del ítem', () => {
      expect(entryPath(item('Insumos'), can())).toBe('/admin-panel/inputs');
    });

    it('ítem simple: su path', () => {
      expect(entryPath(item('Pagos'), can())).toBe('/admin-panel/payments');
    });
  });

  describe('findActive', () => {
    it('Resumen solo con coincidencia exacta', () => {
      expect(findActive('/admin-panel')?.item.label).toBe('Resumen');
      expect(findActive('/admin-panel/nada-que-ver')).toBeNull();
    });

    it('coincidencia más larga: /orders/shipping es Despachos, no Pedidos', () => {
      expect(findActive('/admin-panel/orders/shipping')?.item.label).toBe('Despachos');
      expect(findActive('/admin-panel/orders')?.item.label).toBe('Pedidos');
    });

    it('detalle de pedido por "also" con barra final', () => {
      const r = findActive('/admin-panel/orders/123');
      expect(r).toEqual({ section: 'Ventas', item: item('Pedidos'), inSettings: false, len: '/admin-panel/orders/'.length });
    });

    it('devuelve también la propiedad interna len', () => {
      // ACTUAL: el objeto devuelto incluye `len`, que no está en el tipo de retorno.
      expect(findActive('/admin-panel/payments')).toHaveProperty('len');
    });

    it('subrutas por prefijo con "/"', () => {
      expect(findActive('/admin-panel/products/5/edit')?.item.label).toBe('Productos');
      expect(findActive('/admin-panel/barcodes/9')?.item.label).toBe('Productos');
      expect(findActive('/admin-panel/productsX')).toBeNull();
    });

    it('pestañas de un ítem lo activan', () => {
      expect(findActive('/admin-panel/catalogs/sizes')?.item.label).toBe('Atributos');
      expect(findActive('/admin-panel/design-images')?.item.label).toBe('Personalizador');
    });

    it('rutas del centro de Configuración: inSettings y sección "Configuración"', () => {
      const r = findActive('/admin-panel/settings/payment');
      expect(r?.item.label).toBe('Pagos');
      expect(r?.inSettings).toBe(true);
      expect(r?.section).toBe('Configuración');
      expect(findActive('/admin-panel/shipping/zones')?.item.label).toBe('Envíos');
      expect(findActive('/admin-panel/settings/shipping')?.item.label).toBe('Envíos');
    });

    it('/admin-panel/settings a secas → SETTINGS_ITEM', () => {
      expect(findActive('/admin-panel/settings')).toEqual({ item: SETTINGS_ITEM, inSettings: true });
      // Una subruta de settings no listada también cae en SETTINGS_ITEM.
      expect(findActive('/admin-panel/settings/otra')).toEqual({ item: SETTINGS_ITEM, inSettings: true });
    });

    it('rutas fuera del panel → null', () => {
      expect(findActive('/')).toBeNull();
      expect(findActive('/pos')).toBeNull();
    });
  });

  describe('activeTab', () => {
    it('la pestaña de path más largo que coincide', () => {
      expect(activeTab(item('Atributos'), '/admin-panel/catalogs/colors')?.label).toBe('Colores');
      expect(activeTab(item('Insumos'), '/admin-panel/input-types')?.label).toBe('Tipos de insumo');
      expect(activeTab(item('Insumos'), '/admin-panel/inputs/3')?.label).toBe('Insumos');
      expect(activeTab(item('Pedidos'), '/admin-panel/orders')).toBeUndefined();
    });
  });
});
