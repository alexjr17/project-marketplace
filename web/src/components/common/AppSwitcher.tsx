import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Grid3x3, ShoppingCart, LayoutGrid, ChevronDown, MessageSquare } from 'lucide-react';

interface AppSwitcherProps {
  /** 'sidebar' = encabezado de ancho completo (icono + nombre + chevron). */
  variant?: 'default' | 'sidebar';
  /** Solo en variant 'sidebar': oculta el texto cuando el sidebar está contraído. */
  collapsed?: boolean;
}

export default function AppSwitcher({ variant = 'default', collapsed = false }: AppSwitcherProps) {
  const { user, hasPermission, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Determinar aplicación actual
  const getCurrentApp = () => {
    if (location.pathname.startsWith('/pos')) return 'pos';
    if (location.pathname.startsWith('/admin-panel')) return 'admin';
    if (location.pathname.startsWith('/messaging')) return 'messaging';
    return 'store';
  };

  const currentApp = getCurrentApp();

  // Aplicaciones disponibles según permisos
  const apps = [
    {
      id: 'store',
      name: 'Tienda',
      icon: LayoutGrid,
      path: '/',
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      available: user?.roleId === 2 || hasPermission('store.access'),
    },
    {
      id: 'pos',
      name: 'Punto de Venta',
      icon: ShoppingCart,
      path: '/pos',
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      available: hasPermission('pos.access'),
    },
    {
      id: 'admin',
      name: 'Administración',
      icon: Grid3x3,
      path: '/admin-panel',
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      available: isAdmin, // Acceso al panel admin (admin.access o módulos admin)
    },
    {
      id: 'messaging',
      name: 'Social Media',
      icon: MessageSquare,
      path: '/messaging',
      color: 'text-pink-600',
      bgColor: 'bg-pink-50',
      available: hasPermission('messaging.access'),
    },
  ].filter((app) => app.available);

  const currentAppData = apps.find((app) => app.id === currentApp);

  const isSidebar = variant === 'sidebar';
  const canSwitch = apps.length > 1;

  if (!user) return null;
  // En modo header (default) no tiene sentido si solo hay una app.
  if (!isSidebar && !canSwitch) return null;

  // Lista de aplicaciones del dropdown (reutilizada por ambas variantes).
  const appList = (
    <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
      Cambiar a
    </div>
  );
  const appButtons = apps.map((app) => {
    const Icon = app.icon;
    const isCurrent = app.id === currentApp;
    return (
      <button
        key={app.id}
        onClick={() => { navigate(app.path); setIsOpen(false); }}
        disabled={isCurrent}
        className={`w-full flex items-center space-x-3 px-4 py-3 transition-colors ${
          isCurrent ? 'bg-gray-50 cursor-not-allowed' : 'hover:bg-gray-50 cursor-pointer'
        }`}
      >
        <div className={`p-2 rounded-lg ${app.bgColor} flex-shrink-0`}>
          <Icon className={`w-5 h-5 ${app.color}`} />
        </div>
        <div className="flex-1 text-left min-w-0">
          <div className="font-medium text-gray-900 truncate">{app.name}</div>
          <div className="text-xs text-gray-500 truncate">
            {app.id === 'store' && 'Navegar tienda'}
            {app.id === 'pos' && 'Ventas y caja'}
            {app.id === 'admin' && 'Administración'}
            {app.id === 'messaging' && 'Inbox + publicaciones'}
          </div>
        </div>
        {isCurrent && (
          <div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0" title="Aplicación actual" />
        )}
      </button>
    );
  });

  // Variante sidebar: el encabezado "Punto de Venta" ES el selector.
  if (isSidebar) {
    return (
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => canSwitch && setIsOpen(!isOpen)}
          disabled={!canSwitch}
          title={canSwitch ? 'Cambiar aplicación' : undefined}
          className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors disabled:hover:bg-transparent disabled:cursor-default"
        >
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${currentAppData?.bgColor ?? 'bg-indigo-50'}`}>
            {currentAppData
              ? <currentAppData.icon className={`w-6 h-6 ${currentAppData.color}`} />
              : <ShoppingCart className="w-6 h-6 text-indigo-600" />}
          </div>
          <div className={`min-w-0 flex-1 text-left transition-opacity duration-200 ${collapsed ? 'opacity-0' : 'opacity-100'}`}>
            <p className="font-bold text-gray-900 truncate leading-tight">{currentAppData?.name ?? 'Punto de Venta'}</p>
            <p className="text-xs text-gray-500 whitespace-nowrap">{canSwitch ? 'Cambiar aplicación' : 'Punto de Venta'}</p>
          </div>
          {canSwitch && (
            <ChevronDown className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-all duration-200 ${collapsed ? 'opacity-0' : 'opacity-100'} ${isOpen ? 'rotate-180' : ''}`} />
          )}
        </button>

        {isOpen && canSwitch && (
          <div className="absolute left-0 right-0 mt-2 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
            {appList}
            {appButtons}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
        title="Cambiar aplicación"
      >
        <div className={`p-1.5 rounded ${currentAppData?.bgColor}`}>
          {currentAppData && <currentAppData.icon className={`w-5 h-5 ${currentAppData.color}`} />}
        </div>
        <span className="hidden md:block font-medium text-gray-700">
          {currentAppData?.name}
        </span>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 md:left-0 md:right-auto mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
          {appList}
          {appButtons}
        </div>
      )}
    </div>
  );
}
