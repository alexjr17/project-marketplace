import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  Package,
  ShoppingBag,
  Users,
  BarChart3,
  Settings,
  Menu,
  User,
  LogOut,
  ChevronDown,
  ChevronRight,
  Layers,
  Truck,
  FileText,
  Shield,
  UserCog,
  DollarSign,
  Key,
  Archive,
  Box,
  Palette,
  Ruler,
  Tag,
  FolderTree,
  LayoutTemplate,
  Scissors,
  Image,
  Barcode,
  LayoutGrid,
  ShoppingCart,
  Printer,
  ArrowDownUp,
  ArrowRightLeft,
  ClipboardList,
  RotateCcw,
  Building2,
  Store,
  Star,
  MapPin,
  Plug,
} from 'lucide-react';
import type { Permission } from '../../types/roles';
import AppSwitcher from '../common/AppSwitcher';

interface AdminLayoutProps {
  children: React.ReactNode;
}

// Módulos principales sin submenú
const menuItems: {
  path: string;
  icon: typeof BarChart3;
  label: string;
  exact?: boolean;
  permission?: Permission;
}[] = [
  { path: '/admin-panel', icon: BarChart3, label: 'Dashboard', exact: true, permission: 'dashboard.view' },
];

// Módulos con submenús organizados por categoría
const menuWithSubmenus: {
  id: string;
  label: string;
  icon: typeof Users;
  basePath: string;
  submenu: { path: string; label: string; icon?: typeof UserCog; permission?: Permission }[];
}[] = [
  // 1. VENTAS - Pedidos y Pagos
  {
    id: 'sales',
    label: 'Ventas',
    icon: ShoppingBag,
    basePath: '/admin-panel/orders',
    submenu: [
      { path: '/admin-panel/orders', label: 'Pedidos', icon: FileText, permission: 'orders.view' },
      { path: '/admin-panel/payments', label: 'Pagos', icon: DollarSign, permission: 'settings.payment' },
      { path: '/admin-panel/reviews', label: 'Reseñas', icon: Star, permission: 'orders.view' },
    ],
  },
  // 2. ENVÍOS - Transportadoras, zonas/tarifas, conexiones y despachos
  {
    id: 'shipping',
    label: 'Envíos',
    icon: Truck,
    basePath: '/admin-panel/shipping',
    submenu: [
      { path: '/admin-panel/shipping/carriers', label: 'Transportadoras', icon: Truck, permission: 'shipping.view' },
      { path: '/admin-panel/shipping/zones', label: 'Zonas y Tarifas', icon: MapPin, permission: 'shipping.view' },
      { path: '/admin-panel/shipping/connections', label: 'Conexiones', icon: Plug, permission: 'shipping.view' },
      { path: '/admin-panel/shipping/config', label: 'Configuración', icon: Settings, permission: 'shipping.manage' },
      { path: '/admin-panel/orders/shipping', label: 'Despachos', icon: Truck, permission: 'orders.manage' },
    ],
  },
  // 2. PUNTO DE VENTA - POS y códigos de barras
  {
    id: 'pos',
    label: 'Punto de Venta',
    icon: ShoppingCart,
    basePath: '/admin-panel/cash-registers',
    submenu: [
      { path: '/admin-panel/variants', label: 'Variantes', icon: LayoutGrid, permission: 'products.view' },
      { path: '/admin-panel/cash-registers', label: 'Cajas Registradoras', icon: DollarSign, permission: 'pos.cash_register' },
    ],
  },
  // 3. CATÁLOGO - Productos y clasificaciones
  {
    id: 'catalog',
    label: 'Catálogo',
    icon: Package,
    basePath: '/admin-panel/products',
    submenu: [
      { path: '/admin-panel/products', label: 'Productos', icon: Package, permission: 'products.view' },
      { path: '/admin-panel/templates', label: 'Plantillas/Modelos', icon: LayoutTemplate, permission: 'products.view' },
      { path: '/admin-panel/catalogs/categories', label: 'Categorías', icon: FolderTree, permission: 'catalogs.view' },
      { path: '/admin-panel/catalogs/product-types', label: 'Tipos de Producto', icon: Tag, permission: 'catalogs.view' },
      { path: '/admin-panel/catalogs/sizes', label: 'Tallas', icon: Ruler, permission: 'catalogs.view' },
      { path: '/admin-panel/catalogs/colors', label: 'Colores', icon: Palette, permission: 'catalogs.view' },
    ],
  },
  // 4. PRODUCCIÓN - Zonas y personalización
  {
    id: 'production',
    label: 'Producción',
    icon: Scissors,
    basePath: '/admin-panel/zone',
    submenu: [
      { path: '/admin-panel/zone-types', label: 'Tipos de Zona', icon: Layers, permission: 'products.view' },
      { path: '/admin-panel/design-images', label: 'Imágenes de Diseño', icon: Image, permission: 'products.view' },
    ],
  },
  // 5. INVENTARIO - Insumos y materiales
  {
    id: 'inventory',
    label: 'Inventario',
    icon: Archive,
    basePath: '/admin-panel/input',
    submenu: [
      { path: '/admin-panel/inputs', label: 'Insumos', icon: Box, permission: 'products.view' },
      { path: '/admin-panel/input-types', label: 'Tipos de Insumo', icon: Layers, permission: 'products.view' },
    ],
  },
  // 6. COMPRAS - Proveedores y órdenes de compra
  {
    id: 'purchases',
    label: 'Compras',
    icon: ClipboardList,
    basePath: '/admin-panel/suppliers',
    submenu: [
      { path: '/admin-panel/suppliers', label: 'Proveedores', icon: Building2, permission: 'inventory.view' },
      { path: '/admin-panel/purchase-orders', label: 'Órdenes de Compra', icon: ClipboardList, permission: 'inventory.view' },
      { path: '/admin-panel/purchase-returns', label: 'Devoluciones', icon: RotateCcw, permission: 'inventory.view' },
      { path: '/admin-panel/inventory-conversions', label: 'Conversiones', icon: ArrowRightLeft, permission: 'inventory.view' },
      { path: '/admin-panel/inventory-counts', label: 'Conteo Físico', icon: Archive, permission: 'inventory.view' },
      { path: '/admin-panel/inventory-movements', label: 'Movimientos', icon: ArrowDownUp, permission: 'inventory.view' },
    ],
  },
  // 7. USUARIOS - Gestión de usuarios y roles
  {
    id: 'users',
    label: 'Usuarios',
    icon: Users,
    basePath: '/admin-panel/users',
    submenu: [
      { path: '/admin-panel/users', label: 'Clientes', icon: UserCog, permission: 'users.view' },
      { path: '/admin-panel/admins', label: 'Administradores', icon: Shield, permission: 'admins.view' },
      { path: '/admin-panel/roles', label: 'Roles y Permisos', icon: Key, permission: 'roles.view' },
    ],
  },
  // 8. CONFIGURACIÓN - Ajustes del sistema
  {
    id: 'settings',
    label: 'Configuración',
    icon: Settings,
    basePath: '/admin-panel/settings',
    submenu: [
      { path: '/admin-panel/settings/general', label: 'General', permission: 'settings.general' },
      { path: '/admin-panel/settings/appearance', label: 'Apariencia', permission: 'settings.appearance' },
      { path: '/admin-panel/settings/home', label: 'Página de Inicio', permission: 'settings.home' },
      { path: '/admin-panel/settings/catalog', label: 'Catálogo', permission: 'settings.catalog' },
      { path: '/admin-panel/settings/payment', label: 'Pagos', permission: 'settings.payment' },
      { path: '/admin-panel/settings/legal', label: 'Legal', permission: 'settings.legal' },
      { path: '/admin-panel/settings/printing', label: 'Impresión', permission: 'settings.general' },
      { path: '/admin-panel/settings/label-templates', label: 'Plantillas de Etiquetas', permission: 'settings.general' },
    ],
  },
];

