import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  Package,
  ShoppingBag,
  Users,
  BarChart3,
  Settings,
  Home,
  Menu,
  User,
  LogOut,
  ChevronDown,
  ChevronRight,
  Layers,
  Truck,
  FileText
} from 'lucide-react';

interface AdminLayoutProps {
  children: React.ReactNode;
}

// Módulos principales sin submenú
const menuItems = [
  { path: '/admin-panel', icon: BarChart3, label: 'Dashboard', exact: true },
  { path: '/admin-panel/users', icon: Users, label: 'Usuarios' },
  { path: '/admin-panel/settings', icon: Settings, label: 'Configuración' },
];

// Módulos con submenús
const menuWithSubmenus = [
  {
    id: 'catalogs',
    label: 'Catálogos',
    icon: Layers,
    basePath: '/admin-panel/catalogs',
    submenu: [
      { path: '/admin-panel/products', label: 'Productos', icon: Package },
      { path: '/admin-panel/catalogs/sizes', label: 'Tallas' },
      { path: '/admin-panel/catalogs/colors', label: 'Colores' },
      { path: '/admin-panel/catalogs/product-types', label: 'Tipos de Producto' },
      { path: '/admin-panel/catalogs/categories', label: 'Categorías' },
    ],
  },
  {
    id: 'orders',
    label: 'Pedidos',
    icon: ShoppingBag,
    basePath: '/admin-panel/orders',
    submenu: [
      { path: '/admin-panel/orders', label: 'Todos los Pedidos', icon: FileText },
      { path: '/admin-panel/orders/shipping', label: 'Despacho', icon: Truck },
    ],
  },
];

export const AdminLayout = ({ children }: AdminLayoutProps) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  // Estado para cada submenú
  const [openSubmenus, setOpenSubmenus] = useState<Record<string, boolean>>({
    catalogs: false,
    orders: false,
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

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
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
            <Link
              to="/"
              className="hidden md:flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Home className="w-4 h-4" />
              <span>Ir al Sitio</span>
            </Link>

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
                        Administrador
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

      <div className="flex flex-1 relative">
        {/* Sidebar */}
        <aside
          className={`fixed lg:relative top-0 left-0 z-30 bg-white border-r border-gray-200 transition-all duration-300 ${
            sidebarOpen ? 'w-64' : 'w-0 lg:w-0'
          }`}
          style={{ height: 'calc(100vh - 64px)' }}
        >
          <div className={`w-64 h-full ${sidebarOpen ? 'block' : 'hidden'}`}>
            <nav className="p-4 space-y-1 relative z-30 bg-white h-full overflow-y-auto pb-20">
              {/* Menús simples sin submenú */}
              {menuItems.map((item) => {
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

              {/* Menús con submenús */}
              {menuWithSubmenus.map((module) => {
                const Icon = module.icon;
                const moduleActive = isActive(module.basePath) || isActive('/admin-panel/products');

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
                      <div className="ml-4 mt-1 space-y-1">
                        {module.submenu.map((subItem) => {
                          const subActive = isActive(subItem.path);
                          const SubIcon = subItem.icon;
                          return (
                            <Link
                              key={subItem.path}
                              to={subItem.path}
                              className={`flex items-center gap-3 px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                                subActive
                                  ? 'bg-orange-50 text-orange-700'
                                  : 'text-gray-600 hover:bg-gray-50'
                              }`}
                            >
                              {SubIcon ? (
                                <SubIcon className={`w-4 h-4 ${subActive ? 'text-orange-600' : 'text-gray-500'}`} />
                              ) : (
                                <span className="text-xs">•</span>
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

            {/* Sidebar Footer */}
            <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 bg-white">
              <Link
                to="/"
                className="flex items-center gap-2 px-4 py-3 text-sm text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
              >
                <Home className="w-4 h-4" />
                Volver al Sitio
              </Link>
            </div>
          </div>
        </aside>

        {/* Overlay para móvil */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/20 z-20 lg:hidden"
            style={{ marginTop: '64px' }}
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main Content */}
        <main className="flex-1 overflow-x-hidden transition-all duration-300 w-full">
          {children}
        </main>
      </div>
    </div>
  );
};
