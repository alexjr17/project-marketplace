import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ShoppingCart,
  CreditCard,
  History,
  LogOut,
  DollarSign,
  User,
  Menu,
  X,
  LayoutGrid,
  Store,
  Clock,
  Users,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { usePOS } from '../../context/POSContext';
import AppSwitcher from '../common/AppSwitcher';

interface POSLayoutProps {
  children: React.ReactNode;
}

export default function POSLayout({ children }: POSLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { currentSession } = usePOS();

  // Estado para sidebar en móvil
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 1024);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 1024);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  // En escritorio el sidebar se contrae a iconos y se expande al pasar el cursor.
  const [hovered, setHovered] = useState(false);
  const expanded = isMobile || hovered;

  // Detectar cambios de tamaño de pantalla
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      if (mobile && sidebarOpen) {
        setSidebarOpen(false);
      } else if (!mobile) {
        setSidebarOpen(true);
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

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const menuItems = [
    {
      path: '/pos/sale',
      label: 'Nueva Venta',
      icon: ShoppingCart,
    },
    {
      path: '/pos/history',
      label: 'Historial',
      icon: History,
    },
    {
      path: '/pos/debts',
      label: 'Fiados',
      icon: Clock,
    },
    {
      path: '/pos/customers',
      label: 'Clientes',
      icon: Users,
    },
    {
      path: '/pos/cash',
      label: 'Caja',
      icon: DollarSign,
    },
  ];

  const isActive = (path: string, exact: boolean = false) => {
    if (exact) {
      return location.pathname === path;
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-gray-100">
      {/* Mobile Header */}
      <header className="lg:hidden bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="flex items-center justify-between px-4 py-3">
          {/* Left: Menu Toggle + Logo */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Menu className="w-6 h-6 text-gray-600" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-bold text-gray-900">POS</span>
            </div>
          </div>

          {/* Right: Session Status + User */}
          <div className="flex items-center gap-2">
            {/* Session indicator */}
            {currentSession ? (
              <div className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                Caja Activa
              </div>
            ) : (
              <div className="flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">
                <div className="w-2 h-2 bg-yellow-500 rounded-full" />
                Sin Sesión
              </div>
            )}

            {/* Profile */}
            <div className="relative">
              <button
                onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
                  <span className="text-indigo-600 text-sm font-bold">
                    {user?.name.charAt(0).toUpperCase()}
                  </span>
                </div>
              </button>

              {profileMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setProfileMenuOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl border border-gray-200 py-2 z-20">
                    <div className="px-4 py-2 border-b border-gray-100">
                      <p className="text-sm font-medium text-gray-900">{user?.name}</p>
                      <p className="text-xs text-gray-500">Cajero</p>
                    </div>
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
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

      {/* Sidebar - Desktop always visible, Mobile slide-in */}
      <>
        {/* Overlay for mobile */}
        {sidebarOpen && isMobile && (
          <div
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <aside
          onMouseEnter={() => !isMobile && setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          className={`
            fixed lg:relative inset-y-0 left-0 z-50 lg:z-auto
            w-64 ${expanded ? 'lg:w-64' : 'lg:w-20'} bg-white shadow-lg flex flex-col lg:overflow-x-hidden
            transform transition-[width,transform] duration-300 ease-in-out
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
            ${isMobile ? 'pt-0' : ''}
          `}
        >
          {/* Mobile close button */}
          {isMobile && (
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-white" />
                </div>
                <span className="text-lg font-bold text-gray-900">POS</span>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          )}

          {/* App Switcher - Mobile */}
          {isMobile && (
            <div className="p-4 border-b border-gray-200">
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

                {/* Administración - solo si no es cliente */}
                {user?.roleId !== 2 && (
                  <Link
                    to="/admin-panel"
                    onClick={() => setSidebarOpen(false)}
                    className="flex items-center gap-3 px-3 py-3 hover:bg-purple-50 rounded-xl transition-colors"
                  >
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <LayoutGrid className="w-5 h-5 text-purple-600" />
                    </div>
                    <div className="flex-1">
                      <span className="font-bold text-gray-900">Administración</span>
                      <p className="text-xs text-gray-500">Panel de administración</p>
                    </div>
                  </Link>
                )}
              </div>
            </div>
          )}

          {/* Logo - Desktop only */}
          <div className="hidden lg:block border-b border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <CreditCard className="w-6 h-6 text-white" />
              </div>
              <div className={`min-w-0 transition-opacity duration-200 ${expanded ? 'opacity-100' : 'opacity-0'}`}>
                <h1 className="text-xl font-bold text-gray-900 whitespace-nowrap">POS</h1>
                <p className="text-sm text-gray-500 whitespace-nowrap">Punto de Venta</p>
              </div>
            </div>

            {/* App Switcher (solo expandido) */}
            {expanded && (
              <div className="mt-4">
                <AppSwitcher />
              </div>
            )}
          </div>

          {/* Session Info */}
          {currentSession && (
            <div className="flex items-center gap-2.5 px-4 py-3 bg-green-50 border-b border-green-200" title="Sesión activa">
              <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse flex-shrink-0" />
              <div className={`min-w-0 transition-opacity duration-200 ${expanded ? 'opacity-100' : 'opacity-0'}`}>
                <p className="text-sm font-medium text-green-900 whitespace-nowrap">Sesión Activa</p>
                <p className="text-green-700 text-xs whitespace-nowrap truncate">
                  {currentSession.cashRegister?.name} · {currentSession.salesCount} ventas
                </p>
              </div>
            </div>
          )}

          {!currentSession && (
            <div className="flex items-center gap-2.5 px-4 py-3 bg-yellow-50 border-b border-yellow-200" title="Sin sesión de caja">
              <div className="w-2.5 h-2.5 bg-yellow-500 rounded-full flex-shrink-0" />
              <div className={`min-w-0 transition-opacity duration-200 ${expanded ? 'opacity-100' : 'opacity-0'}`}>
                <p className="text-sm font-medium text-yellow-900 whitespace-nowrap">Sin Sesión</p>
                <p className="text-yellow-700 text-xs whitespace-nowrap">Abre una sesión de caja</p>
              </div>
            </div>
          )}

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4">
            <ul className="space-y-2">
              {menuItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path, item.exact);

                return (
                  <li key={item.path}>
                    <Link
                      to={item.path}
                      onClick={() => isMobile && setSidebarOpen(false)}
                      title={!expanded ? item.label : undefined}
                      className={`
                        flex items-center gap-3 px-2.5 py-3 rounded-lg transition-colors
                        ${
                          active
                            ? 'bg-indigo-50 text-indigo-700 font-medium'
                            : 'text-gray-700 hover:bg-gray-100'
                        }
                      `}
                    >
                      <Icon className="w-5 h-5 flex-shrink-0" />
                      <span className={`whitespace-nowrap transition-opacity duration-200 ${expanded ? 'opacity-100' : 'opacity-0'}`}>
                        {item.label}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* User Info - Desktop */}
          <div className="hidden lg:block border-t border-gray-200 p-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0" title={user?.name}>
                <User className="w-5 h-5 text-gray-600" />
              </div>
              <div className={`min-w-0 flex-1 transition-opacity duration-200 ${expanded ? 'opacity-100' : 'opacity-0'}`}>
                <p className="text-sm font-medium text-gray-900 whitespace-nowrap truncate">{user?.name}</p>
                <p className="text-xs text-gray-500 whitespace-nowrap">Cajero</p>
              </div>
              <button
                onClick={handleLogout}
                className={`p-2 text-gray-500 hover:text-red-600 transition-opacity duration-200 flex-shrink-0 ${expanded ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                title="Cerrar sesión"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </aside>
      </>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto p-4 lg:p-6">{children}</div>
      </main>
    </div>
  );
}
