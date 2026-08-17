import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  Shirt,
  Layers,
  Settings,
  Menu,
  User,
  LogOut,
  ChevronDown,
  ChevronRight,
  Tag,
  Palette,
  Ruler,
  Box,
  Boxes,
  CalendarRange,
  Workflow,
  Building2,
  Warehouse,
  FileText,
  ClipboardList,
  ShoppingCart,
  Users,
  Truck,
  Store,
} from 'lucide-react';
import type { Permission } from '../../types/roles';
import AppSwitcher from '../common/AppSwitcher';

interface ManufacturingLayoutProps {
  children: React.ReactNode;
}

// Módulos con submenús (misma estructura visual que el panel Admin).
const menuWithSubmenus: {
  id: string;
  label: string;
  icon: typeof Layers;
  basePath: string;
  submenu: { path: string; label: string; icon?: typeof Tag; permission?: Permission }[];
}[] = [
  {
    id: 'production',
    label: 'Producción',
    icon: Shirt,
    basePath: '/manufacturing/orders',
    submenu: [
      { path: '/manufacturing/purchase-orders', label: 'Pedidos', icon: ShoppingCart, permission: 'manufacturing.orders.view' },
      { path: '/manufacturing/orders', label: 'Órdenes de producción', icon: ClipboardList, permission: 'manufacturing.orders.view' },
      { path: '/manufacturing/dispatches', label: 'Despachos', icon: Truck, permission: 'manufacturing.orders.view' },
      { path: '/manufacturing/references', label: 'Referencias', icon: FileText, permission: 'manufacturing.references.view' },
      { path: '/manufacturing/inventory', label: 'Inventario', icon: Boxes, permission: 'manufacturing.orders.view' },
    ],
  },
  {
    id: 'catalogs',
    label: 'Catálogos',
    icon: Layers,
    basePath: '/manufacturing/garment-types',
    submenu: [
      { path: '/manufacturing/clients', label: 'Clientes', icon: Users, permission: 'manufacturing.catalogs.view' },
      { path: '/manufacturing/collections', label: 'Colecciones', icon: CalendarRange, permission: 'manufacturing.catalogs.view' },
      { path: '/manufacturing/garment-types', label: 'Tipos de prenda', icon: Tag, permission: 'manufacturing.catalogs.view' },
      { path: '/manufacturing/colors', label: 'Colores', icon: Palette, permission: 'manufacturing.catalogs.view' },
      { path: '/manufacturing/sizes', label: 'Tallas', icon: Ruler, permission: 'manufacturing.catalogs.view' },
      { path: '/manufacturing/input-types', label: 'Tipos de insumo', icon: Boxes, permission: 'manufacturing.catalogs.view' },
      { path: '/manufacturing/inputs', label: 'Insumos', icon: Box, permission: 'manufacturing.catalogs.view' },
    ],
  },
  {
    id: 'config',
    label: 'Configuración',
    icon: Settings,
    basePath: '/manufacturing/processes',
    submenu: [
      { path: '/manufacturing/processes', label: 'Procesos', icon: Workflow, permission: 'manufacturing.catalogs.view' },
      { path: '/manufacturing/workshops', label: 'Talleres', icon: Building2, permission: 'manufacturing.catalogs.view' },
      { path: '/manufacturing/warehouses', label: 'Bodegas', icon: Warehouse, permission: 'manufacturing.catalogs.view' },
    ],
  },
];