export const AdminLayout = ({ children }: AdminLayoutProps) => {
  const { user, role, logout, hasPermission } = useAuth();
  const location = useLocation();
  // Iniciar sidebar cerrado en móvil
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 1024);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 1024);

  // Detectar cambios de tamaño de pantalla
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      // Auto-cerrar sidebar al cambiar a móvil
      if (mobile && sidebarOpen) {
        setSidebarOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [sidebarOpen]);

  // Cerrar sidebar al navegar en móvil
  useEffect(() => {
    if (isMobile) {
      setSidebarOpen(false);
    }
  }, [location.pathname, isMobile]);

  // Filtrar menú items según permisos
  const visibleMenuItems = menuItems.filter(
    item => !item.permission || hasPermission(item.permission)
  );

  // Filtrar módulos con submenús según permisos
  const visibleModules = menuWithSubmenus
    .map(module => ({
      ...module,
      submenu: module.submenu.filter(
        sub => !sub.permission || hasPermission(sub.permission)
      ),
    }))
    .filter(module => module.submenu.length > 0);

  // Estado para cada submenú
  const [openSubmenus, setOpenSubmenus] = useState<Record<string, boolean>>({
    sales: false,
    shipping: false,
    catalog: false,
    production: false,
    inventory: false,
    purchases: false,
    users: false,
    settings: false,
  });

  const toggleSubmenu = (id: string) => {
    setOpenSubmenus((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const isActive = (path: string, exact = false) => {
    if (exact) {
      return location.pathname === path;
    }
    return location.pathname.startsWith(path);
  };

  // Verificar si algún submenú del módulo está activo
  const isModuleActive = (module: typeof menuWithSubmenus[0]) => {
    return module.submenu.some(sub => isActive(sub.path));
  };

  return (
    <div className="h-screen bg-gray-100 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 flex-shrink-0 z-40">
        <div className="flex items-center justify-between px-4 py-3">
          {/* Left: Menu Toggle + Logo */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Menu className="w-6 h-6 text-gray-600" />
            </button>

            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg">
                <Package className="w-6 h-6 text-white" />
              </div>
              <div className="hidden sm:block">
                <h1 className="text-lg font-bold text-gray-900">Panel Admin</h1>
                <p className="text-xs text-gray-500">StylePrint Marketplace</p>
              </div>
            </div>
          </div>

          {/* Right: User Menu */}
          <div className="flex items-center gap-4">
            {/* App Switcher - Solo desktop */}
            <div className="hidden lg:block">
              <AppSwitcher />
            </div>

            {/* Profile Dropdown */}
            <div className="relative">
              <button
                onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                className="flex items-center gap-2 p-2 pr-3 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
                  <span className="text-white text-sm font-bold">
                    {user?.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-gray-600 transition-transform ${
                    profileMenuOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {profileMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setProfileMenuOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-xl border border-gray-200 py-2 z-20">
                    <div className="px-4 py-3 border-b border-gray-100">
                      <p className="text-sm font-medium text-gray-900">{user?.name}</p>
                      <p className="text-xs text-gray-500 mt-1">{user?.email}</p>
                      <span className="inline-block mt-2 px-2 py-1 bg-orange-100 text-orange-700 text-xs font-medium rounded">
                        {role?.name || 'Usuario'}
                      </span>
                    </div>

                    <Link
                      to="/profile"
                      onClick={() => setProfileMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <User className="w-4 h-4" />
                      Mi Perfil
                    </Link>

                    <div className="my-2 border-t border-gray-100"></div>

                    <button
                      onClick={() => {
                        logout();
                        setProfileMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      Cerrar Sesión
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1 relative overflow-hidden">
        {/* Overlay para móvil */}
        {sidebarOpen && isMobile && (
          <div
            className="fixed inset-0 bg-black/50 z-40 lg:hidden transition-opacity duration-300"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          className={`
            fixed lg:relative inset-y-0 left-0 z-50 lg:z-30
            w-64 bg-white border-r border-gray-200 flex flex-col flex-shrink-0
            transform transition-transform duration-300 ease-in-out
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0 lg:w-0 lg:border-0 lg:overflow-hidden'}
            ${!sidebarOpen && !isMobile ? 'lg:hidden' : ''}
            ${isMobile ? 'h-full' : ''}
          `}
        >
          {/* Header del sidebar en móvil */}
          {isMobile && (
            <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg">
                  <Package className="w-5 h-5 text-white" />
                </div>
                <span className="text-lg font-bold text-gray-900">Admin</span>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ChevronRight className="w-5 h-5 text-gray-600 rotate-180" />
              </button>
            </div>
          )}

          {/* App Switcher - Mobile */}
          {isMobile && (
            <div className="p-4 border-b border-gray-200 bg-white">
              <p className="px-2 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Cambiar a
              </p>
              <div className="space-y-1">
                {/* Tienda */}
                <Link
                  to="/"
                  onClick={() => setSidebarOpen(false)}
                  className="flex items-center gap-3 px-3 py-3 hover:bg-blue-50 rounded-xl transition-colors"
                >
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Store className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <span className="font-bold text-gray-900">Tienda</span>
                    <p className="text-xs text-gray-500">Navegar tienda</p>
                  </div>
                </Link>

                {/* Punto de Venta */}
                {hasPermission('pos.access') && (
                  <Link
                    to="/pos"
                    onClick={() => setSidebarOpen(false)}
                    className="flex items-center gap-3 px-3 py-3 hover:bg-green-50 rounded-xl transition-colors"
                  >
                    <div className="p-2 bg-green-100 rounded-lg">
                      <ShoppingCart className="w-5 h-5 text-green-600" />
                    </div>
                    <div className="flex-1">
                      <span className="font-bold text-gray-900">Punto de Venta</span>
                      <p className="text-xs text-gray-500">Ventas y caja</p>
                    </div>
                  </Link>
                )}
              </div>
            </div>
          )}

          <nav className="flex-1 p-4 space-y-1 bg-white overflow-y-auto">
              {/* Menús simples sin submenú */}
              {visibleMenuItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path, item.exact);

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium text-sm transition-colors ${
                      active
                        ? 'bg-orange-50 text-orange-700'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className={`w-5 h-5 ${active ? 'text-orange-600' : 'text-gray-500'}`} />
                    {item.label}
                  </Link>
                );
              })}

              {/* Separador */}
              <div className="my-3 border-t border-gray-200"></div>

              {/* Menús con submenús */}
              {visibleModules.map((module) => {
                const Icon = module.icon;
                const moduleActive = isModuleActive(module);

                return (
                  <div key={module.id}>
                    <button
                      onClick={() => toggleSubmenu(module.id)}
                      className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-lg font-medium text-sm transition-colors ${
                        moduleActive
                          ? 'bg-orange-50 text-orange-700'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className={`w-5 h-5 ${moduleActive ? 'text-orange-600' : 'text-gray-500'}`} />
                        <span>{module.label}</span>
                      </div>
                      <ChevronRight
                        className={`w-4 h-4 transition-transform ${openSubmenus[module.id] ? 'rotate-90' : ''}`}
                      />
                    </button>

                    {openSubmenus[module.id] && (
                      <div className="ml-4 mt-1 space-y-1 border-l-2 border-gray-100 pl-2">
                        {module.submenu.map((subItem) => {
                          const subActive = isActive(subItem.path);
                          const SubIcon = subItem.icon;
                          return (
                            <Link
                              key={subItem.path}
                              to={subItem.path}
                              className={`flex items-center gap-3 px-3 py-2 rounded-lg font-medium text-sm transition-colors ${
                                subActive
                                  ? 'bg-orange-50 text-orange-700'
                                  : 'text-gray-600 hover:bg-gray-50'
                              }`}
                            >
                              {SubIcon ? (
                                <SubIcon className={`w-4 h-4 ${subActive ? 'text-orange-600' : 'text-gray-400'}`} />
                              ) : (
                                <span className="w-4 h-4 flex items-center justify-center text-xs text-gray-400">•</span>
                              )}
                              {subItem.label}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto transition-all duration-300 w-full p-6">
          {children}
        </main>
      </div>
    </div>
  );
};