export default function ManufacturingLayout({ children }: ManufacturingLayoutProps) {
  const location = useLocation();
  const { user, role, logout, hasPermission } = useAuth();

  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 1024);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 1024);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      setSidebarOpen(!mobile);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (isMobile) setSidebarOpen(false);
  }, [location.pathname, isMobile]);

  const visibleModules = menuWithSubmenus
    .map((module) => ({ ...module, submenu: module.submenu.filter((s) => !s.permission || hasPermission(s.permission)) }))
    .filter((module) => module.submenu.length > 0);

  const [openSubmenus, setOpenSubmenus] = useState<Record<string, boolean>>({ production: true, catalogs: false, config: false });
  const toggleSubmenu = (id: string) => setOpenSubmenus((prev) => ({ ...prev, [id]: !prev[id] }));

  const isActive = (path: string) => location.pathname.startsWith(path);
  const isModuleActive = (module: typeof menuWithSubmenus[0]) => module.submenu.some((s) => isActive(s.path));

  return (
    <div className="h-screen bg-gray-100 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 flex-shrink-0 z-40">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <Menu className="w-6 h-6 text-gray-600" />
            </button>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg">
                <Shirt className="w-6 h-6 text-white" />
              </div>
              <div className="hidden sm:block">
                <h1 className="text-lg font-bold text-gray-900">Fábrica</h1>
                <p className="text-xs text-gray-500">Producción</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden lg:block"><AppSwitcher /></div>
            <div className="relative">
              <button onClick={() => setProfileMenuOpen(!profileMenuOpen)} className="flex items-center gap-2 p-2 pr-3 hover:bg-gray-100 rounded-lg transition-colors">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
                  <span className="text-white text-sm font-bold">{user?.name.charAt(0).toUpperCase()}</span>
                </div>
                <ChevronDown className={`w-4 h-4 text-gray-600 transition-transform ${profileMenuOpen ? 'rotate-180' : ''}`} />
              </button>
              {profileMenuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setProfileMenuOpen(false)} />
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-xl border border-gray-200 py-2 z-20">
                    <div className="px-4 py-3 border-b border-gray-100">
                      <p className="text-sm font-medium text-gray-900">{user?.name}</p>
                      <p className="text-xs text-gray-500 mt-1">{user?.email}</p>
                      <span className="inline-block mt-2 px-2 py-1 bg-orange-100 text-orange-700 text-xs font-medium rounded">{role?.name || 'Usuario'}</span>
                    </div>
                    <Link to="/profile" onClick={() => setProfileMenuOpen(false)} className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                      <User className="w-4 h-4" /> Mi Perfil
                    </Link>
                    <div className="my-2 border-t border-gray-100" />
                    <button onClick={() => { logout(); setProfileMenuOpen(false); }} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors">
                      <LogOut className="w-4 h-4" /> Cerrar Sesión
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1 relative overflow-hidden">
        {sidebarOpen && isMobile && (
          <div className="fixed inset-0 bg-black/50 z-40 lg:hidden transition-opacity duration-300" onClick={() => setSidebarOpen(false)} />
        )}

        <aside
          className={`fixed lg:relative inset-y-0 left-0 z-50 lg:z-40 w-64 bg-white border-r border-gray-200 flex flex-col flex-shrink-0 transform transition-transform duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'} ${isMobile ? 'h-full' : ''}`}
        >
          {isMobile && (
            <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg"><Shirt className="w-5 h-5 text-white" /></div>
                <span className="text-lg font-bold text-gray-900">Fábrica</span>
              </div>
              <button onClick={() => setSidebarOpen(false)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <ChevronRight className="w-5 h-5 text-gray-600 rotate-180" />
              </button>
            </div>
          )}

          {/* App Switcher - Mobile */}
          {isMobile && (
            <div className="p-4 border-b border-gray-200 bg-white">
              <p className="px-2 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Cambiar a</p>
              <Link to="/" onClick={() => setSidebarOpen(false)} className="flex items-center gap-3 px-3 py-3 hover:bg-blue-50 rounded-xl transition-colors">
                <div className="p-2 bg-blue-100 rounded-lg"><Store className="w-5 h-5 text-blue-600" /></div>
                <div className="flex-1"><span className="font-bold text-gray-900">Tienda</span><p className="text-xs text-gray-500">Navegar tienda</p></div>
              </Link>
            </div>
          )}

          <nav className="flex-1 px-2 py-3 space-y-1 bg-white overflow-y-auto overflow-x-hidden">
            {visibleModules.map((module) => {
              const Icon = module.icon;
              const moduleActive = isModuleActive(module);
              return (
                <div key={module.id}>
                  <button
                    onClick={() => toggleSubmenu(module.id)}
                    className={`w-full flex items-center justify-between gap-3 px-3 py-3 rounded-lg font-medium text-sm transition-colors ${moduleActive ? 'bg-orange-50 text-orange-700' : 'text-gray-700 hover:bg-gray-50'}`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`w-5 h-5 flex-shrink-0 ${moduleActive ? 'text-orange-600' : 'text-gray-500'}`} />
                      <span className="whitespace-nowrap">{module.label}</span>
                    </div>
                    <ChevronRight className={`w-4 h-4 transition-transform ${openSubmenus[module.id] ? 'rotate-90' : ''}`} />
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
                            className={`flex items-center gap-3 px-3 py-2 rounded-lg font-medium text-sm transition-colors ${subActive ? 'bg-orange-50 text-orange-700' : 'text-gray-600 hover:bg-gray-50'}`}
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

        <main className="flex-1 overflow-y-auto transition-all duration-300 w-full p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
